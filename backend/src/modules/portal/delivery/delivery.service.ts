import {
  BugPriority,
  BugSeverity,
  DocumentVisibility,
  HandoverStatus,
  Prisma,
  ProjectDeliveryStatus,
  SourceCodeMethod,
} from '@prisma/client';
import { prisma } from '@config/database';
import { logger } from '@config/logger';
import { ApiError } from '@utils/api-error';
import { formatCurrency, toNumber } from '@utils/money.util';
import { checksumPrivateFile, removePrivateFile, storageKeyFor, privateFileSize } from '@utils/private-storage';
import { NotificationService } from '@modules/notifications/notification.service';
import { recordActivity } from '@modules/portal/portal.activity';
import { OPEN_STATUSES } from '@modules/portal/bugs/bugs.lifecycle';
import {
  DEFAULT_CHECKLIST,
  DELIVERY_STATUS_LABELS,
  canAdvance,
  type ReadinessCheck,
} from './delivery.constants';

const deliveryInclude = {
  checklist: { orderBy: { sortOrder: 'asc' } },
  versions: {
    include: { publishedBy: { select: { id: true, name: true } } },
    orderBy: { publishedAt: 'desc' },
  },
  adminConfirmedBy: { select: { id: true, name: true } },
  clientConfirmedBy: { select: { id: true, name: true } },
} as const;

