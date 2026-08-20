'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { MoreVertical, Pencil, Plus, Receipt, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input, Textarea } from '@/components/ui/input';
import { TableSkeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogBody, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/misc';
import { PageHeader, SectionHeader } from '@/components/shared/page-header';
import { SearchInput } from '@/components/shared/search-input';
import { Pagination } from '@/components/shared/pagination';
import { EmptyState, ErrorState } from '@/components/shared/empty-state';
import { Money } from '@/components/shared/money';
import { StatCard } from '@/components/shared/stat-card';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Field, FieldRow } from '@/components/shared/form-field';
import { CategoryDonut } from '@/components/modules/dashboard/charts';
import { expensesApi, type ExpenseInput, type ExpenseListParams } from '@/lib/api/expenses.api';
import { accountsApi } from '@/lib/api/accounts.api';
import { projectsApi } from '@/lib/api/projects.api';
import { queryKeys } from '@/lib/hooks/query-keys';
import { useMutationHandlers } from '@/lib/hooks/use-mutation-toast';
import { formatDate, humanize } from '@/lib/format';
import type { Expense, PaymentMethod } from '@/types';

const METHODS: PaymentMethod[] = [
  'BANK_TRANSFER', 'UPI', 'CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'CHEQUE', 'PAYPAL', 'OTHER',
];

