'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Bug, Paperclip, Plus, Upload, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input, Textarea } from '@/components/ui/input';
import { Avatar } from '@/components/ui/misc';
import { TableSkeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogBody, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { PageHeader } from '@/components/shared/page-header';
import { SearchInput } from '@/components/shared/search-input';
import { Pagination } from '@/components/shared/pagination';
import { EmptyState, ErrorState } from '@/components/shared/empty-state';
import { StatCard } from '@/components/shared/stat-card';
import { Field, FieldRow } from '@/components/shared/form-field';
import { BugStatusBadge, PriorityBadge, SeverityBadge } from '@/components/shared/portal-badges';
import { bugsApi, type BugListParams } from '@/lib/api/portal.api';
import { queryKeys } from '@/lib/hooks/query-keys';
import { useMutationHandlers } from '@/lib/hooks/use-mutation-toast';
import { formatDate, formatRelative, humanize } from '@/lib/format';
import { formatFileSize } from '@/lib/format';
import type { BugPriority, BugSeverity, BugStatus } from '@/types/portal';

/**
 * The QA board. Shared by the studio workspace and the client portal — the
 * server already filters what each side may see, so the same component works
 * for both; only the link base differs.
 */
export function BugBoard({
  projectId,
  basePath,
  canReport,
}: {
  projectId: string;
  /** Where a row links to, e.g. `/portal/projects/x/testing`. */
  basePath: string;
  canReport: boolean;
}) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<BugStatus | 'all'>('all');
  const [priority, setPriority] = useState<BugPriority | 'all'>('all');
  const [openOnly, setOpenOnly] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const params: BugListParams = useMemo(
    () => ({
      page,
      limit: 25,
      search: search || undefined,
      status: status === 'all' ? undefined : status,
      priority: priority === 'all' ? undefined : priority,
      openOnly: openOnly || undefined,
    }),
    [page, search, status, priority, openOnly],
  );

  const bugs = useQuery({
    queryKey: queryKeys.portal.bugs(projectId, params),
    queryFn: () => bugsApi.list(projectId, params),
  });

  const stats = useQuery({
    queryKey: queryKeys.portal.bugStats(projectId),
    queryFn: () => bugsApi.stats(projectId),
  });

  const options = useQuery({
    queryKey: queryKeys.portal.bugOptions(projectId),
    queryFn: () => bugsApi.options(projectId),
  });

  const items = bugs.data?.items ?? [];
  const hasFilters = Boolean(search) || status !== 'all' || priority !== 'all' || openOnly;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Testing"
        description="Report issues, track their progress and retest fixes."
        actions={
          canReport && (
            <Button onClick={() => setReportOpen(true)}>
              <Plus /> Report issue
            </Button>
          )
        }
      />

      {stats.data && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total issues" value={stats.data.total} format="number" icon={Bug} />
          <StatCard
            label="Open"
            value={stats.data.open}
            format="number"
            tone={stats.data.open > 0 ? 'warning' : 'success'}
          />
          <StatCard
            label="Critical"
            value={stats.data.critical}
            format="number"
            tone={stats.data.critical > 0 ? 'danger' : 'default'}
          />
          <StatCard label="Resolved" value={stats.data.resolved} format="number" tone="success" />
        </div>
      )}

      <Card>
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center">
          <SearchInput
            value={search}
            onChange={(value) => { setSearch(value); setPage(1); }}
            placeholder="Search issues…"
            className="lg:max-w-xs"
          />

          <div className="flex flex-1 flex-wrap items-center gap-2">
            <Select value={status} onValueChange={(v) => { setStatus(v as BugStatus | 'all'); setPage(1); }}>
              <SelectTrigger className="w-auto min-w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {options.data?.statuses.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={priority} onValueChange={(v) => { setPriority(v as BugPriority | 'all'); setPage(1); }}>
              <SelectTrigger className="w-auto min-w-[130px]"><SelectValue placeholder="Priority" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All priorities</SelectItem>
                {options.data?.priorities.map((value) => (
                  <SelectItem key={value} value={value}>{humanize(value)}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant={openOnly ? 'primary' : 'outline'}
              size="sm"
              onClick={() => { setOpenOnly((v) => !v); setPage(1); }}
            >
              Open only
            </Button>

            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setSearch(''); setStatus('all'); setPriority('all'); setOpenOnly(false); setPage(1); }}
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        {bugs.isError ? (
          <ErrorState onRetry={() => void bugs.refetch()} />
        ) : bugs.isLoading ? (
          <TableSkeleton rows={6} columns={6} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Bug}
            title={hasFilters ? 'No issues match' : 'No issues reported'}
            description={
              hasFilters
                ? 'Try loosening the filters above.'
                : canReport
                  ? 'Found something wrong? Report it and the team will pick it up.'
                  : 'Nothing has been reported on this project yet.'
            }
            action={
              canReport && (
                <Button size="sm" onClick={() => setReportOpen(true)}>
                  <Plus /> Report issue
                </Button>
              )
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Issue</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reported by</TableHead>
                <TableHead>Assigned</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((bug) => (
                <TableRow key={bug.id} interactive>
                  <TableCell>
                    <Link href={`${basePath}/${bug.id}`} className="block group">
                      <span className="font-mono text-[10px] text-muted-foreground">{bug.key}</span>
                      <p className="truncate text-sm font-medium transition-colors group-hover:text-primary">
                        {bug.title}
                      </p>
                      <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                        {bug.module && <span>{bug.module}</span>}
                        {(bug._count?.attachments ?? 0) > 0 && (
                          <span className="flex items-center gap-0.5">
                            <Paperclip className="size-2.5" /> {bug._count?.attachments}
                          </span>
                        )}
                        {(bug._count?.comments ?? 0) > 0 && <span>{bug._count?.comments} comment(s)</span>}
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell><PriorityBadge priority={bug.priority} size="sm" /></TableCell>
                  <TableCell><SeverityBadge severity={bug.severity} size="sm" /></TableCell>
                  <TableCell><BugStatusBadge status={bug.status} size="sm" /></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Avatar name={bug.reportedBy.name} size="xs" />
                      <span className="truncate text-xs">{bug.reportedBy.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {bug.assignedTo ? (
                      <div className="flex items-center gap-1.5">
                        <Avatar name={bug.assignedTo.name} size="xs" />
                        <span className="truncate text-xs">{bug.assignedTo.name}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-[11px] text-muted-foreground">
                    {formatRelative(bug.updatedAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Pagination meta={bugs.data?.meta} onPageChange={setPage} label="issues" />
      </Card>

      <ReportBugDialog open={reportOpen} onOpenChange={setReportOpen} projectId={projectId} />
    </div>
  );
}

/** Captures everything a developer needs to actually reproduce the problem. */
function ReportBugDialog({
  open,
  onOpenChange,
  projectId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}) {
  const { onSuccess, onError } = useMutationHandlers();

  const [form, setForm] = useState({
    title: '',
    description: '',
    expectedBehavior: '',
    actualBehavior: '',
    stepsToReproduce: '',
    priority: 'MEDIUM' as BugPriority,
    severity: 'MAJOR' as BugSeverity,
    module: '',
    browser: '',
    device: '',
    os: '',
    url: '',
  });
  const [files, setFiles] = useState<File[]>([]);

  const modules = useQuery({
    queryKey: queryKeys.portal.bugModules(projectId),
    queryFn: () => bugsApi.modules(projectId),
    enabled: open,
  });

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  /** Pre-fills the environment from the reporter's own browser. */
  const autofillEnvironment = () => {
    const ua = navigator.userAgent;
    const browser = /Edg\//.test(ua)
      ? 'Edge'
      : /Chrome\//.test(ua)
        ? 'Chrome'
        : /Safari\//.test(ua)
          ? 'Safari'
          : /Firefox\//.test(ua)
            ? 'Firefox'
            : 'Unknown';
    const os = /Mac OS X/.test(ua)
      ? 'macOS'
      : /Windows/.test(ua)
        ? 'Windows'
        : /Android/.test(ua)
          ? 'Android'
          : /iPhone|iPad/.test(ua)
            ? 'iOS'
            : 'Unknown';

    setForm((current) => ({
      ...current,
      browser,
      os,
      device: /Mobi/.test(ua) ? 'Mobile' : 'Desktop',
      url: current.url || window.location.href,
    }));
  };

  const create = useMutation({
    mutationFn: () =>
      bugsApi.create(projectId, {
        title: form.title,
        description: form.description,
        expectedBehavior: form.expectedBehavior || undefined,
        actualBehavior: form.actualBehavior || undefined,
        stepsToReproduce: form.stepsToReproduce || undefined,
        priority: form.priority,
        severity: form.severity,
        module: form.module || undefined,
        browser: form.browser || undefined,
        device: form.device || undefined,
        os: form.os || undefined,
        url: form.url || undefined,
        attachments: files,
      }),
    onSuccess: (bug) => {
      onSuccess(`${bug.key} reported`, [
        queryKeys.portal.bugs(projectId, {}),
        ['portal', 'bugs'],
        ['portal', 'bug-stats'],
        queryKeys.portal.workspace(projectId),
      ]);
      setForm({
        title: '', description: '', expectedBehavior: '', actualBehavior: '',
        stepsToReproduce: '', priority: 'MEDIUM', severity: 'MAJOR',
        module: '', browser: '', device: '', os: '', url: '',
      });
      setFiles([]);
      onOpenChange(false);
    },
    onError: (error) => onError(error, 'Could not report the issue'),
  });

  const canSubmit = form.title.trim().length >= 4 && form.description.trim().length >= 10;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>Report an issue</DialogTitle>
          <DialogDescription>
            The more detail you give, the faster it gets fixed. Screenshots help enormously.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <Field label="What went wrong?" required hint="A short, specific title.">
            <Input
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="Login button does nothing on Safari"
              autoFocus
            />
          </Field>

          <Field label="Description" required>
            <Textarea
              rows={3}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Describe what happened and when you noticed it."
            />
          </Field>

          <FieldRow>
            <Field label="What did you expect?">
              <Textarea
                rows={2}
                value={form.expectedBehavior}
                onChange={(e) => set('expectedBehavior', e.target.value)}
                placeholder="I should be signed in and taken to the dashboard."
              />
            </Field>
            <Field label="What happened instead?">
              <Textarea
                rows={2}
                value={form.actualBehavior}
                onChange={(e) => set('actualBehavior', e.target.value)}
                placeholder="Nothing happens — the page stays the same."
              />
            </Field>
          </FieldRow>

          <Field label="Steps to reproduce" hint="Numbered steps are ideal.">
            <Textarea
              rows={3}
              value={form.stepsToReproduce}
              onChange={(e) => set('stepsToReproduce', e.target.value)}
              placeholder={'1. Open the login page\n2. Enter valid credentials\n3. Click Sign in'}
            />
          </Field>

          <FieldRow className="lg:grid-cols-3">
            <Field label="Priority" hint="How urgent is it?">
              <Select value={form.priority} onValueChange={(v) => set('priority', v as BugPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as BugPriority[]).map((value) => (
                    <SelectItem key={value} value={value}>{humanize(value)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Severity" hint="How much does it break?">
              <Select value={form.severity} onValueChange={(v) => set('severity', v as BugSeverity)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['COSMETIC', 'MINOR', 'MAJOR', 'CRITICAL', 'BLOCKER'] as BugSeverity[]).map((value) => (
                    <SelectItem key={value} value={value}>{humanize(value)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Module / area">
              <Input
                value={form.module}
                onChange={(e) => set('module', e.target.value)}
                placeholder="Auth, Checkout…"
                list="bug-modules"
              />
              <datalist id="bug-modules">
                {modules.data?.map((name) => <option key={name} value={name} />)}
              </datalist>
            </Field>
          </FieldRow>

          <div className="rounded-lg border border-border p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium">Environment</p>
              <Button type="button" variant="outline" size="sm" onClick={autofillEnvironment}>
                Detect mine
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Browser">
                <Input value={form.browser} onChange={(e) => set('browser', e.target.value)} className="h-8" />
              </Field>
              <Field label="Device">
                <Input value={form.device} onChange={(e) => set('device', e.target.value)} className="h-8" />
              </Field>
              <Field label="OS">
                <Input value={form.os} onChange={(e) => set('os', e.target.value)} className="h-8" />
              </Field>
              <Field label="URL">
                <Input value={form.url} onChange={(e) => set('url', e.target.value)} className="h-8" />
              </Field>
            </div>
          </div>

          <Field label="Screenshots or video" hint="Up to 5 files.">
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border py-4 text-xs text-muted-foreground transition-colors hover:bg-accent">
              <Upload className="size-3.5" />
              Choose files
              <input
                type="file"
                multiple
                accept="image/*,video/*,application/pdf"
                className="hidden"
                onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 5))}
              />
            </label>

            {files.length > 0 && (
              <div className="mt-2 space-y-1">
                {files.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="flex items-center justify-between gap-2 rounded-md bg-muted/60 px-2.5 py-1.5"
                  >
                    <span className="truncate text-[11px]">{file.name}</span>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">{formatFileSize(file.size)}</span>
                      <button
                        type="button"
                        onClick={() => setFiles(files.filter((_, i) => i !== index))}
                        aria-label={`Remove ${file.name}`}
                      >
                        <X className="size-3 text-muted-foreground hover:text-danger" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Field>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!canSubmit} loading={create.isPending} onClick={() => create.mutate()}>
            Report issue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
