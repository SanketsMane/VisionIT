import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { prisma } from '@config/database';
import { env } from '@config/env';
import { logger } from '@config/logger';
import { verifyAccessToken } from '@utils/jwt.util';
import { chatEvents } from './chat.events';
import { ChatService } from './chat.service';

/**
 * Realtime delivery for chat.
 *
 * Design notes:
 *
 *   - **Rooms, not broadcasts.** Every socket joins `user:{id}` plus a room per
 *     conversation it is entitled to. A message is emitted into one room, so a
 *     browser never receives traffic for a thread it cannot open — the server
 *     does not rely on the client to filter.
 *   - **Membership is checked on join, not trusted from the client.** The
 *     client asks to join a conversation; the server re-runs the same access
 *     check the REST layer uses before letting it in.
 *   - **The socket is a transport, not a second API.** Messages are still sent
 *     over HTTP, and the socket only pushes what happened. That keeps one
 *     validation path, one audit trail, and makes a dropped connection a
 *     display problem rather than a lost message.
 */

interface AuthedSocket extends Socket {
  userId?: string;
  userName?: string;
}

let io: Server | null = null;

/** Sockets per user, so presence survives multiple tabs. */
const online = new Map<string, Set<string>>();

const roomFor = (conversationId: string) => `conversation:${conversationId}`;
const userRoom = (userId: string) => `user:${userId}`;

const track = (userId: string, socketId: string): boolean => {
  const set = online.get(userId) ?? new Set<string>();
  const wasOffline = set.size === 0;
  set.add(socketId);
  online.set(userId, set);
  return wasOffline;
};

const untrack = (userId: string, socketId: string): boolean => {
  const set = online.get(userId);
  if (!set) return false;
  set.delete(socketId);
  if (set.size === 0) {
    online.delete(userId);
    return true;
  }
  return false;
};

export const isOnline = (userId: string): boolean => online.has(userId);

export const attachChatGateway = (server: HttpServer): Server => {
  io = new Server(server, {
    path: '/socket.io',
    cors: { origin: env.corsOrigins, credentials: true },
    // A phone that locks mid-conversation should reconnect, not be dropped.
    pingInterval: 25_000,
    pingTimeout: 20_000,
  });

  // Authenticate once, at handshake — an unauthenticated socket never gets
  // created, so no handler has to re-check.
  io.use(async (socket: AuthedSocket, next) => {
    try {
      const token =
        (socket.handshake.auth?.token as string | undefined) ??
        (socket.handshake.headers.authorization?.startsWith('Bearer ')
          ? socket.handshake.headers.authorization.slice(7)
          : undefined);

      if (!token) return next(new Error('Authentication required'));

      const payload = verifyAccessToken(token);
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, name: true, isActive: true },
      });
      if (!user || !user.isActive) return next(new Error('Account is not active'));

      socket.userId = user.id;
      socket.userName = user.name;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket: AuthedSocket) => {
    const userId = socket.userId as string;
    void socket.join(userRoom(userId));

    if (track(userId, socket.id)) {
      socket.broadcast.emit('presence:online', { userId });
    }

    /**
     * Join the rooms for every conversation this user is in. Done server side
     * from the database rather than from a client-supplied list, so a client
     * cannot join a room by asking nicely.
     */
    const joinOwnConversations = async () => {
      const rows = await prisma.conversationParticipant.findMany({
        where: { userId, leftAt: null, conversation: { project: { deletedAt: null } } },
        select: { conversationId: true },
      });
      await Promise.all(rows.map((r) => socket.join(roomFor(r.conversationId))));
      socket.emit('ready', { conversations: rows.length });
    };
    void joinOwnConversations();

    socket.on('conversation:join', async (conversationId: string, ack?: (ok: boolean) => void) => {
      try {
        await ChatService.getConversation(
          { id: userId, name: socket.userName } as Express.AuthenticatedUser,
          conversationId,
        );
        await socket.join(roomFor(conversationId));
        ack?.(true);
      } catch {
        ack?.(false);
      }
    });

    socket.on('conversation:leave', (conversationId: string) => {
      void socket.leave(roomFor(conversationId));
    });

    /**
     * Typing is fire-and-forget and deliberately not persisted: it is only true
     * for a couple of seconds, and writing it would be more traffic than the
     * messages themselves.
     */
    socket.on('typing:start', (conversationId: string) => {
      socket.to(roomFor(conversationId)).emit('typing:start', {
        conversationId, userId, name: socket.userName,
      });
    });

    socket.on('typing:stop', (conversationId: string) => {
      socket.to(roomFor(conversationId)).emit('typing:stop', { conversationId, userId });
    });

    socket.on('disconnect', () => {
      if (untrack(userId, socket.id)) {
        socket.broadcast.emit('presence:offline', { userId, lastSeen: new Date().toISOString() });
      }
    });
  });

  // ---- Bus → sockets -------------------------------------------------------

  chatEvents.on('message:new', ({ conversationId, message }) => {
    io?.to(roomFor(conversationId)).emit('message:new', { conversationId, message });
  });

  chatEvents.on('message:read', (payload) => {
    io?.to(roomFor(payload.conversationId)).emit('message:read', payload);
  });

  chatEvents.on('message:deleted', (payload) => {
    io?.to(roomFor(payload.conversationId)).emit('message:deleted', payload);
  });

  // A brand-new conversation has no room yet on the recipients' sockets, so
  // reach them by their personal room and let them join.
  chatEvents.on('conversation:created', ({ conversationId, userIds }) => {
    for (const id of userIds) {
      io?.to(userRoom(id)).emit('conversation:created', { conversationId });
    }
  });

  chatEvents.on('conversation:participants', ({ conversationId, userIds }) => {
    for (const id of userIds) {
      io?.to(userRoom(id)).emit('conversation:created', { conversationId });
    }
    io?.to(roomFor(conversationId)).emit('conversation:updated', { conversationId });
  });

  logger.info('💬 Chat gateway attached at /socket.io');
  return io;
};

export const closeChatGateway = async (): Promise<void> => {
  if (!io) return;
  await io.close();
  io = null;
  online.clear();
};
