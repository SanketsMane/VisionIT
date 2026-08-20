'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Check, CheckCheck, Clock, Download, FileText, Image as ImageIcon,
  Loader2, Paperclip, Reply, Send, Trash2, Users, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/misc';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { chatApi, type ChatMessage, type ConversationDetail } from '@/lib/api/chat.api';
import { API_BASE_URL, getAccessToken } from '@/lib/api/client';
import { queryKeys } from '@/lib/hooks/query-keys';
import { useChatSocket, type TypingPeer } from '@/lib/hooks/use-chat-socket';
import { useAuthStore } from '@/store/auth.store';
import { cn } from '@/lib/utils';

const MAX_FILES = 10;

const formatSize = (bytes: number): string =>
  bytes < 1024 ? `${bytes} B`
    : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB`
      : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

const dayLabel = (iso: string): string => {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return 'Today';
  if (same(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

/**
 * Private attachments cannot go in a plain `src` — the browser would fetch them
 * without the Authorization header and get a 401. They are fetched as blobs and
 * released when the component unmounts.
 */
function useAuthedBlob(attachmentId: string, enabled: boolean) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let revoked: string | null = null;
    let cancelled = false;

    void (async () => {
      const response = await fetch(`${API_BASE_URL}${chatApi.attachmentUrl(attachmentId)}`, {
        headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
      });
      if (!response.ok || cancelled) return;
      const blob = await response.blob();
      if (cancelled) return;
      revoked = URL.createObjectURL(blob);
      setUrl(revoked);
    })();

    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [attachmentId, enabled]);

  return url;
}

function AttachmentBubble({ attachment, mine }: { attachment: ChatMessage['attachments'][number]; mine: boolean }) {
  const isImage = attachment.mimeType.startsWith('image/');
  const blobUrl = useAuthedBlob(attachment.id, isImage);

  const download = async () => {
    const response = await fetch(`${API_BASE_URL}${chatApi.attachmentUrl(attachment.id)}`, {
      headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
    });
    if (!response.ok) return toast.error('Could not download that file');
    const blob = await response.blob();
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = attachment.filename;
    link.click();
    URL.revokeObjectURL(href);
  };

  if (isImage) {
    return (
      <button type="button" onClick={() => void download()} className="block overflow-hidden rounded-lg">
        {blobUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={blobUrl} alt={attachment.filename} className="max-h-64 w-auto max-w-full object-cover" />
        ) : (
          <div className="grid h-40 w-56 place-items-center bg-muted/60">
            <ImageIcon className="size-5 text-muted-foreground" />
          </div>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void download()}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg border p-2.5 text-left transition-colors',
        mine ? 'border-white/25 hover:bg-white/10' : 'border-border hover:bg-accent',
      )}
    >
      <span className={cn('grid size-9 shrink-0 place-items-center rounded-md', mine ? 'bg-white/15' : 'bg-muted')}>
        <FileText className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium">{attachment.filename}</span>
        <span className={cn('block text-[10px]', mine ? 'text-white/70' : 'text-muted-foreground')}>
          {formatSize(attachment.sizeBytes)}
        </span>
      </span>
      <Download className="size-3.5 shrink-0 opacity-70" />
    </button>
  );
}

/** Sent → delivered → read, the way the ticks read on WhatsApp. */
function Ticks({ readByAll, pending }: { readByAll: boolean; pending?: boolean }) {
  if (pending) return <Clock className="size-3 opacity-70" />;
  return readByAll
    ? <CheckCheck className="size-3.5 text-sky-300" />
    : <Check className="size-3.5 opacity-70" />;
}

export function ChatWindow({
  conversationId,
  onBack,
  onOpenInfo,
}: {
  conversationId: string;
  onBack?: () => void;
  onOpenInfo?: () => void;
}) {
  const queryClient = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const { typing, startTyping, stopTyping, connected, onlineIds } = useChatSocket(conversationId);

  const [draft, setDraft] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const typingTimer = useRef<number | null>(null);

  const conversation = useQuery({
    queryKey: queryKeys.chat.conversation(conversationId),
    queryFn: () => chatApi.conversation(conversationId),
  });

  const messages = useQuery({
    queryKey: queryKeys.chat.messages(conversationId),
    queryFn: () => chatApi.messages(conversationId, { limit: 50 }),
  });

  const items = messages.data?.items ?? [];

  // Reading is a side effect of the thread being on screen, so it is driven by
  // the newest message rather than by a button nobody would press.
  useEffect(() => {
    const newest = items[items.length - 1];
    if (!newest || newest.sender?.id === me?.id) return;
    void chatApi.markRead(conversationId, newest.id).then(() => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.unread });
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.conversations });
    });
  }, [items, conversationId, me?.id, queryClient]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [items.length, typing.length]);

  const send = useMutation({
    mutationFn: () =>
      chatApi.send(
        conversationId,
        { body: draft.trim() || undefined, replyToId: replyTo?.id ?? null, files },
        files.length ? setProgress : undefined,
      ),
    onSuccess: () => {
      setDraft(''); setFiles([]); setReplyTo(null); setProgress(null);
      stopTyping(conversationId);
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.messages(conversationId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.conversations });
    },
    onError: (error) => {
      setProgress(null);
      toast.error(error instanceof Error ? error.message : 'Message not sent');
    },
  });

  const remove = useMutation({
    mutationFn: (messageId: string) => chatApi.deleteMessage(conversationId, messageId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.chat.messages(conversationId) }),
  });

  const onDraftChange = (value: string) => {
    setDraft(value);
    startTyping(conversationId);
    if (typingTimer.current) window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => stopTyping(conversationId), 1800);
  };

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const next = [...files, ...Array.from(list)].slice(0, MAX_FILES);
    if (next.length < files.length + list.length) toast.info(`Up to ${MAX_FILES} files at a time`);
    setFiles(next);
  };

  /**
   * A message counts as read once every *other* participant's mark has passed
   * it — the group equivalent of both ticks turning blue.
   */
  const readByAll = useMemo(() => {
    const receipts = messages.data?.receipts ?? [];
    return (message: ChatMessage) =>
      receipts.length > 0 &&
      receipts.every((r) => r.lastReadAt && new Date(r.lastReadAt) >= new Date(message.createdAt));
  }, [messages.data?.receipts]);

  const detail = conversation.data as ConversationDetail | undefined;
  const others = (detail?.participants ?? []).filter((p) => p.id !== me?.id);
  const isOnline = detail?.type === 'DIRECT' && others[0] && onlineIds.has(others[0].id);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-3 sm:px-4">
        {onBack && (
          <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={onBack} aria-label="Back">
            <ArrowLeft />
          </Button>
        )}
        <Avatar name={detail?.title ?? '…'} src={detail?.avatarUrl ?? undefined} size="sm" />
        <button type="button" onClick={onOpenInfo} className="min-w-0 flex-1 text-left">
          <p className="truncate text-sm font-semibold leading-tight">{detail?.title ?? 'Loading…'}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {typing.length > 0
              ? `${typing.map((t: TypingPeer) => t.name.split(' ')[0]).join(', ')} typing…`
              : detail?.type === 'GROUP'
                ? `${detail.participants.length} people`
                : isOnline ? 'Online' : (detail?.project.title ?? '')}
          </p>
        </button>
        {detail?.type === 'GROUP' && (
          <Button variant="ghost" size="icon-sm" onClick={onOpenInfo} aria-label="Group info">
            <Users />
          </Button>
        )}
        <span
          className={cn('size-2 shrink-0 rounded-full', connected ? 'bg-success' : 'bg-muted-foreground/40')}
          title={connected ? 'Connected' : 'Reconnecting…'}
        />
      </header>

      {/* ── Messages ───────────────────────────────────────────────── */}
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-slim px-3 py-4 sm:px-4">
        {messages.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className={cn('h-14', i % 2 ? 'ml-auto w-2/5' : 'w-1/2')} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={Send}
            title="No messages yet"
            description="Say hello — messages, photos and documents all work here."
            className="py-16"
          />
        ) : (
          <div className="space-y-1">
            {items.map((message, index) => {
              const mine = message.sender?.id === me?.id;
              const prev = items[index - 1];
              const showDay = !prev || dayLabel(prev.createdAt) !== dayLabel(message.createdAt);
              // Consecutive messages from one person share an avatar and name.
              const grouped =
                prev && prev.sender?.id === message.sender?.id && !showDay &&
                new Date(message.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60_000;

              if (message.type === 'SYSTEM') {
                return (
                  <div key={message.id}>
                    {showDay && <DayDivider label={dayLabel(message.createdAt)} />}
                    <p className="py-2 text-center text-[11px] text-muted-foreground">{message.body}</p>
                  </div>
                );
              }

              return (
                <div key={message.id}>
                  {showDay && <DayDivider label={dayLabel(message.createdAt)} />}
                  <div className={cn('group flex gap-2', mine ? 'justify-end' : 'justify-start')}>
                    {!mine && (
                      <div className="w-7 shrink-0 self-end">
                        {!grouped && (
                          <Avatar name={message.sender?.name} src={message.sender?.avatarUrl ?? undefined} size="xs" />
                        )}
                      </div>
                    )}

                    <div className={cn('max-w-[78%] sm:max-w-[65%]', mine && 'items-end')}>
                      {!mine && !grouped && detail?.type === 'GROUP' && (
                        <p className="mb-0.5 px-1 text-[11px] font-medium text-muted-foreground">
                          {message.sender?.name}
                        </p>
                      )}

                      <div
                        className={cn(
                          'relative rounded-2xl px-3 py-2 text-sm',
                          mine
                            ? 'rounded-br-sm bg-primary text-primary-foreground'
                            : 'rounded-bl-sm bg-muted text-foreground',
                          message.isDeleted && 'italic opacity-70',
                        )}
                      >
                        {message.replyTo && (
                          <div
                            className={cn(
                              'mb-1.5 rounded-md border-l-2 px-2 py-1 text-[11px]',
                              mine ? 'border-white/50 bg-white/10' : 'border-primary bg-background/60',
                            )}
                          >
                            <span className="block font-medium">{message.replyTo.sender?.name}</span>
                            <span className="line-clamp-2 opacity-80">
                              {message.replyTo.body ?? 'Attachment'}
                            </span>
                          </div>
                        )}

                        {message.attachments.length > 0 && (
                          <div className="mb-1.5 space-y-1.5">
                            {message.attachments.map((a) => (
                              <AttachmentBubble key={a.id} attachment={a} mine={mine} />
                            ))}
                          </div>
                        )}

                        {message.isDeleted ? (
                          <span className="text-xs">This message was deleted</span>
                        ) : (
                          message.body && <p className="whitespace-pre-wrap break-words">{message.body}</p>
                        )}

                        <span
                          className={cn(
                            'mt-1 flex items-center justify-end gap-1 text-[10px]',
                            mine ? 'text-white/70' : 'text-muted-foreground',
                          )}
                        >
                          {timeOf(message.createdAt)}
                          {mine && !message.isDeleted && <Ticks readByAll={readByAll(message)} />}
                        </span>
                      </div>

                      {!message.isDeleted && (
                        <div
                          className={cn(
                            'mt-0.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100',
                            mine ? 'justify-end' : 'justify-start',
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => setReplyTo(message)}
                            className="rounded p-1 text-muted-foreground hover:text-foreground"
                            aria-label="Reply"
                          >
                            <Reply className="size-3.5" />
                          </button>
                          {mine && (
                            <button
                              type="button"
                              onClick={() => remove.mutate(message.id)}
                              className="rounded p-1 text-muted-foreground hover:text-danger"
                              aria-label="Delete"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* ── Composer ───────────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-border p-2.5 sm:p-3">
        {replyTo && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border-l-2 border-primary bg-muted/60 px-2.5 py-1.5">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium">Replying to {replyTo.sender?.name}</p>
              <p className="truncate text-[11px] text-muted-foreground">{replyTo.body ?? 'Attachment'}</p>
            </div>
            <button type="button" onClick={() => setReplyTo(null)} aria-label="Cancel reply">
              <X className="size-3.5 text-muted-foreground" />
            </button>
          </div>
        )}

        {files.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {files.map((file, i) => (
              <span key={`${file.name}-${i}`} className="flex items-center gap-1.5 rounded-lg border border-border px-2 py-1 text-[11px]">
                <FileText className="size-3" />
                <span className="max-w-[140px] truncate">{file.name}</span>
                <span className="text-muted-foreground">{formatSize(file.size)}</span>
                <button type="button" onClick={() => setFiles(files.filter((_, x) => x !== i))} aria-label={`Remove ${file.name}`}>
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {progress !== null && (
          <div className="mb-2 h-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
          </div>
        )}

        <div className="flex items-end gap-2">
          <input
            ref={fileInput}
            type="file"
            multiple
            hidden
            onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
          />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => fileInput.current?.click()}
            aria-label="Attach files"
            disabled={send.isPending}
          >
            <Paperclip />
          </Button>

          <Textarea
            rows={1}
            value={draft}
            placeholder="Write a message…"
            className="max-h-32 min-h-[38px] flex-1 resize-none py-2"
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends; Shift+Enter is a newline, as everyone expects.
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (draft.trim() || files.length) send.mutate();
              }
            }}
          />

          <Button
            size="icon"
            onClick={() => send.mutate()}
            disabled={send.isPending || (!draft.trim() && !files.length)}
            aria-label="Send"
          >
            {send.isPending ? <Loader2 className="animate-spin" /> : <Send />}
          </Button>
        </div>
      </div>
    </div>
  );
}

function DayDivider({ label }: { label: string }) {
  return (
    <div className="my-3 flex items-center gap-3">
      <span className="h-px flex-1 bg-border" />
      <Badge variant="outline" size="sm">{label}</Badge>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
