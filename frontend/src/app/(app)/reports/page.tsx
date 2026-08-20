'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Download, Printer } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader, SectionHeader } from '@/components/shared/page-header';
import { Money } from '@/components/shared/money';
import { StatCard } from '@/components/shared/stat-card';
import { ErrorState } from '@/components/shared/empty-state';
import { RevenueTrendChart } from '@/components/modules/dashboard/charts';
import { reportsApi } from '@/lib/api/reports.api';
import { queryKeys } from '@/lib/hooks/query-keys';
import { formatDate, formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { StatementSection } from '@/types';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function ReportsPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() + 1);

  const pack = useQuery({
    queryKey: queryKeys.reports.monthlyPack(year, month),
    queryFn: () => reportsApi.monthlyPack(year, month),
  });

  const trend = useQuery({
    queryKey: queryKeys.reports.trend(12),
    queryFn: () => reportsApi.trend(12),
  });

  const years = Array.from({ length: 6 }, (_, index) => now.getUTCFullYear() - index);

  if (pack.isError) {
    return (
      <Card>
        <ErrorState
          title="Could not generate the reports"
          message={pack.error instanceof Error ? pack.error.message : undefined}
          onRetry={() => void pack.refetch()}
        />
      </Card>
    );
  }

  const data = pack.data;
  const currency = data?.statement.currency ?? 'INR';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financial reports"
        description="Every statement is derived from your posted ledger — not from invoice totals."
        actions={
          <>
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS.map((label, index) => (
                  <SelectItem key={label} value={String(index + 1)}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {years.map((option) => (
                  <SelectItem key={option} value={String(option)}>{option}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={() => window.print()} className="no-print">
              <Printer /> Print
            </Button>
          </>
        }
      />

      {pack.isLoading || !data ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-28" />)}
          </div>
          <Skeleton className="h-96" />
        </div>
      ) : (
        <>
          {/* ── Month summary ─────────────────────────────────────────── */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Invoiced"
              value={data.statement.revenue.invoiced}
              currency={currency}
              hint={`${data.statement.revenue.invoiceCount} invoice(s)`}
            />
            <StatCard
              label="Collected"
              value={data.statement.revenue.collected}
              currency={currency}
              tone="success"
              hint="Cash actually received"
            />
            <StatCard
              label="Spent"
              value={data.statement.expenses.total}
              currency={currency}
              tone="warning"
              hint={`${data.statement.expenses.count} expense(s)`}
            />
            <StatCard
              label="Net profit"
              value={data.statement.profit.net}
              currency={currency}
              change={data.statement.comparison.changePercent}
              tone={data.statement.profit.net >= 0 ? 'success' : 'danger'}
            />
          </div>

          <Tabs defaultValue="statement">
            <TabsList>
              <TabsTrigger value="statement">Monthly statement</TabsTrigger>
              <TabsTrigger value="pnl">Profit &amp; loss</TabsTrigger>
              <TabsTrigger value="balance">Balance sheet</TabsTrigger>
              <TabsTrigger value="cash">Cash flow</TabsTrigger>
              <TabsTrigger value="tax">Tax</TabsTrigger>
            </TabsList>

            {/* ── Monthly statement ──────────────────────────────────── */}
            <TabsContent value="statement" className="space-y-4">
              <Card>
                <SectionHeader
                  title={`Statement for ${data.statement.label}`}
                  description="The month-end close: what came in, what went out, what's still owed."
                />
                <CardContent className="grid gap-6 p-5 lg:grid-cols-2">
                  <div className="space-y-4">
                    <StatementBlock
                      title="Revenue"
                      rows={[
                        ['Invoiced this month', data.statement.revenue.invoiced],
                        ['Collected this month', data.statement.revenue.collected],
                      ]}
                      currency={currency}
                    />
                    <StatementBlock
                      title="Costs"
                      rows={[
                        ['Total spend', data.statement.expenses.total],
                        ['Recoverable tax paid', data.statement.expenses.tax],
                      ]}
                      currency={currency}
                    />
                    <StatementBlock
                      title="Profitability"
                      rows={[
                        ['Gross profit', data.statement.profit.gross],
                        ['Net profit', data.statement.profit.net],
                      ]}
                      currency={currency}
                      footer={`Net margin ${formatPercent(data.statement.profit.margin)}`}
                    />
                  </div>

                  <div className="space-y-4">
                    <StatementBlock
                      title="Receivables"
                      rows={[
                        ['Opening balance', data.statement.receivables.opening],
                        ['Closing balance', data.statement.receivables.closing],
                        ['Of which overdue', data.statement.receivables.overdue],
                      ]}
                      currency={currency}
                    />
                    <StatementBlock
                      title="Cash"
                      rows={[
                        ['Opening', data.statement.cash.opening],
                        ['Net movement', data.statement.cash.net],
                        ['Closing', data.statement.cash.closing],
                      ]}
                      currency={currency}
                    />
                    <StatementBlock
                      title="Tax position"
                      rows={[
                        ['Output tax collected', data.statement.tax.collected],
                        ['Input tax paid', data.statement.tax.paid],
                        ['Net payable', data.statement.tax.net],
                      ]}
                      currency={currency}
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <SectionHeader title="Top clients this month" description="By cash collected" />
                  <CardContent className="p-0">
                    {data.statement.topClients.length === 0 ? (
                      <p className="px-5 py-8 text-center text-xs text-muted-foreground">
                        No payments collected this month
                      </p>
                    ) : (
                      <ul className="divide-y divide-border">
                        {data.statement.topClients.map((client, index) => (
                          <li key={client.id} className="flex items-center justify-between gap-3 px-5 py-3">
                            <span className="flex min-w-0 items-center gap-2.5">
                              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-semibold tabular">
                                {index + 1}
                              </span>
                              <span className="truncate text-xs">{client.name}</span>
                            </span>
                            <span className="shrink-0 text-sm font-semibold">
                              <Money value={client.amount} currency={currency} />
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <SectionHeader title="Biggest expense categories" />
                  <CardContent className="p-0">
                    {data.statement.topExpenseCategories.length === 0 ? (
                      <p className="px-5 py-8 text-center text-xs text-muted-foreground">
                        No expenses recorded this month
                      </p>
                    ) : (
                      <ul className="divide-y divide-border">
                        {data.statement.topExpenseCategories.map((category) => (
                          <li key={category.name} className="flex items-center justify-between gap-3 px-5 py-3">
                            <span className="flex min-w-0 items-center gap-2.5">
                              <span
                                className="size-2.5 shrink-0 rounded-full"
                                style={{ backgroundColor: category.color ?? 'var(--color-chart-1)' }}
                              />
                              <span className="truncate text-xs">{category.name}</span>
                            </span>
                            <span className="shrink-0 text-sm font-semibold">
                              <Money value={category.amount} currency={currency} />
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <SectionHeader title="12-month trend" />
                <CardContent className="pt-4">
                  {trend.isLoading ? (
                    <Skeleton className="h-[260px] w-full" />
                  ) : (
                    <RevenueTrendChart data={trend.data ?? []} currency={currency} />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── P&L ────────────────────────────────────────────────── */}
            <TabsContent value="pnl">
              <Card>
                <SectionHeader
                  title="Profit &amp; loss"
                  description={data.profitAndLoss.period.label}
                />
                <CardContent className="p-5">
                  <div className="mx-auto max-w-2xl space-y-1">
                    <SectionRows section={data.profitAndLoss.income} currency={currency} />
                    <SectionRows section={data.profitAndLoss.costOfServices} currency={currency} negative />

                    <SubtotalRow
                      label="Gross profit"
                      value={data.profitAndLoss.grossProfit}
                      currency={currency}
                      note={formatPercent(data.profitAndLoss.grossMargin)}
                    />

                    <SectionRows section={data.profitAndLoss.operatingExpenses} currency={currency} negative />

                    <SubtotalRow
                      label="Operating profit"
                      value={data.profitAndLoss.operatingProfit}
                      currency={currency}
                    />

                    {data.profitAndLoss.otherIncome.lines.length > 0 && (
                      <SectionRows section={data.profitAndLoss.otherIncome} currency={currency} />
                    )}
                    {data.profitAndLoss.taxExpense.lines.length > 0 && (
                      <SectionRows section={data.profitAndLoss.taxExpense} currency={currency} negative />
                    )}

                    <div className="mt-3 flex items-center justify-between rounded-lg bg-primary-muted px-4 py-3">
                      <span className="text-sm font-bold">Net profit</span>
                      <span className="text-base font-bold">
                        <Money value={data.profitAndLoss.netProfit} currency={currency} />
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          {formatPercent(data.profitAndLoss.netMargin)} margin
                        </span>
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Balance sheet ──────────────────────────────────────── */}
            <TabsContent value="balance">
              <Card>
                <SectionHeader
                  title="Balance sheet"
                  description={`As at ${formatDate(data.balanceSheet.asOf)}`}
                  actions={
                    <Badge variant={data.balanceSheet.isBalanced ? 'success' : 'danger'} className="gap-1">
                      {data.balanceSheet.isBalanced ? <CheckCircle2 /> : <AlertTriangle />}
                      {data.balanceSheet.isBalanced ? 'Balanced' : 'Out of balance'}
                    </Badge>
                  }
                />
                <CardContent className="grid gap-8 p-5 lg:grid-cols-2">
                  <div className="space-y-1">
                    <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Assets</h3>
                    <SectionRows section={data.balanceSheet.assets.current} currency={currency} />
                    {data.balanceSheet.assets.fixed.lines.length > 0 && (
                      <SectionRows section={data.balanceSheet.assets.fixed} currency={currency} />
                    )}
                    <SubtotalRow label="Total assets" value={data.balanceSheet.assets.total} currency={currency} emphasis />
                  </div>

                  <div className="space-y-1">
                    <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Liabilities &amp; equity
                    </h3>
                    <SectionRows section={data.balanceSheet.liabilities.current} currency={currency} />
                    {data.balanceSheet.liabilities.longTerm.lines.length > 0 && (
                      <SectionRows section={data.balanceSheet.liabilities.longTerm} currency={currency} />
                    )}
                    <SubtotalRow label="Total liabilities" value={data.balanceSheet.liabilities.total} currency={currency} />

                    <div className="pt-3">
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Equity
                      </p>
                      {data.balanceSheet.equity.lines.map((line) => (
                        <LineRow key={line.accountId} label={`${line.code} · ${line.name}`} value={line.amount} currency={currency} />
                      ))}
                      {data.balanceSheet.equity.priorPeriodProfit !== 0 && (
                        <LineRow
                          label="Retained earnings (prior periods)"
                          value={data.balanceSheet.equity.priorPeriodProfit}
                          currency={currency}
                        />
                      )}
                      <LineRow
                        label="Current period profit"
                        value={data.balanceSheet.equity.currentPeriodProfit}
                        currency={currency}
                      />
                      <SubtotalRow label="Total equity" value={data.balanceSheet.equity.total} currency={currency} />
                    </div>

                    <SubtotalRow
                      label="Total liabilities & equity"
                      value={data.balanceSheet.totalLiabilitiesAndEquity}
                      currency={currency}
                      emphasis
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Cash flow ──────────────────────────────────────────── */}
            <TabsContent value="cash">
              <Card>
                <SectionHeader
                  title="Cash flow statement"
                  description={`${data.cashFlow.period.label} · direct method, from movement on your cash and bank accounts`}
                />
                <CardContent className="p-5">
                  <div className="mx-auto max-w-xl space-y-1">
                    <LineRow label="Opening cash" value={data.cashFlow.opening} currency={currency} />

                    <div className="pt-3">
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Operating activities
                      </p>
                      <LineRow label="Cash received" value={data.cashFlow.operating.inflows} currency={currency} />
                      <LineRow label="Cash paid out" value={-data.cashFlow.operating.outflows} currency={currency} />
                      <SubtotalRow label="Net from operations" value={data.cashFlow.operating.net} currency={currency} />
                    </div>

                    {data.cashFlow.investing.net !== 0 && (
                      <SubtotalRow label="Net from investing" value={data.cashFlow.investing.net} currency={currency} />
                    )}
                    {data.cashFlow.financing.net !== 0 && (
                      <SubtotalRow label="Net from financing" value={data.cashFlow.financing.net} currency={currency} />
                    )}

                    <SubtotalRow label="Net change in cash" value={data.cashFlow.netChange} currency={currency} />

                    <div className="mt-3 flex items-center justify-between rounded-lg bg-primary-muted px-4 py-3">
                      <span className="text-sm font-bold">Closing cash</span>
                      <span className="text-base font-bold">
                        <Money value={data.cashFlow.closing} currency={currency} />
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Tax ────────────────────────────────────────────────── */}
            <TabsContent value="tax">
              <Card>
                <SectionHeader
                  title="Tax summary"
                  description="Output tax charged on invoices, less recoverable input tax on expenses."
                />
                <CardContent className="p-5">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="text-sm">Taxable revenue</TableCell>
                        <TableCell className="text-right text-sm font-medium">
                          <Money value={data.tax.taxableRevenue} currency={currency} />
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-sm">Output tax collected</TableCell>
                        <TableCell className="text-right text-sm font-medium">
                          <Money value={data.tax.outputTax} currency={currency} />
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-sm">Input tax paid</TableCell>
                        <TableCell className="text-right text-sm font-medium text-success">
                          −<Money value={data.tax.inputTax} currency={currency} />
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-sm font-bold">Net tax payable</TableCell>
                        <TableCell className="text-right text-base font-bold">
                          <Money value={data.tax.netTaxPayable} currency={currency} />
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>

                  <p className="mt-4 text-[11px] text-muted-foreground">
                    Based on {data.tax.invoiceCount} invoice(s) and {data.tax.expenseCount} expense(s) in the period.
                    This is a working summary — confirm against your filing before submission.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

function StatementBlock({
  title,
  rows,
  currency,
  footer,
}: {
  title: string;
  rows: readonly (readonly [string, number])[];
  currency: string;
  footer?: string;
}) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      <dl className="space-y-1.5">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between text-sm">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-medium"><Money value={value} currency={currency} /></dd>
          </div>
        ))}
      </dl>
      {footer && <p className="mt-2 border-t border-border pt-2 text-[11px] text-muted-foreground">{footer}</p>}
    </div>
  );
}

function SectionRows({
  section,
  currency,
  negative,
}: {
  section: StatementSection;
  currency: string;
  negative?: boolean;
}) {
  if (section.lines.length === 0 && section.total === 0) return null;

  return (
    <div className="pt-3">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {section.title}
      </p>
      {section.lines.map((line) => (
        <LineRow
          key={line.accountId}
          label={`${line.code} · ${line.name}`}
          value={negative ? -line.amount : line.amount}
          currency={currency}
        />
      ))}
      <SubtotalRow
        label={`Total ${section.title.toLowerCase()}`}
        value={negative ? -section.total : section.total}
        currency={currency}
      />
    </div>
  );
}

function LineRow({ label, value, currency }: { label: string; value: number; currency: string }) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className="min-w-0 truncate pr-4 text-muted-foreground">{label}</span>
      <span className="shrink-0 tabular"><Money value={value} currency={currency} /></span>
    </div>
  );
}

function SubtotalRow({
  label,
  value,
  currency,
  note,
  emphasis,
}: {
  label: string;
  value: number;
  currency: string;
  note?: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={cn(
        'mt-1 flex items-center justify-between border-t border-border py-1.5 text-sm font-semibold',
        emphasis && 'border-t-2 border-foreground/20 text-base',
      )}
    >
      <span>{label}</span>
      <span className="tabular">
        <Money value={value} currency={currency} />
        {note && <span className="ml-2 text-xs font-normal text-muted-foreground">{note}</span>}
      </span>
    </div>
  );
}
