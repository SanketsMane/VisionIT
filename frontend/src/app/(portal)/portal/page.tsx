'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Boxes, Bug, FolderOpen, MessageSquare, ShoppingBag, Wallet } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/misc';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { Money } from '@/components/shared/money';
import { EmptyState, ErrorState } from '@/components/shared/empty-state';
import { DeliveryBadge, RoleBadge } from '@/components/shared/portal-badges';
import { SupportPill } from '@/components/modules/portal/support-countdown';
import { ProjectStatusBadge } from '@/components/shared/status-badge';
import { workspaceApi } from '@/lib/api/portal.api';
import { queryKeys } from '@/lib/hooks/query-keys';
import { formatDate } from '@/lib/format';
import { useAuthStore } from '@/store/auth.store';
import type { ProjectStatus } from '@/types';

export default function PortalHomePage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  // Someone who signed up on the website rather than being invited to a project.
  const isLead = user?.userType === 'LEAD';

  const dashboard = useQuery({
    queryKey: queryKeys.portal.myProjects,
    queryFn: workspaceApi.myProjects,
  });

  const projects = dashboard.data?.projects;
  const onlyProject = projects?.length === 1 ? projects[0] : undefined;

  // A client with one project has no list to choose from — this screen would
  // be a single card they have to click through on every sign-in. Send them
  // straight to the work. `replace` keeps Back from bouncing them here again.
  useEffect(() => {
    if (onlyProject) router.replace(`/portal/projects/${onlyProject.id}`);
  }, [onlyProject, router]);

  if (dashboard.isError) {
    return (
      <Card>
        <ErrorState
          title="Could not load your projects"
          message={dashboard.error instanceof Error ? dashboard.error.message : undefined}
          onRetry={() => void dashboard.refetch()}
        />
      </Card>
    );
  }

  const data = dashboard.data;

  // Render the spinner rather than a flash of the list while redirecting.
  if (onlyProject) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${isLead && !data?.projects.length ? 'Welcome' : 'Welcome back'}, ${user?.name?.split(' ')[0] ?? ''}`}
        description={
          isLead && !data?.projects.length
            ? 'Browse our work, price up a service, or just tell us what you need.'
            : 'Everything happening on your projects, in one place.'
        }
      />

      {dashboard.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : isLead && !data?.projects.length ? null : (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Active projects"
            value={data?.totals.projects ?? 0}
            format="number"
            icon={FolderOpen}
            tone="primary"
          />
          <StatCard
            label="Open issues"
            value={data?.totals.openBugs ?? 0}
            format="number"
            icon={Bug}
            tone={(data?.totals.openBugs ?? 0) > 0 ? 'warning' : 'default'}
          />
          <StatCard
            label="Outstanding balance"
            value={data?.totals.pending ?? 0}
            icon={Wallet}
            tone={(data?.totals.pending ?? 0) > 0 ? 'danger' : 'success'}
          />
        </div>
      )}

      {dashboard.isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-52" />)}
        </div>
      ) : !data?.projects.length ? (
        isLead ? (
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                href: '/portal/catalog',
                icon: Boxes,
                title: 'Browse our work',
                body: 'Everything we have designed, built and delivered.',
              },
              {
                href: '/portal/services',
                icon: ShoppingBag,
                title: 'Explore services',
                body: 'Development, hosting, SMS, AI and marketing.',
              },
              {
                href: '/portal/messages',
                icon: MessageSquare,
                title: 'Talk to us',
                body: 'Send a brief or ask a question. It reaches us directly.',
              },
            ].map((card) => (
              <Link
                key={card.href}
                href={card.href}
                className="group flex flex-col rounded-xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-soft"
              >
                <span className="grid size-10 place-items-center rounded-lg bg-primary-muted text-primary">
                  <card.icon className="size-5" />
                </span>
                <p className="mt-3 text-sm font-semibold">{card.title}</p>
                <p className="mt-1 flex-1 text-xs leading-relaxed text-muted-foreground">
                  {card.body}
                </p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
                  Open
                  <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <Card>
            <EmptyState
              icon={FolderOpen}
              title="No projects yet"
              description="Once your project team invites you, it will appear here."
            />
          </Card>
        )
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.projects.map((project) => {
            const paidPercent =
              project.financial.contractValue > 0
                ? Math.round((project.financial.paid / project.financial.contractValue) * 100)
                : 0;

            return (
              <Card key={project.id} className="transition-shadow hover:shadow-raised">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {project.code && (
                        <p className="font-mono text-[10px] tracking-wide text-muted-foreground">
                          {project.code}
                        </p>
                      )}
                      <Link
                        href={`/portal/projects/${project.id}`}
                        className="block truncate text-base font-semibold transition-colors hover:text-primary"
                      >
                        {project.title}
                      </Link>
                      {project.summary && (
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                          {project.summary}
                        </p>
                      )}
                    </div>
                    <RoleBadge role={project.role} size="sm" />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <ProjectStatusBadge status={project.status as ProjectStatus} size="sm" />
                    <DeliveryBadge status={project.delivery.status} size="sm" />
                    {project.openBugs > 0 && (
                      <Badge variant="warning" size="sm">{project.openBugs} open issue(s)</Badge>
                    )}
                  </div>

                  <div className="mt-3">
                    <SupportPill support={project.support} />
                  </div>

                  <div className="mt-4 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">Payment progress</span>
                      <span className="font-medium tabular">{paidPercent}%</span>
                    </div>
                    <Progress value={paidPercent} />
                  </div>

                  <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-3">
                    <div>
                      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Value</dt>
                      <dd className="mt-0.5 text-xs font-semibold">
                        <Money value={project.financial.contractValue} currency={project.currency} compact />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Paid</dt>
                      <dd className="mt-0.5 text-xs font-semibold text-success">
                        <Money value={project.financial.paid} currency={project.currency} compact />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Pending</dt>
                      <dd className="mt-0.5 text-xs font-semibold text-warning">
                        <Money value={project.financial.pending} currency={project.currency} compact />
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                    <span className="text-[11px] text-muted-foreground">
                      {project.endDate ? `Due ${formatDate(project.endDate)}` : 'No delivery date set'}
                    </span>
                    <Link
                      href={`/portal/projects/${project.id}`}
                      className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      Open <ArrowRight className="size-3" />
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
