'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight, Bug, CalendarClock, CheckCircle2, Circle, Megaphone, PackageCheck,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/misc';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader, SectionHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { Money } from '@/components/shared/money';
import { EmptyState, ErrorState } from '@/components/shared/empty-state';
import { DeliveryBadge, HealthBadge } from '@/components/shared/portal-badges';
import { SupportCountdown } from '@/components/modules/portal/support-countdown';
import { ProjectStatusBadge } from '@/components/shared/status-badge';
import { workspaceApi } from '@/lib/api/portal.api';
import { queryKeys } from '@/lib/hooks/query-keys';
import { formatDate, formatDateTime } from '@/lib/format';
import type { ProjectStatus } from '@/types';

export default function PortalProjectOverviewPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;

  const workspace = useQuery({
    queryKey: queryKeys.portal.workspace(projectId),
    queryFn: () => workspaceApi.overview(projectId),
    enabled: Boolean(projectId),
  });

  if (workspace.isError) {
    return (
      <Card>
        <ErrorState
          title="Could not load this project"
          message={workspace.error instanceof Error ? workspace.error.message : undefined}
          onRetry={() => void workspace.refetch()}
        />
      </Card>
    );
  }

  if (workspace.isLoading || !workspace.data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-72" />
        <div className="grid gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const data = workspace.data;
  const currency = data.project.currency;

  return (
    <div className="space-y-6">
      <div>
        <PageHeader
          title={data.project.title}
          description={data.project.summary ?? undefined}
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {data.project.code && (
            <Badge variant="outline" className="font-mono">{data.project.code}</Badge>
          )}
          <ProjectStatusBadge status={data.project.status as ProjectStatus} />
          <HealthBadge status={data.health.status} />
          <DeliveryBadge status={data.delivery.status} />
        </div>
      </div>

      {/* ── Project health reasons ────────────────────────────────────── */}
      {data.health.status !== 'ON_TRACK' && (
        <Card
          className={
            data.health.status === 'DELAYED'
              ? 'border-danger/30 bg-danger-muted/30'
              : 'border-warning/30 bg-warning-muted/30'
          }
        >
          <CardContent className="p-4">
            <p className="text-sm font-medium">
              {data.health.status === 'DELAYED' ? 'This project is delayed' : 'This project needs attention'}
            </p>
            <ul className="mt-1 space-y-0.5">
              {data.health.reasons.map((reason) => (
                <li key={reason} className="text-xs text-muted-foreground">— {reason}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* ── Financial summary ─────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Project value" value={data.financial.contractValue} currency={currency} tone="primary" />
        <StatCard
          label="Paid"
          value={data.financial.paid}
          currency={currency}
          tone="success"
          hint={`${data.financial.paidPercent}% of the contract`}
        />
        <StatCard
          label="Pending"
          value={data.financial.pending}
          currency={currency}
          tone={data.financial.pending > 0 ? 'warning' : 'default'}
          hint={
            data.financial.overdueInvoices > 0
              ? `${data.financial.overdueInvoices} overdue`
              : 'Nothing overdue'
          }
        />
        <StatCard
          label="Open issues"
          value={data.testing.open}
          format="number"
          icon={Bug}
          tone={data.testing.critical > 0 ? 'danger' : data.testing.open > 0 ? 'warning' : 'success'}
          hint={data.testing.critical > 0 ? `${data.testing.critical} critical` : 'None critical'}
        />
      </div>

      {/* ── Technical support countdown ───────────────────────────────── */}
      {/* Sits above announcements because "how long am I covered for?" is the
          question a client comes back to this page to answer. Renders nothing
          when no support term has been set up. */}
      <SupportCountdown support={data.support} />

      {/* ── Announcements ─────────────────────────────────────────────── */}
      {data.announcements.length > 0 && (
        <Card>
          <SectionHeader title="Announcements" />
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {data.announcements.map((announcement) => (
                <li key={announcement.id} className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-primary-muted text-primary">
                      <Megaphone className="size-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{announcement.title}</p>
                        {announcement.isPinned && <Badge variant="warning" size="sm">Pinned</Badge>}
                      </div>
                      <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
                        {announcement.body}
                      </p>
                      <p className="mt-1.5 text-[10px] text-muted-foreground">
                        {announcement.publishedBy.name} · {formatDateTime(announcement.publishedAt)}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ── Milestones ──────────────────────────────────────────────── */}
        <Card className="lg:col-span-2">
          <SectionHeader
            title="Milestones"
            description={
              data.progress.milestonesTotal
                ? `${data.progress.milestonesCompleted} of ${data.progress.milestonesTotal} complete`
                : 'No milestones defined yet'
            }
          />
          <CardContent className="p-0">
            {data.progress.milestonesTotal > 0 && (
              <div className="px-5 pt-4">
                <Progress value={data.progress.percent} />
              </div>
            )}

            {!data.milestones.length ? (
              <EmptyState icon={CalendarClock} title="No milestones yet" className="py-10" />
            ) : (
              <ul className="divide-y divide-border">
                {data.milestones.map((milestone) => (
                  <li key={milestone.id} className="flex items-start gap-3 px-5 py-3">
                    {milestone.completedAt ? (
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                    ) : (
                      <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className={milestone.completedAt ? 'text-sm line-through opacity-60' : 'text-sm font-medium'}>
                        {milestone.title}
                      </p>
                      {milestone.dueDate && (
                        <p className="text-[11px] text-muted-foreground tabular">
                          Due {formatDate(milestone.dueDate)}
                        </p>
                      )}
                    </div>
                    {milestone.amount != null && (
                      <span className="shrink-0 text-sm font-medium">
                        <Money value={milestone.amount} currency={currency} />
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* ── Side panel ──────────────────────────────────────────────── */}
        <div className="space-y-4">
          <Card>
            <SectionHeader title="Timeline" />
            <CardContent className="p-5 pt-4">
              <dl className="space-y-2 text-xs">
                <Row label="Started" value={formatDate(data.project.startDate)} />
                <Row label="Expected delivery" value={formatDate(data.project.endDate)} />
                <Row
                  label="Days remaining"
                  value={
                    data.progress.daysRemaining === null
                      ? '—'
                      : data.progress.daysRemaining < 0
                        ? `${Math.abs(data.progress.daysRemaining)} overdue`
                        : String(data.progress.daysRemaining)
                  }
                />
                {data.progress.currentMilestone && (
                  <Row label="Current milestone" value={data.progress.currentMilestone.title} />
                )}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <SectionHeader title="Delivery" />
            <CardContent className="space-y-3 p-5 pt-4">
              <div className="flex items-center gap-2.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-muted text-primary">
                  <PackageCheck className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{data.delivery.statusLabel}</p>
                  {data.delivery.version && (
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {data.delivery.version}
                    </p>
                  )}
                </div>
              </div>

              {data.delivery.adminConfirmed && !data.delivery.clientConfirmed && (
                <div className="rounded-lg border border-warning/40 bg-warning-muted/40 p-3">
                  <p className="text-xs font-medium">Your confirmation is needed</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Review the handover and confirm you&apos;ve received everything.
                  </p>
                </div>
              )}

              <Link
                href={`/portal/projects/${projectId}/delivery`}
                className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Open delivery <ArrowRight className="size-3" />
              </Link>
            </CardContent>
          </Card>

          <Card>
            <SectionHeader title="At a glance" />
            <CardContent className="p-5 pt-4">
              <dl className="space-y-2 text-xs">
                <Row label="Team members" value={String(data.counts.members)} />
                <Row label="Documents" value={String(data.counts.documents)} />
                <Row label="Invoices" value={String(data.financial.invoiceCount)} />
                <Row
                  label="Payments awaiting review"
                  value={String(data.financial.pendingPaymentRequests)}
                />
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium tabular">{value}</dd>
    </div>
  );
}
