'use client';

import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL, getAccessToken } from '@/lib/api/client';
import { useAuthStore } from '@/store/auth.store';
import { queryKeys } from './query-keys';
import type { ChatMessage } from '@/lib/api/chat.api';

/**
 * One socket for the whole app.
 *
 * A module-level connection rather than one per component: every screen that
 * shows a chat badge would otherwise open its own, and a user with the
 * conversation list and a thread open would hold two connections receiving
 * identical traffic.
 *
 * The socket only *invalidates* — it never writes into the cache directly.
 * React Query then refetches through the same authorised endpoints the rest of
 * the app uses, so a pushed payload can never put data on screen that the API
 * would have refused to return.
 */

let socket: Socket | null = null;

/**
 * The socket outlives any single component.
 *
 * Ref-counting it and closing on the last unmount looked tidier but was wrong:
 * React remounts effects in development, so the count hit zero between the
 * unmount and the remount and closed the connection mid-handshake — the browser
 * reported "closed before the connection is established" and nothing ever
 * arrived. One connection per signed-in session, dropped on sign-out, avoids
 * the race entirely and costs nothing to keep.
 */
export const closeChatSocket = (): void => {
  socket?.close();
  socket = null;
};

const socketOrigin = (): string => {
  // API_BASE_URL is ".../api/v1"; the socket lives at the server root.
  try {
    return new URL(API_BASE_URL, window.location.origin).origin;
  } catch {
    return window.location.origin;
  }
};

export interface TypingPeer { userId: string; name: string }

export function useChatSocket(activeConversationId?: string) {
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userId = useAuthStore((s) => s.user?.id);
  // Seeded from the live socket: a component mounting after the connection is
  // already up would otherwise wait forever for a 'connect' that already fired.
  const [connected, setConnected] = useState(() => socket?.connected ?? false);
  const [typing, setTyping] = useState<TypingPeer[]>([]);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const activeRef = useRef(activeConversationId);
  activeRef.current = activeConversationId;

  useEffect(() => {
    if (!isAuthenticated) return;
    const token = getAccessToken();
    if (!token) return;

    if (!socket) {
      socket = io(socketOrigin(), {
        path: '/socket.io',
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnectionDelay: 1000,
        reconnectionDelayMax: 8000,
      });
    }
    const s = socket;
    if (s.connected) setConnected(true);

    const onReady = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    const onMessage = ({ conversationId, message }: { conversationId: string; message: ChatMessage }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.messages(conversationId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.conversations });
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.unread });
      // A message ends whatever the sender was typing.
      setTyping((peers) => peers.filter((p) => p.userId !== message.sender?.id));
    };

    const onRead = ({ conversationId }: { conversationId: string }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.messages(conversationId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.conversations });
    };

    const onConversationChanged = () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.conversations });
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.unread });
    };

    const onTypingStart = (p: { conversationId: string; userId: string; name: string }) => {
      if (p.conversationId !== activeRef.current || p.userId === userId) return;
      setTyping((peers) => (peers.some((x) => x.userId === p.userId) ? peers : [...peers, p]));
      // Self-expiring: a browser that closes mid-keystroke never sends "stop",
      // and the indicator would otherwise stick forever.
      window.setTimeout(
        () => setTyping((peers) => peers.filter((x) => x.userId !== p.userId)),
        4000,
      );
    };

    const onTypingStop = (p: { userId: string }) =>
      setTyping((peers) => peers.filter((x) => x.userId !== p.userId));

    const onOnline = ({ userId: id }: { userId: string }) =>
      setOnlineIds((prev) => new Set(prev).add(id));
    const onOffline = ({ userId: id }: { userId: string }) =>
      setOnlineIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });

    s.on('ready', onReady);
    s.on('connect', onReady);
    s.on('disconnect', onDisconnect);
    s.on('message:new', onMessage);
    s.on('message:read', onRead);
    s.on('message:deleted', onRead);
    s.on('conversation:created', onConversationChanged);
    s.on('conversation:updated', onConversationChanged);
    s.on('typing:start', onTypingStart);
    s.on('typing:stop', onTypingStop);
    s.on('presence:online', onOnline);
    s.on('presence:offline', onOffline);

    return () => {
      s.off('ready', onReady);
      s.off('connect', onReady);
      s.off('disconnect', onDisconnect);
      s.off('message:new', onMessage);
      s.off('message:read', onRead);
      s.off('message:deleted', onRead);
      s.off('conversation:created', onConversationChanged);
      s.off('conversation:updated', onConversationChanged);
      s.off('typing:start', onTypingStart);
      s.off('typing:stop', onTypingStop);
      s.off('presence:online', onOnline);
      s.off('presence:offline', onOffline);
      // Listeners only — the connection itself is left alone. See the note on
      // `closeChatSocket` above.
    };
  }, [isAuthenticated, queryClient, userId]);

  useEffect(() => {
    if (!socket || !activeConversationId) return;
    socket.emit('conversation:join', activeConversationId);
    setTyping([]);
  }, [activeConversationId]);

  return {
    connected,
    typing,
    onlineIds,
    startTyping: (conversationId: string) => socket?.emit('typing:start', conversationId),
    stopTyping: (conversationId: string) => socket?.emit('typing:stop', conversationId),
  };
}
