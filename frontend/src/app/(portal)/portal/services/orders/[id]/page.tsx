'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, CheckCircle2, Clock, Copy, HelpCircle, Hourglass,
  Send, ShieldCheck, Upload, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input, Textarea } from '@/components/ui/input';
import { Avatar } from '@/components/ui/misc';
import { Skeleton } from '@/components/ui/skeleton';
import { Field } from '@/components/shared/form-field';
import { ErrorState } from '@/components/shared/empty-state';
import { ServiceIcon } from '@/components/modules/services/service-icon';
import { STATUS_TONE } from '../page';
import { ORDER_STATUS_LABELS, ordersApi, type ServiceOrderStatus } from '@/lib/api/services.api';
import { ApiRequestError } from '@/lib/api/client';
import { queryKeys } from '@/lib/hooks/query-keys';
import { formatDate, formatRelative } from '@/lib/format';
import { useAuthStore } from '@/store/auth.store';
import { cn } from '@/lib/utils';

const rupees = (value: number) => `₹${value.toLocaleString('en-IN')}`;

/** The stages a client is walked through, in order. */
const STEPS: { key: ServiceOrderStatus[]; label: string }[] = [
  { key: ['QUOTE_REQUESTED'], label: 'Quote requested' },
  { key: ['QUOTED', 'AWAITING_PAYMENT', 'REJECTED'], label: 'Payment' },
  { key: ['PAYMENT_SUBMITTED'], label: 'Verifying' },
  { key: ['ACTIVE'], label: 'Active' },
];

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const me = useAuthStore((s) => s.user);

  const order = useQuery({
    queryKey: queryKeys.services.myOrder(params.id),
    queryFn: () => ordersApi.mineById(params.id),
    // Polled while a person is looking at it, so an approval lands without a
    // manual refresh.
    refetchInterval: 30_000,
  });

  const payment = useQuery({
    queryKey: queryKeys.services.paymentDetails,
    queryFn: ordersApi.paymentDetails,
  });

  const messages = useQuery({
    queryKey: queryKeys.services.orderMessages(params.id),
    queryFn: () => ordersApi.messages(params.id),
  });

  const [method, setMethod] = useState('UPI');
  const [reference, setReference] = useState('');
  const [proof, setProof] = useState<File | null>(null);
  const [question, setQuestion] = useState('');

  const submit = useMutation({
    mutationFn: () =>
      ordersApi.submitPayment(params.id, {
        method,
        reference: reference.trim() || undefined,
        paidAt: new Date().toISOString(),
        proof: proof ?? undefined,
      }),
    onSuccess: () => {
      toast.success('Sent — we will verify it shortly');
      setProof(null); setReference('');
      void queryClient.invalidateQueries({ queryKey: queryKeys.services.myOrder(params.id) });
    },
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : 'Could not submit that'),
  });

  const ask = useMutation({
    mutationFn: () => ordersApi.sendMessage(params.id, question.trim()),
    onSuccess: () => {
      setQuestion('');
      void queryClient.invalidateQueries({ queryKey: queryKeys.services.orderMessages(params.id) });
      toast.success('Sent — we will get back to you');
    },
    onError: () => toast.error('Could not send that'),
  });

  if (order.isLoading) return <Skeleton className="h-96" />;
  if (order.isError || !order.data) {
    return <Card><ErrorState title="Order not found" onRetry={() => void order.refetch()} /></Card>;
  }

  const data = order.data;
  const activeStep = STEPS.findIndex((s) => s.key.includes(data.status));

  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/portal/services/orders"><ArrowLeft /> My orders</Link>
      </Button>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span
                className="grid size-11 place-items-center rounded-lg"
                style={{
                  backgroundColor: `${data.service.accentColor ?? '#0076FF'}18`,
                  color: data.service.accentColor ?? '#0076FF',
                }}
              >
                <ServiceIcon name={data.service.icon} className="size-5" />
              </span>
              <div>
                <p className="text-base font-semibold">
                  {data.service.name}
                  {data.plan && <span className="text-muted-foreground"> · {data.plan.name}</span>}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {data.orderNumber} · ordered {formatDate(data.createdAt)}
                </p>
              </div>
            </div>
            <Badge variant={STATUS_TONE[data.status]}>{ORDER_STATUS_LABELS[data.status]}</Badge>
          </div>

          {/* Progress, so the client always knows whose turn it is. */}
          <div className="mt-5 flex items-center gap-1">
            {STEPS.map((step, index) => (
              <div key={step.label} className="flex flex-1 items-center gap-1">
                <div className="flex-1">
                  <div
                    className={cn(
                      'h-1 rounded-full',
                      index <= activeStep ? 'bg-primary' : 'bg-border',
                      data.status === 'REJECTED' && index === 1 && 'bg-danger',
                    )}
                  />
                  <p className={cn(
                    'mt-1.5 text-[10px]',
                    index <= activeStep ? 'font-medium text-foreground' : 'text-muted-foreground',
                  )}>
                    {step.label}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── State-specific panel ───────────────────────────────────── */}
      {data.awaitingQuote && (
        <Card>
          <CardContent className="flex items-start gap-3 p-5">
            <Hourglass className="mt-0.5 size-5 shrink-0 text-warning" />
            <div>
              <p className="text-sm font-semibold">We&apos;re putting a price together</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Someone is reading your requirements now. You&apos;ll get an email as soon as there&apos;s a
                number, and it will appear here. Nothing is owed until then.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {data.status === 'PAYMENT_SUBMITTED' && (
        <Card>
          <CardContent className="flex items-start gap-3 p-5">
            <Clock className="mt-0.5 size-5 shrink-0 text-info" />
            <div>
              <p className="text-sm font-semibold">Payment received — we&apos;re checking it</p>
              <p className="mt-1 text-xs text-muted-foreground">
                We&apos;ll verify it against our account and activate your service. You&apos;ll get an email
                either way, usually the same working day.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {data.status === 'ACTIVE' && (
        <Card className="border-success/40">
          <CardContent className="flex items-start gap-3 p-5">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />
            <div className="min-w-0">
              <p className="text-sm font-semibold">Your service is active</p>
              <p className="mt-1 text-xs text-muted-foreground">
                We&apos;ve sent your access details to{' '}
                <span className="font-medium text-foreground">{data.deliveryEmail}</span> in a separate
                email. Check spam if it hasn&apos;t arrived.
              </p>
              {data.deliveryNote && (
                <p className="mt-2 rounded-lg bg-muted/60 p-2.5 text-xs">{data.deliveryNote}</p>
              )}
              {data.expiresAt && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Runs until {formatDate(data.expiresAt)}.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {data.status === 'REJECTED' && (
        <Card className="border-danger/40">
          <CardContent className="flex items-start gap-3 p-5">
            <XCircle className="mt-0.5 size-5 shrink-0 text-danger" />
            <div>
              <p className="text-sm font-semibold">We couldn&apos;t verify that payment</p>
              <p className="mt-1 text-xs text-muted-foreground">{data.rejectionReason}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Submit it again below with the corrected details and it goes straight back to us.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_minmax(0,340px)]">
        <div className="space-y-5">
          {/* ── Pay ─────────────────────────────────────────────── */}
          {data.canPay && data.finalPrice !== null && (
            <Card>
              <CardContent className="space-y-4 p-5">
                <div>
                  <p className="text-sm font-semibold">Pay {rupees(data.finalPrice)}{data.termMonths ? '/mo' : ''}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Transfer using any of the details below, then tell us you&apos;ve paid.
                  </p>
                </div>

                {payment.data?.methods.length ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {payment.data.methods.map((option) => (
                      <div key={option.type} className="rounded-lg border border-border p-3">
                        <p className="text-xs font-semibold">{option.label}</p>
                        <dl className="mt-2 space-y-1">
                          {option.rows.map((row) => (
                            <div key={row.label} className="flex items-center justify-between gap-2">
                              <dt className="text-[11px] text-muted-foreground">{row.label}</dt>
                              <dd className="flex items-center gap-1 text-[11px] font-medium">
                                <span className="max-w-[150px] truncate">{row.value}</span>
                                <button
                                  type="button"
                                  aria-label={`Copy ${row.label}`}
                                  onClick={() => {
                                    void navigator.clipboard.writeText(row.value);
                                    toast.success(`${row.label} copied`);
                                  }}
                                  className="text-muted-foreground hover:text-foreground"
                                >
                                  <Copy className="size-3" />
                                </button>
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-lg border border-warning/40 bg-warning-muted p-3 text-xs text-warning">
                    Payment details aren&apos;t set up yet. Message us below and we&apos;ll send them over.
                  </p>
                )}

                <div className="space-y-3 border-t border-border pt-4">
                  <p className="text-xs font-semibold">Once you&apos;ve paid</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="How did you pay?" htmlFor="method">
                      <select
                        id="method"
                        value={method}
                        onChange={(e) => setMethod(e.target.value)}
                        className="h-9 w-full rounded-lg border border-border bg-card px-3 text-sm"
                      >
                        <option value="UPI">UPI</option>
                        <option value="BANK_TRANSFER">Bank transfer</option>
                        <option value="CARD">Card</option>
                        <option value="CASH">Cash</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </Field>
                    <Field label="Reference / UTR" htmlFor="reference" hint="Helps us find it faster.">
                      <Input id="reference" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. UPI/2026/8817204" />
                    </Field>
                  </div>

                  <Field label="Screenshot or receipt" htmlFor="proof" hint="A screenshot of the transfer is enough.">
                    <label className={cn(
                      'flex cursor-pointer items-center gap-2.5 rounded-lg border border-dashed p-3 transition-colors',
                      proof ? 'border-success bg-success-muted' : 'border-border hover:border-primary',
                    )}>
                      <input
                        id="proof"
                        type="file"
                        accept="image/*,application/pdf"
                        hidden
                        onChange={(e) => setProof(e.target.files?.[0] ?? null)}
                      />
                      <Upload className={cn('size-4', proof ? 'text-success' : 'text-muted-foreground')} />
                      <span className="text-xs">
                        {proof ? proof.name : 'Choose a screenshot or PDF'}
                      </span>
                    </label>
                  </Field>

                  <Button
                    className="w-full"
                    loading={submit.isPending}
                    disabled={!proof && !reference.trim()}
                    onClick={() => submit.mutate()}
                  >
                    <ShieldCheck /> I&apos;ve paid — send for verification
                  </Button>
                  <p className="text-center text-[11px] text-muted-foreground">
                    Nothing is charged here. We verify the transfer manually before activating anything.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Ask for help ────────────────────────────────────── */}
          <Card>
            <CardContent className="space-y-3 p-5">
              <p className="inline-flex items-center gap-1.5 text-sm font-semibold">
                <HelpCircle className="size-4" /> Questions about this order
              </p>

              {(messages.data ?? []).length > 0 && (
                <div className="space-y-2.5">
                  {(messages.data ?? []).map((message) => (
                    <div key={message.id} className="flex gap-2.5">
                      <Avatar name={message.author.name} src={message.author.avatarUrl ?? undefined} size="xs" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-medium">
                          {message.author.id === me?.id ? 'You' : message.author.name}
                          <span className="ml-1.5 font-normal text-muted-foreground">
                            {formatRelative(message.createdAt)}
                          </span>
                        </p>
                        <p className="mt-0.5 whitespace-pre-wrap text-xs text-muted-foreground">{message.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <Textarea
                  rows={2}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask us anything about this order…"
                  className="flex-1 resize-none"
                />
                <Button
                  size="icon"
                  disabled={!question.trim() || ask.isPending}
                  onClick={() => ask.mutate()}
                  aria-label="Send"
                >
                  <Send />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Summary ───────────────────────────────────────────── */}
        <Card className="h-fit">
          <CardContent className="space-y-3 p-5">
            <p className="text-sm font-semibold">Order summary</p>
            <dl className="space-y-2 text-xs">
              <Row label="Service" value={data.service.name} />
              {data.plan && <Row label="Plan" value={data.plan.name} />}
              {data.termMonths && <Row label="Term" value={`${data.termMonths} months`} />}
              {data.listPrice > 0 && <Row label="List price" value={`${rupees(data.listPrice)}/mo`} />}
              {data.couponCode && (
                <Row label={`Coupon ${data.couponCode}`} value={`− ${rupees(data.discountAmount ?? 0)}/mo`} tone="success" />
              )}
              <div className="flex items-center justify-between border-t border-border pt-2 text-sm font-semibold">
                <dt>{data.finalPrice ? 'You pay' : 'Price'}</dt>
                <dd>{data.finalPrice ? `${rupees(data.finalPrice)}${data.termMonths ? '/mo' : ''}` : 'Pending quote'}</dd>
              </div>
              {data.finalPrice && data.termMonths ? (
                <p className="text-right text-[11px] text-muted-foreground">
                  {rupees(data.finalPrice * data.termMonths)} for {data.termMonths} months
                </p>
              ) : null}
            </dl>

            <div className="border-t border-border pt-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Delivery email</p>
              <p className="mt-0.5 break-all text-xs font-medium">{data.deliveryEmail}</p>
            </div>

            {data.requirements && (
              <div className="border-t border-border pt-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Your notes</p>
                <p className="mt-0.5 whitespace-pre-wrap text-xs text-muted-foreground">{data.requirements}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'success' }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn('font-medium', tone === 'success' && 'text-success')}>{value}</dd>
    </div>
  );
}
