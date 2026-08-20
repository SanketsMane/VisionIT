'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Download, FileText } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TableSkeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/shared/page-header';
import { Money } from '@/components/shared/money';
import { StatCard } from '@/components/shared/stat-card';
import { EmptyState, ErrorState } from '@/components/shared/empty-state';
import { InvoiceStatusBadge } from '@/components/shared/status-badge';
import { workspaceApi } from '@/lib/api/portal.api';
import { invoicesApi } from '@/lib/api/invoices.api';
import { queryKeys } from '@/lib/hooks/query-keys';
import { formatDate } from '@/lib/format';
import type { InvoiceStatus } from '@/types';

export default function PortalInvoicesPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;

  const invoices = useQuery({
    queryKey: queryKeys.portal.invoices(projectId),
    queryFn: () => workspaceApi.invoices(projectId),
    enabled: Boolean(projectId),
  });

  if (invoices.isError) {
    return (
      <Card>
        <ErrorState onRetry={() => void invoices.refetch()} />
      </Card>
    );
  }

  const items = invoices.data ?? [];
  const currency = items[0]?.currency ?? 'INR';
  const totals = items.reduce(
    (acc, invoice) => ({
      total: acc.total + Number(invoice.total),
      paid: acc.paid + Number(invoice.amountPaid),
      due: acc.due + Number(invoice.balanceDue),
    }),
    { total: 0, paid: 0, due: 0 },
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Invoices" description="Everything you've been billed for on this project." />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Total invoiced" value={totals.total} currency={currency} />
        <StatCard label="Paid" value={totals.paid} currency={currency} tone="success" />
        <StatCard
          label="Outstanding"
          value={totals.due}
          currency={currency}
          tone={totals.due > 0 ? 'warning' : 'success'}
        />
      </div>

      <Card>
        {invoices.isLoading ? (
          <TableSkeleton rows={5} columns={6} />
        ) : items.length === 0 ? (
          <EmptyState icon={FileText} title="No invoices yet" description="Invoices will appear here once issued." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead>Due</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="text-sm font-medium tabular">{invoice.number}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground tabular">
                    {formatDate(invoice.issueDate)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground tabular">
                    {formatDate(invoice.dueDate)}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium">
                    <Money value={invoice.total} currency={invoice.currency} />
                  </TableCell>
                  <TableCell className="text-right text-sm text-success">
                    <Money value={invoice.amountPaid} currency={invoice.currency} />
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium">
                    {Number(invoice.balanceDue) > 0 ? (
                      <span className="text-warning">
                        <Money value={invoice.balanceDue} currency={invoice.currency} />
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <InvoiceStatusBadge status={invoice.status as InvoiceStatus} size="sm" />
                  </TableCell>
                  <TableCell>
                    {invoice.publicToken && (
                      <Button variant="ghost" size="icon-sm" asChild aria-label="Download invoice">
                        <a
                          href={invoicesApi.publicPdfUrl(invoice.publicToken)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Download />
                        </a>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
