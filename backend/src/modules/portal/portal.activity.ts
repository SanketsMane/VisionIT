import type { Prisma } from '@prisma/client';
import { prisma } from '@config/database';
import { logger } from '@config/logger';

/**
 * Every action worth remembering on a project. Keeping these as a closed union
 * means the timeline UI can render an icon and phrasing per action instead of
 * echoing raw strings, and a typo can't silently create a new action type.
 */
export type ProjectAction =
  | 'project.created'
  | 'project.updated'
  | 'project.status_changed'
  | 'invitation.created'
  | 'invitation.resent'
  | 'invitation.revoked'
  | 'invitation.accepted'
  | 'member.joined'
  | 'member.role_changed'
  | 'member.removed'
  | 'milestone.created'
  | 'milestone.updated'
  | 'milestone.completed'
  | 'invoice.issued'
  | 'payment.requested'
  | 'payment.approved'
  | 'payment.rejected'
  | 'bug.submitted'
  | 'bug.acknowledged'
  | 'bug.assigned'
  | 'bug.status_changed'
  | 'bug.commented'
  | 'bug.closed'
  | 'document.uploaded'
  | 'document.updated'
  | 'document.deleted'
  | 'document.downloaded'
  | 'support.started'
  | 'support.updated'
  | 'support.renewed'
  | 'support.cancelled'
  | 'support.removed'
  | 'delivery.started'
  | 'delivery.status_changed'
  | 'delivery.checklist_updated'
  | 'delivery.source_submitted'
  | 'delivery.version_published'
  | 'delivery.admin_confirmed'
  | 'delivery.client_confirmed'
  | 'delivery.completed'
  | 'announcement.published';

export interface RecordActivityInput {
  projectId: string;
  actorId?: string | null;
  action: ProjectAction;
  entityType: string;
  entityId?: string | null;
  /** One human sentence — this is what the timeline actually displays. */
  summary: string;
  field?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  metadata?: Prisma.InputJsonValue;
  /** Internal actions are filtered out of the client-facing timeline. */
  isInternal?: boolean;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Append-only project audit trail.
 *
 * Writes are best-effort: a failure to log must never fail the action being
 * logged. When a transaction client is supplied the row is written inside it,
 * so an activity entry can't survive a rolled-back operation.
 */
export const recordActivity = async (
  input: RecordActivityInput,
  tx?: Prisma.TransactionClient,
): Promise<void> => {
  const client = tx ?? prisma;

  const data = {
    projectId: input.projectId,
    actorId: input.actorId ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    summary: input.summary,
    field: input.field ?? null,
    oldValue: input.oldValue ?? null,
    newValue: input.newValue ?? null,
    ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
    isInternal: input.isInternal ?? false,
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
  };

  if (tx) {
    // Inside a transaction the caller owns error handling — letting it throw
    // keeps the activity row and the change it describes atomic.
    await client.projectActivity.create({ data });
    return;
  }

  try {
    await client.projectActivity.create({ data });
  } catch (error) {
    logger.warn('Failed to record project activity', {
      action: input.action,
      projectId: input.projectId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

export const ActivityModel = {
  list: (
    projectId: string,
    options: { skip: number; take: number; includeInternal: boolean },
  ) =>
    prisma.projectActivity.findMany({
      where: {
        projectId,
        ...(options.includeInternal ? {} : { isInternal: false }),
      },
      include: {
        actor: { select: { id: true, name: true, avatarUrl: true, userType: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: options.skip,
      take: options.take,
    }),

  count: (projectId: string, includeInternal: boolean) =>
    prisma.projectActivity.count({
      where: { projectId, ...(includeInternal ? {} : { isInternal: false }) },
    }),
};
