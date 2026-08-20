'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Loader2, Tag, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogBody, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Field } from '@/components/shared/form-field';
import { ApiRequestError } from '@/lib/api/client';
import {
  TERM_LABELS, ordersApi, quoteFromSlabs,
  type AppliedCoupon, type Service, type ServicePlan,
} from '@/lib/api/services.api';
import { queryKeys } from '@/lib/hooks/query-keys';
import { useAuthStore } from '@/store/auth.store';
import { cn } from '@/lib/utils';

const rupees = (value: number) => `₹${value.toLocaleString('en-IN')}`;

/**
 * Ordering, in one dialog.
 *
 * A priced service asks for a plan and a term; a quote-only one asks what they
 * need. Both end at the same place — an order the studio can see — because
 * splitting them into two flows would mean the client has to know which kind
 * they are looking at before they start.
 *
 * Nothing here decides a price. The plan, term and coupon are sent to the
 * server, which re-derives the figure from the catalog; the numbers on screen
 * are a preview.
 */
export function OrderDialog({
  service,
  open,
  onOpenChange,
}: {
  service: Service | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const me = useAuthStore((s) => s.user);

  const hasPlans = Boolean(service?.plans.length);
  const isSlab = service?.pricingModel === 'SLAB';

  const [planId, setPlanId] = useState<string | null>(null);
  const [term, setTerm] = useState<number>(24);
  const [code, setCode] = useState('');
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);
  const [applying, setApplying] = useState(false);
  const [requirements, setRequirements] = useState('');
  const [amount, setAmount] = useState('');
  const [deliveryEmail, setDeliveryEmail] = useState('');

  useEffect(() => {
    if (!open || !service) return;
    const popular = service.plans.find((p) => p.isPopular) ?? service.plans[0];
    setPlanId(popular?.id ?? null);
    const terms = popular?.prices.map((p) => p.termMonths) ?? [];
    setTerm(terms.length ? Math.max(...terms) : 24);
    setCode(''); setCoupon(null); setRequirements('');
    // Prefilled with the minimum so the calculator shows something immediately
    // rather than an empty box the client has to guess at.
    setAmount(service.minOrderAmount ? String(service.minOrderAmount) : '');
    // Pre-filled with their sign-in address, but editable: credentials often
    // need to go to a personal inbox rather than a work one.
    setDeliveryEmail(me?.email ?? '');
  }, [open, service, me?.email]);

  const plan: ServicePlan | null = service?.plans.find((p) => p.id === planId) ?? null;
  const price = plan?.prices.find((p) => p.termMonths === term) ?? null;
  const discounted = coupon?.prices.find((p) => p.planId === planId && p.termMonths === term);
  const payable = discounted?.price ?? price?.price ?? null;

  const terms = plan?.prices.map((p) => p.termMonths).sort((a, b) => b - a) ?? [];

  const applyCode = async () => {
    if (!code.trim() || !service) return;
    setApplying(true);
    try {
      const result = await ordersApi.applyCoupon(code.trim(), service.id);
      if (!result.prices.length) {
        toast.error('That code does not apply to this service');
        setCoupon(null);
      } else {
        setCoupon(result);
        toast.success('Coupon applied');
      }
    } catch (error) {
      setCoupon(null);
      toast.error(error instanceof ApiRequestError ? error.message : 'Could not apply that code');
    } finally {
      setApplying(false);
    }
  };

  const numericAmount = Number(amount);
  const slabQuote = isSlab && service ? quoteFromSlabs(service.slabs, numericAmount) : null;
  const belowMinimum = Boolean(
    isSlab && service?.minOrderAmount && numericAmount > 0 && numericAmount < service.minOrderAmount,
  );

  const place = useMutation({
    mutationFn: () =>
      ordersApi.place({
        serviceId: service?.id,
        ...(isSlab
          ? { amount: numericAmount }
          : hasPlans
            ? { planId, termMonths: term, couponCode: coupon?.code }
            : { requestQuote: true }),
        requirements: requirements.trim() || undefined,
        deliveryEmail: deliveryEmail.trim(),
      }),
    onSuccess: (order) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.services.myOrders });
      toast.success(
        order.awaitingQuote
          ? 'Request sent — we will come back with a price'
          : `Order ${order.orderNumber} placed`,
      );
      onOpenChange(false);
      router.push(`/portal/services/orders/${order.id}`);
    },
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : 'Could not place that order'),
  });

  const canSubmit =
    /.+@.+\..+/.test(deliveryEmail) &&
    (isSlab ? Boolean(slabQuote) && !belowMinimum : !hasPlans || Boolean(planId));

  if (!service) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>
            {isSlab
              ? `Buy ${service.unitLabel ?? 'credits'} — ${service.name}`
              : hasPlans
                ? `Choose a plan — ${service.name}`
                : 'Tell us what you need'}
          </DialogTitle>
          <DialogDescription>
            {isSlab
              ? 'Enter what you want to spend and we will show you what it buys. The rate improves the more you top up.'
              : hasPlans
                ? 'Pick a size and a term. Nothing is charged here — we will send you payment details.'
                : `We price ${service.name} per project, so tell us a little and we will come back with a figure.`}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {hasPlans && (
            <>
              <div className="space-y-1.5">
                <p className="text-xs font-medium">Plan</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {service.plans.map((option) => {
                    const optionPrice = option.prices.find((p) => p.termMonths === term);
                    const optionDiscount = coupon?.prices.find(
                      (p) => p.planId === option.id && p.termMonths === term,
                    );
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setPlanId(option.id)}
                        className={cn(
                          'rounded-lg border p-3 text-left transition-colors',
                          planId === option.id
                            ? 'border-primary bg-primary-muted'
                            : 'border-border hover:border-primary/50',
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold">{option.name}</span>
                          {option.isPopular && <Badge variant="primary" size="sm">Popular</Badge>}
                        </div>
                        {optionPrice && (
                          <p className="mt-1 text-sm font-bold">
                            {optionDiscount ? (
                              <>
                                <span className="mr-1 text-[11px] font-normal text-muted-foreground line-through">
                                  {rupees(optionPrice.price)}
                                </span>
                                <span className="text-success">{rupees(optionDiscount.price)}</span>
                              </>
                            ) : (
                              rupees(optionPrice.price)
                            )}
                            <span className="text-[10px] font-normal text-muted-foreground">/mo</span>
                          </p>
                        )}
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {option.specs.map((s) => s.value).join(' · ')}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-medium">Billing term</p>
                <div className="inline-flex rounded-lg bg-muted p-1">
                  {terms.map((months) => (
                    <button
                      key={months}
                      type="button"
                      onClick={() => setTerm(months)}
                      className={cn(
                        'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                        term === months ? 'bg-card shadow-soft' : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {TERM_LABELS[months] ?? `${months} months`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-medium">Coupon</p>
                {coupon ? (
                  <div className="inline-flex items-center gap-2 rounded-lg border border-success/40 bg-success-muted px-3 py-1.5">
                    <Tag className="size-3.5 text-success" />
                    <span className="text-xs font-semibold text-success">{coupon.code} applied</span>
                    <button type="button" onClick={() => { setCoupon(null); setCode(''); }} aria-label="Remove coupon">
                      <X className="size-3.5 text-success/70" />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-1.5">
                    <Input
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void applyCode(); } }}
                      placeholder="Have a code?"
                      className="h-8 max-w-[180px] text-xs uppercase"
                    />
                    <Button size="sm" variant="outline" onClick={() => void applyCode()} disabled={applying || !code.trim()}>
                      {applying ? <Loader2 className="animate-spin" /> : 'Apply'}
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}

          {isSlab && service && (
            <div className="space-y-3">
              {service.priceNote && (
                <Badge variant="success" size="sm">{service.priceNote}</Badge>
              )}

              <Field
                label="How much do you want to top up?"
                htmlFor="amount"
                hint={service.minOrderAmount ? `Minimum ₹${service.minOrderAmount.toLocaleString('en-IN')}.` : undefined}
                error={belowMinimum ? `The minimum top-up is ₹${service.minOrderAmount?.toLocaleString('en-IN')}` : undefined}
                required
              >
                <Input
                  id="amount"
                  type="number"
                  min={service.minOrderAmount ?? 1}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  error={belowMinimum}
                  placeholder="1000"
                />
              </Field>

              {/* Quick picks: most people do not want to think about a number. */}
              <div className="flex flex-wrap gap-1.5">
                {[1000, 3000, 8000, 15000, 70000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAmount(String(preset))}
                    className={cn(
                      'rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors',
                      numericAmount === preset
                        ? 'border-primary bg-primary-muted text-primary'
                        : 'border-border text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {rupees(preset)}
                  </button>
                ))}
              </div>

              {slabQuote && !belowMinimum && (
                <div className="rounded-lg border border-primary/40 bg-primary-muted p-4 text-center">
                  <p className="text-2xl font-bold text-primary">
                    {slabQuote.quantity.toLocaleString('en-IN')}
                  </p>
                  <p className="text-xs font-medium text-primary">{service.unitLabel ?? 'units'}</p>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    at ₹{slabQuote.unitPrice.toFixed(2)} each
                    {slabQuote.validityLabel ? ` · valid ${slabQuote.validityLabel}` : ''}
                  </p>
                </div>
              )}

              {/* The whole ladder, so the next band is visible rather than a surprise. */}
              <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full text-[11px]">
                  <thead className="bg-muted/60">
                    <tr>
                      <th className="px-2.5 py-1.5 text-left font-medium text-muted-foreground">Top-up</th>
                      <th className="px-2.5 py-1.5 text-right font-medium text-muted-foreground">Rate</th>
                      <th className="px-2.5 py-1.5 text-right font-medium text-muted-foreground">Validity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {service.slabs.map((slab) => {
                      const current =
                        numericAmount >= slab.minAmount && numericAmount <= (slab.maxAmount ?? Infinity);
                      return (
                        <tr key={slab.minAmount} className={cn('border-t border-border', current && 'bg-primary-muted font-medium')}>
                          <td className="px-2.5 py-1.5">
                            {rupees(Math.max(slab.minAmount, service.minOrderAmount ?? 0))}
                            {slab.maxAmount ? ` – ${rupees(slab.maxAmount)}` : '+'}
                          </td>
                          <td className="px-2.5 py-1.5 text-right">₹{slab.unitPrice.toFixed(2)}</td>
                          <td className="px-2.5 py-1.5 text-right text-muted-foreground">{slab.validityLabel}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <Field
            label="Where should we send everything?"
            htmlFor="delivery-email"
            hint="Login details and bills go here. Use whichever inbox you actually check."
            required
          >
            <Input
              id="delivery-email"
              type="email"
              value={deliveryEmail}
              onChange={(e) => setDeliveryEmail(e.target.value)}
              placeholder="you@gmail.com"
            />
          </Field>

          <Field
            label={hasPlans || isSlab ? 'Anything we should know?' : 'What do you need?'}
            htmlFor="requirements"
            hint={
              hasPlans
                ? 'Operating system, software to preinstall, anything specific.'
                : isSlab
                  ? 'Sender ID, the kind of messages you send, anything else.'
                  : undefined
            }
          >
            <Textarea
              id="requirements"
              rows={hasPlans ? 3 : 5}
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              placeholder={
                hasPlans
                  ? 'e.g. Ubuntu 22.04 with Node and PostgreSQL'
                  : isSlab
                    ? 'e.g. transactional OTPs, sender ID VISION'
                    : 'Tell us about the project, who it is for, and when you need it.'
              }
            />
          </Field>

          {hasPlans && payable !== null && (
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {plan?.name} · {term === 1 ? 'monthly' : `${term} months`}
                </span>
                <span className="font-semibold">{rupees(payable)}/mo</span>
              </div>
              {discounted && (
                <div className="mt-1 flex items-center justify-between text-[11px] text-success">
                  <span>{coupon?.code} discount</span>
                  <span>− {rupees(discounted.amountOff)}/mo</span>
                </div>
              )}
              <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-xs font-semibold">
                <span>Total for {term === 1 ? '1 month' : `${term} months`}</span>
                <span>{rupees(payable * term)}</span>
              </div>
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!canSubmit} loading={place.isPending} onClick={() => place.mutate()}>
            <Check /> {isSlab ? 'Place order' : hasPlans ? 'Place order' : 'Request a quote'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
