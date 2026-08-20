'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Copy, Download, FileText, MoreVertical, Pencil, Plus, Send, Trash2, XCircle,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TableSkeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar } from '@/components/ui/misc';
import { PageHeader } from '@/components/shared/page-header';
import { SearchInput } from '@/components/shared/search-input';
import { Pagination } from '@/components/shared/pagination';
import { EmptyState, ErrorState } from '@/components/shared/empty-state';
import { Money } from '@/components/shared/money';
import { InvoiceStatusBadge } from '@/components/shared/status-badge';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { StatCard } from '@/components/shared/stat-card';
import { InvoiceBuilder } from '@/components/modules/invoices/invoice-builder';
import { invoicesApi, type InvoiceListParams } from '@/lib/api/invoices.api';
import { queryKeys } from '@/lib/hooks/query-keys';
import { useMutationHandlers } from '@/lib/hooks/use-mutation-toast';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { DocumentType, Invoice, InvoiceStatus } from '@/types';

const STATUSES: InvoiceStatus[] = [
  'DRAFT', 'SENT', 'VIEWED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED',
];

export default function InvoicesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<InvoiceStatus | 'all'>('all');
  const [documentType, setDocumentType] = useState<DocumentType | 'all'>('all');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);

  useEffect(() => {
    if (searchParams.get('new')) {
      setEditing(null);
      setBuilderOpen(true);
      router.replace('/invoices');
    }
    if (searchParams.get('overdueOnly')) {
      setOverdueOnly(true);
      router.replace('/invoices');
    }
  }, [searchParams, router]);

  const params: InvoiceListParams = useMemo(
    () => ({
      page,
      limit: 20,
      search: search || undefined,
      status: status === 'all' ? undefined : status,
      documentType: documentType === 'all' ? undefined : documentType,
      overdueOnly: overdueOnly || undefined,
      sortBy: 'issueDate',
      sortOrder: 'desc',
    }),
    [page, search, status, documentType, overdueOnly],
  );

  const invoices = useQuery({
    queryKey: queryKeys.invoices.list(params),
    queryFn: () => invoicesApi.list(params),
  });

  const stats = useQuery({
    queryKey: queryKeys.invoices.stats,
    queryFn: invoicesApi.stats,
  });

  const { onSuccess, onError } = useMutationHandlers();
  const invalidate = [queryKeys.invoices.all, queryKeys.dashboard.overview, queryKeys.ledger.all, queryKeys.accounts.all];

  const send = useMutation({
    mutationFn: (id: string) => invoicesApi.send(id),
    onSuccess: () => onSuccess('Invoice issued and posted to your ledger', invalidate),
    onError: (error) => onError(error, 'Could not issue the invoice'),
  });

  const duplicate = useMutation({
    mutationFn: (id: string) => invoicesApi.duplicate(id),
    onSuccess: (created) => {
      onSuccess(`Duplicated as ${created.number}`, invalidate);
      router.push(`/invoices/${created.id}`);
    },
    onError: (error) => onError(error, 'Could not duplicate'),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => invoicesApi.cancel(id),
    onSuccess: () => onSuccess('Invoice cancelled and its ledger entry reversed', invalidate),
    onError: (error) => onError(error, 'Could not cancel'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => invoicesApi.remove(id),
    onSuccess: () => onSuccess('Invoice deleted', invalidate),
    onError: (error) => onError(error, 'Could not delete'),
  });

  const resetAnd = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };

  const items = invoices.data?.items ?? [];
  const hasFilters = Boolean(search) || status !== 'all' || documentType !== 'all' || overdueOnly;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        description="Bill your clients and keep the books in step."
        actions={
          <Button onClick={() => { setEditing(null); setBuilderOpen(true); }}>
            <Plus /> New invoice
          </Button>
        }
      />

      {stats.data && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Outstanding" value={stats.data.totalOutstanding} icon={FileText} tone="primary" hint="Across all open invoices" />
          <StatCard label="Overdue" value={stats.data.aging.days1to30 + stats.data.aging.days31to60 + stats.data.aging.days61to90 + stats.data.aging.over90} icon={XCircle} tone="danger" hint={`${stats.data.overdueCount} invoice(s)`} />
          <StatCard label="Paid" value={stats.data.byStatus.PAID?.total ?? 0} tone="success" hint={`${stats.data.byStatus.PAID?.count ?? 0} settled`} />
          <StatCard label="Draft" value={stats.data.byStatus.DRAFT?.total ?? 0} hint={`${stats.data.byStatus.DRAFT?.count ?? 0} not yet issued`} />
        </div>
      )}

      <Card>
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center">
          <SearchInput
            value={search}
            onChange={resetAnd(setSearch)}
            placeholder="Search by number, client or PO…"
            className="lg:max-w-xs"
          />

          <div className="flex flex-1 flex-wrap items-center gap-2">
            <Select value={status} onValueChange={resetAnd((v) => setStatus(v as InvoiceStatus | 'all'))}>
              <SelectTrigger className="w-auto min-w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUSES.map((key) => (
                  <SelectItem key={key} value={key}>
                    {key.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase())}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={documentType} onValueChange={resetAnd((v) => setDocumentType(v as DocumentType | 'all'))}>
              <SelectTrigger className="w-auto min-w-[130px]"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All documents</SelectItem>
                <SelectItem value="INVOICE">Invoices</SelectItem>
                <SelectItem value="QUOTATION">Quotations</SelectItem>
                <SelectItem value="PROFORMA">Proforma</SelectItem>
                <SelectItem value="CREDIT_NOTE">Credit notes</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant={overdueOnly ? 'danger' : 'outline'}
              size="sm"
              onClick={() => { setOverdueOnly((v) => !v); setPage(1); }}
            >
              Overdue only
            </Button>

            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setSearch(''); setStatus('all'); setDocumentType('all'); setOverdueOnly(false); setPage(1); }}
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        {invoices.isError ? (
          <ErrorState
            message={invoices.error instanceof Error ? invoices.error.message : undefined}
            onRetry={() => void invoices.refetch()}
          />
        ) : invoices.isLoading ? (
          <TableSkeleton rows={6} columns={6} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={hasFilters ? 'No invoices match' : 'No invoices yet'}
            description={
              hasFilters
                ? 'Try loosening the filters above.'
                : 'Create your first invoice — totals, tax and the ledger entry are all handled for you.'
            }
            action={
              <Button size="sm" onClick={() => { setEditing(null); setBuilderOpen(true); }}>
                <Plus /> New invoice
              </Button>
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead>Due</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((invoice) => (
                <TableRow key={invoice.id} interactive onClick={() => router.push(`/invoices/${invoice.id}`)}>
                  <TableCell>
                    <p className="text-sm font-medium tabular">{invoice.number}</p>
                    {invoice.documentType !== 'INVOICE' && (
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {invoice.documentType.replace('_', ' ')}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar name={invoice.client?.companyName ?? invoice.client?.name} size="xs" />
                      <span className="truncate text-xs">
                        {invoice.client?.companyName ?? invoice.client?.name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground tabular">
                    {formatDate(invoice.issueDate)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'whitespace-nowrap text-xs tabular',
                      invoice.isOverdue ? 'font-medium text-danger' : 'text-muted-foreground',
                    )}
                  >
                    {formatDate(invoice.dueDate)}
                    {invoice.isOverdue && invoice.daysOverdue ? ` · ${invoice.daysOverdue}d late` : ''}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium">
                    <Money value={invoice.total} currency={invoice.currency} />
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {Number(invoice.balanceDue) > 0 ? (
                      <span className="font-medium text-warning">
                        <Money value={invoice.balanceDue} currency={invoice.currency} />
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell><InvoiceStatusBadge status={invoice.status} /></TableCell>
                  <TableCell onClick={(event) => event.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label="Invoice actions">
                          <MoreVertical />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/invoices/${invoice.id}`}>Open</Link>
                        </DropdownMenuItem>

                        {invoice.status === 'DRAFT' && (
                          <>
                            <DropdownMenuItem onSelect={() => { setEditing(invoice); setBuilderOpen(true); }}>
                              <Pencil /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => send.mutate(invoice.id)}>
                              <Send /> Issue
                            </DropdownMenuItem>
                          </>
                        )}

                        <DropdownMenuItem onSelect={() => void invoicesApi.downloadPdf(invoice.id, invoice.number)}>
                          <Download /> Download PDF
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => duplicate.mutate(invoice.id)}>
                          <Copy /> Duplicate
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        {invoice.status !== 'CANCELLED' && invoice.status !== 'PAID' && (
                          <ConfirmDialog
                            trigger={
                              <button type="button" className="relative flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent [&_svg]:size-3.5">
                                <XCircle /> Cancel
                              </button>
                            }
                            title={`Cancel ${invoice.number}?`}
                            description="The invoice stays on record and its ledger entry is reversed."
                            confirmLabel="Cancel invoice"
                            onConfirm={() => cancel.mutateAsync(invoice.id)}
                          />
                        )}

                        <ConfirmDialog
                          trigger={
                            <button type="button" className="relative flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-danger outline-none transition-colors hover:bg-danger-muted [&_svg]:size-3.5">
                              <Trash2 /> Delete
                            </button>
                          }
                          title={`Delete ${invoice.number}?`}
                          description="This removes the document and reverses any ledger entry. Invoices with recorded payments cannot be deleted."
                          confirmLabel="Delete"
                          onConfirm={() => remove.mutateAsync(invoice.id)}
                        />
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Pagination meta={invoices.data?.meta} onPageChange={setPage} label="invoices" />
      </Card>

      <InvoiceBuilder
        open={builderOpen}
        onOpenChange={setBuilderOpen}
        invoice={editing}
        onSaved={(saved) => router.push(`/invoices/${saved.id}`)}
      />
    </div>
  );
}
