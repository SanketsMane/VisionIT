'use client';

import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogBody, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Field } from '@/components/shared/form-field';
import { ApiRequestError } from '@/lib/api/client';
import { servicesApi, type AppliedCoupon, type Service, type ServicePlan } from '@/lib/api/services.api';

export interface QuoteTarget {
  service: Service;
  plan?: ServicePlan;
  termMonths?: number;
  coupon?: AppliedCoupon | null;
}

const rupees = (value: number) => `₹${value.toLocaleString('en-IN')}`;

/**
 * The "Get a quote" form.
 *
 * Deliberately short — name, email, and what they need. Every extra required
 * field costs enquiries, and anything else can be asked in the reply. Budget
 * and timeline are offered because they genuinely change the answer, but
 * neither is required.
 */
export function QuoteDialog({
  target,
  open,
  onOpenChange,
}: {
  target: QuoteTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [form, setForm] = useState({
    name: '', email: '', phone: '', company: '', message: '', budget: '', timeline: '',
  });
  // Honeypot: never shown to a person, so anything in it came from a bot.
  const [website, setWebsite] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ name: '', email: '', phone: '', company: '', message: '', budget: '', timeline: '' });
      setWebsite('');
      setSent(false);
    }
  }, [open]);

  const set = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = useMutation({
    mutationFn: () =>
      servicesApi.submitQuote({
        serviceId: target?.service.id,
        serviceSlug: target?.service.slug,
        planId: target?.plan?.id,
        termMonths: target?.termMonths,
        couponCode: target?.coupon?.code,
        ...form,
        website,
      }),
    onSuccess: () => setSent(true),
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : 'Could not send that just now'),
  });

  const price = target?.plan && target.termMonths
    ? target.plan.prices.find((p) => p.termMonths === target.termMonths)
    : null;
  const discounted = target?.coupon?.prices.find(
    (p) => p.planId === target.plan?.id && p.termMonths === target.termMonths,
  );

  const canSubmit = form.name.trim().length >= 2 && /.+@.+\..+/.test(form.email);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        {sent ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="size-5 text-success" />
                Thanks — that&apos;s with us
              </DialogTitle>
              <DialogDescription>
                We read every enquiry ourselves and usually reply the same working day.
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
              <p className="text-sm text-muted-foreground">
                We&apos;ll be in touch at <span className="font-medium text-foreground">{form.email}</span>.
                {target?.coupon && ' Your coupon is noted on the enquiry.'}
              </p>
            </DialogBody>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Close</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>
                {target?.plan ? `Get a quote — ${target.service.name} ${target.plan.name}` : `Get a quote — ${target?.service.name ?? ''}`}
              </DialogTitle>
              <DialogDescription>
                Tell us what you need. No obligation, and we&apos;ll come back with a real number.
              </DialogDescription>
            </DialogHeader>

            <DialogBody className="space-y-4">
              {price && (
                <div className="rounded-lg border border-border bg-muted/40 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      {target?.plan?.name} · {target?.termMonths === 1 ? 'monthly' : `${target?.termMonths} months`}
                    </span>
                    <span className="text-sm font-semibold">
                      {discounted ? (
                        <>
                          <span className="mr-1.5 text-xs font-normal text-muted-foreground line-through">
                            {rupees(discounted.listPrice)}
                          </span>
                          <span className="text-success">{rupees(discounted.price)}/mo</span>
                        </>
                      ) : (
                        `${rupees(price.price)}/mo`
                      )}
                    </span>
                  </div>
                  {target?.coupon && (
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-success">
                      <Tag className="size-3" /> {target.coupon.code} applied
                    </p>
                  )}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Your name" htmlFor="q-name" required>
                  <Input id="q-name" value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus placeholder="Full name" />
                </Field>
                <Field label="Email" htmlFor="q-email" required>
                  <Input id="q-email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="you@company.com" />
                </Field>
                <Field label="Phone" htmlFor="q-phone">
                  <Input id="q-phone" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+91 …" />
                </Field>
                <Field label="Company" htmlFor="q-company">
                  <Input id="q-company" value={form.company} onChange={(e) => set('company', e.target.value)} />
                </Field>
              </div>

              <Field label="What do you need?" htmlFor="q-message" hint="The more specific, the better the quote.">
                <Textarea
                  id="q-message"
                  rows={4}
                  value={form.message}
                  onChange={(e) => set('message', e.target.value)}
                  placeholder="Tell us about the project, the stack you're on, and anything that has to work from day one."
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Budget" htmlFor="q-budget" hint="Optional — it helps us scope realistically.">
                  <Input id="q-budget" value={form.budget} onChange={(e) => set('budget', e.target.value)} placeholder="e.g. ₹50,000 – ₹1,00,000" />
                </Field>
                <Field label="Timeline" htmlFor="q-timeline">
                  <Input id="q-timeline" value={form.timeline} onChange={(e) => set('timeline', e.target.value)} placeholder="e.g. within a month" />
                </Field>
              </div>

              {/* Off-screen rather than display:none — some bots skip hidden fields. */}
              <div aria-hidden className="absolute left-[-9999px] top-0 h-0 w-0 overflow-hidden">
                <Label htmlFor="q-website">Leave this empty</Label>
                <Input id="q-website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
              </div>
            </DialogBody>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button disabled={!canSubmit} loading={submit.isPending} onClick={() => submit.mutate()}>
                Send enquiry
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