export default function ExpensesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);

  useEffect(() => {
    if (searchParams.get('new')) {
      setEditing(null);
      setFormOpen(true);
      router.replace('/expenses');
    }
  }, [searchParams, router]);

  const params: ExpenseListParams = useMemo(
    () => ({
      page, limit: 20,
      search: search || undefined,
      categoryId: categoryId === 'all' ? undefined : categoryId,
    }),
    [page, search, categoryId],
  );

  const expenses = useQuery({
    queryKey: queryKeys.expenses.list(params),
    queryFn: () => expensesApi.list(params),
  });

  const stats = useQuery({
    queryKey: queryKeys.expenses.stats({}),
    queryFn: () => expensesApi.stats(),
  });

  const categories = useQuery({
    queryKey: queryKeys.expenses.categories,
    queryFn: expensesApi.categories,
  });

  const { onSuccess, onError } = useMutationHandlers();

  const remove = useMutation({
    mutationFn: (id: string) => expensesApi.remove(id),
    onSuccess: () =>
      onSuccess('Expense deleted and its ledger entry reversed', [
        queryKeys.expenses.all, queryKeys.dashboard.overview,
        queryKeys.ledger.all, queryKeys.accounts.all,
      ]),
    onError: (error) => onError(error, 'Could not delete the expense'),
  });

  const items = expenses.data?.items ?? [];
  const summary = expenses.data?.meta as { summary?: { totalAmount: number; totalTax: number; count: number } } | undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses"
        description="Every cost, booked straight to your chart of accounts."
        actions={
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus /> Record expense
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:col-span-2 lg:grid-cols-2">
          <StatCard label="Total spend" value={stats.data?.totalSpend ?? 0} tone="warning" hint="All time" />
          <StatCard
            label="Recoverable tax"
            value={summary?.summary?.totalTax ?? 0}
            tone="success"
            hint="Input tax credit"
          />
          <StatCard
            label="This filter"
            value={summary?.summary?.totalAmount ?? 0}
            hint={`${summary?.summary?.count ?? 0} expense(s)`}
          />
          <StatCard
            label="Categories"
            value={categories.data?.length ?? 0}
            format="number"
            hint="Active buckets"
          />
        </div>

        <Card>
          <SectionHeader title="Spend by category" />
          <CardContent className="pt-4">
            <CategoryDonut
              data={(stats.data?.byCategory ?? []).slice(0, 7).map((item) => ({
                name: item.name, value: item.total, color: item.color,
              }))}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center">
          <SearchInput
            value={search}
            onChange={(value) => { setSearch(value); setPage(1); }}
            placeholder="Search vendor, description or reference…"
            className="sm:max-w-xs"
          />
          <Select value={categoryId} onValueChange={(v) => { setCategoryId(v); setPage(1); }}>
            <SelectTrigger className="w-auto min-w-[180px]"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.data?.map((category) => (
                <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {expenses.isError ? (
          <ErrorState onRetry={() => void expenses.refetch()} />
        ) : expenses.isLoading ? (
          <TableSkeleton rows={6} columns={6} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No expenses recorded"
            description="Track what you spend — it feeds straight into your profit & loss."
            action={
              <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}>
                <Plus /> Record expense
              </Button>
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Paid from</TableHead>
                <TableHead className="text-right">Tax</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground tabular">
                    {formatDate(expense.date)}
                  </TableCell>
                  <TableCell>
                    <p className="text-sm font-medium">{expense.vendor}</p>
                    {expense.description && (
                      <p className="truncate text-[11px] text-muted-foreground">{expense.description}</p>
                    )}
                    {expense.billable && <Badge variant="info" size="sm" className="mt-1">Billable</Badge>}
                  </TableCell>
                  <TableCell>
                    {expense.category ? (
                      <span className="flex items-center gap-1.5 text-xs">
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: expense.category.color ?? 'var(--color-chart-1)' }}
                        />
                        {expense.category.name}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Uncategorised</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {expense.paidFrom?.name ?? '—'}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    <Money value={expense.taxAmount} currency={expense.currency} />
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium">
                    <Money value={expense.total} currency={expense.currency} />
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label="Expense actions"><MoreVertical /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => { setEditing(expense); setFormOpen(true); }}>
                          <Pencil /> Edit
                        </DropdownMenuItem>
                        <ConfirmDialog
                          trigger={
                            <button type="button" className="relative flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-danger outline-none transition-colors hover:bg-danger-muted [&_svg]:size-3.5">
                              <Trash2 /> Delete
                            </button>
                          }
                          title="Delete this expense?"
                          description="The ledger entry it created is reversed at the same time."
                          confirmLabel="Delete"
                          onConfirm={() => remove.mutateAsync(expense.id)}
                        />
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Pagination meta={expenses.data?.meta} onPageChange={setPage} label="expenses" />
      </Card>

      <ExpenseFormDialog open={formOpen} onOpenChange={setFormOpen} expense={editing} />
    </div>
  );
}

function ExpenseFormDialog({
  open,
  onOpenChange,
  expense,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense?: Expense | null;
}) {
  const isEdit = Boolean(expense);
  const { onSuccess, onError } = useMutationHandlers();

  const [form, setForm] = useState<Partial<ExpenseInput>>({});

  const categories = useQuery({
    queryKey: queryKeys.expenses.categories,
    queryFn: expensesApi.categories,
    enabled: open,
  });

  const accounts = useQuery({
    queryKey: queryKeys.accounts.list({ includeBalances: false }),
    queryFn: () => accountsApi.list({}),
    enabled: open,
  });

  const projects = useQuery({
    queryKey: queryKeys.projects.list({ limit: 100 }),
    queryFn: () => projectsApi.list({ limit: 100 }),
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    setForm(
      expense
        ? {
            vendor: expense.vendor,
            description: expense.description ?? '',
            date: expense.date.slice(0, 10),
            amount: Number(expense.amount),
            taxAmount: Number(expense.taxAmount),
            currency: expense.currency,
            method: expense.method,
            categoryId: expense.category?.id ?? null,
            projectId: expense.project?.id ?? null,
            paidFromAccountId: expense.paidFrom?.id ?? '',
            reference: expense.reference ?? '',
            billable: expense.billable,
          }
        : {
            vendor: '',
            date: new Date().toISOString().slice(0, 10),
            amount: 0,
            taxAmount: 0,
            currency: 'INR',
            method: 'BANK_TRANSFER',
            billable: false,
          },
    );
  }, [open, expense]);

  const set = <K extends keyof ExpenseInput>(key: K, value: ExpenseInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  // Only accounts of type EXPENSE can receive the debit side of a cost.
  const expenseAccounts = accounts.data?.items.filter((account) => account.type === 'EXPENSE') ?? [];
  const paymentAccounts = accounts.data?.items.filter(
    (account) => ['CASH', 'BANK', 'CREDIT_CARD'].includes(account.subtype),
  ) ?? [];

  const save = useMutation({
    mutationFn: () =>
      isEdit && expense
        ? expensesApi.update(expense.id, form)
        : expensesApi.create(form as ExpenseInput),
    onSuccess: () => {
      onSuccess(isEdit ? 'Expense updated' : 'Expense recorded and posted to your ledger', [
        queryKeys.expenses.all, queryKeys.dashboard.overview,
        queryKeys.ledger.all, queryKeys.accounts.all,
      ]);
      onOpenChange(false);
    },
    onError: (error) => onError(error, 'Could not save the expense'),
  });

  const total = (Number(form.amount) || 0) + (Number(form.taxAmount) || 0);
  const canSave = Boolean(form.vendor?.trim()) && Number(form.amount) > 0
    && Boolean(form.paidFromAccountId) && Boolean(form.expenseAccountId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit expense' : 'Record an expense'}</DialogTitle>
          <DialogDescription>
            Posts <strong>Dr Expense / Cr Bank</strong>, with recoverable tax split out automatically.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <FieldRow>
            <Field label="Vendor" required>
              <Input value={form.vendor ?? ''} onChange={(e) => set('vendor', e.target.value)} placeholder="Amazon Web Services" />
            </Field>
            <Field label="Date">
              <Input type="date" value={form.date ?? ''} onChange={(e) => set('date', e.target.value)} />
            </Field>
          </FieldRow>

          <Field label="Description">
            <Input value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} placeholder="What was this for?" />
          </Field>

          <FieldRow>
            <Field label="Amount (before tax)" required>
              <Input
                type="number" step="0.01" min="0"
                value={form.amount ?? 0}
                onChange={(e) => set('amount', Number(e.target.value))}
                className="tabular"
              />
            </Field>
            <Field label="Tax" hint="Booked to input tax credit where available.">
              <Input
                type="number" step="0.01" min="0"
                value={form.taxAmount ?? 0}
                onChange={(e) => set('taxAmount', Number(e.target.value))}
                className="tabular"
              />
            </Field>
          </FieldRow>

          <div className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Total</span>
            <span className="font-semibold"><Money value={total} currency={form.currency ?? 'INR'} /></span>
          </div>

          <FieldRow>
            <Field label="Book to expense account" required hint="The debit side of the entry.">
              <Select
                value={form.expenseAccountId ?? ''}
                onValueChange={(v) => set('expenseAccountId', v)}
              >
                <SelectTrigger><SelectValue placeholder="Choose an account" /></SelectTrigger>
                <SelectContent>
                  {expenseAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.code} · {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Paid from" required hint="The credit side — where the money left.">
              <Select
                value={form.paidFromAccountId ?? ''}
                onValueChange={(v) => set('paidFromAccountId', v)}
              >
                <SelectTrigger><SelectValue placeholder="Choose an account" /></SelectTrigger>
                <SelectContent>
                  {paymentAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.code} · {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FieldRow>

          <FieldRow>
            <Field label="Category">
              <Select
                value={form.categoryId ?? 'none'}
                onValueChange={(v) => set('categoryId', v === 'none' ? null : v)}
              >
                <SelectTrigger><SelectValue placeholder="Uncategorised" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Uncategorised</SelectItem>
                  {categories.data?.map((category) => (
                    <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Method">
              <Select value={form.method ?? 'BANK_TRANSFER'} onValueChange={(v) => set('method', v as PaymentMethod)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METHODS.map((option) => (
                    <SelectItem key={option} value={option}>{humanize(option)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FieldRow>

          <FieldRow>
            <Field label="Project" hint="Attribute the cost to a project.">
              <Select
                value={form.projectId ?? 'none'}
                onValueChange={(v) => set('projectId', v === 'none' ? null : v)}
              >
                <SelectTrigger><SelectValue placeholder="No project" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No project</SelectItem>
                  {projects.data?.items.map((project) => (
                    <SelectItem key={project.id} value={project.id}>{project.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Reference">
              <Input value={form.reference ?? ''} onChange={(e) => set('reference', e.target.value)} placeholder="Invoice / receipt number" />
            </Field>
          </FieldRow>

          <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-xs font-medium">Billable to the client</p>
              <p className="text-[11px] text-muted-foreground">Flags it for re-billing on the project invoice.</p>
            </div>
            <Switch checked={form.billable ?? false} onCheckedChange={(v) => set('billable', v)} />
          </label>

          <Field label="Notes">
            <Textarea rows={2} value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
          </Field>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!canSave} loading={save.isPending} onClick={() => save.mutate()}>
            {isEdit ? 'Save changes' : 'Record expense'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
