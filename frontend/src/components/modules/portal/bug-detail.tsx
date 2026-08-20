'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, Check, Lock, MessageSquare, Paperclip, Send, ShieldAlert,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input, Textarea } from '@/components/ui/input';
import { Avatar, Switch } from '@/components/ui/misc';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogBody, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { SectionHeader } from '@/components/shared/page-header';
import { Field, FieldRow } from '@/components/shared/form-field';
import { ErrorState } from '@/components/shared/empty-state';
import { BugStatusBadge, PriorityBadge, SeverityBadge } from '@/components/shared/portal-badges';
import { bugsApi, teamApi } from '@/lib/api/portal.api';
import { queryKeys } from '@/lib/hooks/query-keys';
import { useMutationHandlers } from '@/lib/hooks/use-mutation-toast';
import { getAccessToken } from '@/lib/api/client';
import { formatDate, formatDateTime, formatFileSize, formatRelative, humanize } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { BugPriority, BugStatus } from '@/types/portal';

export function BugDetail({
  projectId,
  bugId,
  backHref,
  /** Studio users get triage controls and internal comments. */
  isInternal,
}: {
  projectId: string;
  bugId: string;
  backHref: string;
  isInternal: boolean;
}) {
  const { onSuccess, onError } = useMutationHandlers();
  const [comment, setComment] = useState('');
  const [commentInternal, setCommentInternal] = useState(false);
  const [ackOpen, setAckOpen] = useState(false);

  const bug = useQuery({
    queryKey: queryKeys.portal.bug(projectId, bugId),
    queryFn: () => bugsApi.byId(projectId, bugId),
    enabled: Boolean(projectId && bugId),
  });

  const invalidate = [
    queryKeys.portal.bug(projectId, bugId),
    ['portal', 'bugs'],
    ['portal', 'bug-stats'],
  ];

  const changeStatus = useMutation({
    mutationFn: (status: BugStatus) => bugsApi.changeStatus(projectId, bugId, { status }),
    onSuccess: (updated) => onSuccess(`Moved to ${updated.statusLabel}`, invalidate),
    onError: (error) => onError(error, 'Could not update the issue'),
  });

  const postComment = useMutation({
    mutationFn: () => bugsApi.comment(projectId, bugId, comment.trim(), commentInternal),
    onSuccess: () => {
      onSuccess(commentInternal ? 'Internal note added' : 'Comment added', invalidate);
      setComment('');
      setCommentInternal(false);
    },
    onError: (error) => onError(error, 'Could not post the comment'),
  });

  if (bug.isError) {
    return (
      <Card>
        <ErrorState
          title="Could not load this issue"
          message={bug.error instanceof Error ? bug.error.message : undefined}
          onRetry={() => void bug.refetch()}
        />
      </Card>
    );
  }

  if (bug.isLoading || !bug.data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-96 lg:col-span-2" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  const data = bug.data;

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
          <Link href={backHref}><ArrowLeft /> All issues</Link>
        </Button>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="font-mono text-xs text-muted-foreground">{data.key}</p>
            <h1 className="text-xl font-semibold tracking-tight">{data.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <BugStatusBadge status={data.status} />
              <PriorityBadge priority={data.priority} />
              <SeverityBadge severity={data.severity} />
              {data.module && <Badge variant="outline">{data.module}</Badge>}
              {data.duplicateOf && (
                <Badge variant="default">Duplicate of {data.duplicateOf.key}</Badge>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isInternal && data.status === 'SUBMITTED' && (
              <Button onClick={() => setAckOpen(true)}>
                <Check /> Acknowledge
              </Button>
            )}

            {data.availableTransitions.length > 0 && (
              <Select onValueChange={(value) => changeStatus.mutate(value as BugStatus)}>
                <SelectTrigger className="w-auto min-w-[170px]">
                  <SelectValue placeholder="Move to…" />
                </SelectTrigger>
                <SelectContent>
                  {data.availableTransitions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <SectionHeader title="Details" />
            <CardContent className="space-y-4 p-5 pt-4">
              <Block label="Description" body={data.description} />
              {data.expectedBehavior && <Block label="Expected behaviour" body={data.expectedBehavior} />}
              {data.actualBehavior && <Block label="Actual behaviour" body={data.actualBehavior} />}
              {data.stepsToReproduce && <Block label="Steps to reproduce" body={data.stepsToReproduce} mono />}
            </CardContent>
          </Card>

          {data.attachments.length > 0 && (
            <Card>
              <SectionHeader title="Attachments" description={`${data.attachments.length} file(s)`} />
              <CardContent className="p-5 pt-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {data.attachments.map((attachment) => (
                    <AttachmentTile
                      key={attachment.id}
                      projectId={projectId}
                      bugId={bugId}
                      attachment={attachment}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Discussion ────────────────────────────────────────────── */}
          <Card>
            <SectionHeader
              title="Discussion"
              description={`${data.comments.length} comment(s)`}
            />
            <CardContent className="p-0">
              {data.comments.length === 0 ? (
                <p className="px-5 py-8 text-center text-xs text-muted-foreground">
                  No comments yet
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {data.comments.map((item) => (
                    <li
                      key={item.id}
                      className={cn('px-5 py-4', item.isInternal && 'bg-warning-muted/30')}
                    >
                      <div className="flex items-start gap-3">
                        <Avatar name={item.author.name} src={item.author.avatarUrl} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-medium">{item.author.name}</span>
                            {item.author.userType === 'INTERNAL' && (
                              <Badge variant="success" size="sm">Team</Badge>
                            )}
                            {item.isInternal && (
                              <Badge variant="warning" size="sm" className="gap-1">
                                <Lock className="size-2.5" /> Internal only
                              </Badge>
                            )}
                            <span className="text-[10px] text-muted-foreground">
                              {formatRelative(item.createdAt)}
                            </span>
                          </div>
                          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">{item.body}</p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <div className="space-y-2 border-t border-border p-4">
                <Textarea
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Add a comment…"
                  className={cn(commentInternal && 'border-warning bg-warning-muted/20')}
                />

                <div className="flex flex-wrap items-center justify-between gap-2">
                  {isInternal ? (
                    <label className="flex cursor-pointer items-center gap-2">
                      <Switch checked={commentInternal} onCheckedChange={setCommentInternal} />
                      <span className="text-[11px] text-muted-foreground">
                        Internal only — <span className="font-medium">the client will never see this</span>
                      </span>
                    </label>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">
                      Visible to your team and the studio
                    </span>
                  )}

                  <Button
                    size="sm"
                    disabled={!comment.trim()}
                    loading={postComment.isPending}
                    onClick={() => postComment.mutate()}
                  >
                    <Send /> {commentInternal ? 'Add internal note' : 'Comment'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Side panel ──────────────────────────────────────────────── */}
        <div className="space-y-4">
          <Card>
            <SectionHeader title="Issue info" />
            <CardContent className="p-5 pt-4">
              <dl className="space-y-2 text-xs">
                <Row label="Reported by" value={data.reportedBy.name} />
                <Row label="Reported" value={formatDate(data.createdAt)} />
                <Row label="Assigned to" value={data.assignedTo?.name ?? 'Unassigned'} />
                {data.dueDate && <Row label="Target date" value={formatDate(data.dueDate)} />}
                {data.acknowledgedAt && <Row label="Acknowledged" value={formatDate(data.acknowledgedAt)} />}
                {data.resolvedAt && <Row label="Fixed" value={formatDate(data.resolvedAt)} />}
                {data.closedAt && <Row label="Closed" value={formatDate(data.closedAt)} />}
              </dl>
            </CardContent>
          </Card>

          {(data.browser || data.os || data.device || data.url) && (
            <Card>
              <SectionHeader title="Environment" />
              <CardContent className="p-5 pt-4">
                <dl className="space-y-2 text-xs">
                  {data.browser && <Row label="Browser" value={data.browser} />}
                  {data.os && <Row label="OS" value={data.os} />}
                  {data.device && <Row label="Device" value={data.device} />}
                  {data.environment && <Row label="Environment" value={data.environment} />}
                </dl>
                {data.url && (
                  <a
                    href={data.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 block truncate text-[11px] text-primary hover:underline"
                  >
                    {data.url}
                  </a>
                )}
              </CardContent>
            </Card>
          )}

          {isInternal && data.internalNote && (
            <Card className="border-warning/40 bg-warning-muted/20">
              <SectionHeader title="Internal triage note" />
              <CardContent className="p-5 pt-4">
                <p className="flex items-start gap-2 whitespace-pre-line text-xs leading-relaxed">
                  <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-warning" />
                  {data.internalNote}
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <SectionHeader title="Activity" />
            <CardContent className="p-0">
              <ol className="divide-y divide-border">
                {data.activities.map((entry) => (
                  <li key={entry.id} className="flex items-start gap-2.5 px-5 py-2.5">
                    <span
                      className={cn(
                        'mt-1 size-1.5 shrink-0 rounded-full',
                        entry.isInternal ? 'bg-warning' : 'bg-primary',
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px]">
                        <span className="font-medium">{entry.actor?.name ?? 'System'}</span>{' '}
                        <span className="text-muted-foreground">
                          {describeActivity(entry.action, entry.field, entry.oldValue, entry.newValue)}
                        </span>
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatDateTime(entry.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>

      {isInternal && (
        <AcknowledgeDialog
          open={ackOpen}
          onOpenChange={setAckOpen}
          projectId={projectId}
          bugId={bugId}
          currentPriority={data.priority}
        />
      )}
    </div>
  );
}

function describeActivity(
  action: string,
  field: string | null,
  oldValue: string | null,
  newValue: string | null,
): string {
  if (action === 'submitted') return 'reported this issue';
  if (action === 'acknowledged') return 'acknowledged the issue';
  if (action === 'assigned') return 'assigned the issue';
  if (action === 'commented') return 'commented';
  if (action === 'internal_comment') return 'added an internal note';
  if (action === 'internal_note') return 'added a triage note';
  if (action === 'status_changed' && oldValue && newValue) {
    return `moved it from ${humanize(oldValue)} to ${humanize(newValue)}`;
  }
  if (action === 'updated' && field) {
    return `changed ${humanize(field)}${newValue ? ` to ${humanize(newValue)}` : ''}`;
  }
  return humanize(action);
}

function Block({ label, body, mono }: { label: string; body: string; mono?: boolean }) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={cn('whitespace-pre-line text-sm leading-relaxed', mono && 'font-mono text-xs')}>
        {body}
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium">{value}</dd>
    </div>
  );
}

/**
 * Attachments live in private storage behind an authorised route, so the image
 * is fetched with the bearer token and rendered from a blob URL rather than
 * being pointed at directly with <img src>.
 */
function AttachmentTile({
  projectId,
  bugId,
  attachment,
}: {
  projectId: string;
  bugId: string;
  attachment: { id: string; filename: string; mimeType: string; sizeBytes: number };
}) {
  const [url, setUrl] = useState<string | null>(null);
  const isImage = attachment.mimeType.startsWith('image/');

  const load = async () => {
    if (url) return;
    const response = await fetch(bugsApi.attachmentUrl(projectId, bugId, attachment.id), {
      headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
      credentials: 'include',
    });
    if (!response.ok) return;
    setUrl(URL.createObjectURL(await response.blob()));
  };

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      {isImage ? (
        url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={attachment.filename} className="h-36 w-full bg-muted object-contain" />
        ) : (
          <button
            type="button"
            onClick={() => void load()}
            className="grid h-36 w-full place-items-center bg-muted text-xs text-muted-foreground transition-colors hover:bg-accent"
          >
            Click to load preview
          </button>
        )
      ) : (
        <div className="grid h-36 w-full place-items-center bg-muted">
          <Paperclip className="size-6 text-muted-foreground" />
        </div>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium">{attachment.filename}</p>
          <p className="text-[10px] text-muted-foreground">{formatFileSize(attachment.sizeBytes)}</p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => void load().then(() => url && window.open(url, '_blank'))}
          aria-label="Open attachment"
        >
          <Paperclip />
        </Button>
      </div>
    </div>
  );
}

/** The spec's "Acknowledge Bug" action — triage in a single step. */
function AcknowledgeDialog({
  open,
  onOpenChange,
  projectId,
  bugId,
  currentPriority,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  bugId: string;
  currentPriority: BugPriority;
}) {
  const { onSuccess, onError } = useMutationHandlers();
  const [assignedToUserId, setAssignedTo] = useState('');
  const [priority, setPriority] = useState<BugPriority>(currentPriority);
  const [dueDate, setDueDate] = useState('');
  const [internalNote, setInternalNote] = useState('');

  const members = useQuery({
    queryKey: queryKeys.portal.members(projectId),
    queryFn: () => teamApi.members(projectId),
    enabled: open,
  });

  const acknowledge = useMutation({
    mutationFn: () =>
      bugsApi.acknowledge(projectId, bugId, {
        assignedToUserId: assignedToUserId || null,
        priority,
        dueDate: dueDate || null,
        internalNote: internalNote.trim() || null,
      }),
    onSuccess: () => {
      onSuccess('Issue acknowledged — the reporter has been notified', [
        queryKeys.portal.bug(projectId, bugId),
        ['portal', 'bugs'],
        ['portal', 'bug-stats'],
      ]);
      onOpenChange(false);
    },
    onError: (error) => onError(error, 'Could not acknowledge the issue'),
  });

  // Only studio members can be assigned work.
  const assignable = (members.data ?? []).filter((m) => m.role === 'INTERNAL_MEMBER');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Acknowledge issue</DialogTitle>
          <DialogDescription>
            The reporter is told it&apos;s been seen. Assigning also notifies whoever picks it up.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <Field label="Assign to" hint="Optional — moves the issue straight to Assigned.">
            <Select
              value={assignedToUserId || 'none'}
              onValueChange={(v) => setAssignedTo(v === 'none' ? '' : v)}
            >
              <SelectTrigger><SelectValue placeholder="Leave unassigned" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Leave unassigned</SelectItem>
                {assignable.map((member) => (
                  <SelectItem key={member.user.id} value={member.user.id}>{member.user.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <FieldRow>
            <Field label="Priority">
              <Select value={priority} onValueChange={(v) => setPriority(v as BugPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as BugPriority[]).map((value) => (
                    <SelectItem key={value} value={value}>{humanize(value)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Target resolution date">
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </Field>
          </FieldRow>

          <Field
            label="Internal note"
            hint="Only your team sees this — never the client."
          >
            <Textarea
              rows={3}
              value={internalNote}
              onChange={(e) => setInternalNote(e.target.value)}
              placeholder="Likely the Safari CSS issue in the auth component."
            />
          </Field>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button loading={acknowledge.isPending} onClick={() => acknowledge.mutate()}>
            <MessageSquare /> Acknowledge
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
