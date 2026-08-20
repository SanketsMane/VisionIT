import { NotificationType, ProjectRole, UserType } from '@prisma/client';
import { prisma } from '@config/database';
import { logger } from '@config/logger';
import { absoluteLink, sendTemplatedEmail } from './email-sender';
import { EVENT_TEMPLATES, type EventContext, type NotificationEvent } from './notification.events';

export interface EmitInput {
  event: NotificationEvent;
  /** Explicit recipients. Use `audience` instead to target by project role. */
  userIds?: string[];
  /**
   * Resolve recipients from project membership. `internal` means the workspace
   * owner and any internal members; `client` means every active client member.
   */
  audience?: {
    projectId: string;
    include: ('internal' | 'client')[];
    roles?: ProjectRole[];
    excludeUserIds?: string[];
  };
  context: EventContext;
  projectId?: string;
  link?: string;
}

interface Recipient {
  id: string;
  name: string;
  email: string;
  userType: UserType;
}

/**
 * Resolves who should hear about an event.
 *
 * Targeting by *role* rather than by a caller-supplied list is what keeps
 * "notify the client" from accidentally emailing the studio team, and vice
 * versa — the audience is derived from membership at send time.
 */
const resolveRecipients = async (input: EmitInput): Promise<Recipient[]> => {
  const select = { id: true, name: true, email: true, userType: true } as const;

  if (input.userIds?.length) {
    return prisma.user.findMany({
      where: { id: { in: input.userIds }, isActive: true },
      select,
    });
  }

  if (!input.audience) return [];

  const { projectId, include, roles, excludeUserIds = [] } = input.audience;
  const recipients: Recipient[] = [];

  if (include.includes('internal')) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { userId: true },
    });

    if (project) {
      const owner = await prisma.user.findFirst({
        where: { id: project.userId, isActive: true },
        select,
      });
      if (owner) recipients.push(owner);
    }

    const internalMembers = await prisma.projectMember.findMany({
      where: {
        projectId,
        isActive: true,
        role: ProjectRole.INTERNAL_MEMBER,
        user: { isActive: true },
      },
      select: { user: { select } },
    });
    recipients.push(...internalMembers.map((m) => m.user));
  }

  if (include.includes('client')) {
    const clientMembers = await prisma.projectMember.findMany({
      where: {
        projectId,
        isActive: true,
        user: { isActive: true, userType: UserType.CLIENT },
        ...(roles?.length ? { role: { in: roles } } : {}),
      },
      select: { user: { select } },
    });
    recipients.push(...clientMembers.map((m) => m.user));
  }

  // The actor rarely wants a notification about their own action, and one
  // person can match several rules — de-duplicate on id.
  const seen = new Set(excludeUserIds);
  return recipients.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
};

const NOTIFICATION_TYPE: Record<string, NotificationType> = {
  invoice: NotificationType.INVOICE_OVERDUE,
  payment: NotificationType.PAYMENT_RECEIVED,
  bug: NotificationType.SYSTEM,
  delivery: NotificationType.SYSTEM,
  project: NotificationType.SYSTEM,
};

export const NotificationService = {
  /**
   * The one entry point for telling someone something happened.
   *
   * Features call this and nothing else — they never construct a subject line,
   * pick a transport, or decide who to email. Adding WhatsApp or SMS later
   * means extending this function, not touching thirty call sites.
   */
  async emit(input: EmitInput): Promise<void> {
    const template = EVENT_TEMPLATES[input.event];
    if (!template) {
      logger.warn('Unknown notification event', { event: input.event });
      return;
    }

    const recipients = await resolveRecipients(input);
    if (!recipients.length) return;

    const title = template.title(input.context);
    const body = template.body(input.context);
    const link = input.link ?? input.context.link ?? null;
    const domain = input.event.split('.')[0];

    if (template.channels.includes('IN_APP')) {
      await prisma.notification
        .createMany({
          data: recipients.map((recipient) => ({
            userId: recipient.id,
            type: NOTIFICATION_TYPE[domain] ?? NotificationType.SYSTEM,
            title,
            body,
            link,
          })),
        })
        .catch((error: unknown) =>
          logger.warn('In-app notification failed', {
            event: input.event,
            error: error instanceof Error ? error.message : String(error),
          }),
        );
    }

    if (template.channels.includes('EMAIL')) {
      const url = absoluteLink(input.context.actionUrl ?? input.context.inviteUrl ?? link);

      // Rendered per recipient rather than once: the greeting uses their name,
      // and a personal opener is most of what separates a real message from
      // something that reads like a system alert.
      await Promise.allSettled(
        recipients.map((recipient) =>
          sendTemplatedEmail({
            to: recipient.email,
            event: input.event,
            context: { ...input.context, recipientName: recipient.name, actionUrl: url },
            userId: recipient.id,
            projectId: input.projectId,
          }),
        ),
      );
    }

    logger.info('Notification emitted', {
      event: input.event,
      recipients: recipients.length,
      channels: template.channels,
    });
  },

  /**
   * Fire-and-forget wrapper.
   *
   * Notifications are a side effect of business actions, not part of them —
   * this keeps a slow SMTP handshake from delaying an API response, and a
   * failed send from failing the request.
   */
  emitAsync(input: EmitInput): void {
    void this.emit(input).catch((error: unknown) =>
      logger.warn('Notification emit failed', {
        event: input.event,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  },

  /**
   * The signed-in user's own inbox.
   *
   * Lives here rather than under `/settings`, which is gated to the studio —
   * a client member has notifications too, and gating their own inbox behind
   * an internal-only router is why the portal showed none.
   */
  listForUser: (userId: string) =>
    prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 }),

  unreadCount: (userId: string) =>
    prisma.notification.count({ where: { userId, isRead: false } }),

  /** Scoped by `userId` so one user cannot mark another's notification read. */
  markRead: (userId: string, id: string) =>
    prisma.notification.update({ where: { id, userId }, data: { isRead: true } }),

  markAllRead: (userId: string) =>
    prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } }),

  /** Email delivery log for the admin notification screen. */
  async emailLog(projectId: string | undefined, page: number, limit: number) {
    const where = projectId ? { projectId } : {};
    const [items, total] = await Promise.all([
      prisma.emailLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      prisma.emailLog.count({ where }),
    ]);
    return { items, total, page, limit };
  },
};

export default NotificationService;
