'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Paperclip, Plus, Receipt, Upload, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { TableSkeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogBody, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { PageHeader } from '@/components/shared/page-header';
import { Pagination } from '@/components/shared/pagination';
import { Money } from '@/components/shared/money';
import { EmptyState, ErrorState } from '@/components/shared/empty-state';
import { Field, FieldRow } from '@/components/shared/form-field';
import { PaymentRequestBadge } from '@/components/shared/portal-badges';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { paymentRequestsApi, workspaceApi } from '@/lib/api/portal.api';
import { queryKeys } from '@/lib/hooks/query-keys';
import { useMutationHandlers } from '@/lib/hooks/use-mutation-toast';
import { formatDate, formatFileSize, humanize } from '@/lib/format';

const METHODS = ['BANK_TRANSFER', 'UPI', 'CASH', 'CHEQUE', 'CREDIT_CARD', 'PAYPAL', 'WIRE', 'OTHER'];

export default function PortalPaymentsPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;

  const [page, setPage] = useState(1);
  const [submitOpen, setSubmitOpen] = useState(false);

  const query = useMemo(() => ({ page, limit: 20 }), [page]);

  const requests = useQuery({
    queryKey: queryKeys.portal.paymentRequests(projectId, query),
    queryFn: () => paymentRequestsApi.list(projectId, query),
    enabled: Boolean(projectId),
  });

  const workspace = useQuery({
    queryKey: queryKeys.portal.workspace(projectId),
    queryFn: () => workspaceApi.overview(projectId),
    enabled: Boolean(projectId),
  });

  const { onSuccess, onError } = useMutationHandlers();

  const cancel = useMutation({
    mutationFn: (requestId: string) => paymentRequestsApi.cancel(projectId, requestId),
    onSuccess: () => onSuccess('Request withdrawn', [['portal', 'payment-requests']]),
    onError: (error) => onError(error, 'Could not withdraw the request'),
  });

  const canSubmit = workspace.data?.access.permissions.includes('payment:submit') ?? false;
  const items = requests.data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description="Submit a payment you've made and track its verification."
        actions={
          canSubmit && (
            <Button onClick={() => setSubmitOpen(true)}>
              <Plus /> Submit payment
            </Button>
          )
        }
      />

      <Card>
        {requests.isError ? (
          <ErrorState onRetry={() => void requests.refetch()} />
        ) : requests.isLoading ? (
          <TableSkeleton rows={5} columns={6} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No payments submitted"
            description="When you've paid an invoice, submit it here with proof so it can be verified."
            action={
              canSubmit && (
                <Button size="sm" onClick={() => setSubmitOpen(true)}>
                  <Plus /> Submit payment
                </Button>
              )
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((request) => (
                <TableRow key={request.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground tabular">
                    {formatDate(request.paidAt)}
                  </TableCell>
                  <TableCell>
                    <p className="text-sm font-medium">{request.reason}</p>
                    {request.invoice && (
                      <p className="text-[11px] text-muted-foreground tabular">
                        Against {request.invoice.number}
                      </p>
                    )}
                    {request.status === 'REJECTED' && request.rejectionReason && (
                      <p className="mt-1 text-[11px] text-danger">{request.rejectionReason}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">{humanize(request.method)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground tabular">
                    {request.reference ?? '—'}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium">
                    <Money value={request.amount} currency={request.currency} />
                  </TableCell>
                  <TableCell><PaymentRequestBadge status={request.status} size="sm" /></TableCell>
                  <TableCell>
                    {request.status === 'PENDING' && (
                      <ConfirmDialog
                        trigger={
                          <Button variant="ghost" size="icon-sm" aria-label="Withdraw request">
                            <X className="text-danger" />
                          </Button>
                        }
                        title="Withdraw this payment?"
                        description="You can submit it again afterwards."
                        confirmLabel="Withdraw"
                        onConfirm={() => cancel.mutateAsync(request.id)}
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Pagination meta={requests.data?.meta} onPageChange={setPage} label="payments" />
      </Card>

      <SubmitPaymentDialog open={submitOpen} onOpenChange={setSubmitOpen} projectId={projectId} />
    </div>
  );
}

function SubmitPaymentDialog({
  open,
  onOpenChange,
  projectId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}) {
  const { onSuccess, onError } = useMutationHandlers();

  const [amount, setAmount] = useState('');
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState('BANK_TRANSFER');
  const [reference, setReference] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [invoiceId, setInvoiceId] = useState('');
  const [proof, setProof] = useState<File | null>(null);

  const invoices = useQuery({
    queryKey: queryKeys.portal.invoices(projectId),
    queryFn: () => workspaceApi.invoices(projectId),
    enabled: open,
  });

  const unpaid = (invoices.data ?? []).filter((invoice) => Number(invoice.balanceDue) > 0);

  const submit = useMutation({
    mutationFn: () =>
      paymentRequestsApi.submit(projectId, {
        amount: Number(amount),
        paidAt,
        method,
        reason: reason.trim(),
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
        invoiceId: invoiceId || undefined,
        proof,
      }),
    onSuccess: () => {
      onSuccess('Payment submitted — it will be verified shortly', [
        ['portal', 'payment-requests'],
        queryKeys.portal.workspace(projectId),
      ]);
      setAmount(''); setReference(''); setReason(''); setNotes('');
      setInvoiceId(''); setProof(null);
      onOpenChange(false);
    },
    onError: (error) => onError(error, 'Could not submit the payment'),
  });

  const canSubmit = Number(amount) > 0 && reason.trim().length >= 2;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Submit a payment</DialogTitle>
          <DialogDescription>
            Tell us what you paid and attach proof. It shows as pending until the team verifies it.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <FieldRow>
            <Field label="Amount paid" required>
              <Input
                type="number" step="0.01" min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="tabular"
                autoFocus
              />
            </Field>
            <Field label="Payment date" required>
              <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
            </Field>
          </FieldRow>

          <Field label="What is this for?" required hint="e.g. Milestone 2 payment">
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Milestone 2 Payment"
            />
          </Field>

          <Field label="Against which invoice?" hint="Optional, but it speeds up verification.">
            <Select value={invoiceId || 'none'} onValueChange={(v) => setInvoiceId(v === 'none' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Not linked to an invoice" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not linked to an invoice</SelectItem>
                {unpaid.map((invoice) => (
                  <SelectItem key={invoice.id} value={invoice.id}>
                    {invoice.number} — {invoice.currency} {Number(invoice.balanceDue).toFixed(2)} due
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <FieldRow>
            <Field label="Payment method">
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METHODS.map((value) => (
                    <SelectItem key={value} value={value}>{humanize(value)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Transaction / reference ID">
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="UTR / cheque number"
              />
            </Field>
          </FieldRow>

          <Field label="Payment proof" hint="Screenshot or PDF receipt. Stored privately.">
            {proof ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                <span className="flex min-w-0 items-center gap-2">
                  <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate text-xs">{proof.name}</span>
                </span>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">{formatFileSize(proof.size)}</span>
                  <button type="button" onClick={() => setProof(null)} aria-label="Remove file">
                    <X className="size-3 text-muted-foreground hover:text-danger" />
                  </button>
                </div>
              </div>
            ) : (
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border py-4 text-xs text-muted-foreground transition-colors hover:bg-accent">
                <Upload className="size-3.5" />
                Choose a file
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => setProof(e.target.files?.[0] ?? null)}
                />
              </label>
            )}
          </Field>

          <Field label="Notes">
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!canSubmit} loading={submit.isPending} onClick={() => submit.mutate()}>
            Submit payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
