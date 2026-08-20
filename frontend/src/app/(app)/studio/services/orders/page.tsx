'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Check, Copy, Eye, EyeOff, FileText, KeyRound,
  PackageCheck, Send, Tag, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input, Textarea } from '@/components/ui/input';
import { TableSkeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogBody, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Field } from '@/components/shared/form-field';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState, ErrorState } from '@/components/shared/empty-state';
import { ServiceIcon } from '@/components/modules/services/service-icon';
import { API_BASE_URL, ApiRequestError, getAccessToken } from '@/lib/api/client';
import {
  ORDER_STATUS_LABELS, ordersApi,
  type ServiceOrder, type ServiceOrderStatus,
} from '@/lib/api/services.api';
import { queryKeys } from '@/lib/hooks/query-keys';
import { formatDate, formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';

const rupees = (value: number) => `₹${value.toLocaleString('en-IN')}`;

const TONE: Record<ServiceOrderStatus, 'warning' | 'primary' | 'info' | 'success' | 'danger' | 'outline'> = {
  QUOTE_REQUESTED: 'warning',
  QUOTED: 'primary',
  AWAITING_PAYMENT: 'warning',
  PAYMENT_SUBMITTED: 'info',
  ACTIVE: 'success',
  REJECTED: 'danger',
  CANCELLED: 'outline',
};

const FILTERS: (ServiceOrderStatus | 'ALL')[] = [
  'ALL', 'QUOTE_REQUESTED', 'PAYMENT_SUBMITTED', 'QUOTED', 'AWAITING_PAYMENT', 'ACTIVE', 'REJECTED',
];

export default function OrdersPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<ServiceOrderStatus | 'ALL'>('ALL');
  const [activeId, setActiveId] = useState<string | null>(null);

  const orders = useQuery({
    queryKey: queryKeys.services.orders(filter),
    queryFn: () => ordersApi.list(filter === 'ALL' ? undefined : filter),
    refetchInterval: 60_000,
  });

  const items = orders.data?.items ?? [];
  const byStatus = orders.data?.byStatus ?? {};
  const active = items.find((o) => o.id === activeId) ?? items[0] ?? null;
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['services'] });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders"
        description="What clients have ordered, and what needs you."
        actions={<Button asChild variant="ghost"><Link href="/studio/services"><ArrowLeft /> Services</Link></Button>}
      />

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={cn(
              'rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
              filter === value
                ? 'border-primary bg-primary-muted text-primary'
                : 'border-border text-muted-foreground hover:text-foreground',
            )}
          >
            {value === 'ALL' ? 'All' : ORDER_STATUS_LABELS[value]}
            {value !== 'ALL' && byStatus[value] ? (
              <span className="ml-1.5 text-[10px] opacity-70">{byStatus[value]}</span>
            ) : null}
          </button>
        ))}
      </div>

      {orders.isError ? (
        <Card><ErrorState onRetry={() => void orders.refetch()} /></Card>
      ) : orders.isLoading ? (
        <Card><TableSkeleton rows={5} columns={4} /></Card>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState icon={PackageCheck} title="No orders here" className="py-16" />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_1fr]">
          <Card className="overflow-hidden">
            <div className="max-h-[70vh] overflow-y-auto scrollbar-slim">
              {items.map((order) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => setActiveId(order.id)}
                  className={cn(
                    'flex w-full items-start gap-2.5 border-b border-border p-3 text-left transition-colors',
                    active?.id === order.id ? 'bg-primary-muted' : 'hover:bg-accent',
                  )}
                >
                  <span
                    className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg"
                    style={{
                      backgroundColor: `${order.service.accentColor ?? '#0076FF'}18`,
                      color: order.service.accentColor ?? '#0076FF',
                    }}
                  >
                    <ServiceIcon name={order.service.icon} className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-xs font-semibold">{order.clientUser?.name}</p>
                      <Badge variant={TONE[order.status]} size="sm">{ORDER_STATUS_LABELS[order.status]}</Badge>
                    </div>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {order.service.name}{order.plan ? ` · ${order.plan.name}` : ''}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {order.orderNumber} · {formatRelative(order.createdAt)}
                      {order.finalPrice ? ` · ${rupees(order.finalPrice)}` : ''}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </Card>

          {active && <OrderPanel order={active} onChanged={refresh} />}
        </div>
      )}
    </div>
  );
}

