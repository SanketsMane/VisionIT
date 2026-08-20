import {
  ConversationType, MessageType, ParticipantRole, Prisma, UserType,
} from '@prisma/client';
import { prisma } from '@config/database';
import { logger } from '@config/logger';
import { ApiError } from '@utils/api-error';
import { privateFileSize } from '@utils/private-storage';
import { assertEligible, resolveChatAccess, type ChatAccess } from './chat.access';
import { chatEvents } from './chat.events';

/** What a message looks like everywhere it is returned. */
const messageInclude = {
  sender: { select: { id: true, name: true, avatarUrl: true, userType: true } },
  attachments: {
    select: {
      id: true, filename: true, mimeType: true, sizeBytes: true, width: true, height: true,
    },
  },
  replyTo: {
    select: {
      id: true, body: true, type: true, deletedAt: true,
      sender: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.MessageInclude;

/** One-line summary shown under a conversation in the list. */
const previewOf = (
  type: MessageType,
  body: string | null,
  attachmentCount: number,
): string => {
  if (type === MessageType.SYSTEM) return body ?? '';
  if (body?.trim()) return body.trim().slice(0, 140);
  if (type === MessageType.IMAGE) return attachmentCount > 1 ? `${attachmentCount} photos` : 'Photo';
  if (attachmentCount > 1) return `${attachmentCount} files`;
  return 'Attachment';
};

const shapeMessage = (
  message: Prisma.MessageGetPayload<{ include: typeof messageInclude }>,
) => ({
  id: message.id,
  conversationId: message.conversationId,
  type: message.type,
  // A deleted message keeps its place in the thread but loses its content.
  body: message.deletedAt ? null : message.body,
  isDeleted: Boolean(message.deletedAt),
  editedAt: message.editedAt,
  createdAt: message.createdAt,
  sender: message.sender,
  attachments: message.deletedAt ? [] : message.attachments,
  replyTo: message.replyTo
    ? {
        id: message.replyTo.id,
        body: message.replyTo.deletedAt ? null : message.replyTo.body,
        type: message.replyTo.type,
        sender: message.replyTo.sender,
      }
    : null,
});

export const ChatService = {
  /**
   * Every conversation the user is in, newest activity first, with the unread
   * count each one carries.
   *
   * The counts are a single grouped query rather than one per row: a client with
   * a dozen threads would otherwise cost a dozen round trips to render a list.
   */
  async listConversations(user: Express.AuthenticatedUser, projectId?: string) {
    const memberships = await prisma.conversationParticipant.findMany({
      where: {
        userId: user.id,
        leftAt: null,
        conversation: {
          isArchived: false,
          ...(projectId ? { projectId } : {}),
          project: { deletedAt: null },
        },
      },
      select: {
        lastReadAt: true,
        isMuted: true,
        role: true,
        conversation: {
          select: {
            id: true, projectId: true, type: true, title: true, avatarUrl: true,
            lastMessageAt: true, lastMessagePreview: true, lastMessageSenderId: true,
            project: { select: { id: true, title: true, code: true } },
            participants: {
              where: { leftAt: null },
              select: {
                userId: true, role: true,
                user: { select: { id: true, name: true, avatarUrl: true, userType: true } },
              },
            },
          },
        },
      },
      orderBy: { conversation: { lastMessageAt: 'desc' } },
    });

    if (!memberships.length) return [];

    const ids = memberships.map((m) => m.conversation.id);

    // Unread = messages in the thread newer than my read mark, not mine, not
    // deleted. Grouping does all the threads at once.
    const unreadRows = await prisma.message.groupBy({
      by: ['conversationId'],
      where: {
        conversationId: { in: ids },
        deletedAt: null,
        senderId: { not: user.id },
        OR: memberships.map((m) => ({
          conversationId: m.conversation.id,
          ...(m.lastReadAt ? { createdAt: { gt: m.lastReadAt } } : {}),
        })),
      },
      _count: { _all: true },
    });
    const unreadBy = new Map(unreadRows.map((r) => [r.conversationId, r._count._all]));

    return memberships.map((m) => {
      const c = m.conversation;
      const others = c.participants.filter((p) => p.userId !== user.id);
      return {
        id: c.id,
        projectId: c.projectId,
        project: c.project,
        type: c.type,
        // A direct thread has no title of its own; it is named after the person
        // on the other end.
        title: c.type === ConversationType.GROUP ? c.title : (others[0]?.user.name ?? 'Conversation'),
        avatarUrl: c.type === ConversationType.GROUP ? c.avatarUrl : (others[0]?.user.avatarUrl ?? null),
        participants: c.participants.map((p) => ({ ...p.user, role: p.role })),
        participantCount: c.participants.length,
        lastMessageAt: c.lastMessageAt,
        lastMessagePreview: c.lastMessagePreview,
        lastMessageIsMine: c.lastMessageSenderId === user.id,
        unreadCount: unreadBy.get(c.id) ?? 0,
        isMuted: m.isMuted,
        myRole: m.role,
      };
    });
  },

  /**
   * Opens (or creates) the direct thread between two people on a project.
   *
   * Idempotent: a pair gets exactly one direct thread per project, so clicking
   * "message" twice does not produce two half-populated conversations.
   */
  async openDirect(user: Express.AuthenticatedUser, projectId: string, otherUserId: string) {
    if (otherUserId === user.id) throw ApiError.badRequest('You cannot open a chat with yourself');
    await assertEligible(projectId, [user.id, otherUserId]);

    const existing = await prisma.conversation.findFirst({
      where: {
        projectId,
        type: ConversationType.DIRECT,
        AND: [
          { participants: { some: { userId: user.id } } },
          { participants: { some: { userId: otherUserId } } },
        ],
      },
      select: { id: true },
    });

    if (existing) {
      // Re-opening after someone left should revive their seat, not 404.
      await prisma.conversationParticipant.updateMany({
        where: { conversationId: existing.id, userId: { in: [user.id, otherUserId] } },
        data: { leftAt: null },
      });
      return this.getConversation(user, existing.id);
    }

    const created = await prisma.conversation.create({
      data: {
        projectId,
        type: ConversationType.DIRECT,
        createdById: user.id,
        participants: {
          create: [
            { userId: user.id, role: ParticipantRole.MEMBER },
            { userId: otherUserId, role: ParticipantRole.MEMBER },
          ],
        },
      },
      select: { id: true },
    });

    chatEvents.emit('conversation:created', { conversationId: created.id, userIds: [user.id, otherUserId] });
    return this.getConversation(user, created.id);
  },

  /** Creates a named group. The creator owns it and can add their teammates. */
  async createGroup(
    user: Express.AuthenticatedUser,
    projectId: string,
    input: { title: string; participantIds: string[] },
  ) {
    const members = [...new Set([user.id, ...input.participantIds])];
    await assertEligible(projectId, members);
    if (members.length < 2) throw ApiError.badRequest('Add at least one other person to the group');

    const created = await prisma.conversation.create({
      data: {
        projectId,
        type: ConversationType.GROUP,
        title: input.title.trim(),
        createdById: user.id,
        participants: {
          create: members.map((id) => ({
            userId: id,
            role: id === user.id ? ParticipantRole.OWNER : ParticipantRole.MEMBER,
          })),
        },
      },
      select: { id: true },
    });

    await this.systemMessage(created.id, `${user.name} created "${input.title.trim()}"`);
    chatEvents.emit('conversation:created', { conversationId: created.id, userIds: members });
    logger.info('Chat group created', { conversationId: created.id, projectId, size: members.length });
    return this.getConversation(user, created.id);
  },

  async getConversation(user: Express.AuthenticatedUser, conversationId: string) {
    const access = await resolveChatAccess(user, conversationId);
    const conversation = await prisma.conversation.findUniqueOrThrow({
      where: { id: conversationId },
      select: {
        id: true, projectId: true, type: true, title: true, avatarUrl: true,
        createdById: true, lastMessageAt: true,
        project: { select: { id: true, title: true, code: true } },
        participants: {
          where: { leftAt: null },
          select: {
            userId: true, role: true, joinedAt: true, lastReadAt: true,
            user: { select: { id: true, name: true, email: true, avatarUrl: true, userType: true } },
          },
        },
      },
    });

    const others = conversation.participants.filter((p) => p.userId !== user.id);
    return {
      ...conversation,
      title:
        conversation.type === ConversationType.GROUP
          ? conversation.title
          : (others[0]?.user.name ?? 'Conversation'),
      avatarUrl:
        conversation.type === ConversationType.GROUP
          ? conversation.avatarUrl
          : (others[0]?.user.avatarUrl ?? null),
      participants: conversation.participants.map((p) => ({
        ...p.user,
        role: p.role,
        joinedAt: p.joinedAt,
        lastReadAt: p.lastReadAt,
      })),
      myRole: access.role,
      canManage: access.canManage,
    };
  },

  /**
   * A page of messages, newest first.
   *
   * Cursor-based rather than offset: a thread gains messages while you scroll,
   * and `skip` would silently repeat or drop rows as the window shifts.
   */
  async listMessages(
    user: Express.AuthenticatedUser,
    conversationId: string,
    options: { limit: number; before?: string },
  ) {
    await resolveChatAccess(user, conversationId);

    const cursor = options.before
      ? await prisma.message.findUnique({
          where: { id: options.before },
          select: { createdAt: true },
        })
      : null;

    const rows = await prisma.message.findMany({
      where: {
        conversationId,
        ...(cursor ? { createdAt: { lt: cursor.createdAt } } : {}),
      },
      include: messageInclude,
      orderBy: { createdAt: 'desc' },
      take: options.limit + 1,
    });

    const hasMore = rows.length > options.limit;
    const page = hasMore ? rows.slice(0, options.limit) : rows;

    // Read marks of everyone else, so the UI can draw the ticks without asking
    // per message.
    const participants = await prisma.conversationParticipant.findMany({
      where: { conversationId, leftAt: null },
      select: { userId: true, lastReadAt: true, lastDeliveredAt: true },
    });

    return {
      // Reversed so the caller renders oldest → newest without another pass.
      items: page.reverse().map(shapeMessage),
      hasMore,
      nextCursor: hasMore ? page[0]?.id : null,
      receipts: participants.filter((p) => p.userId !== user.id),
    };
  },

  /** Posts a message and updates the conversation's denormalised preview. */
  async sendMessage(
    user: Express.AuthenticatedUser,
    conversationId: string,
    input: {
      body?: string | null;
      replyToId?: string | null;
      attachments?: { storageKey: string; filename: string; mimeType: string }[];
    },
  ) {
    const access = await resolveChatAccess(user, conversationId);

    const attachments = input.attachments ?? [];
    const body = input.body?.trim() || null;
    if (!body && !attachments.length) throw ApiError.badRequest('Write something or attach a file');

    if (input.replyToId) {
      const parent = await prisma.message.findFirst({
        where: { id: input.replyToId, conversationId },
        select: { id: true },
      });
      // Silently dropping a bad reply id would attach the quote to nothing.
      if (!parent) throw ApiError.badRequest('The message being replied to is not in this conversation');
    }

    const allImages = attachments.length > 0 && attachments.every((a) => a.mimeType.startsWith('image/'));
    const type = attachments.length
      ? (allImages ? MessageType.IMAGE : MessageType.FILE)
      : MessageType.TEXT;

    const message = await prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: {
          conversationId,
          senderId: user.id,
          type,
          body,
          replyToId: input.replyToId ?? null,
          attachments: {
            create: attachments.map((a) => ({
              storageKey: a.storageKey,
              filename: a.filename,
              mimeType: a.mimeType,
              sizeBytes: privateFileSize(a.storageKey),
            })),
          },
        },
        include: messageInclude,
      });

      await tx.conversation.update({
        where: { id: conversationId },
        data: {
          lastMessageAt: created.createdAt,
          lastMessagePreview: previewOf(type, body, attachments.length),
          lastMessageSenderId: user.id,
        },
      });

      // Your own message is read by definition; without this the sender's own
      // unread badge would tick up as they type.
      await tx.conversationParticipant.update({
        where: { conversationId_userId: { conversationId, userId: user.id } },
        data: { lastReadAt: created.createdAt, lastReadMessageId: created.id },
      });

      return created;
    });

    const shaped = shapeMessage(message);
    chatEvents.emit('message:new', { conversationId, projectId: access.projectId, message: shaped });
    return shaped;
  },

  /** Internal helper for "X added Y", "X left" and friends. */
  async systemMessage(conversationId: string, text: string) {
    const message = await prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: { conversationId, type: MessageType.SYSTEM, body: text },
        include: messageInclude,
      });
      await tx.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: created.createdAt, lastMessagePreview: text, lastMessageSenderId: null },
      });
      return created;
    });

    const shaped = shapeMessage(message);
    chatEvents.emit('message:new', { conversationId, message: shaped });
    return shaped;
  },

  /**
   * Moves the read mark forward.
   *
   * Only ever forward: messages arriving out of order, or an older thread being
   * re-opened, must not rewind a mark and resurrect notifications.
   */
  async markRead(user: Express.AuthenticatedUser, conversationId: string, messageId?: string) {
    await resolveChatAccess(user, conversationId);

    const target = messageId
      ? await prisma.message.findFirst({
          where: { id: messageId, conversationId },
          select: { id: true, createdAt: true },
        })
      : await prisma.message.findFirst({
          where: { conversationId },
          orderBy: { createdAt: 'desc' },
          select: { id: true, createdAt: true },
        });

    if (!target) return { lastReadAt: null };

    const participant = await prisma.conversationParticipant.findUniqueOrThrow({
      where: { conversationId_userId: { conversationId, userId: user.id } },
      select: { lastReadAt: true },
    });

    if (participant.lastReadAt && participant.lastReadAt >= target.createdAt) {
      return { lastReadAt: participant.lastReadAt };
    }

    await prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId: user.id } },
      data: {
        lastReadAt: target.createdAt,
        lastReadMessageId: target.id,
        lastDeliveredAt: target.createdAt,
      },
    });

    chatEvents.emit('message:read', {
      conversationId,
      userId: user.id,
      lastReadAt: target.createdAt.toISOString(),
      lastReadMessageId: target.id,
    });

    return { lastReadAt: target.createdAt };
  },

  async addParticipants(user: Express.AuthenticatedUser, conversationId: string, userIds: string[]) {
    const access = await this.requireManage(user, conversationId);
    await assertEligible(access.projectId, userIds);

    const added: string[] = [];
    for (const id of userIds) {
      const existing = await prisma.conversationParticipant.findUnique({
        where: { conversationId_userId: { conversationId, userId: id } },
        select: { id: true, leftAt: true },
      });
      if (existing && !existing.leftAt) continue;

      if (existing) {
        await prisma.conversationParticipant.update({
          where: { id: existing.id },
          data: { leftAt: null, joinedAt: new Date() },
        });
      } else {
        await prisma.conversationParticipant.create({
          data: { conversationId, userId: id, role: ParticipantRole.MEMBER },
        });
      }
      added.push(id);
    }

    if (added.length) {
      const people = await prisma.user.findMany({
        where: { id: { in: added } },
        select: { name: true },
      });
      await this.systemMessage(
        conversationId,
        `${user.name} added ${people.map((p) => p.name).join(', ')}`,
      );
      chatEvents.emit('conversation:participants', { conversationId, userIds: added });
    }

    return this.getConversation(user, conversationId);
  },

  async removeParticipant(user: Express.AuthenticatedUser, conversationId: string, userId: string) {
    const access = await this.requireManage(user, conversationId);
    if (userId === user.id) throw ApiError.badRequest('Use "leave" to remove yourself');

    const participant = await prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
      select: { id: true, leftAt: true, role: true, user: { select: { name: true } } },
    });
    if (!participant || participant.leftAt) throw ApiError.notFound('Participant');
    if (participant.role === ParticipantRole.OWNER && !access.isInternal) {
      throw ApiError.forbidden('The group owner cannot be removed');
    }

    await prisma.conversationParticipant.update({
      where: { id: participant.id },
      data: { leftAt: new Date() },
    });
    await this.systemMessage(conversationId, `${user.name} removed ${participant.user.name}`);
    chatEvents.emit('conversation:participants', { conversationId, userIds: [userId] });

    return this.getConversation(user, conversationId);
  },

  async leave(user: Express.AuthenticatedUser, conversationId: string) {
    const access = await resolveChatAccess(user, conversationId);
    const conversation = await prisma.conversation.findUniqueOrThrow({
      where: { id: conversationId },
      select: { type: true },
    });
    if (conversation.type === ConversationType.DIRECT) {
      throw ApiError.badRequest('A direct conversation cannot be left');
    }

    await prisma.conversationParticipant.update({
      where: { id: access.participantId },
      data: { leftAt: new Date() },
    });
    await this.systemMessage(conversationId, `${user.name} left`);
    return { left: true };
  },

  async rename(user: Express.AuthenticatedUser, conversationId: string, title: string) {
    await this.requireManage(user, conversationId);
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { title: title.trim() },
    });
    await this.systemMessage(conversationId, `${user.name} renamed the group to "${title.trim()}"`);
    return this.getConversation(user, conversationId);
  },

  /** Soft-deletes your own message; the studio may remove anyone's. */
  async deleteMessage(user: Express.AuthenticatedUser, conversationId: string, messageId: string) {
    const access = await resolveChatAccess(user, conversationId);
    const message = await prisma.message.findFirst({
      where: { id: messageId, conversationId },
      select: { id: true, senderId: true, deletedAt: true },
    });
    if (!message) throw ApiError.notFound('Message');
    if (message.senderId !== user.id && !access.isInternal) {
      throw ApiError.forbidden('You can only delete your own messages');
    }
    if (message.deletedAt) return { deleted: true };

    await prisma.message.update({ where: { id: messageId }, data: { deletedAt: new Date() } });
    chatEvents.emit('message:deleted', { conversationId, messageId });
    return { deleted: true };
  },

  /** Total unread across every thread — the badge in the header. */
  async unreadTotal(user: Express.AuthenticatedUser) {
    const conversations = await this.listConversations(user);
    return {
      total: conversations.reduce((sum, c) => sum + (c.isMuted ? 0 : c.unreadCount), 0),
      byConversation: conversations
        .filter((c) => c.unreadCount > 0)
        .map((c) => ({ conversationId: c.id, unreadCount: c.unreadCount })),
    };
  },

  /** People who could be added to a thread in this project. */
  async directory(user: Express.AuthenticatedUser, projectId: string) {
    const { resolveProjectAccess } = await import('@middlewares/project-access.middleware');
    await resolveProjectAccess(user, projectId);
    const { eligibleParticipants } = await import('./chat.access');
    return (await eligibleParticipants(projectId)).filter((p) => p.id !== user.id);
  },

  async requireManage(user: Express.AuthenticatedUser, conversationId: string): Promise<ChatAccess> {
    const access = await resolveChatAccess(user, conversationId);
    if (!access.canManage) throw ApiError.forbidden('Only group admins can do that');
    return access;
  },

  /** Resolves an attachment for download, after checking participation. */
  async attachmentFor(user: Express.AuthenticatedUser, attachmentId: string) {
    const attachment = await prisma.messageAttachment.findUnique({
      where: { id: attachmentId },
      select: {
        storageKey: true, filename: true, mimeType: true,
        message: { select: { conversationId: true, deletedAt: true } },
      },
    });
    if (!attachment || attachment.message.deletedAt) throw ApiError.notFound('Attachment');

    // The whole point of private storage: prove membership before streaming.
    await resolveChatAccess(user, attachment.message.conversationId);
    return attachment;
  },
};

export default ChatService;
export { UserType };