export const DeliveryService = {
  /**
   * Loads the delivery record, creating it with the default checklist on first
   * access. Lazy creation keeps every existing project working without a
   * backfill migration.
   */
  async ensure(projectId: string) {
    const existing = await prisma.projectDelivery.findUnique({
      where: { projectId },
      include: deliveryInclude,
    });
    if (existing) return existing;

    try {
      await prisma.projectDelivery.create({
        data: {
          projectId,
          checklist: {
            create: DEFAULT_CHECKLIST.map((item) => ({
              key: item.key,
              label: item.label,
              isRequired: item.isRequired,
              sortOrder: item.sortOrder,
            })),
          },
        },
      });
    } catch (error) {
      /*
       * find-then-create is a race: two concurrent callers both see nothing and
       * both insert. `projectId` is unique, so the loser gets P2002 — which
       * means the record now exists, which is exactly what was wanted. Any
       * other error is real and rethrown.
       */
      const isUniqueViolation =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
      if (!isUniqueViolation) throw error;
    }

    return prisma.projectDelivery.findUniqueOrThrow({
      where: { projectId },
      include: deliveryInclude,
    });
  },

  /**
   * Evaluates whether the project is genuinely ready to hand over.
   *
   * The spec is explicit that an admin should not be able to mark a project
   * delivered while critical bugs are open or the final invoice is unpaid, so
   * these are computed from live data rather than trusted to a checkbox.
   */
  async readiness(projectId: string): Promise<{
    checks: ReadinessCheck[];
    isReady: boolean;
    blockers: number;
  }> {
    const delivery = await this.ensure(projectId);

    const [criticalOpen, requiredChecklist, docCount, outstanding] = await Promise.all([
      prisma.bug.count({
        where: {
          projectId,
          status: { in: OPEN_STATUSES },
          OR: [{ priority: BugPriority.CRITICAL }, { severity: BugSeverity.BLOCKER }],
        },
      }),
      prisma.deliveryChecklistItem.findMany({
        where: { deliveryId: delivery.id, isRequired: true },
        select: { key: true, label: true, isComplete: true },
      }),
      prisma.projectDocument.count({
        where: { projectId, visibility: DocumentVisibility.CLIENT_VISIBLE },
      }),
      prisma.invoice.aggregate({
        where: {
          projectId,
          deletedAt: null,
          status: { in: ['SENT', 'VIEWED', 'PARTIALLY_PAID', 'OVERDUE'] },
        },
        _sum: { balanceDue: true },
        _count: { _all: true },
      }),
    ]);

    const outstandingAmount = toNumber(outstanding._sum.balanceDue);
    const incompleteRequired = requiredChecklist.filter((item) => !item.isComplete);

    const hasSource =
      (delivery.sourceCodeMethod === SourceCodeMethod.GITHUB && Boolean(delivery.githubRepoUrl)) ||
      (delivery.sourceCodeMethod === SourceCodeMethod.ZIP && Boolean(delivery.zipStorageKey));

    const checks: ReadinessCheck[] = [
      {
        key: 'critical_bugs',
        label: 'Critical issues resolved',
        passed: criticalOpen === 0,
        detail: criticalOpen === 0 ? 'No open critical issues' : `${criticalOpen} still open`,
        blocking: true,
      },
      {
        key: 'final_payment',
        label: 'Payments settled',
        passed: outstandingAmount <= 0.01,
        detail:
          outstandingAmount <= 0.01
            ? 'Nothing outstanding'
            : `${formatCurrency(outstandingAmount)} across ${outstanding._count._all} invoice(s)`,
        blocking: true,
      },
      {
        key: 'source_code',
        label: 'Source code prepared',
        passed: hasSource,
        detail: hasSource
          ? delivery.sourceCodeMethod === SourceCodeMethod.GITHUB
            ? 'GitHub repository recorded'
            : 'Archive uploaded'
          : 'No source-code handover method chosen yet',
        blocking: true,
      },
      {
        key: 'documents',
        label: 'Documents shared with the client',
        passed: docCount > 0,
        detail: docCount > 0 ? `${docCount} document(s) shared` : 'None shared yet',
        blocking: true,
      },
      {
        key: 'checklist',
        label: 'Handover checklist complete',
        passed: incompleteRequired.length === 0,
        detail:
          incompleteRequired.length === 0
            ? 'All required items ticked'
            : `${incompleteRequired.length} item(s) outstanding`,
        blocking: true,
      },
      {
        key: 'client_confirmation',
        label: 'Client confirmed receipt',
        passed: Boolean(delivery.clientConfirmedAt),
        detail: delivery.clientConfirmedAt
          ? 'Confirmed by the client'
          : 'Waiting on the client to confirm',
        blocking: false,
      },
    ];

    const blockers = checks.filter((check) => check.blocking && !check.passed).length;
    return { checks, isReady: blockers === 0, blockers };
  },

  async get(projectId: string) {
    // Sequential on purpose: `readiness` also calls `ensure`, and running both
    // concurrently on a project with no delivery row raced to create it.
    const delivery = await this.ensure(projectId);
    const readiness = await this.readiness(projectId);

    const { zipStorageKey, ...safe } = delivery;

    return {
      ...safe,
      statusLabel: DELIVERY_STATUS_LABELS[delivery.status],
      hasArchive: Boolean(zipStorageKey),
      readiness,
    };
  },

  async setStatus(
    projectId: string,
    status: ProjectDeliveryStatus,
    actor: { id: string; name: string },
  ) {
    const delivery = await this.ensure(projectId);
    const project = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { title: true },
    });

    if (!canAdvance(delivery.status, status)) {
      throw ApiError.badRequest(
        `Delivery cannot move from ${DELIVERY_STATUS_LABELS[delivery.status]} to ${DELIVERY_STATUS_LABELS[status]}`,
      );
    }

    // The two gates that actually protect the handover.
    if (status === ProjectDeliveryStatus.DELIVERED) {
      const readiness = await this.readiness(projectId);
      if (!readiness.isReady) {
        const failing = readiness.checks.filter((c) => c.blocking && !c.passed).map((c) => c.label);
        throw ApiError.badRequest(
          `This project is not ready for delivery. Outstanding: ${failing.join(', ')}`,
        );
      }
      if (!delivery.clientConfirmedAt) {
        throw ApiError.badRequest(
          'The client has not confirmed the handover yet. Wait for their confirmation.',
        );
      }
    }

    const updated = await prisma.projectDelivery.update({
      where: { projectId },
      data: {
        status,
        ...(status === ProjectDeliveryStatus.DELIVERED ? { deliveredAt: new Date() } : {}),
      },
      include: deliveryInclude,
    });

    await recordActivity({
      projectId,
      actorId: actor.id,
      action: status === ProjectDeliveryStatus.DELIVERED ? 'delivery.completed' : 'delivery.status_changed',
      entityType: 'ProjectDelivery',
      entityId: delivery.id,
      summary: `Delivery moved to ${DELIVERY_STATUS_LABELS[status]}`,
      field: 'status',
      oldValue: delivery.status,
      newValue: status,
    });

    const EVENT_BY_STATUS: Partial<Record<ProjectDeliveryStatus, 'delivery.started' | 'delivery.ready' | 'delivery.ownership_initiated' | 'delivery.completed'>> = {
      [ProjectDeliveryStatus.PREPARING]: 'delivery.started',
      [ProjectDeliveryStatus.READY_FOR_CLIENT]: 'delivery.ready',
      [ProjectDeliveryStatus.OWNERSHIP_TRANSFER]: 'delivery.ownership_initiated',
      [ProjectDeliveryStatus.DELIVERED]: 'delivery.completed',
    };

    const event = EVENT_BY_STATUS[status];
    if (event) {
      NotificationService.emitAsync({
        event,
        audience: { projectId, include: ['client'] },
        context: {
          projectName: project.title,
          version: updated.version ?? '',
          status: DELIVERY_STATUS_LABELS[status],
        },
        projectId,
        link: `/portal/projects/${projectId}/delivery`,
      });
    }

    return this.get(projectId);
  },

  async toggleChecklistItem(
    projectId: string,
    itemId: string,
    isComplete: boolean,
    actor: { id: string; name: string },
    note?: string | null,
  ) {
    const delivery = await this.ensure(projectId);

    const item = await prisma.deliveryChecklistItem.findFirst({
      where: { id: itemId, deliveryId: delivery.id },
    });
    if (!item) throw ApiError.notFound('Checklist item');

    await prisma.deliveryChecklistItem.update({
      where: { id: itemId },
      data: {
        isComplete,
        completedAt: isComplete ? new Date() : null,
        completedById: isComplete ? actor.id : null,
        note: note ?? item.note,
      },
    });

    await recordActivity({
      projectId,
      actorId: actor.id,
      action: 'delivery.checklist_updated',
      entityType: 'DeliveryChecklistItem',
      entityId: itemId,
      summary: `${isComplete ? 'Completed' : 'Reopened'} "${item.label}"`,
      isInternal: true,
    });

    return this.get(projectId);
  },

  /**
   * Records the GitHub repository the client wants the code transferred to.
   * Submitted by the client, which is why it moves the handover to
   * "details submitted" rather than straight to transferred.
   */
  async submitGithubDetails(
    projectId: string,
    actor: { id: string; name: string },
    details: { githubUsername: string; githubRepoUrl: string },
  ) {
    await this.ensure(projectId);
    const project = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { title: true },
    });

    await prisma.projectDelivery.update({
      where: { projectId },
      data: {
        sourceCodeMethod: SourceCodeMethod.GITHUB,
        githubUsername: details.githubUsername,
        githubRepoUrl: details.githubRepoUrl,
        githubOwner: details.githubUsername,
        handoverStatus: HandoverStatus.CLIENT_DETAILS_SUBMITTED,
      },
    });

    await recordActivity({
      projectId,
      actorId: actor.id,
      action: 'delivery.source_submitted',
      entityType: 'ProjectDelivery',
      entityId: projectId,
      summary: `${actor.name} submitted GitHub details (${details.githubUsername})`,
    });

    NotificationService.emitAsync({
      event: 'delivery.source_requested',
      audience: { projectId, include: ['internal'] },
      context: { projectName: project.title, actorName: actor.name },
      projectId,
      link: `/projects/${projectId}/delivery`,
    });

    return this.get(projectId);
  },

  /** The client choosing how they want the code, before details are known. */
  async chooseSourceMethod(
    projectId: string,
    method: SourceCodeMethod,
    actor: { id: string; name: string },
  ) {
    await this.ensure(projectId);

    await prisma.projectDelivery.update({
      where: { projectId },
      data: { sourceCodeMethod: method },
    });

    await recordActivity({
      projectId,
      actorId: actor.id,
      action: 'delivery.source_submitted',
      entityType: 'ProjectDelivery',
      entityId: projectId,
      summary: `${actor.name} chose ${method === SourceCodeMethod.GITHUB ? 'GitHub transfer' : 'a downloadable archive'} for the source code`,
    });

    return this.get(projectId);
  },

  /** Admin marks the repository as actually transferred. */
  async confirmGithubTransfer(
    projectId: string,
    actor: { id: string; name: string },
    notes?: string | null,
  ) {
    const delivery = await this.ensure(projectId);
    if (!delivery.githubRepoUrl) {
      throw ApiError.badRequest('No GitHub repository has been recorded yet');
    }

    await prisma.projectDelivery.update({
      where: { projectId },
      data: {
        handoverStatus: HandoverStatus.ADMIN_CONFIRMED,
        transferredAt: new Date(),
        transferNotes: notes ?? null,
      },
    });

    await recordActivity({
      projectId,
      actorId: actor.id,
      action: 'delivery.source_submitted',
      entityType: 'ProjectDelivery',
      entityId: projectId,
      summary: `${actor.name} transferred the repository to ${delivery.githubUsername ?? 'the client'}`,
    });

    return this.get(projectId);
  },

  /** Uploads the source archive into private storage and records its hash. */
  async uploadArchive(
    projectId: string,
    actor: { id: string; name: string },
    file: Express.Multer.File,
    version: string,
  ) {
    const delivery = await this.ensure(projectId);
    const storageKey = storageKeyFor('source-code', projectId, file.filename);
    const checksum = await checksumPrivateFile(storageKey).catch(() => null);

    // Replacing an archive shouldn't leave the old one on disk.
    if (delivery.zipStorageKey && delivery.zipStorageKey !== storageKey) {
      try {
        removePrivateFile(delivery.zipStorageKey);
      } catch {
        // Non-fatal — the row no longer points at it.
      }
    }

    await prisma.projectDelivery.update({
      where: { projectId },
      data: {
        sourceCodeMethod: SourceCodeMethod.ZIP,
        zipStorageKey: storageKey,
        zipFilename: file.originalname,
        zipSizeBytes: file.size || privateFileSize(storageKey),
        zipChecksum: checksum,
        zipVersion: version,
        handoverStatus: HandoverStatus.ADMIN_CONFIRMED,
      },
    });

    await recordActivity({
      projectId,
      actorId: actor.id,
      action: 'delivery.source_submitted',
      entityType: 'ProjectDelivery',
      entityId: projectId,
      summary: `${actor.name} uploaded the source archive (${version})`,
    });

    return this.get(projectId);
  },

  /** Resolves the archive for the authorised download route. */
  async prepareArchiveDownload(projectId: string, userId: string) {
    const delivery = await prisma.projectDelivery.findUnique({
      where: { projectId },
      select: { zipStorageKey: true, zipFilename: true, status: true },
    });

    if (!delivery?.zipStorageKey) throw ApiError.notFound('Source archive');

    // Nothing is downloadable until the package is actually ready for them.
    if (
      delivery.status === ProjectDeliveryStatus.NOT_STARTED ||
      delivery.status === ProjectDeliveryStatus.PREPARING
    ) {
      throw ApiError.forbidden('The delivery package is not ready yet');
    }

    await prisma.projectDelivery.update({
      where: { projectId },
      data: { zipDownloadCount: { increment: 1 } },
    });

    await recordActivity({
      projectId,
      actorId: userId,
      action: 'document.downloaded',
      entityType: 'ProjectDelivery',
      entityId: projectId,
      summary: 'Source archive downloaded',
    });

    return delivery;
  },

  async publishVersion(
    projectId: string,
    actor: { id: string; name: string },
    input: { version: string; releaseNotes?: string | null },
  ) {
    const delivery = await this.ensure(projectId);
    const project = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { title: true },
    });

    const existing = await prisma.deliveryVersion.findFirst({
      where: { deliveryId: delivery.id, version: input.version },
    });
    if (existing) throw ApiError.conflict(`Version ${input.version} has already been published`);

    await prisma.$transaction([
      prisma.deliveryVersion.create({
        data: {
          deliveryId: delivery.id,
          version: input.version,
          releaseNotes: input.releaseNotes ?? null,
          sourceMethod: delivery.sourceCodeMethod,
          storageKey: delivery.zipStorageKey,
          filename: delivery.zipFilename,
          sizeBytes: delivery.zipSizeBytes,
          checksum: delivery.zipChecksum,
          githubUrl: delivery.githubRepoUrl,
          publishedById: actor.id,
        },
      }),
      prisma.projectDelivery.update({
        where: { projectId },
        data: { version: input.version, releaseNotes: input.releaseNotes ?? null },
      }),
    ]);

    await recordActivity({
      projectId,
      actorId: actor.id,
      action: 'delivery.version_published',
      entityType: 'DeliveryVersion',
      entityId: delivery.id,
      summary: `${actor.name} published version ${input.version}`,
    });

    NotificationService.emitAsync({
      event: 'delivery.ready',
      audience: { projectId, include: ['client'] },
      context: { projectName: project.title, version: input.version },
      projectId,
      link: `/portal/projects/${projectId}/delivery`,
    });

    return this.get(projectId);
  },

  /**
   * Admin's half of the ownership transfer — a recorded, timestamped statement
   * that the deliverables were handed over.
   */
  async confirmAsAdmin(projectId: string, actor: { id: string; name: string }) {
    const delivery = await this.ensure(projectId);
    const project = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { title: true },
    });

    if (delivery.adminConfirmedAt) {
      throw ApiError.badRequest('You have already confirmed this handover');
    }

    const readiness = await this.readiness(projectId);
    const blocking = readiness.checks.filter(
      (check) => check.blocking && !check.passed && check.key !== 'client_confirmation',
    );
    if (blocking.length) {
      throw ApiError.badRequest(
        `Cannot confirm the handover yet. Outstanding: ${blocking.map((c) => c.label).join(', ')}`,
      );
    }

    await prisma.projectDelivery.update({
      where: { projectId },
      data: {
        adminConfirmedAt: new Date(),
        adminConfirmedById: actor.id,
        status:
          delivery.status === ProjectDeliveryStatus.OWNERSHIP_TRANSFER
            ? delivery.status
            : ProjectDeliveryStatus.OWNERSHIP_TRANSFER,
        handoverStatus: HandoverStatus.ADMIN_CONFIRMED,
      },
    });

    await recordActivity({
      projectId,
      actorId: actor.id,
      action: 'delivery.admin_confirmed',
      entityType: 'ProjectDelivery',
      entityId: delivery.id,
      summary: `${actor.name} confirmed the deliverables were handed over`,
    });

    NotificationService.emitAsync({
      event: 'delivery.ownership_initiated',
      audience: { projectId, include: ['client'] },
      context: { projectName: project.title, version: delivery.version ?? '' },
      projectId,
      link: `/portal/projects/${projectId}/delivery`,
    });

    return this.get(projectId);
  },

  /** The client's half — this is what makes the handover defensible. */
  async confirmAsClient(projectId: string, actor: { id: string; name: string }) {
    const delivery = await this.ensure(projectId);
    const project = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { title: true },
    });

    if (!delivery.adminConfirmedAt) {
      throw ApiError.badRequest('The handover has not been prepared for confirmation yet');
    }
    if (delivery.clientConfirmedAt) {
      throw ApiError.badRequest('This handover has already been confirmed');
    }

    await prisma.$transaction([
      prisma.projectDelivery.update({
        where: { projectId },
        data: {
          clientConfirmedAt: new Date(),
          clientConfirmedById: actor.id,
          handoverStatus: HandoverStatus.CLIENT_CONFIRMED,
        },
      }),
      prisma.deliveryVersion.updateMany({
        where: { deliveryId: delivery.id, version: delivery.version ?? '' },
        data: { clientConfirmedAt: new Date() },
      }),
    ]);

    await recordActivity({
      projectId,
      actorId: actor.id,
      action: 'delivery.client_confirmed',
      entityType: 'ProjectDelivery',
      entityId: delivery.id,
      summary: `${actor.name} confirmed receipt of the project handover`,
    });

    NotificationService.emitAsync({
      event: 'delivery.ownership_completed',
      audience: { projectId, include: ['internal'] },
      context: { projectName: project.title, actorName: actor.name },
      projectId,
      link: `/projects/${projectId}/delivery`,
    });

    logger.info('Client confirmed project handover', { projectId, userId: actor.id });
    return this.get(projectId);
  },

  /** Everything the handover certificate PDF needs, in one shot. */
  async handoverRecord(projectId: string) {
    const [delivery, project] = await Promise.all([
      this.ensure(projectId),
      prisma.project.findUniqueOrThrow({
        where: { id: projectId },
        select: {
          id: true, title: true, code: true, startDate: true, endDate: true,
          client: { select: { name: true, companyName: true } },
          user: {
            select: {
              name: true,
              company: { select: { legalName: true, tradeName: true, logoUrl: true } },
            },
          },
        },
      }),
    ]);

    const [documentCount, members] = await Promise.all([
      prisma.projectDocument.count({
        where: { projectId, visibility: DocumentVisibility.CLIENT_VISIBLE },
      }),
      prisma.projectMember.findMany({
        where: { projectId, isActive: true, role: 'CLIENT_OWNER' },
        select: { user: { select: { name: true, email: true } } },
        take: 1,
      }),
    ]);

    return {
      project,
      delivery: {
        status: delivery.status,
        statusLabel: DELIVERY_STATUS_LABELS[delivery.status],
        version: delivery.version,
        sourceCodeMethod: delivery.sourceCodeMethod,
        githubRepoUrl: delivery.githubRepoUrl,
        zipFilename: delivery.zipFilename,
        zipChecksum: delivery.zipChecksum,
        adminConfirmedAt: delivery.adminConfirmedAt,
        adminConfirmedBy: delivery.adminConfirmedBy?.name ?? null,
        clientConfirmedAt: delivery.clientConfirmedAt,
        clientConfirmedBy: delivery.clientConfirmedBy?.name ?? null,
        deliveredAt: delivery.deliveredAt,
      },
      documentCount,
      clientContact: members[0]?.user ?? null,
      versions: delivery.versions,
    };
  },
};

export default DeliveryService;