function OrderPanel({ order, onChanged }: { order: ServiceOrder; onChanged: () => void }) {
  const [priceOpen, setPriceOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [credentials, setCredentials] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const queryClient = useQueryClient();

  const messages = useQuery({
    queryKey: queryKeys.services.orderMessages(order.id),
    queryFn: () => ordersApi.messages(order.id),
  });

  const send = useMutation({
    mutationFn: () => ordersApi.sendMessage(order.id, reply.trim()),
    onSuccess: () => {
      setReply('');
      void queryClient.invalidateQueries({ queryKey: queryKeys.services.orderMessages(order.id) });
    },
  });

  const revealCredentials = async () => {
    if (credentials !== null) return setCredentials(null);
    const result = await ordersApi.credentials(order.id);
    setCredentials(result.credentials ?? 'None stored');
  };

  const viewProof = async () => {
    const response = await fetch(`${API_BASE_URL}${ordersApi.proofUrl(order.id)}`, {
      headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
    });
    if (!response.ok) return toast.error('Could not open that file');
    const url = URL.createObjectURL(await response.blob());
    window.open(url, '_blank');
    // Revoked on a delay so the new tab has time to read it.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-base font-semibold">
              {order.service.name}{order.plan ? ` · ${order.plan.name}` : ''}
            </p>
            <p className="text-xs text-muted-foreground">
              {order.orderNumber} · {order.clientUser?.name} ({order.clientUser?.email})
              {order.termMonths ? ` · ${order.termMonths} months` : ''}
            </p>
          </div>
          <Badge variant={TONE[order.status]}>{ORDER_STATUS_LABELS[order.status]}</Badge>
        </div>

        <dl className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/40 p-3 sm:grid-cols-4">
          <Stat label="List" value={order.listPrice ? `${rupees(order.listPrice)}/mo` : '—'} />
          <Stat label="Coupon" value={order.couponCode ? `${order.couponCode} (−${rupees(order.discountAmount ?? 0)})` : '—'} />
          <Stat label="They pay" value={order.finalPrice ? rupees(order.finalPrice) : 'Not priced'} strong />
          <Stat label="Send to" value={order.deliveryEmail} />
        </dl>

        {order.requirements && (
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">What they asked for</p>
            <p className="whitespace-pre-wrap rounded-lg border-l-2 border-primary bg-muted/40 p-3 text-xs">
              {order.requirements}
            </p>
          </div>
        )}

        {order.status === 'PAYMENT_SUBMITTED' && (
          <div className="rounded-lg border border-info/40 bg-info-muted p-3">
            <p className="text-xs font-semibold text-info">Payment to verify</p>
            <dl className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
              <Stat label="Method" value={order.paymentMethod ?? '—'} />
              <Stat label="Reference" value={order.paymentReference ?? '—'} />
              <Stat label="Paid on" value={order.paidAt ? formatDate(order.paidAt) : '—'} />
              <Stat label="Submitted" value={order.submittedAt ? formatRelative(order.submittedAt) : '—'} />
            </dl>
            {order.hasProof && (
              <Button size="sm" variant="outline" className="mt-2" onClick={() => void viewProof()}>
                <FileText /> View proof
              </Button>
            )}
          </div>
        )}

        {order.hasCredentials && (
          <div className="rounded-lg border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold">
                <KeyRound className="size-3.5" /> Credentials sent to {order.deliveryEmail}
              </p>
              <Button size="sm" variant="ghost" onClick={() => void revealCredentials()}>
                {credentials === null ? <><Eye /> Show</> : <><EyeOff /> Hide</>}
              </Button>
            </div>
            {credentials !== null && (
              <div className="mt-2 flex items-start gap-2">
                <pre className="flex-1 overflow-x-auto rounded bg-muted p-2 text-[11px]">{credentials}</pre>
                <button
                  type="button"
                  aria-label="Copy credentials"
                  onClick={() => { void navigator.clipboard.writeText(credentials); toast.success('Copied'); }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Copy className="size-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Actions, gated by state so nothing invalid is offered ── */}
        <div className="flex flex-wrap gap-2 border-t border-border pt-3">
          {(order.status === 'QUOTE_REQUESTED' || order.status === 'QUOTED') && (
            <Button size="sm" onClick={() => setPriceOpen(true)}>
              <Tag /> {order.status === 'QUOTED' ? 'Change the price' : 'Set a price'}
            </Button>
          )}
          {order.status === 'PAYMENT_SUBMITTED' && (
            <>
              <Button size="sm" onClick={() => setApproveOpen(true)}><Check /> Approve &amp; deliver</Button>
              <Button size="sm" variant="outline" onClick={() => setRejectOpen(true)}><X /> Reject</Button>
            </>
          )}
        </div>

        {/* ── Thread ────────────────────────────────────────────── */}
        <div className="border-t border-border pt-3">
          <p className="mb-2 text-xs font-semibold">Messages</p>
          {(messages.data ?? []).length > 0 && (
            <div className="mb-2 space-y-2">
              {(messages.data ?? []).map((message) => (
                <div key={message.id} className={cn('rounded-lg p-2.5', message.isInternal ? 'bg-warning-muted' : 'bg-muted/50')}>
                  <p className="text-[11px] font-medium">
                    {message.author.name}
                    {message.isInternal && <Badge variant="warning" size="sm" className="ml-1.5">Internal</Badge>}
                    <span className="ml-1.5 font-normal text-muted-foreground">{formatRelative(message.createdAt)}</span>
                  </p>
                  <p className="mt-0.5 whitespace-pre-wrap text-xs text-muted-foreground">{message.body}</p>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Textarea rows={2} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply to the client…" className="flex-1 resize-none" />
            <Button size="icon" disabled={!reply.trim() || send.isPending} onClick={() => send.mutate()} aria-label="Send">
              <Send />
            </Button>
          </div>
        </div>
      </CardContent>

      <PriceDialog order={order} open={priceOpen} onOpenChange={setPriceOpen} onDone={onChanged} />
      <ApproveDialog order={order} open={approveOpen} onOpenChange={setApproveOpen} onDone={onChanged} />
      <RejectDialog order={order} open={rejectOpen} onOpenChange={setRejectOpen} onDone={onChanged} />
    </Card>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className={cn('mt-0.5 truncate text-xs', strong ? 'font-bold' : 'font-medium')}>{value}</dd>
    </div>
  );
}

function PriceDialog({ order, open, onOpenChange, onDone }: {
  order: ServiceOrder; open: boolean; onOpenChange: (v: boolean) => void; onDone: () => void;
}) {
  const [price, setPrice] = useState(String(order.finalPrice ?? ''));
  const [note, setNote] = useState('');

  const save = useMutation({
    mutationFn: () => ordersApi.setPrice(order.id, Number(price), note.trim() || undefined),
    onSuccess: () => { toast.success('Quote sent to the client'); onDone(); onOpenChange(false); },
    onError: (e) => toast.error(e instanceof ApiRequestError ? e.message : 'Could not save'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set a price for {order.clientUser?.name}</DialogTitle>
          <DialogDescription>
            This price is for this client only — the catalog is unchanged. They&apos;ll be emailed and
            can pay straight away.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <Field label="Price" htmlFor="price" hint={order.termMonths ? 'Per month.' : 'Total for the project.'} required>
            <Input id="price" type="number" min={1} value={price} onChange={(e) => setPrice(e.target.value)} autoFocus placeholder="e.g. 185000" />
          </Field>
          <Field label="Note to the client" htmlFor="note" hint="What the price covers.">
            <Textarea id="note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Includes 3 months of post-launch support." />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!Number(price)} loading={save.isPending} onClick={() => save.mutate()}>Send quote</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ApproveDialog({ order, open, onOpenChange, onDone }: {
  order: ServiceOrder; open: boolean; onOpenChange: (v: boolean) => void; onDone: () => void;
}) {
  const [credentials, setCredentials] = useState('');
  const [note, setNote] = useState('');

  const approve = useMutation({
    mutationFn: () => ordersApi.approve(order.id, {
      credentials: credentials.trim() || undefined,
      deliveryNote: note.trim() || undefined,
    }),
    onSuccess: () => { toast.success('Approved — the client has been told'); onDone(); onOpenChange(false); },
    onError: (e) => toast.error(e instanceof ApiRequestError ? e.message : 'Could not approve'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Approve and hand over</DialogTitle>
          <DialogDescription>
            Only do this once you have seen the money land. It activates the service immediately.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <Field
            label="Access details"
            htmlFor="credentials"
            hint={`Emailed on their own to ${order.deliveryEmail}, and stored encrypted so you can resend.`}
          >
            <Textarea
              id="credentials"
              rows={5}
              value={credentials}
              onChange={(e) => setCredentials(e.target.value)}
              placeholder={'IP: 203.0.113.45\nuser: root\npassword: …'}
              className="font-mono text-xs"
            />
          </Field>
          <Field label="Note" htmlFor="delivery-note" hint="Shown on their order page.">
            <Textarea id="delivery-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ubuntu 22.04 with Node 22 and PostgreSQL 16 preinstalled." />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button loading={approve.isPending} onClick={() => approve.mutate()}><Check /> Approve</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RejectDialog({ order, open, onOpenChange, onDone }: {
  order: ServiceOrder; open: boolean; onOpenChange: (v: boolean) => void; onDone: () => void;
}) {
  const [reason, setReason] = useState('');

  const reject = useMutation({
    mutationFn: () => ordersApi.reject(order.id, reason.trim()),
    onSuccess: () => { toast.success('Client told what to fix'); onDone(); onOpenChange(false); },
    onError: (e) => toast.error(e instanceof ApiRequestError ? e.message : 'Could not reject'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject this payment</DialogTitle>
          <DialogDescription>
            They can submit again, so say what would fix it rather than just what was wrong.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Field label="What was the problem?" htmlFor="reason" required>
            <Textarea
              id="reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              autoFocus
              placeholder="We could not find this reference on our account — could you send the bank receipt instead of the screenshot?"
            />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="danger" disabled={reason.trim().length < 3} loading={reject.isPending} onClick={() => reject.mutate()}>
            Reject
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
