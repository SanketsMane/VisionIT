'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageSquarePlus, Search, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar } from '@/components/ui/misc';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogBody, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { EmptyState } from '@/components/shared/empty-state';
import { ChatWindow } from './chat-window';
import { chatApi, type ChatPerson } from '@/lib/api/chat.api';
import { queryKeys } from '@/lib/hooks/query-keys';
import { useChatSocket } from '@/lib/hooks/use-chat-socket';
import { cn } from '@/lib/utils';

const relative = (iso: string | null): string => {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

/**
 * Two-pane chat: a list on the left, the open thread on the right.
 *
 * On a phone the two become one — the list is replaced by the thread rather
 * than squeezed beside it, which is what every messaging app does and the only
 * layout that leaves room to actually read a message.
 */
export function ChatShell({
  projects,
  basePath,
}: {
  projects: { id: string; title: string }[];
  basePath: string;
}) {
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [newOpen, setNewOpen] = useState(false);

  // Keeps the badge live even while sitting on the list.
  useChatSocket(activeId ?? undefined);

  const conversations = useQuery({
    queryKey: queryKeys.chat.conversations,
    queryFn: () => chatApi.conversations(),
    refetchInterval: 60_000,
  });

  const items = conversations.data ?? [];

  useEffect(() => {
    // Open the most recent thread on a wide screen so the pane is never empty.
    if (!activeId && items.length && window.innerWidth >= 1024) setActiveId(items[0].id);
  }, [items, activeId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        (c.lastMessagePreview ?? '').toLowerCase().includes(q) ||
        c.project.title.toLowerCase().includes(q),
    );
  }, [items, search]);

  return (
    <div className="flex h-[calc(100dvh-8rem)] min-h-[420px] overflow-hidden rounded-xl border border-border bg-card">
      {/* ── List ──────────────────────────────────────────────────── */}
      <aside
        className={cn(
          'flex w-full min-w-0 flex-col border-r border-border lg:w-80 lg:shrink-0',
          activeId && 'hidden lg:flex',
        )}
      >
        <div className="shrink-0 space-y-2.5 border-b border-border p-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Messages</h2>
            <Button size="sm" variant="outline" onClick={() => setNewOpen(true)}>
              <MessageSquarePlus /> New
            </Button>
          </div>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations"
            leading={<Search className="size-3.5" />}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-slim">
          {conversations.isLoading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={MessageSquarePlus}
              title={search ? 'Nothing matches' : 'No conversations yet'}
              description={search ? undefined : 'Start one with the New button.'}
              className="py-12"
            />
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveId(c.id)}
                className={cn(
                  'flex w-full items-start gap-2.5 border-b border-border px-3 py-2.5 text-left transition-colors',
                  activeId === c.id ? 'bg-primary-muted' : 'hover:bg-accent',
                )}
              >
                <div className="relative shrink-0">
                  <Avatar name={c.title} src={c.avatarUrl ?? undefined} size="sm" />
                  {c.type === 'GROUP' && (
                    <span className="absolute -bottom-0.5 -right-0.5 grid size-4 place-items-center rounded-full bg-card">
                      <Users className="size-2.5 text-muted-foreground" />
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className={cn('truncate text-xs', c.unreadCount ? 'font-semibold' : 'font-medium')}>
                      {c.title}
                    </p>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {relative(c.lastMessageAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p
                      className={cn(
                        'truncate text-[11px]',
                        c.unreadCount ? 'text-foreground' : 'text-muted-foreground',
                      )}
                    >
                      {c.lastMessageIsMine && 'You: '}
                      {c.lastMessagePreview ?? 'No messages yet'}
                    </p>
                    {c.unreadCount > 0 && (
                      <span className="grid min-w-[18px] shrink-0 place-items-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                        {c.unreadCount > 99 ? '99+' : c.unreadCount}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{c.project.title}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* ── Thread ────────────────────────────────────────────────── */}
      <div className={cn('min-w-0 flex-1', !activeId && 'hidden lg:block')}>
        {activeId ? (
          <ChatWindow conversationId={activeId} onBack={() => setActiveId(null)} />
        ) : (
          <div className="grid h-full place-items-center p-6">
            <EmptyState
              icon={MessageSquarePlus}
              title="Pick a conversation"
              description="Or start a new one to message someone on a project."
            />
          </div>
        )}
      </div>

      <NewConversationDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        projects={projects}
        onCreated={(id) => {
          setActiveId(id);
          void queryClient.invalidateQueries({ queryKey: queryKeys.chat.conversations });
        }}
      />
    </div>
  );
}

function NewConversationDialog({
  open, onOpenChange, projects, onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: { id: string; title: string }[];
  onCreated: (conversationId: string) => void;
}) {
  const [projectId, setProjectId] = useState<string>('');
  const [mode, setMode] = useState<'direct' | 'group'>('direct');
  const [title, setTitle] = useState('');
  const [picked, setPicked] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setProjectId(projects[0]?.id ?? '');
      setMode('direct'); setTitle(''); setPicked([]);
    }
  }, [open, projects]);

  const people = useQuery({
    queryKey: queryKeys.chat.people(projectId),
    queryFn: () => chatApi.people(projectId),
    enabled: open && Boolean(projectId),
  });

  const create = useMutation({
    mutationFn: async () => {
      if (mode === 'direct') return chatApi.openDirect(projectId, picked[0]);
      return chatApi.createGroup({ projectId, title: title.trim(), participantIds: picked });
    },
    onSuccess: (conversation) => {
      onCreated(conversation.id);
      onOpenChange(false);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Could not start that conversation'),
  });

  const toggle = (id: string) =>
    setPicked((current) =>
      mode === 'direct'
        ? [id]
        : current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );

  const canSubmit =
    Boolean(projectId) &&
    picked.length > 0 &&
    (mode === 'direct' || title.trim().length >= 2);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New conversation</DialogTitle>
          <DialogDescription>
            Chat is per project — everyone in a thread must be a member of it.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="chat-project">Project</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger id="chat-project"><SelectValue placeholder="Choose a project" /></SelectTrigger>
              <SelectContent>
                {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-1.5">
            {(['direct', 'group'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => { setMode(value); setPicked([]); }}
                className={cn(
                  'flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
                  mode === value
                    ? 'border-primary bg-primary-muted text-primary'
                    : 'border-border text-muted-foreground hover:text-foreground',
                )}
              >
                {value === 'direct' ? 'Direct message' : 'Group'}
              </button>
            ))}
          </div>

          {mode === 'group' && (
            <div className="space-y-1.5">
              <Label htmlFor="chat-title">Group name</Label>
              <Input
                id="chat-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Design review"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>{mode === 'direct' ? 'Who do you want to message?' : 'Who should be in it?'}</Label>
            <div className="max-h-56 space-y-1 overflow-y-auto scrollbar-slim rounded-lg border border-border p-1.5">
              {people.isLoading ? (
                <Skeleton className="h-10" />
              ) : (people.data ?? []).length === 0 ? (
                <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                  Nobody else has access to this project yet.
                </p>
              ) : (
                (people.data ?? []).map((person: ChatPerson) => (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => toggle(person.id)}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors',
                      picked.includes(person.id) ? 'bg-primary-muted' : 'hover:bg-accent',
                    )}
                  >
                    <Avatar name={person.name} src={person.avatarUrl ?? undefined} size="xs" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium">{person.name}</span>
                      <span className="block truncate text-[10px] text-muted-foreground">{person.email}</span>
                    </span>
                    <Badge variant={person.userType === 'INTERNAL' ? 'primary' : 'outline'} size="sm">
                      {person.userType === 'INTERNAL' ? 'Studio' : 'Client'}
                    </Badge>
                  </button>
                ))
              )}
            </div>
            {mode === 'group' && picked.length > 0 && (
              <p className="text-[11px] text-muted-foreground">{picked.length} selected</p>
            )}
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!canSubmit} loading={create.isPending} onClick={() => create.mutate()}>
            {mode === 'direct' ? 'Start chat' : 'Create group'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
