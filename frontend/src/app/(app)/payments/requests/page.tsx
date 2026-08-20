'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Check, ExternalLink, Paperclip, Receipt, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/input';
import { Avatar } from '@/components/ui/misc';
import { TableSkeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogBody, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { PageHeader } from '@/components/shared/page-header';
import { Pagination } from '@/components/shared/pagination';
import { Money } from '@/components/shared/money';
import { StatCard } from '@/components/shared/stat-card';
import { EmptyState, ErrorState } from '@/components/shared/empty-state';
import { Field } from '@/components/shared/form-field';
import { PaymentRequestBadge } from '@/components/shared/portal-badges';
import { paymentRequestsApi } from '@/lib/api/portal.api';
import { accountsApi } from '@/lib/api/accounts.api';
import { queryKeys } from '@/lib/hooks/query-keys';
import { useMutationHandlers } from '@/lib/hooks/use-mutation-toast';
import { getAccessToken } from '@/lib/api/client';
import { formatDate, humanize } from '@/lib/format';
import type { PaymentRequest, PaymentRequestStatus } from '@/types/portal';

const TABS: { value: PaymentRequestStatus | 'all'; label: string }[] = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'all', label: 'All' },
];

/**
 * The approvals queue.
 *
 * A client submitting a payment does not move any money — approving here does,
 * by posting the same double entry the manual "Record payment" flow uses.
 */
