import fs from 'node:fs';
import type { Request, Response } from 'express';
import { asyncHandler } from '@utils/async-handler';
import { buildPaginationMeta, sendCreated, sendSuccess } from '@utils/api-response';
import { ApiError } from '@utils/api-error';
import { resolvePrivatePath } from '@utils/private-storage';
import { getProjectAccess } from '@middlewares/project-access.middleware';
import { roleCan } from '@modules/portal/portal.permissions';
import type { AuthedRequest } from '@/types/common.types';
import { DocumentsService } from './documents.service';
import type { UploadDocumentDto } from './documents.validation';

export const DocumentsController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const access = getProjectAccess(req);
    const canSeeAdminOnly = roleCan(access.role, 'document:manage');
    const { items, total, page, limit } = await DocumentsService.list(
      access.projectId,
      req.query as never,
      canSeeAdminOnly,
    );
    return sendSuccess(res, items, 'Documents fetched', 200, buildPaginationMeta(page, limit, total));
  }),

  stats: asyncHandler(async (req: Request, res: Response) => {
    const access = getProjectAccess(req);
    const canSeeAdminOnly = roleCan(access.role, 'document:manage');
    return sendSuccess(
      res,
      await DocumentsService.stats(access.projectId, canSeeAdminOnly),
      'Document stats fetched',
    );
  }),

  upload: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    const { projectId } = getProjectAccess(req);
    if (!req.file) throw ApiError.badRequest('No file was uploaded');

    const body = req.body as UploadDocumentDto;
    const document = await DocumentsService.upload(
      projectId,
      { id: user.id, name: user.name },
      req.file,
      {
        name: body.name,
        description: body.description ?? null,
        category: body.category,
        version: body.version ?? null,
        visibility: body.visibility,
        allowDownload: body.allowDownload,
      },
    );

    return sendCreated(res, document, 'Document uploaded');
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    const { projectId } = getProjectAccess(req);
    const data = await DocumentsService.update(
      projectId,
      params.documentId,
      { id: user.id, name: user.name },
      req.body,
    );
    return sendSuccess(res, data, 'Document updated');
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    const { projectId } = getProjectAccess(req);
    await DocumentsService.remove(projectId, params.documentId, { id: user.id, name: user.name });
    return sendSuccess(res, null, 'Document deleted');
  }),

  /** Streams a private document once visibility and role have been checked. */
  download: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    const access = getProjectAccess(req);

    const document = await DocumentsService.prepareDownload(access.projectId, params.documentId, {
      id: user.id,
      canSeeAdminOnly: roleCan(access.role, 'document:manage'),
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
    });

    const absolute = resolvePrivatePath(document.storageKey);
    if (!fs.existsSync(absolute)) throw ApiError.notFound('Document file');

    res.setHeader('Content-Type', document.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${document.filename.replace(/[^\w.-]/g, '_')}"`,
    );
    fs.createReadStream(absolute).pipe(res);
  }),

  history: asyncHandler(async (req: Request, res: Response) => {
    const { params } = req as AuthedRequest;
    const { projectId } = getProjectAccess(req);
    return sendSuccess(
      res,
      await DocumentsService.downloadHistory(projectId, params.documentId),
      'Download history fetched',
    );
  }),
};

export default DocumentsController;
