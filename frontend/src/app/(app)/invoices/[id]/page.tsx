'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, Banknote, Copy, Download, Link2, Loader2, Mail,
  Pencil, Send, Trash2, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar } from '@/components/ui/misc';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogBody, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader, SectionHeader } from '@/components/shared/page-header';
import { Money } from '@/components/shared/money';
import { Field, FieldRow } from '@/components/shared/form-field';
import { ErrorState } from '@/components/shared/empty-state';
import { InvoiceStatusBadge } from '@/components/shared/status-badge';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { InvoiceBuilder } from '@/components/modules/invoices/invoice-builder';
import { invoicesApi } from '@/lib/api/invoices.api';
import { accountsApi } from '@/lib/api/accounts.api';
import { queryKeys } from '@/lib/hooks/query-keys';
import { useMutationHandlers } from '@/lib/hooks/use-mutation-toast';
import { getAccessToken } from '@/lib/api/client';
import { formatDate, formatDateTime, humanize } from '@/lib/format';
import type { PaymentMethod } from '@/types';

const METHODS: PaymentMethod[] = [
  'BANK_TRANSFER', 'UPI', 'CASH', 'CHEQUE', 'CREDIT_CARD', 'PAYPAL', 'STRIPE', 'RAZORPAY', 'WIRE', 'OTHER',
];

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [builderOpen, setBuilderOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);

  const invoice = useQuery({
    queryKey: queryKeys.invoices.detail(id),
    queryFn: () => invoicesApi.byId(id),
    enabled: Boolean(id),
  });

  const { onSuccess, onError } = useMutationHandlers();
  const invalidate = [
    queryKeys.invoices.all, queryKeys.dashboard.overview,
    queryKeys.ledger.all, queryKeys.accounts.all,
  ];

  const send = useMutation({
    mutationFn: () => invoicesApi.send(id),
    onSuccess: () => onSuccess('Invoice issued and posted to your ledger', invalidate),
    onError: (error) => onError(error, 'Could not issue the invoice'),
  });

  const cancel = useMutation({
    mutationFn: () => invoicesApi.cancel(id),
    onSuccess: () => onSuccess('Invoice cancelled', invalidate),
    onError: (error) => onError(error, 'Could not cancel'),
  });

  const remove = useMutation({
    mutationFn: () => invoicesApi.remove(id),
    onSuccess: () => {
      onSuccess('Invoice deleted', invalidate);
      router.push('/invoices');
    },
    onError: (error) => onError(error, 'Could not delete'),
  });

  const duplicate = useMutation({
    mutationFn: () => invoicesApi.duplicate(id),
    onSuccess: (created) => {
      onSuccess(`Duplicated as ${created.number}`, invalidate);
      router.push(`/invoices/${created.id}`);
    },
    onError: (error) => onError(error, 'Could not duplicate'),
  });

  const deletePayment = useMutation({
    mutationFn: (paymentId: string) => invoicesApi.deletePayment(id, paymentId),
    onSuccess: () => onSuccess('Payment removed and its ledger entry reversed', invalidate),
    onError: (error) => onError(error, 'Could not remove the payment'),
  });

  if (invoice.isError) {
    return (
      <Card>
        <ErrorState
          title="Could not load this invoice"
          message={invoice.error instanceof Error ? invoice.error.message : undefined}
          onRetry={() => void invoice.refetch()}
        />
      </Card>
    );
  }

  if (invoice.isLoading || !invoice.data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-[600px] lg:col-span-2" />
          <Skeleton className="h-[400px]" />
        </div>
      </div>
    );
  }

  const data = invoice.data;
  const isDraft = data.status === 'DRAFT';
  const canPay = !isDraft && data.status !== 'CANCELLED' && Number(data.balanceDue) > 0;
  const publicUrl = data.publicToken
    ? `${window.location.origin}/invoice/${data.publicToken}`
    : null;

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
          <Link href="/invoices"><ArrowLeft /> All invoices</Link>
        </Button>

        <PageHeader
          title={data.number}
          description={`${humanize(data.documentType)} for ${data.client.companyName ?? data.client.name}`}
          actions={
            <>
              {isDraft && (
                <>
                  <Button variant="outline" onClick={() => setBuilderOpen(true)}>
                    <Pencil /> Edit
                  </Button>
                  <Button loading={send.isPending} onClick={() => send.mutate()}>
                    <Send /> Issue invoice
                  </Button>
                </>
              )}

              {canPay && (
                <Button onClick={() => setPaymentOpen(true)}>
                  <Banknote /> Record payment
                </Button>
              )}

              <Button variant="outline" onClick={() => void invoicesApi.downloadPdf(data.id, data.number)}>
                <Download /> PDF
              </Button>

              <Button variant="outline" asChild>
                <Link href={`/email?compose=1&invoiceId=${data.id}&clientId=${data.clientId}`}>
                  <Mail /> Email
                </Link>
              </Button>
            </>
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ── Document preview ───────────────────────────────────────── */}
        <Card className="overflow-hidden lg:col-span-2">
          <SectionHeader
            title="Document"
            description={`Template: ${data.templateKey}`}
            actions={
              publicUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void navigator.clipboard.writeText(publicUrl);
                    toast.success('Share link copied', {
                      description: 'Anyone with this link can view and download the invoice.',
                    });
                  }}
                >
                  <Link2 /> Copy share link
                </Button>
              )
            }
          />
          <CardContent className="p-0">
            <InvoicePreviewFrame invoiceId={data.id} />
          </CardContent>
        </Card>

        {/* ── Side panel ─────────────────────────────────────────────── */}
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="flex items-center justify-between">
                <InvoiceStatusBadge status={data.status} />
                {data.isOverdue && data.daysOverdue ? (
                  <Badge variant="danger">{data.daysOverdue} days overdue</Badge>
                ) : null}
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-2xl font-semibold">
                  <Money value={data.total} currency={data.currency} />
                </p>
              </div>

              {Number(data.amountPaid) > 0 && (
                <div className="space-y-1 rounded-lg bg-muted/60 p-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Paid</span>
                    <span className="font-medium text-success">
                      <Money value={data.amountPaid} currency={data.currency} />
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Balance due</span>
                    <span className="font-semibold">
                      <Money value={data.balanceDue} currency={data.currency} />
                    </span>
                  </div>
                </div>
              )}

              <dl className="space-y-2 border-t border-border pt-3 text-xs">
                <Row label="Issued" value={formatDate(data.issueDate)} />
                <Row label="Due" value={formatDate(data.dueDate)} />
                {data.poNumber && <Row label="PO number" value={data.poNumber} />}
                {data.sentAt && <Row label="Sent" value={formatDateTime(data.sentAt)} />}
                {data.viewedAt && <Row label="Viewed by client" value={formatDateTime(data.viewedAt)} />}
                {data.paidAt && <Row label="Settled" value={formatDate(data.paidAt)} />}
                {data.project && (
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted-foreground">Project</dt>
                    <dd className="truncate">
                      <Link href={`/projects/${data.project.id}`} className="font-medium text-primary hover:underline">
                        {data.project.title}
                      </Link>
                    </dd>
                  </div>
                )}
              </dl>

              <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                <Button variant="outline" size="sm" onClick={() => duplicate.mutate()} loading={duplicate.isPending}>
                  <Copy /> Duplicate
                </Button>

                {data.status !== 'CANCELLED' && data.status !== 'PAID' && (
                  <ConfirmDialog
                    trigger={<Button variant="outline" size="sm"><XCircle /> Cancel</Button>}
                    title={`Cancel ${data.number}?`}
                    description="The invoice stays on record and its ledger entry is reversed."
                    confirmLabel="Cancel invoice"
                    onConfirm={() => cancel.mutateAsync()}
                  />
                )}

                <ConfirmDialog
                  trigger={<Button variant="ghost" size="sm" className="text-danger"><Trash2 /> Delete</Button>}
                  title={`Delete ${data.number}?`}
                  description="This removes the document permanently and reverses any ledger entry."
                  confirmLabel="Delete"
                  onConfirm={() => remove.mutateAsync()}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <SectionHeader title="Client" />
            <CardContent className="p-5 pt-4">
              <div className="flex items-center gap-3">
                <Avatar name={data.client.companyName ?? data.client.name} src={data.client.avatarUrl} />
                <div className="min-w-0">
                  <Link href={`/clients/${data.clientId}`} className="block truncate text-sm font-medium hover:text-primary">
                    {data.client.companyName ?? data.client.name}
                  </Link>
                  {data.client.email && (
                    <p className="truncate text-[11px] text-muted-foreground">{data.client.email}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <SectionHeader title="Payments" description={`${data.payments?.length ?? 0} recorded`} />
            <CardContent className="p-0">
              {!data.payments?.length ? (
                <p className="px-5 py-6 text-center text-xs text-muted-foreground">
                  No payments recorded yet
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {data.payments.map((payment) => (
                    <li key={payment.id} className="flex items-start justify-between gap-2 px-5 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-success">
                          <Money value={payment.amount} currency={payment.currency} />
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {formatDate(payment.paidAt)} · {humanize(payment.method)}
                          {payment.account ? ` → ${payment.account.name}` : ''}
                        </p>
                        {payment.reference && (
                          <p className="truncate text-[10px] text-muted-foreground tabular">
                            Ref: {payment.reference}
                          </p>
                        )}
                      </div>
                      <ConfirmDialog
                        trigger={
                          <Button variant="ghost" size="icon-sm" aria-label="Remove payment">
                            <Trash2 className="text-danger" />
                          </Button>
                        }
                        title="Remove this payment?"
                        description="The ledger entry is reversed and the invoice balance is restored."
                        confirmLabel="Remove payment"
                        onConfirm={() => deletePayment.mutateAsync(payment.id)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <InvoiceBuilder open={builderOpen} onOpenChange={setBuilderOpen} invoice={data} />
      <RecordPaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        invoiceId={data.id}
        balanceDue={Number(data.balanceDue)}
        currency={data.currency}
      />
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

/**
 * The preview endpoint requires a bearer token, which an <iframe src> cannot
 * send. So the HTML is fetched through the API client and injected via
 * `srcDoc`, keeping the document sandboxed from the app.
 */
function InvoicePreviewFrame({ invoiceId }: { invoiceId: string }) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setHtml(null);
      setError(null);
      try {
        const response = await fetch(invoicesApi.previewUrl(invoiceId), {
          headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
          credentials: 'include',
        });
        if (!response.ok) throw new Error(`Preview failed (${response.status})`);
        const text = await response.text();
        if (!cancelled) setHtml(text);
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Preview failed');
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [invoiceId]);

  if (error) {
    return <div className="grid h-[700px] place-items-center text-xs text-danger">{error}</div>;
  }

  if (!html) {
    return (
      <div className="grid h-[700px] place-items-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <iframe
      title="Invoice preview"
      srcDoc={html}
      sandbox=""
      className="h-[700px] w-full border-0 bg-white"
    />
  );
}

function RecordPaymentDialog({
  open,
  onOpenChange,
  invoiceId,
  balanceDue,
  currency,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  balanceDue: number;
  currency: string;
}) {
  const { onSuccess, onError } = useMutationHandlers();

  const [amount, setAmount] = useState(String(balanceDue));
  const [accountId, setAccountId] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('BANK_TRANSFER');
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState('');
  const [feeAmount, setFeeAmount] = useState('0');

  const accounts = useQuery({
    queryKey: queryKeys.accounts.cashPosition,
    queryFn: accountsApi.cashPosition,
    enabled: open,
  });

  // Default to the full outstanding balance and the first cash account —
  // the common case is "they paid it all into my main account".
  useEffect(() => {
    if (!open) return;
    setAmount(String(balanceDue));
    setPaidAt(new Date().toISOString().slice(0, 10));
    setReference('');
    setFeeAmount('0');
  }, [open, balanceDue]);

  useEffect(() => {
    if (open && !accountId && accounts.data?.accounts.length) {
      setAccountId(accounts.data.accounts[0].id);
    }
  }, [open, accountId, accounts.data]);

  const record = useMutation({
    mutationFn: () =>
      invoicesApi.recordPayment(invoiceId, {
        amount: Number(amount),
        accountId,
        method,
        paidAt,
        reference: reference.trim() || null,
        feeAmount: Number(feeAmount) || 0,
      }),
    onSuccess: () => {
      onSuccess('Payment recorded and posted to your ledger', [
        queryKeys.invoices.all, queryKeys.dashboard.overview,
        queryKeys.ledger.all, queryKeys.accounts.all,
      ]);
      onOpenChange(false);
    },
    onError: (error) => onError(error, 'Could not record the payment'),
  });

  const numericAmount = Number(amount);
  const exceedsBalance = numericAmount > balanceDue + 0.01;
  const canSubmit = numericAmount > 0 && !exceedsBalance && Boolean(accountId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record a payment</DialogTitle>
          <DialogDescription>
            Posts <strong>Dr Bank / Cr Accounts Receivable</strong> and updates the invoice status.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <FieldRow>
            <Field
              label="Amount received"
              required
              error={exceedsBalance ? `Cannot exceed the balance of ${balanceDue.toFixed(2)}` : undefined}
            >
              <Input
                type="number" step="0.01" min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                error={exceedsBalance}
                className="tabular"
              />
            </Field>
            <Field label="Date received">
              <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
            </Field>
          </FieldRow>

          <Field label="Deposited into" required hint="Which of your accounts received the money.">
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger><SelectValue placeholder="Choose an account" /></SelectTrigger>
              <SelectContent>
                {accounts.data?.accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.code} · {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <FieldRow>
            <Field label="Method">
              <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METHODS.map((option) => (
                    <SelectItem key={option} value={option}>{humanize(option)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Gateway fee" hint="Booked to Bank Charges.">
              <Input
                type="number" step="0.01" min="0"
                value={feeAmount}
                onChange={(e) => setFeeAmount(e.target.value)}
                className="tabular"
              />
            </Field>
          </FieldRow>

          <Field label="Reference" hint="UTR, cheque number, transaction id…">
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Optional" />
          </Field>

          <div className="rounded-lg bg-muted/60 p-3 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Balance after this payment</span>
              <span className="font-semibold tabular">
                <Money value={Math.max(0, balanceDue - (numericAmount || 0))} currency={currency} />
              </span>
            </div>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!canSubmit} loading={record.isPending} onClick={() => record.mutate()}>
            Record payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
