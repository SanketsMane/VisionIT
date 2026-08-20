import { env } from '@config/env';
import { prisma } from '@config/database';
import { logger } from '@config/logger';
import { NotificationService } from '@modules/notifications/notification.service';
import { isOnline } from './chat.gateway';

/**
 * Tells people about messages they have not read.
 *
 * The rule is deliberately restrained, because a chat that emails on every
 * message trains people to filter it:
 *
 *   - **Wait first.** A message has to sit unread for `QUIET_MINUTES` before it
 *     counts. Someone mid-conversation is already reading; mailing them is
 *     noise.
 *   - **Skip anyone connected.** If a socket is open, the message arrived on
 *     screen. An email would be telling them what they can already see.
 *   - **Once per conversation.** `lastNotifiedAt` marks the backlog as covered.
 *     Reading resets the situation naturally: a message newer than the mark
 *     makes the thread notifiable again, so a real reply always gets through.
 *   - **Muted threads stay silent**, in app and in the inbox.
 *
 * One email per conversation, not per message — "3 unread messages from Rohan"
 * is more useful than three separate mails, and it is what the reader wants to
 * act on.
 */

const QUIET_MINUTES = 10;

export const sweepUnreadChat = async (): Promise<void> => {
  try {
    const cutoff = new Date(Date.now() - QUIET_MINUTES * 60_000);

    const participants = await prisma.conversationParticipant.findMany({
      where: {
        leftAt: null,
        isMuted: false,
        user: { isActive: true },
        conversation: { project: { deletedAt: null } },
      },
      select: {
        id: true,
        userId: true,
        lastReadAt: true,
        lastNotifiedAt: true,
        conversation: {
          select: {
            id: true, type: true, title: true, projectId: true,
            project: { select: { title: true } },
          },
        },
        user: { select: { id: true, name: true } },
      },
    });

    let sent = 0;

    for (const participant of participants) {
      // Someone with the tab open does not need an email.
      if (isOnline(participant.userId)) continue;

      const unread = await prisma.message.findMany({
        where: {
          conversationId: participant.conversation.id,
          deletedAt: null,
          senderId: { not: participant.userId },
          createdAt: {
            lte: cutoff,
            ...(participant.lastReadAt ? { gt: participant.lastReadAt } : {}),
            // Only messages newer than the last nudge; otherwise every sweep
            // would re-report the same backlog.
            ...(participant.lastNotifiedAt ? { gt: participant.lastNotifiedAt } : {}),
          },
        },
        select: {
          id: true, body: true, type: true, createdAt: true,
          sender: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'asc' },
      });

      if (!unread.length) continue;

      const latest = unread[unread.length - 1];
      const senderName = latest.sender?.name ?? 'Someone';
      const isGroup = participant.conversation.type === 'GROUP';
      const preview =
        latest.body?.trim() ||
        (latest.type === 'IMAGE' ? 'Sent a photo' : latest.type === 'FILE' ? 'Sent a file' : '');

      NotificationService.emitAsync({
        event: 'chat.unread',
        userIds: [participant.userId],
        context: {
          recipientName: participant.user.name,
          actorName: isGroup ? `${senderName} in ${participant.conversation.title ?? 'the group'}` : senderName,
          projectName: participant.conversation.project.title,
          title: isGroup ? (participant.conversation.title ?? undefined) : undefined,
          count: String(unread.length),
          body: preview,
          actionUrl: `${env.CLIENT_URL}/chat/${participant.conversation.id}`,
          actionLabel: 'Open the conversation',
        },
        projectId: participant.conversation.projectId,
        link: `/chat/${participant.conversation.id}`,
      });

      await prisma.conversationParticipant.update({
        where: { id: participant.id },
        data: { lastNotifiedAt: latest.createdAt },
      });
      sent += 1;
    }

    if (sent) logger.info(`[cron] chat: nudged ${sent} unread conversation(s)`);
  } catch (error) {
    logger.error('[cron] chat unread sweep failed', { error: String(error) });
  }
};

export default sweepUnreadChat;
