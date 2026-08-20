import { DocumentCategory, DocumentVisibility, type Prisma } from '@prisma/client';
import { prisma } from '@config/database';
import { ApiError } from '@utils/api-error';
import { resolvePagination } from '@utils/pagination.util';
import { checksumPrivateFile, removePrivateFile, storageKeyFor } from '@utils/private-storage';
import { NotificationService } from '@modules/notifications/notification.service';
import { recordActivity } from '@modules/portal/portal.activity';

/** `storageKey` is never selected — downloads go through the guarded route. */
const documentSelect = {
  id: true,
  projectId: true,
  name: true,
  description: true,
  category: true,
  version: true,
  visibility: true,
  allowDownload: true,
  filename: true,
  mimeType: true,
  sizeBytes: true,
  checksum: true,
  downloadCount: true,
  createdAt: true,
  updatedAt: true,
  uploadedBy: { select: { id: true, name: true, avatarUrl: true } },
} satisfies Prisma.ProjectDocumentSelect;

export interface DocumentListQuery {
  page?: number;
  limit?: number;
  category?: DocumentCategory;
  search?: string;
}

export const DocumentsService = {
  /**
   * Lists documents.
   *
   * `canSeeAdminOnly` comes from the caller's role, so an ADMIN_ONLY contract
   * is filtered out of the query itself rather than hidden by the UI — a client
   * calling the API directly gets the same answer as one using the portal.
   */
  async list(projectId: string, query: DocumentListQuery, canSeeAdminOnly: boolean) {
    const pagination = resolvePagination(query, { defaultLimit: 50 });

    const where: Prisma.ProjectDocumentWhereInput = {
      projectId,
      ...(canSeeAdminOnly ? {} : { visibility: DocumentVisibility.CLIENT_VISIBLE }),
      ...(query.category ? { category: query.category } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
              { filename: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.projectDocument.findMany({
        where,
        select: documentSelect,
        orderBy: [{ category: 'asc' }, { createdAt: 'desc' }],
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.projectDocument.count({ where }),
    ]);

    return { items, total, page: pagination.page, limit: pagination.limit };
  },

  async upload(
    projectId: string,
    uploader: { id: string; name: string },
    file: Express.Multer.File,
    meta: {
      name?: string;
      description?: string | null;
      category: DocumentCategory;
      version?: string | null;
      visibility: DocumentVisibility;
      allowDownload: boolean;
    },
  ) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, title: true },
    });
    if (!project) throw ApiError.notFound('Project');

    const storageKey = storageKeyFor('documents', projectId, file.filename);
    // Recorded so a client can verify the file they downloaded is intact.
    const checksum = await checksumPrivateFile(storageKey).catch(() => null);

    const document = await prisma.projectDocument.create({
      data: {
        projectId,
        name: meta.name?.trim() || file.originalname,
        description: meta.description ?? null,
        category: meta.category,
        version: meta.version ?? null,
        visibility: meta.visibility,
        allowDownload: meta.allowDownload,
        storageKey,
        filename: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        checksum,
        uploadedById: uploader.id,
      },
      select: documentSelect,
    });

    await recordActivity({
      projectId,
      actorId: uploader.id,
      action: 'document.uploaded',
      entityType: 'ProjectDocument',
      entityId: document.id,
      summary: `${uploader.name} uploaded "${document.name}"`,
      // Admin-only files shouldn't even appear in the client's timeline.
      isInternal: meta.visibility === DocumentVisibility.ADMIN_ONLY,
    });

    if (meta.visibility === DocumentVisibility.CLIENT_VISIBLE) {
      NotificationService.emitAsync({
        event: 'delivery.documents_uploaded',
        audience: { projectId, include: ['client'] },
        context: { projectName: project.title, count: '1' },
        projectId,
        link: `/portal/projects/${projectId}/documents`,
      });
    }

    return document;
  },

  async update(
    projectId: string,
    documentId: string,
    actor: { id: string; name: string },
    patch: {
      name?: string;
      description?: string | null;
      category?: DocumentCategory;
      version?: string | null;
      visibility?: DocumentVisibility;
      allowDownload?: boolean;
    },
  ) {
    const existing = await prisma.projectDocument.findFirst({
      where: { id: documentId, projectId },
      select: { id: true, name: true, visibility: true },
    });
    if (!existing) throw ApiError.notFound('Document');

    const document = await prisma.projectDocument.update({
      where: { id: documentId },
      data: patch,
      select: documentSelect,
    });

    if (patch.visibility && patch.visibility !== existing.visibility) {
      await recordActivity({
        projectId,
        actorId: actor.id,
        action: 'document.updated',
        entityType: 'ProjectDocument',
        entityId: documentId,
        summary:
          patch.visibility === DocumentVisibility.CLIENT_VISIBLE
            ? `"${document.name}" was shared with the client`
            : `"${document.name}" was made internal-only`,
        field: 'visibility',
        oldValue: existing.visibility,
        newValue: patch.visibility,
      });
    }

    return document;
  },

  async remove(projectId: string, documentId: string, actor: { id: string; name: string }) {
    const document = await prisma.projectDocument.findFirst({
      where: { id: documentId, projectId },
      select: { id: true, name: true, storageKey: true, visibility: true },
    });
    if (!document) throw ApiError.notFound('Document');

    // The row goes first: an orphaned file on disk is harmless, a row pointing
    // at a missing file breaks every download attempt.
    await prisma.projectDocument.delete({ where: { id: documentId } });
    try {
      removePrivateFile(document.storageKey);
    } catch {
      // Already gone, or unreadable — nothing references it now either way.
    }

    await recordActivity({
      projectId,
      actorId: actor.id,
      action: 'document.deleted',
      entityType: 'ProjectDocument',
      entityId: documentId,
      summary: `${actor.name} deleted "${document.name}"`,
      isInternal: document.visibility === DocumentVisibility.ADMIN_ONLY,
    });
  },

  /**
   * Resolves a document for download, enforcing both visibility and the
   * download flag, then records who took a copy.
   */
  async prepareDownload(
    projectId: string,
    documentId: string,
    reader: { id: string; canSeeAdminOnly: boolean; ipAddress?: string; userAgent?: string },
  ) {
    const document = await prisma.projectDocument.findFirst({
      where: { id: documentId, projectId },
      select: {
        id: true, name: true, storageKey: true, filename: true, mimeType: true,
        visibility: true, allowDownload: true,
      },
    });
    if (!document) throw ApiError.notFound('Document');

    if (document.visibility === DocumentVisibility.ADMIN_ONLY && !reader.canSeeAdminOnly) {
      // 404 rather than 403 — confirming it exists tells a client there is a
      // document they aren't allowed to see.
      throw ApiError.notFound('Document');
    }

    if (!document.allowDownload && !reader.canSeeAdminOnly) {
      throw ApiError.forbidden('This document is view-only');
    }

    await prisma.$transaction([
      prisma.projectDocument.update({
        where: { id: documentId },
        data: { downloadCount: { increment: 1 } },
      }),
      prisma.documentDownload.create({
        data: {
          documentId,
          userId: reader.id,
          ipAddress: reader.ipAddress ?? null,
          userAgent: reader.userAgent ?? null,
        },
      }),
    ]);

    return document;
  },

  /** Download audit for one document — who took a copy, and when. */
  downloadHistory: (projectId: string, documentId: string) =>
    prisma.documentDownload.findMany({
      where: { documentId, document: { projectId } },
      include: { user: { select: { id: true, name: true, email: true, userType: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),

  async stats(projectId: string, canSeeAdminOnly: boolean) {
    const where: Prisma.ProjectDocumentWhereInput = {
      projectId,
      ...(canSeeAdminOnly ? {} : { visibility: DocumentVisibility.CLIENT_VISIBLE }),
    };

    const [total, byCategory, size] = await Promise.all([
      prisma.projectDocument.count({ where }),
      prisma.projectDocument.groupBy({ by: ['category'], where, _count: { _all: true } }),
      prisma.projectDocument.aggregate({ where, _sum: { sizeBytes: true } }),
    ]);

    return {
      total,
      totalBytes: size._sum.sizeBytes ?? 0,
      byCategory: byCategory.map((row) => ({ category: row.category, count: row._count._all })),
    };
  },
};

export default DocumentsService;
