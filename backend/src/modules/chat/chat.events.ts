import { EventEmitter } from 'node:events';

/**
 * In-process bus between the chat service and whatever is pushing to browsers.
 *
 * The service must not import the socket server: a message is created the same
 * way whether it came from a socket, a REST call or a background job, and the
 * service should not care whether anyone is listening. This also keeps the HTTP
 * layer testable without standing up a websocket.
 *
 * Single-process today, which suits one PM2 fork. Running more than one
 * instance means replacing this with a Redis adapter so an event raised on one
 * process reaches sockets held by another — the emit sites would not change.
 */

export interface ChatEventMap {
  'message:new': {
    conversationId: string;
    projectId?: string;
    message: unknown;
  };
  'message:read': {
    conversationId: string;
    userId: string;
    lastReadAt: string;
    lastReadMessageId: string;
  };
  'message:deleted': { conversationId: string; messageId: string };
  'conversation:created': { conversationId: string; userIds: string[] };
  'conversation:participants': { conversationId: string; userIds: string[] };
}

class ChatEventBus extends EventEmitter {
  override emit<K extends keyof ChatEventMap>(event: K, payload: ChatEventMap[K]): boolean {
    return super.emit(event, payload);
  }

  override on<K extends keyof ChatEventMap>(event: K, listener: (payload: ChatEventMap[K]) => void): this {
    return super.on(event, listener);
  }
}

export const chatEvents = new ChatEventBus();

// One bus, many sockets: without this Node warns at 11 listeners, and each
// connected browser adds none — but the socket layer attaches a handful per
// event type and the default limit is easy to trip during reloads.
chatEvents.setMaxListeners(50);
