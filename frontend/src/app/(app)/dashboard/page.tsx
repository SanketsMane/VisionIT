'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle, ArrowRight, Banknote, Briefcase, CalendarClock,
  FileText, TrendingDown, TrendingUp, Users, Wallet,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/misc';
import { Skeleton, CardSkeleton } from '@/components/ui/skeleton';
import { PageHeader, SectionHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { Money } from '@/components/shared/money';
import { EmptyState, ErrorState } from '@/components/shared/empty-state';
import { InvoiceStatusBadge } from '@/components/shared/status-badge';
import {
  AgingBarChart, CategoryDonut, ProfitBarChart, RevenueTrendChart,
} from '@/components/modules/dashboard/charts';
import { dashboardApi } from '@/lib/api/reports.api';
import { expensesApi } from '@/lib/api/expenses.api';
import { queryKeys } from '@/lib/hooks/query-keys';
import { formatDate, formatRelative, humanize } from '@/lib/format';
import { cn } from '@/lib/utils';

const TREND_OPTIONS = [6, 12, 24] as const;

export default function DashboardPage() {
  const [trendMonths, setTrendMonths] = useState<number>(12);

  const overview = useQuery({
    queryKey: queryKeys.dashboard.overview,
    queryFn: dashboardApi.overview,
  });

  const trend = useQuery({
    queryKey: queryKeys.dashboard.trend(trendMonths),
    queryFn: () => dashboardApi.trend(trendMonths),
  });

  const expenseStats = useQuery({
    queryKey: queryKeys.expenses.stats({ scope: 'dashboard' }),
    queryFn: () => expensesApi.stats(),
  });

  if (overview.isError) {
    return (
      <Card>
        <ErrorState
          title="Could not load your dashboard"
          message={overview.error instanceof Error ? overview.error.message : undefined}
          onRetry={() => void overview.refetch()}
        />
      </Card>
    );
  }

  const data = overview.data;
  const currency = data?.currency ?? 'INR';
  const kpis = data?.kpis;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Good ${greeting()}`}
        description="Here's where your business stands right now."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/reports">
                View reports <ArrowRight />
              </Link>
            </Button>
            <Button asChild>
              <Link href="/invoices?new=1">
                <FileText /> New invoice
              </Link>
            </Button>
          </>
        }
      />

      {/* ── KPI row ─────────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {overview.isLoading || !kpis ? (
          Array.from({ length: 4 }).map((_, index) => <CardSkeleton key={index} />)
        ) : (
          <>
            <StatCard
              label="Revenue this month"
              value={kpis.revenueThisMonth}
              currency={currency}
              change={kpis.revenueChange}
              icon={TrendingUp}
              tone="primary"
            />
            <StatCard
              label="Expenses this month"
              value={kpis.expensesThisMonth}
              currency={currency}
              change={kpis.expensesChange}
              icon={TrendingDown}
              tone="warning"
            />
            <StatCard
              label="Net profit"
              value={kpis.profitThisMonth}
              currency={currency}
              change={kpis.profitChange}
              icon={Banknote}
              tone={kpis.profitThisMonth >= 0 ? 'success' : 'danger'}
            />
            <StatCard
              label="Cash on hand"
              value={kpis.cashOnHand}
              currency={currency}
              icon={Wallet}
              tone="success"
              hint={`Collected ${new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(kpis.collectedThisMonth)} this month`}
            />
          </>
        )}
      </div>

      {/* ── Attention strip ─────────────────────────────────────────────── */}
      {kpis && kpis.overdueCount > 0 && (
        <Card className="border-danger/30 bg-danger-muted/40">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-danger/10 text-danger">
                <AlertTriangle className="size-4" />
              </span>
              <div>
                <p className="text-sm font-medium">
                  {kpis.overdueCount} overdue invoice{kpis.overdueCount > 1 ? 's' : ''}
                </p>
                <p className="text-xs text-muted-foreground">
                  <Money value={kpis.outstanding} currency={currency} /> is outstanding across all open invoices.
                </p>
              </div>
            </div>
            <Button variant="danger" size="sm" asChild>
              <Link href="/invoices?overdueOnly=true">Chase payments</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Trend + secondary stats ─────────────────────────────────────── */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <SectionHeader
            title="Revenue vs expenses"
            description="Posted to your ledger, month by month"
            actions={
              <div className="flex rounded-lg bg-muted p-0.5">
                {TREND_OPTIONS.map((months) => (
                  <button
                    key={months}
                    type="button"
                    onClick={() => setTrendMonths(months)}
                    className={cn(
                      'rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors',
                      trendMonths === months
                        ? 'bg-card text-foreground shadow-soft'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {months}m
                  </button>
                ))}
              </div>
            }
          />
          <CardContent className="pt-4">
            {trend.isLoading ? (
              <Skeleton className="h-[260px] w-full" />
            ) : (
              <RevenueTrendChart data={trend.data ?? []} currency={currency} />
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          {overview.isLoading || !kpis ? (
            <>
              <CardSkeleton />
              <CardSkeleton />
            </>
          ) : (
            <>
              <StatCard
                label="Outstanding receivables"
                value={kpis.outstanding}
                currency={currency}
                icon={FileText}
                tone={kpis.overdueCount > 0 ? 'danger' : 'default'}
                hint={`${kpis.overdueCount} overdue`}
              />
              <div className="grid grid-cols-2 gap-4">
                <StatCard
                  label="Active clients"
                  value={kpis.activeClients}
                  format="number"
                  icon={Users}
                  tone="primary"
                  hint="Currently engaged"
                />
                <StatCard
                  label="Live projects"
                  value={kpis.activeProjects}
                  format="number"
                  icon={Briefcase}
                  tone="primary"
                  hint="In progress"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Profit + aging + spend ──────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <SectionHeader title="Monthly net profit" description="Revenue less every posted expense" />
          <CardContent className="pt-4">
            {trend.isLoading ? (
              <Skeleton className="h-[240px] w-full" />
            ) : (
              <ProfitBarChart data={(trend.data ?? []).slice(-6)} currency={currency} />
            )}
          </CardContent>
        </Card>

        <Card>
          <SectionHeader title="Receivables aging" description="How overdue the money owed to you is" />
          <CardContent className="pt-4">
            {overview.isLoading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : (
              <AgingBarChart aging={data?.invoices.aging ?? {}} currency={currency} />
            )}
          </CardContent>
        </Card>

        <Card>
          <SectionHeader title="Where the money goes" description="Spend by category" />
          <CardContent className="pt-4">
            {expenseStats.isLoading ? (
              <Skeleton className="h-[240px] w-full" />
            ) : (
              <CategoryDonut
                currency={currency}
                data={(expenseStats.data?.byCategory ?? []).slice(0, 7).map((item) => ({
                  name: item.name,
                  value: item.total,
                  color: item.color,
                }))}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Recent activity ─────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionHeader
            title="Recent invoices"
            actions={
              <Button variant="ghost" size="sm" asChild>
                <Link href="/invoices">View all <ArrowRight /></Link>
              </Button>
            }
          />
          <CardContent className="p-0">
            {overview.isLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-12 w-full" />
                ))}
              </div>
            ) : !data?.recentInvoices.length ? (
              <EmptyState
                icon={FileText}
                title="No invoices yet"
                description="Create your first invoice and it will show up here."
                action={<Button size="sm" asChild><Link href="/invoices?new=1">Create invoice</Link></Button>}
              />
            ) : (
              <ul className="divide-y divide-border">
                {data.recentInvoices.map((invoice) => (
                  <li key={invoice.id}>
                    <Link
                      href={`/invoices/${invoice.id}`}
                      className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-accent/50"
                    >
                      <Avatar name={invoice.client?.companyName ?? invoice.client?.name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {invoice.client?.companyName ?? invoice.client?.name}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground tabular">
                          {invoice.number} · due {formatDate(invoice.dueDate)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold">
                          <Money value={invoice.total} currency={invoice.currency} />
                        </p>
                        <InvoiceStatusBadge status={invoice.status} size="sm" />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <SectionHeader title="Upcoming milestones" description="Next 30 days" />
            <CardContent className="p-0">
              {overview.isLoading ? (
                <div className="space-y-2 p-4">
                  {Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-10 w-full" />)}
                </div>
              ) : !data?.upcomingDeadlines.length ? (
                <EmptyState icon={CalendarClock} title="Nothing due soon" className="py-10" />
              ) : (
                <ul className="divide-y divide-border">
                  {data.upcomingDeadlines.map((milestone) => (
                    <li key={milestone.id} className="px-5 py-2.5">
                      <Link href={`/projects/${milestone.project.id}`} className="block">
                        <p className="truncate text-xs font-medium">{milestone.title}</p>
                        <div className="mt-0.5 flex items-center justify-between gap-2">
                          <p className="truncate text-[11px] text-muted-foreground">{milestone.project.title}</p>
                          <span className="shrink-0 text-[11px] text-muted-foreground tabular">
                            {formatDate(milestone.dueDate, 'short')}
                          </span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <SectionHeader title="Cash accounts" />
            <CardContent className="p-0">
              {overview.isLoading ? (
                <div className="space-y-2 p-4">
                  {Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-8 w-full" />)}
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {(data?.cashAccounts ?? []).map((account) => (
                    <li key={account.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium">{account.name}</p>
                        <p className="truncate text-[10px] text-muted-foreground tabular">
                          {account.code}
                          {account.bankName ? ` · ${account.bankName}` : ''}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs font-semibold">
                        <Money value={account.balance} currency={account.currency} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Payments + activity ─────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionHeader title="Recent payments" />
          <CardContent className="p-0">
            {!data?.recentPayments.length ? (
              <EmptyState icon={Banknote} title="No payments recorded yet" className="py-10" />
            ) : (
              <ul className="divide-y divide-border">
                {data.recentPayments.map((payment) => (
                  <li key={payment.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium">
                        {payment.invoice?.client?.name ?? 'Payment received'}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground tabular">
                        {payment.invoice?.number} · {humanize(payment.method)} · {formatDate(payment.paidAt)}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-success">
                      +<Money value={payment.amount} currency={payment.currency} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <SectionHeader title="Activity" description="What happened in your workspace" />
          <CardContent className="p-0">
            {!data?.recentActivity.length ? (
              <EmptyState title="No activity yet" className="py-10" />
            ) : (
              <ul className="divide-y divide-border">
                {data.recentActivity.slice(0, 6).map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Badge variant="outline" size="sm">{entry.entityType}</Badge>
                      <span className="truncate text-xs text-muted-foreground">
                        {entry.action.replace(/\./g, ' ')}
                      </span>
                    </div>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {formatRelative(entry.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}