export default function PaymentRequestsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<PaymentRequestStatus | 'all'>('PENDING');
  const [reviewing, setReviewing] = useState<PaymentRequest | null>(null);
  const [rejecting, setRejecting] = useState<PaymentRequest | null>(null);

  const query = useMemo(
    () => ({ page, limit: 20, status: status === 'all' ? undefined : status }),
    [page, status],
  );

  const requests = useQuery({
    queryKey: queryKeys.portal.paymentQueue(query),
    queryFn: () => paymentRequestsApi.queue(query),
  });

  const items = requests.data?.items ?? [];
  const summary = (requests.data?.meta as { summary?: { pendingCount: number; pendingValue: number } })
    ?.summary;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment requests"
        description="Payments your clients say they've made. Approving one records it in your books."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Awaiting review"
          value={summary?.pendingCount ?? 0}
          format="number"
          icon={Receipt}
          tone={(summary?.pendingCount ?? 0) > 0 ? 'warning' : 'default'}
        />
        <StatCard
          label="Value pending"
          value={summary?.pendingValue ?? 0}
          tone={(summary?.pendingValue ?? 0) > 0 ? 'primary' : 'default'}
        />
        <StatCard
          label="In this view"
          value={requests.data?.meta.total ?? 0}
          format="number"
          hint={status === 'all' ? 'All requests' : humanize(status)}
        />
      </div>

      <Card>
        <div className="border-b border-border p-4">
          <Tabs value={status} onValueChange={(v) => { setStatus(v as PaymentRequestStatus | 'all'); setPage(1); }}>
            <TabsList>
              {TABS.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>{tab.label}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {requests.isError ? (
          <ErrorState onRetry={() => void requests.refetch()} />
        ) : requests.isLoading ? (
          <TableSkeleton rows={5} columns={5} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title={status === 'PENDING' ? 'Nothing awaiting review' : 'No requests here'}
            description={
              status === 'PENDING'
                ? "You're all caught up — no client payments are waiting on you."
                : 'Try a different filter.'
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {items.map((request) => (
              <li key={request.id} className="flex flex-col gap-3 p-5 lg:flex-row lg:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <Avatar name={request.submittedBy.name} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{request.reason}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {request.submittedBy.name} ·{' '}
                      <Link
                        href={`/projects/${request.project.id}`}
                        className="text-primary hover:underline"
                      >
                        {request.project.title}
                      </Link>
                      {request.invoice ? ` · against ${request.invoice.number}` : ''}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" size="sm">{humanize(request.method)}</Badge>
                      {request.reference && (
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {request.reference}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        Paid {formatDate(request.paidAt)}
                      </span>
                      {request.proofFilename && (
                        <ProofLink projectId={request.project.id} requestId={request.id} />
                      )}
                    </div>
                    {request.status === 'REJECTED' && request.rejectionReason && (
                      <p className="mt-1 text-[11px] text-danger">
                        Rejected: {request.rejectionReason}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <div className="text-right">
                    <p className="text-base font-semibold">
                      <Money value={request.amount} currency={request.currency} />
                    </p>
                    <PaymentRequestBadge status={request.status} size="sm" />
                  </div>

                  {request.status === 'PENDING' && (
                    <div className="flex gap-1.5">
                      <Button size="sm" onClick={() => setReviewing(request)}>
                        <Check /> Approve
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setRejecting(request)}>
                        <X /> Reject
                      </Button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        <Pagination meta={requests.data?.meta} onPageChange={setPage} label="requests" />
      </Card>

      <ApproveDialog request={reviewing} onClose={() => setReviewing(null)} />
      <RejectDialog request={rejecting} onClose={() => setRejecting(null)} />
    </div>
  );
}

/**
 * Proof lives in private storage behind an authorised route, so it's fetched
 * with the bearer token and opened from a blob rather than linked directly.
 */
function ProofLink({ projectId, requestId }: { projectId: string; requestId: string }) {
  const [loading, setLoading] = useState(false);

  const open = async () => {
    setLoading(true);
    try {
      const response = await fetch(paymentRequestsApi.proofUrl(projectId, requestId), {
        headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
        credentials: 'include',
      });
      if (!response.ok) return;
      window.open(URL.createObjectURL(await response.blob()), '_blank');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void open()}
      disabled={loading}
      className="flex items-center gap-1 text-[10px] font-medium text-primary hover:underline"
    >
      <Paperclip className="size-2.5" />
      {loading ? 'Opening…' : 'View proof'}
    </button>
  );
}

function ApproveDialog({
  request,
  onClose,
}: {
  request: PaymentRequest | null;
  onClose: () => void;
}) {
  const { onSuccess, onError } = useMutationHandlers();
  const [accountId, setAccountId] = useState('');

  const accounts = useQuery({
    queryKey: queryKeys.accounts.cashPosition,
    queryFn: accountsApi.cashPosition,
    enabled: Boolean(request),
  });

  const approve = useMutation({
    mutationFn: () =>
      paymentRequestsApi.approve(request!.project.id, request!.id, {
        accountId,
        invoiceId: request!.invoiceId ?? undefined,
      }),
    onSuccess: () => {
      onSuccess('Payment approved and posted to your ledger', [
        ['portal', 'payment-queue'],
        ['portal', 'payment-requests'],
        queryKeys.invoices.all,
        queryKeys.dashboard.overview,
        queryKeys.ledger.all,
        queryKeys.accounts.all,
      ]);
      onClose();
    },
    onError: (error) => onError(error, 'Could not approve the payment'),
  });

  const hasInvoice = Boolean(request?.invoiceId);

  return (
    <Dialog open={Boolean(request)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Approve this payment</DialogTitle>
          <DialogDescription>
            Records the money for real: <strong>Dr Bank / Cr Accounts Receivable</strong>, and
            updates the invoice.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {request && (
            <div className="rounded-lg bg-muted/60 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Amount</span>
                <span className="text-base font-semibold">
                  <Money value={request.amount} currency={request.currency} />
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{request.reason}</span>
                <span>{request.invoice?.number ?? 'No invoice linked'}</span>
              </div>
            </div>
          )}

          {!hasInvoice && (
            <div className="rounded-lg border border-warning/40 bg-warning-muted/40 p-3">
              <p className="text-xs font-medium">No invoice linked</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                A payment has to settle an invoice to post correctly. Ask the client to resubmit
                against one, or record it manually from the invoice.
              </p>
            </div>
          )}

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
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!accountId || !hasInvoice}
            loading={approve.isPending}
            onClick={() => approve.mutate()}
          >
            <Check /> Approve payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RejectDialog({
  request,
  onClose,
}: {
  request: PaymentRequest | null;
  onClose: () => void;
}) {
  const { onSuccess, onError } = useMutationHandlers();
  const [reason, setReason] = useState('');

  const reject = useMutation({
    mutationFn: () => paymentRequestsApi.reject(request!.project.id, request!.id, reason.trim()),
    onSuccess: () => {
      onSuccess('Payment rejected — the client has been told why', [
        ['portal', 'payment-queue'],
        ['portal', 'payment-requests'],
      ]);
      setReason('');
      onClose();
    },
    onError: (error) => onError(error, 'Could not reject the payment'),
  });

  return (
    <Dialog open={Boolean(request)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject this payment</DialogTitle>
          <DialogDescription>
            The client sees your reason and can submit a corrected request.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <Field
            label="Why can't this be verified?"
            required
            hint="Be specific — this is what the client reads."
          >
            <Textarea
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="We could not find this transaction on our bank statement. Please check the reference number and resubmit."
              autoFocus
            />
          </Field>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            variant="danger"
            disabled={reason.trim().length < 5}
            loading={reject.isPending}
            onClick={() => reject.mutate()}
          >
            Reject payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
