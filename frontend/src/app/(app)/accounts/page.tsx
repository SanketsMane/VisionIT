'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowRightLeft, Plus, Wallet } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { TableSkeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogBody, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { PageHeader, SectionHeader } from '@/components/shared/page-header';
import { SearchInput } from '@/components/shared/search-input';
import { EmptyState, ErrorState } from '@/components/shared/empty-state';
import { Money } from '@/components/shared/money';
import { StatCard } from '@/components/shared/stat-card';
import { Field, FieldRow } from '@/components/shared/form-field';
import { accountsApi } from '@/lib/api/accounts.api';
import { queryKeys } from '@/lib/hooks/query-keys';
import { useMutationHandlers } from '@/lib/hooks/use-mutation-toast';
import { humanize } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Account, AccountType } from '@/types';

const TYPES: AccountType[] = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'];

const TYPE_TONE: Record<AccountType, string> = {
  ASSET: 'text-info',
  LIABILITY: 'text-warning',
  EQUITY: 'text-chart-5',
  INCOME: 'text-success',
  EXPENSE: 'text-danger',
};

export default function AccountsPage() {
  const [search, setSearch] = useState('');
  const [type, setType] = useState<AccountType | 'all'>('all');
  const [transferOpen, setTransferOpen] = useState(false);
  const [ledgerFor, setLedgerFor] = useState<Account | null>(null);

  const params = useMemo(
    () => ({ search: search || undefined, type: type === 'all' ? undefined : type, includeBalances: true }),
    [search, type],
  );

  const accounts = useQuery({
    queryKey: queryKeys.accounts.list(params),
    queryFn: () => accountsApi.list(params),
  });

  const cash = useQuery({
    queryKey: queryKeys.accounts.cashPosition,
    queryFn: accountsApi.cashPosition,
  });

  const items = accounts.data?.items ?? [];
  const totals = (accounts.data?.meta as { totals?: Record<string, number> } | undefined)?.totals;

  // Grouped by type so the chart of accounts reads like an accountant expects.
  const grouped = useMemo(() => {
    const map = new Map<AccountType, Account[]>();
    for (const account of items) {
      const list = map.get(account.type) ?? [];
      list.push(account);
      map.set(account.type, list);
    }
    return TYPES.map((key) => ({ type: key, accounts: map.get(key) ?? [] })).filter(
      (group) => group.accounts.length > 0,
    );
  }, [items]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounts"
        description="Your chart of accounts and where the money actually sits."
        actions={
          <Button variant="outline" onClick={() => setTransferOpen(true)}>
            <ArrowRightLeft /> Transfer
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Cash on hand" value={cash.data?.totalCash ?? 0} icon={Wallet} tone="success" hint={`${cash.data?.accounts.length ?? 0} accounts`} />
        <StatCard label="Total assets" value={totals?.ASSET ?? 0} tone="primary" />
        <StatCard label="Total liabilities" value={totals?.LIABILITY ?? 0} tone="warning" />
        <StatCard label="Equity" value={totals?.EQUITY ?? 0} />
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by code or name…"
            className="sm:max-w-xs"
          />
          <Select value={type} onValueChange={(v) => setType(v as AccountType | 'all')}>
            <SelectTrigger className="w-auto min-w-[150px]"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {TYPES.map((key) => (
                <SelectItem key={key} value={key}>{humanize(key)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {accounts.isError ? (
          <ErrorState onRetry={() => void accounts.refetch()} />
        ) : accounts.isLoading ? (
          <TableSkeleton rows={8} columns={4} />
        ) : items.length === 0 ? (
          <EmptyState icon={Wallet} title="No accounts match" />
        ) : (
          <div className="divide-y divide-border">
            {grouped.map((group) => (
              <div key={group.type}>
                <div className="flex items-center justify-between bg-muted/40 px-4 py-2">
                  <h3 className={cn('text-xs font-bold uppercase tracking-wider', TYPE_TONE[group.type])}>
                    {humanize(group.type)}
                  </h3>
                  {totals?.[group.type] !== undefined && (
                    <span className="text-xs font-semibold tabular">
                      <Money value={totals[group.type]} />
                    </span>
                  )}
                </div>

                <Table>
                  <TableBody>
                    {group.accounts.map((account) => (
                      <TableRow key={account.id} interactive onClick={() => setLedgerFor(account)}>
                        <TableCell className="w-20 text-xs font-medium text-muted-foreground tabular">
                          {account.code}
                        </TableCell>
                        <TableCell>
                          <p className="text-sm font-medium">{account.name}</p>
                          {account.description && (
                            <p className="truncate text-[11px] text-muted-foreground">{account.description}</p>
                          )}
                        </TableCell>
                        <TableCell className="w-40">
                          <Badge variant="outline" size="sm">{humanize(account.subtype)}</Badge>
                          {account.isSystem && <Badge variant="primary" size="sm" className="ml-1">System</Badge>}
                        </TableCell>
                        <TableCell className="w-32 text-right text-sm font-semibold">
                          <Money value={account.balance ?? 0} currency={account.currency} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}
          </div>
        )}
      </Card>

      <AccountLedgerDialog account={ledgerFor} onOpenChange={(open) => !open && setLedgerFor(null)} />
      <TransferDialog open={transferOpen} onOpenChange={setTransferOpen} />
    </div>
  );
}

function AccountLedgerDialog({
  account,
  onOpenChange,
}: {
  account: Account | null;
  onOpenChange: (open: boolean) => void;
}) {
  const ledger = useQuery({
    queryKey: queryKeys.accounts.ledger(account?.id ?? '', { limit: 100 }),
    queryFn: () => accountsApi.ledger(account!.id, { limit: 100 }),
    enabled: Boolean(account),
  });

  return (
    <Dialog open={Boolean(account)} onOpenChange={onOpenChange}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>{account ? `${account.code} · ${account.name}` : 'Account ledger'}</DialogTitle>
          <DialogDescription>
            Every posting against this account, newest first, with a running balance.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="p-0">
          {ledger.isLoading ? (
            <TableSkeleton rows={8} columns={5} />
          ) : !ledger.data?.lines.length ? (
            <EmptyState title="No transactions yet" description="Nothing has been posted to this account." />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 border-b border-border p-4">
                <div>
                  <p className="text-[11px] text-muted-foreground">Opening balance</p>
                  <p className="text-sm font-semibold">
                    <Money value={ledger.data.openingBalance} currency={ledger.data.account.currency} />
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-muted-foreground">Closing balance</p>
                  <p className="text-sm font-semibold">
                    <Money value={ledger.data.closingBalance} currency={ledger.data.account.currency} />
                  </p>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Entry</TableHead>
                    <TableHead>Narration</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledger.data.lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground tabular">
                        {new Date(line.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit', timeZone: 'UTC' })}
                      </TableCell>
                      <TableCell className="text-xs tabular">{line.entryNumber}</TableCell>
                      <TableCell className="max-w-xs truncate text-xs">{line.narration ?? '—'}</TableCell>
                      <TableCell className="text-right text-xs tabular">
                        {line.debit > 0 ? <Money value={line.debit} currency={ledger.data!.account.currency} /> : '—'}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular">
                        {line.credit > 0 ? <Money value={line.credit} currency={ledger.data!.account.currency} /> : '—'}
                      </TableCell>
                      <TableCell className="text-right text-xs font-medium tabular">
                        <Money value={line.runningBalance} currency={ledger.data!.account.currency} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TransferDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { onSuccess, onError } = useMutationHandlers();
  const [fromAccountId, setFrom] = useState('');
  const [toAccountId, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [narration, setNarration] = useState('');

  const cash = useQuery({
    queryKey: queryKeys.accounts.cashPosition,
    queryFn: accountsApi.cashPosition,
    enabled: open,
  });

  const transfer = useMutation({
    mutationFn: () =>
      accountsApi.transfer({
        fromAccountId, toAccountId,
        amount: Number(amount),
        narration: narration.trim() || undefined,
      }),
    onSuccess: () => {
      onSuccess('Transfer recorded', [queryKeys.accounts.all, queryKeys.ledger.all, queryKeys.dashboard.overview]);
      setFrom(''); setTo(''); setAmount(''); setNarration('');
      onOpenChange(false);
    },
    onError: (error) => onError(error, 'Could not record the transfer'),
  });

  const canSubmit = fromAccountId && toAccountId && fromAccountId !== toAccountId && Number(amount) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transfer between accounts</DialogTitle>
          <DialogDescription>
            Moves money between two of your own accounts and posts a balanced journal entry.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <FieldRow>
            <Field label="From" required>
              <Select value={fromAccountId} onValueChange={setFrom}>
                <SelectTrigger><SelectValue placeholder="Source" /></SelectTrigger>
                <SelectContent>
                  {cash.data?.accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.code} · {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field
              label="To"
              required
              error={fromAccountId && fromAccountId === toAccountId ? 'Pick a different account' : undefined}
            >
              <Select value={toAccountId} onValueChange={setTo}>
                <SelectTrigger><SelectValue placeholder="Destination" /></SelectTrigger>
                <SelectContent>
                  {cash.data?.accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.code} · {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FieldRow>

          <Field label="Amount" required>
            <Input
              type="number" step="0.01" min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="tabular"
            />
          </Field>

          <Field label="Narration">
            <Input value={narration} onChange={(e) => setNarration(e.target.value)} placeholder="Optional description" />
          </Field>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!canSubmit} loading={transfer.isPending} onClick={() => transfer.mutate()}>
            Record transfer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
