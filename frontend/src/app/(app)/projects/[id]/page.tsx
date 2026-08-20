'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, CalendarClock, CheckCircle2, Circle, Clock, ExternalLink,
  FileText, GitBranch, Pencil, Plus, Smartphone, Trash2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, Progress } from '@/components/ui/misc';
import {
  Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { PageHeader, SectionHeader } from '@/components/shared/page-header';
import { Money } from '@/components/shared/money';
import { Field, FieldRow } from '@/components/shared/form-field';
import { EmptyState, ErrorState } from '@/components/shared/empty-state';
import { CategoryBadge, InvoiceStatusBadge, ProjectStatusBadge } from '@/components/shared/status-badge';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { ProjectFormDialog } from '@/components/modules/projects/project-form';
import { ProjectWorkspaceTabs } from '@/components/modules/portal/project-tabs';
import { SupportPanel } from '@/components/modules/projects/support-panel';
import { projectsApi } from '@/lib/api/projects.api';
import { queryKeys } from '@/lib/hooks/query-keys';
import { useMutationHandlers } from '@/lib/hooks/use-mutation-toast';
import { formatDate, formatNumber, humanize } from '@/lib/format';

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [editOpen, setEditOpen] = useState(false);
  const [milestoneOpen, setMilestoneOpen] = useState(false);
  const [hoursOpen, setHoursOpen] = useState(false);

  const project = useQuery({
    queryKey: queryKeys.projects.detail(id),
    queryFn: () => projectsApi.byId(id),
    enabled: Boolean(id),
  });

  const { onSuccess, onError } = useMutationHandlers();

  const toggleMilestone = useMutation({
    mutationFn: ({ milestoneId, completed }: { milestoneId: string; completed: boolean }) =>
      projectsApi.updateMilestone(id, milestoneId, { completed }),
    onSuccess: () => onSuccess('Milestone updated', [queryKeys.projects.all]),
    onError: (error) => onError(error, 'Could not update the milestone'),
  });

  const removeMilestone = useMutation({
    mutationFn: (milestoneId: string) => projectsApi.removeMilestone(id, milestoneId),
    onSuccess: () => onSuccess('Milestone removed', [queryKeys.projects.all]),
    onError: (error) => onError(error, 'Could not remove'),
  });

  if (project.isError) {
    return (
      <Card>
        <ErrorState
          title="Could not load this project"
          message={project.error instanceof Error ? project.error.message : undefined}
          onRetry={() => void project.refetch()}
        />
      </Card>
    );
  }

  if (project.isLoading || !project.data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const data = project.data;
  const metrics = data.metrics;
  const milestoneProgress = metrics?.milestonesTotal
    ? (metrics.milestonesCompleted / metrics.milestonesTotal) * 100
    : 0;

  return (
    <div className="space-y-6">
      <ProjectWorkspaceTabs projectId={id} active="overview" />

      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
          <Link href="/projects"><ArrowLeft /> All projects</Link>
        </Button>

        <PageHeader
          title={data.title}
          description={data.summary ?? undefined}
          actions={
            <>
              <Button variant="outline" onClick={() => setHoursOpen(true)}>
                <Clock /> Log hours
              </Button>
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil /> Edit
              </Button>
              <Button asChild>
                <Link href="/invoices?new=1"><FileText /> Invoice</Link>
              </Button>
            </>
          }
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {data.code && <Badge variant="outline" className="font-mono">{data.code}</Badge>}
          <ProjectStatusBadge status={data.status} />
          <CategoryBadge category={data.category} />
          <Badge variant="outline">{humanize(data.engagement)}</Badge>
          <Badge variant="outline">{humanize(data.visibility)}</Badge>
          {data.tags.map((tag) => <Badge key={tag} variant="default" size="sm">{tag}</Badge>)}
        </div>
      </div>

      {/* Sits high on the page: an admin setting this up has just delivered,
          and the client's countdown starts the moment it is saved. */}
      <SupportPanel projectId={id} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Contract value</p>
          <p className="mt-1 text-xl font-semibold">
            <Money value={metrics?.contractValue ?? 0} currency={data.currency} compact />
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Invoiced</p>
          <p className="mt-1 text-xl font-semibold">
            <Money value={metrics?.totalInvoiced ?? 0} currency={data.currency} compact />
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Outstanding</p>
          <p className="mt-1 text-xl font-semibold text-warning">
            <Money value={metrics?.outstanding ?? 0} currency={data.currency} compact />
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Hours logged</p>
          <p className="mt-1 text-xl font-semibold tabular">{formatNumber(metrics?.loggedHours ?? 0)}</p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {data.description && (
            <Card>
              <SectionHeader title="Overview" />
              <CardContent className="p-5 pt-4">
                <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                  {data.description}
                </p>
              </CardContent>
            </Card>
          )}

          {(data.challenges || data.solution || data.outcome) && (
            <Card>
              <SectionHeader title="Case study" />
              <CardContent className="space-y-4 p-5 pt-4">
                {([
                  ['The challenge', data.challenges],
                  ['The solution', data.solution],
                  ['The outcome', data.outcome],
                ] as const).map(([label, body]) =>
                  body ? (
                    <div key={label}>
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {label}
                      </p>
                      <p className="whitespace-pre-line text-sm leading-relaxed">{body}</p>
                    </div>
                  ) : null,
                )}

                {data.testimonial && (
                  <blockquote className="border-l-2 border-primary bg-primary-muted/40 p-4">
                    <p className="text-sm italic leading-relaxed">&ldquo;{data.testimonial}&rdquo;</p>
                    {data.testimonialAuthor && (
                      <footer className="mt-2 text-[11px] text-muted-foreground">— {data.testimonialAuthor}</footer>
                    )}
                  </blockquote>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <SectionHeader
              title="Milestones"
              description={
                metrics?.milestonesTotal
                  ? `${metrics.milestonesCompleted} of ${metrics.milestonesTotal} complete`
                  : undefined
              }
              actions={
                <Button variant="outline" size="sm" onClick={() => setMilestoneOpen(true)}>
                  <Plus /> Add
                </Button>
              }
            />
            <CardContent className="p-0">
              {metrics?.milestonesTotal ? (
                <div className="px-5 pt-4">
                  <Progress value={milestoneProgress} />
                </div>
              ) : null}

              {!data.milestones?.length ? (
                <EmptyState
                  icon={CalendarClock}
                  title="No milestones yet"
                  description="Break the project into billable stages."
                  className="py-10"
                />
              ) : (
                <ul className="divide-y divide-border">
                  {data.milestones.map((milestone) => (
                    <li key={milestone.id} className="flex items-start gap-3 px-5 py-3">
                      <button
                        type="button"
                        onClick={() =>
                          toggleMilestone.mutate({
                            milestoneId: milestone.id,
                            completed: !milestone.completedAt,
                          })
                        }
                        className="mt-0.5 shrink-0"
                        aria-label={milestone.completedAt ? 'Mark incomplete' : 'Mark complete'}
                      >
                        {milestone.completedAt ? (
                          <CheckCircle2 className="size-4 text-success" />
                        ) : (
                          <Circle className="size-4 text-muted-foreground" />
                        )}
                      </button>

                      <div className="min-w-0 flex-1">
                        <p className={milestone.completedAt ? 'text-sm line-through opacity-60' : 'text-sm font-medium'}>
                          {milestone.title}
                        </p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                          {milestone.dueDate && <span className="tabular">Due {formatDate(milestone.dueDate)}</span>}
                          {milestone.invoiced && <Badge variant="success" size="sm">Invoiced</Badge>}
                        </div>
                      </div>

                      {milestone.amount != null && (
                        <span className="shrink-0 text-sm font-medium">
                          <Money value={milestone.amount} currency={data.currency} />
                        </span>
                      )}

                      <ConfirmDialog
                        trigger={
                          <Button variant="ghost" size="icon-sm" aria-label="Remove milestone">
                            <Trash2 className="text-danger" />
                          </Button>
                        }
                        title="Remove this milestone?"
                        confirmLabel="Remove"
                        onConfirm={() => removeMilestone.mutateAsync(milestone.id)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <SectionHeader title="Invoices" description={`${data.invoices?.length ?? 0} raised for this project`} />
            <CardContent className="p-0">
              {!data.invoices?.length ? (
                <EmptyState icon={FileText} title="No invoices yet" className="py-10" />
              ) : (
                <ul className="divide-y divide-border">
                  {data.invoices.map((invoice) => (
                    <li key={invoice.id}>
                      <Link
                        href={`/invoices/${invoice.id}`}
                        className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-accent/50"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium tabular">{invoice.number}</p>
                          <p className="text-[11px] text-muted-foreground tabular">
                            {formatDate(invoice.issueDate)} · due {formatDate(invoice.dueDate)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <span className="text-sm font-semibold">
                            <Money value={invoice.total} currency={invoice.currency} />
                          </span>
                          <InvoiceStatusBadge status={invoice.status} size="sm" />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {data.client && (
            <Card>
              <SectionHeader title="Client" />
              <CardContent className="p-5 pt-4">
                <Link href={`/clients/${data.client.id}`} className="flex items-center gap-3 group">
                  <Avatar name={data.client.companyName ?? data.client.name} src={data.client.avatarUrl} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium group-hover:text-primary">
                      {data.client.companyName ?? data.client.name}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">{data.client.name}</p>
                  </div>
                </Link>
              </CardContent>
            </Card>
          )}

          <Card>
            <SectionHeader title="Details" />
            <CardContent className="p-5 pt-4">
              <dl className="space-y-2 text-xs">
                <Row label="Started" value={formatDate(data.startDate)} />
                <Row label="Ends" value={formatDate(data.endDate)} />
                <Row label="Engagement" value={humanize(data.engagement)} />
                {data.hourlyRate != null && (
                  <Row label="Hourly rate" value={`${data.currency} ${data.hourlyRate}`} />
                )}
                {data.estimatedHours != null && (
                  <Row label="Estimated hours" value={formatNumber(data.estimatedHours)} />
                )}
              </dl>
            </CardContent>
          </Card>

          {data.technologies.length > 0 && (
            <Card>
              <SectionHeader title="Stack" />
              <CardContent className="p-5 pt-4">
                <div className="flex flex-wrap gap-1.5">
                  {data.technologies.map((tech) => (
                    <Badge key={tech.id} variant="primary">{tech.name}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {(data.liveUrl || data.repoUrl || data.playStoreUrl || data.appStoreUrl) && (
            <Card>
              <SectionHeader title="Links" />
              <CardContent className="space-y-2 p-5 pt-4">
                {([
                  [data.liveUrl, 'Live site', ExternalLink],
                  [data.repoUrl, 'Repository', GitBranch],
                  [data.playStoreUrl, 'Play Store', Smartphone],
                  [data.appStoreUrl, 'App Store', Smartphone],
                ] as const).map(([url, label, Icon]) =>
                  url ? (
                    <a
                      key={label}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 text-xs text-primary transition-colors hover:underline"
                    >
                      <Icon className="size-3.5" /> {label}
                    </a>
                  ) : null,
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <ProjectFormDialog open={editOpen} onOpenChange={setEditOpen} project={data} />
      <MilestoneDialog open={milestoneOpen} onOpenChange={setMilestoneOpen} projectId={id} currency={data.currency} />
      <LogHoursDialog open={hoursOpen} onOpenChange={setHoursOpen} projectId={id} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular">{value}</dd>
    </div>
  );
}

function MilestoneDialog({
  open, onOpenChange, projectId, currency,
}: {
  open: boolean; onOpenChange: (open: boolean) => void; projectId: string; currency: string;
}) {
  const { onSuccess, onError } = useMutationHandlers();
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');

  const create = useMutation({
    mutationFn: () =>
      projectsApi.addMilestone(projectId, {
        title,
        amount: amount ? Number(amount) : null,
        dueDate: dueDate || null,
      }),
    onSuccess: () => {
      onSuccess('Milestone added', [queryKeys.projects.all]);
      setTitle(''); setAmount(''); setDueDate('');
      onOpenChange(false);
    },
    onError: (error) => onError(error, 'Could not add the milestone'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add a milestone</DialogTitle></DialogHeader>
        <DialogBody className="space-y-4">
          <Field label="Title" required>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Discovery & architecture" />
          </Field>
          <FieldRow>
            <Field label={`Amount (${currency})`}>
              <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="tabular" />
            </Field>
            <Field label="Due date">
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </Field>
          </FieldRow>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!title.trim()} loading={create.isPending} onClick={() => create.mutate()}>
            Add milestone
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LogHoursDialog({
  open, onOpenChange, projectId,
}: {
  open: boolean; onOpenChange: (open: boolean) => void; projectId: string;
}) {
  const { onSuccess, onError } = useMutationHandlers();
  const [hours, setHours] = useState('');

  const log = useMutation({
    mutationFn: () => projectsApi.logHours(projectId, Number(hours)),
    onSuccess: () => {
      onSuccess('Hours logged', [queryKeys.projects.all]);
      setHours('');
      onOpenChange(false);
    },
    onError: (error) => onError(error, 'Could not log hours'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader><DialogTitle>Log hours</DialogTitle></DialogHeader>
        <DialogBody>
          <Field label="Hours worked" required>
            <Input
              type="number" step="0.25" min="0.25"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="7.5"
              className="tabular"
              autoFocus
            />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!Number(hours)} loading={log.isPending} onClick={() => log.mutate()}>
            Log hours
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
