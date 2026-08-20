'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertTriangle, BookOpen, CheckCircle2, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { TableSkeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogBody, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { PageHeader, SectionHeader } from '@/components/shared/page-header';
import { SearchInput } from '@/components/shared/search-input';
import { Pagination } from '@/components/shared/pagination';
import { EmptyState, ErrorState } from '@/components/shared/empty-state';
import { Money } from '@/components/shared/money';
import { Field } from '@/components/shared/form-field';
import { accountsApi, ledgerApi } from '@/lib/api/accounts.api';
import { queryKeys } from '@/lib/hooks/query-keys';
import { useMutationHandlers } from '@/lib/hooks/use-mutation-toast';
import { formatDate, humanize } from '@/lib/format';
import type { JournalSource } from '@/types';

const SOURCES: JournalSource[] = [
  'MANUAL', 'INVOICE', 'PAYMENT', 'EXPENSE', 'OPENING_BALANCE', 'ADJUSTMENT', 'TRANSFER',
];

export default function LedgerPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [source, setSource] = useState<JournalSource | 'all'>('all');
  const [entryOpen, setEntryOpen] = useState(false);

  const params = useMemo(
    () => ({ page, limit: 20, search: search || undefined, source: source === 'all' ? undefined : source }),
    [page, search, source],
  );

  const entries = useQuery({
    queryKey: queryKeys.ledger.list(params),
    queryFn: () => ledgerApi.list(params),
  });

  const trialBalance = useQuery({
    queryKey: queryKeys.ledger.trialBalance(),
    queryFn: () => ledgerApi.trialBalance(),
  });

  const items = entries.data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="General ledger"
        description="Every posting, in double entry. Invoices, payments and expenses land here automatically."
        actions={
          <Button onClick={() => setEntryOpen(true)}>
            <Plus /> Manual entry
          </Button>
        }
      />

      <Tabs defaultValue="journal">
        <TabsList>
          <TabsTrigger value="journal">Journal</TabsTrigger>
          <TabsTrigger value="trial">Trial balance</TabsTrigger>
        </TabsList>

        <TabsContent value="journal">
          <Card>
            <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center">
              <SearchInput
                value={search}
                onChange={(value) => { setSearch(value); setPage(1); }}
                placeholder="Search narration, reference or entry number…"
                className="sm:max-w-xs"
              />
              <Select value={source} onValueChange={(v) => { setSource(v as JournalSource | 'all'); setPage(1); }}>
                <SelectTrigger className="w-auto min-w-[160px]"><SelectValue placeholder="Source" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sources</SelectItem>
                  {SOURCES.map((key) => (
                    <SelectItem key={key} value={key}>{humanize(key)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {entries.isError ? (
              <ErrorState onRetry={() => void entries.refetch()} />
            ) : entries.isLoading ? (
              <TableSkeleton rows={6} columns={4} />
            ) : items.length === 0 ? (
              <EmptyState icon={BookOpen} title="No journal entries" description="Issue an invoice or record an expense and the postings appear here." />
            ) : (
              <ul className="divide-y divide-border">
                {items.map((entry) => (
                  <li key={entry.id} className="p-4">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold tabular">{entry.entryNumber}</span>
                        <Badge variant="outline" size="sm">{humanize(entry.source)}</Badge>
                        <span className="text-[11px] text-muted-foreground tabular">{formatDate(entry.date)}</span>
                      </div>
                      {entry.reference && (
                        <span className="text-[11px] text-muted-foreground tabular">Ref: {entry.reference}</span>
                      )}
                    </div>

                    {entry.narration && <p className="mb-2 text-xs text-muted-foreground">{entry.narration}</p>}

                    <div className="overflow-x-auto rounded-lg border border-border scrollbar-slim">
                      <table className="w-full text-xs">
                        <tbody className="divide-y divide-border">
                          {entry.lines.map((line) => (
                            <tr key={line.id}>
                              <td className="px-3 py-1.5">
                                <span className="text-muted-foreground tabular">{line.account.code}</span>
                                <span className="ml-2">{line.account.name}</span>
                              </td>
                              <td className="w-28 px-3 py-1.5 text-right tabular">
                                {Number(line.debit) > 0 ? <Money value={line.debit} /> : ''}
                              </td>
                              <td className="w-28 px-3 py-1.5 text-right tabular">
                                {Number(line.credit) > 0 ? <Money value={line.credit} /> : ''}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <Pagination meta={entries.data?.meta} onPageChange={setPage} label="entries" />
          </Card>
        </TabsContent>

        <TabsContent value="trial">
          <Card>
            <SectionHeader
              title="Trial balance"
              description={trialBalance.data ? `As at ${formatDate(trialBalance.data.asOf)}` : undefined}
              actions={
                trialBalance.data && (
                  <Badge variant={trialBalance.data.isBalanced ? 'success' : 'danger'} className="gap-1">
                    {trialBalance.data.isBalanced ? <CheckCircle2 /> : <AlertTriangle />}
                    {trialBalance.data.isBalanced ? 'Balanced' : 'Out of balance'}
                  </Badge>
                )
              }
            />
            <CardContent className="p-0">
              {trialBalance.isLoading ? (
                <TableSkeleton rows={10} columns={4} />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trialBalance.data?.rows.map((row) => (
                      <TableRow key={row.accountId}>
                        <TableCell className="text-xs text-muted-foreground tabular">{row.code}</TableCell>
                        <TableCell className="text-sm">{row.name}</TableCell>
                        <TableCell><Badge variant="outline" size="sm">{humanize(row.type)}</Badge></TableCell>
                        <TableCell className="text-right text-sm tabular">
                          {row.debitBalance > 0 ? <Money value={row.debitBalance} /> : '—'}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular">
                          {row.creditBalance > 0 ? <Money value={row.creditBalance} /> : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                    {trialBalance.data && (
                      <TableRow className="bg-muted/50 font-bold">
                        <TableCell colSpan={3} className="text-sm">Total</TableCell>
                        <TableCell className="text-right text-sm tabular">
                          <Money value={trialBalance.data.totalDebit} />
                        </TableCell>
                        <TableCell className="text-right text-sm tabular">
                          <Money value={trialBalance.data.totalCredit} />
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ManualEntryDialog open={entryOpen} onOpenChange={setEntryOpen} />
    </div>
  );
}

interface DraftLine {
  accountId: string;
  debit: string;
  credit: string;
  description: string;
}

function ManualEntryDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { onSuccess, onError } = useMutationHandlers();

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [narration, setNarration] = useState('');
  const [reference, setReference] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([
    { accountId: '', debit: '', credit: '', description: '' },
    { accountId: '', debit: '', credit: '', description: '' },
  ]);

  const accounts = useQuery({
    queryKey: queryKeys.accounts.list({}),
    queryFn: () => accountsApi.list({}),
    enabled: open,
  });

  const totalDebit = lines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0);
  const totalCredit = lines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  const update = (index: number, patch: Partial<DraftLine>) =>
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));

  const create = useMutation({
    mutationFn: () =>
      ledgerApi.create({
        date,
        narration: narration.trim() || null,
        reference: reference.trim() || null,
        lines: lines
          .filter((line) => line.accountId && (Number(line.debit) > 0 || Number(line.credit) > 0))
          .map((line) => ({
            accountId: line.accountId,
            debit: Number(line.debit) || 0,
            credit: Number(line.credit) || 0,
            description: line.description.trim() || null,
          })),
      }),
    onSuccess: () => {
      onSuccess('Journal entry posted', [queryKeys.ledger.all, queryKeys.accounts.all, queryKeys.dashboard.overview]);
      setLines([
        { accountId: '', debit: '', credit: '', description: '' },
        { accountId: '', debit: '', credit: '', description: '' },
      ]);
      setNarration('');
      setReference('');
      onOpenChange(false);
    },
    onError: (error) => onError(error, 'Could not post the entry'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>Manual journal entry</DialogTitle>
          <DialogDescription>
            Debits must equal credits. The entry is rejected server-side if they don&apos;t.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Date">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Narration" className="sm:col-span-2">
              <Input value={narration} onChange={(e) => setNarration(e.target.value)} placeholder="What is this entry for?" />
            </Field>
          </div>

          <Field label="Reference">
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Optional" />
          </Field>

          <div className="overflow-x-auto rounded-lg border border-border scrollbar-slim">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="bg-muted/60">
                <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-2 py-2 text-left font-semibold">Account</th>
                  <th className="px-2 py-2 text-left font-semibold">Description</th>
                  <th className="w-32 px-2 py-2 text-right font-semibold">Debit</th>
                  <th className="w-32 px-2 py-2 text-right font-semibold">Credit</th>
                  <th className="w-10 px-2 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lines.map((line, index) => (
                  <tr key={index}>
                    <td className="px-2 py-2">
                      <Select value={line.accountId} onValueChange={(v) => update(index, { accountId: v })}>
                        <SelectTrigger className="h-8"><SelectValue placeholder="Choose" /></SelectTrigger>
                        <SelectContent>
                          {accounts.data?.items.map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                              {account.code} · {account.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        value={line.description}
                        onChange={(e) => update(index, { description: e.target.value })}
                        className="h-8"
                        placeholder="Optional"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        type="number" step="0.01" min="0"
                        value={line.debit}
                        onChange={(e) => update(index, { debit: e.target.value, credit: '' })}
                        className="h-8 text-right tabular"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        type="number" step="0.01" min="0"
                        value={line.credit}
                        onChange={(e) => update(index, { credit: e.target.value, debit: '' })}
                        className="h-8 text-right tabular"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setLines((current) => current.filter((_, i) => i !== index))}
                        disabled={lines.length <= 2}
                        aria-label="Remove line"
                      >
                        <Trash2 className="text-danger" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/40 font-semibold">
                <tr>
                  <td colSpan={2} className="px-2 py-2 text-xs">Totals</td>
                  <td className="px-2 py-2 text-right text-sm tabular"><Money value={totalDebit} /></td>
                  <td className="px-2 py-2 text-right text-sm tabular"><Money value={totalCredit} /></td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLines((current) => [...current, { accountId: '', debit: '', credit: '', description: '' }])}
            >
              <Plus /> Add line
            </Button>

            <Badge variant={isBalanced ? 'success' : 'warning'} className="gap-1">
              {isBalanced ? <CheckCircle2 /> : <AlertTriangle />}
              {isBalanced
                ? 'Balanced'
                : `Out by ${Math.abs(totalDebit - totalCredit).toFixed(2)}`}
            </Badge>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!isBalanced} loading={create.isPending} onClick={() => create.mutate()}>
            Post entry
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
