import {
  BugPriority,
  BugSeverity,
  BugStatus,
  type Prisma,
} from '@prisma/client';
import { prisma } from '@config/database';
import { logger } from '@config/logger';
import { ApiError } from '@utils/api-error';
import { resolvePagination } from '@utils/pagination.util';
import { storageKeyFor } from '@utils/private-storage';
import { NotificationService } from '@modules/notifications/notification.service';
import { recordActivity } from '@modules/portal/portal.activity';
import {
  CLIENT_SETTABLE,
  OPEN_STATUSES,
  RESOLVED_STATUSES,
  STATUS_EVENT,
  STATUS_LABELS,
  canTransition,
  nextStatuses,
} from './bugs.lifecycle';

const bugListSelect = {
  id: true,
  key: true,
  number: true,
  title: true,
  priority: true,
  severity: true,
  status: true,
  module: true,
  browser: true,
  device: true,
  dueDate: true,
  createdAt: true,
  updatedAt: true,
  reportedBy: { select: { id: true, name: true, avatarUrl: true } },
  assignedTo: { select: { id: true, name: true, avatarUrl: true } },
  _count: { select: { comments: true, attachments: true } },
} satisfies Prisma.BugSelect;

export interface CreateBugInput {
  title: string;
  description: string;
  expectedBehavior?: string | null;
  actualBehavior?: string | null;
  stepsToReproduce?: string | null;
  priority: BugPriority;
  severity: BugSeverity;
  module?: string | null;
  environment?: string | null;
  browser?: string | null;
  device?: string | null;
  os?: string | null;
  url?: string | null;
}

export interface BugListQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: BugStatus;
  priority?: BugPriority;
  severity?: BugSeverity;
  module?: string;
  assignedToUserId?: string;
  reportedByUserId?: string;
  openOnly?: boolean;
}

/**
 * Allocates the next per-project bug number inside the caller's transaction,
 * so two testers filing at the same instant can't both claim BUG-0048.
 */
const nextBugNumber = async (projectId: string, tx: Prisma.TransactionClient): Promise<number> => {
  const last = await tx.bug.findFirst({
    where: { projectId },
    orderBy: { number: 'desc' },
    select: { number: true },
  });
  return (last?.number ?? 0) + 1;
};

export const BugsService = {
  async list(projectId: string, query: BugListQuery) {
    const pagination = resolvePagination(query, { defaultLimit: 25 });

    const where: Prisma.BugWhereInput = { projectId };
    if (query.status) where.status = query.status;
    if (query.priority) where.priority = query.priority;
    if (query.severity) where.severity = query.severity;
    if (query.module) where.module = query.module;
    if (query.assignedToUserId) where.assignedToUserId = query.assignedToUserId;
    if (query.reportedByUserId) where.reportedByUserId = query.reportedByUserId;
    if (query.openOnly) where.status = { in: OPEN_STATUSES };
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { key: { contains: query.search, mode: 'insensitive' } },
        { module: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.bug.findMany({
        where,
        select: bugListSelect,
        orderBy: [{ status: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.bug.count({ where }),
    ]);

    return { items, total, page: pagination.page, limit: pagination.limit };
  },

  /** Counters for the QA dashboard. */
  async stats(projectId: string) {
    const [byStatus, byPriority, bySeverity, overdue, total] = await Promise.all([
      prisma.bug.groupBy({ by: ['status'], where: { projectId }, _count: { _all: true } }),
      prisma.bug.groupBy({ by: ['priority'], where: { projectId }, _count: { _all: true } }),
      prisma.bug.groupBy({ by: ['severity'], where: { projectId }, _count: { _all: true } }),
      prisma.bug.count({
        where: { projectId, status: { in: OPEN_STATUSES }, dueDate: { lt: new Date() } },
      }),
      prisma.bug.count({ where: { projectId } }),
    ]);

    const statusCounts = Object.fromEntries(byStatus.map((r) => [r.status, r._count._all]));
    const open = OPEN_STATUSES.reduce((sum, status) => sum + (statusCounts[status] ?? 0), 0);

    return {
      total,
      open,
      resolved: RESOLVED_STATUSES.reduce((sum, status) => sum + (statusCounts[status] ?? 0), 0),
      overdue,
      critical:
        (byPriority.find((r) => r.priority === BugPriority.CRITICAL)?._count._all ?? 0),
      blockers: bySeverity.find((r) => r.severity === BugSeverity.BLOCKER)?._count._all ?? 0,
      byStatus: byStatus.map((r) => ({
        status: r.status,
        label: STATUS_LABELS[r.status],
        count: r._count._all,
      })),
      byPriority: byPriority.map((r) => ({ priority: r.priority, count: r._count._all })),
      bySeverity: bySeverity.map((r) => ({ severity: r.severity, count: r._count._all })),
    };
  },

  /**
   * Full bug detail.
   *
   * `includeInternal` is the single switch that keeps internal triage notes and
   * private discussion off client routes. It is derived from the caller's role,
   * never from a request parameter.
   */
  async getById(projectId: string, bugId: string, includeInternal: boolean) {
    const bug = await prisma.bug.findFirst({
      where: { id: bugId, projectId },
      include: {
        reportedBy: { select: { id: true, name: true, avatarUrl: true, userType: true } },
        assignedTo: { select: { id: true, name: true, avatarUrl: true } },
        duplicateOf: { select: { id: true, key: true, title: true } },
        attachments: {
          select: {
            id: true, filename: true, mimeType: true, sizeBytes: true, createdAt: true,
            uploadedBy: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        comments: {
          where: includeInternal ? {} : { isInternal: false },
          include: { author: { select: { id: true, name: true, avatarUrl: true, userType: true } } },
          orderBy: { createdAt: 'asc' },
        },
        activities: {
          where: includeInternal ? {} : { isInternal: false },
          include: { actor: { select: { id: true, name: true, avatarUrl: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!bug) throw ApiError.notFound('Issue');

    const { internalNote, ...rest } = bug;

    return {
      ...rest,
      // Never leak the triage note to a client, even by accident.
      internalNote: includeInternal ? internalNote : undefined,
      statusLabel: STATUS_LABELS[bug.status],
      availableTransitions: nextStatuses(bug.status).map((status) => ({
        value: status,
        label: STATUS_LABELS[status],
      })),
    };
  },

  async create(
    projectId: string,
    reporter: { id: string; name: string },
    input: CreateBugInput,
    files: Express.Multer.File[] = [],
  ) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, title: true },
    });
    if (!project) throw ApiError.notFound('Project');

    const bug = await prisma.$transaction(async (tx) => {
      const number = await nextBugNumber(projectId, tx);
      const key = `BUG-${String(number).padStart(4, '0')}`;

      const created = await tx.bug.create({
        data: {
          projectId,
          number,
          key,
          title: input.title,
          description: input.description,
          expectedBehavior: input.expectedBehavior ?? null,
          actualBehavior: input.actualBehavior ?? null,
          stepsToReproduce: input.stepsToReproduce ?? null,
          priority: input.priority,
          severity: input.severity,
          module: input.module ?? null,
          environment: input.environment ?? null,
          browser: input.browser ?? null,
          device: input.device ?? null,
          os: input.os ?? null,
          url: input.url ?? null,
          reportedByUserId: reporter.id,
        },
      });

      if (files.length) {
        await tx.bugAttachment.createMany({
          data: files.map((file) => ({
            bugId: created.id,
            uploadedById: reporter.id,
            storageKey: storageKeyFor('bug-attachments', projectId, file.filename),
            filename: file.originalname,
            mimeType: file.mimetype,
            sizeBytes: file.size,
          })),
        });
      }

      await tx.bugActivity.create({
        data: {
          bugId: created.id,
          actorId: reporter.id,
          action: 'submitted',
          newValue: BugStatus.SUBMITTED,
        },
      });

      await recordActivity(
        {
          projectId,
          actorId: reporter.id,
          action: 'bug.submitted',
          entityType: 'Bug',
          entityId: created.id,
          summary: `${reporter.name} reported ${key}: ${input.title}`,
        },
        tx,
      );

      return created;
    });

    NotificationService.emitAsync({
      event: 'bug.submitted',
      audience: { projectId, include: ['internal'], excludeUserIds: [reporter.id] },
      context: {
        projectName: project.title,
        actorName: reporter.name,
        bugKey: bug.key,
        bugTitle: bug.title,
      },
      projectId,
      link: `/projects/${projectId}/testing/${bug.id}`,
    });

    logger.info('Bug reported', { projectId, bugKey: bug.key });
    return this.getById(projectId, bug.id, false);
  },

  /**
   * Moves a bug through its lifecycle.
   *
   * The transition table is enforced here, not in the UI — an illegal jump is
   * rejected regardless of which client sent it.
   */
  async changeStatus(
    projectId: string,
    bugId: string,
    status: BugStatus,
    actor: { id: string; name: string; isInternal: boolean },
    options: { reason?: string | null; duplicateOfId?: string | null } = {},
  ) {
    const bug = await prisma.bug.findFirst({
      where: { id: bugId, projectId },
      include: { project: { select: { title: true } } },
    });
    if (!bug) throw ApiError.notFound('Issue');

    if (!canTransition(bug.status, status)) {
      throw ApiError.badRequest(
        `An issue that is ${STATUS_LABELS[bug.status].toLowerCase()} cannot move to ${STATUS_LABELS[status].toLowerCase()}`,
      );
    }

    if (!actor.isInternal && !CLIENT_SETTABLE.includes(status)) {
      throw ApiError.forbidden(`Only the studio team can set an issue to ${STATUS_LABELS[status]}`);
    }

    if (status === BugStatus.DUPLICATE && !options.duplicateOfId) {
      throw ApiError.badRequest('Say which issue this duplicates');
    }

    const data: Prisma.BugUpdateInput = { status };
    if (status === BugStatus.ACKNOWLEDGED && !bug.acknowledgedAt) data.acknowledgedAt = new Date();
    if (status === BugStatus.FIXED) data.resolvedAt = new Date();
    if (RESOLVED_STATUSES.includes(status)) data.closedAt = new Date();
    if (status === BugStatus.DUPLICATE && options.duplicateOfId) {
      data.duplicateOf = { connect: { id: options.duplicateOfId } };
    }
    // Reopening clears the previous resolution so the timeline reads correctly.
    if (status === BugStatus.ACKNOWLEDGED && bug.closedAt) {
      data.closedAt = null;
      data.resolvedAt = null;
    }

    await prisma.$transaction(async (tx) => {
      await tx.bug.update({ where: { id: bugId }, data });

      await tx.bugActivity.create({
        data: {
          bugId,
          actorId: actor.id,
          action: 'status_changed',
          field: 'status',
          oldValue: bug.status,
          newValue: status,
        },
      });

      if (options.reason) {
        await tx.bugComment.create({
          data: { bugId, authorId: actor.id, body: options.reason, isInternal: false },
        });
      }

      await recordActivity(
        {
          projectId,
          actorId: actor.id,
          action: status === BugStatus.CLOSED ? 'bug.closed' : 'bug.status_changed',
          entityType: 'Bug',
          entityId: bugId,
          summary: `${bug.key} moved to ${STATUS_LABELS[status]}`,
          field: 'status',
          oldValue: bug.status,
          newValue: status,
        },
        tx,
      );
    });

    const event = STATUS_EVENT[status] ?? 'bug.status_changed';

    NotificationService.emitAsync({
      event,
      // Status changes are news for the person who reported it, plus the other
      // side of the conversation.
      userIds: [bug.reportedByUserId].filter((id) => id !== actor.id),
      context: {
        projectName: bug.project.title,
        actorName: actor.name,
        bugKey: bug.key,
        bugTitle: bug.title,
        status: STATUS_LABELS[status],
        reason: options.reason ?? '',
      },
      projectId,
      link: `/portal/projects/${projectId}/testing/${bugId}`,
    });

    return this.getById(projectId, bugId, actor.isInternal);
  },

  /**
   * Acknowledge with triage in one step — the spec's "Acknowledge Bug" action,
   * which optionally assigns, sets priority and a resolution date, then tells
   * both the reporter and the new assignee.
   */
  async acknowledge(
    projectId: string,
    bugId: string,
    actor: { id: string; name: string },
    options: {
      assignedToUserId?: string | null;
      priority?: BugPriority;
      dueDate?: Date | null;
      internalNote?: string | null;
    },
  ) {
    const bug = await prisma.bug.findFirst({
      where: { id: bugId, projectId },
      include: { project: { select: { title: true } } },
    });
    if (!bug) throw ApiError.notFound('Issue');

    if (options.assignedToUserId) {
      const assignee = await prisma.projectMember.findFirst({
        where: { projectId, userId: options.assignedToUserId, isActive: true },
        select: { id: true },
      });
      if (!assignee) throw ApiError.badRequest('That person is not a member of this project');
    }

    const nextStatus = options.assignedToUserId ? BugStatus.ASSIGNED : BugStatus.ACKNOWLEDGED;

    await prisma.$transaction(async (tx) => {
      await tx.bug.update({
        where: { id: bugId },
        data: {
          status: nextStatus,
          acknowledgedAt: bug.acknowledgedAt ?? new Date(),
          assignedToUserId: options.assignedToUserId ?? bug.assignedToUserId,
          priority: options.priority ?? bug.priority,
          dueDate: options.dueDate ?? bug.dueDate,
          internalNote: options.internalNote ?? bug.internalNote,
        },
      });

      await tx.bugActivity.createMany({
        data: [
          {
            bugId,
            actorId: actor.id,
            action: 'acknowledged',
            field: 'status',
            oldValue: bug.status,
            newValue: nextStatus,
          },
          ...(options.assignedToUserId
            ? [
                {
                  bugId,
                  actorId: actor.id,
                  action: 'assigned',
                  field: 'assignedTo',
                  oldValue: bug.assignedToUserId,
                  newValue: options.assignedToUserId,
                },
              ]
            : []),
          ...(options.internalNote
            ? [{ bugId, actorId: actor.id, action: 'internal_note', isInternal: true }]
            : []),
        ],
      });

      await recordActivity(
        {
          projectId,
          actorId: actor.id,
          action: 'bug.acknowledged',
          entityType: 'Bug',
          entityId: bugId,
          summary: `${actor.name} acknowledged ${bug.key}`,
        },
        tx,
      );
    });

    NotificationService.emitAsync({
      event: 'bug.acknowledged',
      userIds: [bug.reportedByUserId].filter((id) => id !== actor.id),
      context: {
        projectName: bug.project.title,
        bugKey: bug.key,
        bugTitle: bug.title,
        actorName: actor.name,
      },
      projectId,
      link: `/portal/projects/${projectId}/testing/${bugId}`,
    });

    if (options.assignedToUserId && options.assignedToUserId !== actor.id) {
      NotificationService.emitAsync({
        event: 'bug.assigned',
        userIds: [options.assignedToUserId],
        context: {
          projectName: bug.project.title,
          bugKey: bug.key,
          bugTitle: bug.title,
          actorName: actor.name,
        },
        projectId,
        link: `/projects/${projectId}/testing/${bugId}`,
      });
    }

    return this.getById(projectId, bugId, true);
  },

  /** Updates triage fields without moving the bug through its lifecycle. */
  async update(
    projectId: string,
    bugId: string,
    actor: { id: string; name: string },
    patch: {
      priority?: BugPriority;
      severity?: BugSeverity;
      assignedToUserId?: string | null;
      dueDate?: Date | null;
      module?: string | null;
      internalNote?: string | null;
    },
  ) {
    const bug = await prisma.bug.findFirst({ where: { id: bugId, projectId } });
    if (!bug) throw ApiError.notFound('Issue');

    const changes: { field: string; oldValue: string | null; newValue: string | null }[] = [];
    const track = (field: string, oldValue: unknown, newValue: unknown) => {
      if (newValue === undefined || String(oldValue ?? '') === String(newValue ?? '')) return;
      changes.push({
        field,
        oldValue: oldValue === null || oldValue === undefined ? null : String(oldValue),
        newValue: newValue === null ? null : String(newValue),
      });
    };

    track('priority', bug.priority, patch.priority);
    track('severity', bug.severity, patch.severity);
    track('assignedTo', bug.assignedToUserId, patch.assignedToUserId);
    track('dueDate', bug.dueDate?.toISOString() ?? null, patch.dueDate?.toISOString() ?? null);
    track('module', bug.module, patch.module);

    await prisma.$transaction(async (tx) => {
      await tx.bug.update({
        where: { id: bugId },
        data: {
          ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
          ...(patch.severity !== undefined ? { severity: patch.severity } : {}),
          ...(patch.assignedToUserId !== undefined
            ? { assignedToUserId: patch.assignedToUserId }
            : {}),
          ...(patch.dueDate !== undefined ? { dueDate: patch.dueDate } : {}),
          ...(patch.module !== undefined ? { module: patch.module } : {}),
          ...(patch.internalNote !== undefined ? { internalNote: patch.internalNote } : {}),
        },
      });

      if (changes.length) {
        await tx.bugActivity.createMany({
          data: changes.map((change) => ({
            bugId,
            actorId: actor.id,
            action: 'updated',
            field: change.field,
            oldValue: change.oldValue,
            newValue: change.newValue,
          })),
        });
      }
    });

    if (patch.assignedToUserId && patch.assignedToUserId !== bug.assignedToUserId) {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { title: true },
      });
      NotificationService.emitAsync({
        event: 'bug.assigned',
        userIds: [patch.assignedToUserId],
        context: {
          projectName: project?.title ?? '',
          bugKey: bug.key,
          bugTitle: bug.title,
          actorName: actor.name,
        },
        projectId,
        link: `/projects/${projectId}/testing/${bugId}`,
      });
    }

    return this.getById(projectId, bugId, true);
  },

  /**
   * Adds a comment.
   *
   * `isInternal` is forced to false for client-side authors — the spec is
   * explicit that internal discussion must never become visible to the client,
   * and the safest way to guarantee that is to make it impossible to author.
   */
  async comment(
    projectId: string,
    bugId: string,
    author: { id: string; name: string; isInternal: boolean },
    body: string,
    requestedInternal: boolean,
  ) {
    const bug = await prisma.bug.findFirst({
      where: { id: bugId, projectId },
      include: { project: { select: { title: true } } },
    });
    if (!bug) throw ApiError.notFound('Issue');

    const isInternal = author.isInternal ? requestedInternal : false;

    const comment = await prisma.$transaction(async (tx) => {
      const created = await tx.bugComment.create({
        data: { bugId, authorId: author.id, body, isInternal },
        include: { author: { select: { id: true, name: true, avatarUrl: true, userType: true } } },
      });

      await tx.bugActivity.create({
        data: {
          bugId,
          actorId: author.id,
          action: isInternal ? 'internal_comment' : 'commented',
          isInternal,
        },
      });

      if (!isInternal) {
        await recordActivity(
          {
            projectId,
            actorId: author.id,
            action: 'bug.commented',
            entityType: 'Bug',
            entityId: bugId,
            summary: `${author.name} commented on ${bug.key}`,
          },
          tx,
        );
      }

      return created;
    });

    // An internal note is not news for the client.
    if (!isInternal) {
      NotificationService.emitAsync({
        event: 'bug.commented',
        userIds: [bug.reportedByUserId, bug.assignedToUserId].filter(
          (id): id is string => Boolean(id) && id !== author.id,
        ),
        context: {
          projectName: bug.project.title,
          actorName: author.name,
          bugKey: bug.key,
          bugTitle: bug.title,
        },
        projectId,
        link: `/portal/projects/${projectId}/testing/${bugId}`,
      });
    }

    return comment;
  },

  async addAttachments(
    projectId: string,
    bugId: string,
    uploaderId: string,
    files: Express.Multer.File[],
  ) {
    const bug = await prisma.bug.findFirst({ where: { id: bugId, projectId }, select: { id: true } });
    if (!bug) throw ApiError.notFound('Issue');
    if (!files.length) throw ApiError.badRequest('No files were uploaded');

    await prisma.bugAttachment.createMany({
      data: files.map((file) => ({
        bugId,
        uploadedById: uploaderId,
        storageKey: storageKeyFor('bug-attachments', projectId, file.filename),
        filename: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
      })),
    });

    return prisma.bugAttachment.findMany({
      where: { bugId },
      select: { id: true, filename: true, mimeType: true, sizeBytes: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
  },

  /** Resolves an attachment's private key for the authorised download route. */
  async loadAttachment(projectId: string, bugId: string, attachmentId: string) {
    const attachment = await prisma.bugAttachment.findFirst({
      where: { id: attachmentId, bugId, bug: { projectId } },
      select: { storageKey: true, filename: true, mimeType: true },
    });
    if (!attachment) throw ApiError.notFound('Attachment');
    return attachment;
  },

  /** Distinct module names already used, to power the filter dropdown. */
  async modules(projectId: string) {
    const rows = await prisma.bug.findMany({
      where: { projectId, module: { not: null } },
      select: { module: true },
      distinct: ['module'],
      orderBy: { module: 'asc' },
    });
    return rows.map((row) => row.module).filter((value): value is string => Boolean(value));
  },
};

export default BugsService;
