'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, Clock, Loader2, Mail, MapPin, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Field } from '@/components/shared/form-field';
import { LEAD_SOURCE_OPTIONS, publicApi, type LeadSource } from '@/lib/api/public.api';
import { ApiRequestError } from '@/lib/api/client';
import { SITE, addressLines, hasAddress } from '@/lib/site.config';
import { PageHero } from '@/components/site/page-hero';

export default function ContactPage() {
  const [form, setForm] = useState({
    name: '', email: '', phone: '', company: '', subject: '', message: '',
    source: '' as LeadSource | '',
    website: '',
  });
  const [sent, setSent] = useState(false);

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const send = useMutation({
    mutationFn: () =>
      publicApi.contact({
        name: form.name,
        email: form.email,
        phone: form.phone || undefined,
        company: form.company || undefined,
        subject: form.subject || undefined,
        message: form.message,
        source: form.source || undefined,
        website: form.website,
      }),
    onSuccess: () => setSent(true),
    onError: (error) =>
      toast.error(
        error instanceof ApiRequestError ? error.message : 'Could not send that. Try again.',
      ),
  });

  const address = addressLines();

  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="Tell us what you are building"
        description={`Or ask about anything we do. ${SITE.responseTime}, every enquiry.`}
      />

      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">

      <div className="mt-12 grid gap-10 lg:grid-cols-[1.3fr_1fr]">
        {/* ── Form ───────────────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
          {sent ? (
            <div className="py-10 text-center">
              <span className="mx-auto grid size-12 place-items-center rounded-full bg-success-muted text-success">
                <CheckCircle2 className="size-6" />
              </span>
              <h2 className="mt-5 text-xl font-semibold">Message sent</h2>
              <p className="mx-auto mt-2 max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">
                We have it, and you should have a confirmation email too. Someone will reply within
                one working day.
              </p>
              <div className="mt-6 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
                <Button asChild>
                  <Link href="/register">Create an account</Link>
                </Button>
                <Button variant="outline" onClick={() => { setSent(false); setForm({ name: '', email: '', phone: '', company: '', subject: '', message: '', source: '', website: '' }); }}>
                  Send another
                </Button>
              </div>
            </div>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                send.mutate();
              }}
              className="space-y-4"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Your name" htmlFor="name" required>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => set('name')(e.target.value)}
                    placeholder="Full name"
                    required
                    autoComplete="name"
                  />
                </Field>
                <Field label="Email" htmlFor="email" required>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => set('email')(e.target.value)}
                    placeholder="you@company.com"
                    required
                    autoComplete="email"
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Phone" htmlFor="phone" hint="Optional">
                  <Input
                    id="phone"
                    value={form.phone}
                    onChange={(e) => set('phone')(e.target.value)}
                    placeholder="+91 00000 00000"
                    autoComplete="tel"
                  />
                </Field>
                <Field label="Company" htmlFor="company" hint="Optional">
                  <Input
                    id="company"
                    value={form.company}
                    onChange={(e) => set('company')(e.target.value)}
                    placeholder="Company name"
                    autoComplete="organization"
                  />
                </Field>
              </div>

              <Field label="Subject" htmlFor="subject" hint="Optional">
                <Input
                  id="subject"
                  value={form.subject}
                  onChange={(e) => set('subject')(e.target.value)}
                  placeholder="What is this about?"
                />
              </Field>

              <Field label="Message" htmlFor="message" required>
                <textarea
                  id="message"
                  value={form.message}
                  onChange={(e) => set('message')(e.target.value)}
                  rows={6}
                  required
                  minLength={10}
                  placeholder="Tell us what you need, who it is for, and roughly when."
                  className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                />
              </Field>

              <Field label="How did you find us?" htmlFor="source" hint="Optional">
                <select
                  id="source"
                  value={form.source}
                  onChange={(e) => set('source')(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                >
                  <option value="">Prefer not to say</option>
                  {LEAD_SOURCE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>

              {/* Honeypot. Hidden from people, irresistible to bots. */}
              <div aria-hidden className="absolute left-[-9999px] size-px overflow-hidden">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={form.website}
                  onChange={(e) => set('website')(e.target.value)}
                />
              </div>

              <Button type="submit" size="lg" className="w-full" disabled={send.isPending}>
                {send.isPending ? <Loader2 className="animate-spin" /> : 'Send message'}
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                Prefer an account?{' '}
                <Link href="/register" className="font-medium text-primary hover:underline">
                  Sign up
                </Link>{' '}
                and message us from inside the portal.
              </p>
            </form>
          )}
        </div>

        {/* ── Details ────────────────────────────────────────────────────── */}
        <aside className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="text-sm font-semibold">Reach us directly</h2>
            <div className="mt-4 space-y-3.5 text-sm">
              <a
                href={`mailto:${SITE.contact.email}`}
                className="flex items-start gap-3 text-muted-foreground transition-colors hover:text-foreground"
              >
                <Mail className="mt-0.5 size-4 shrink-0" />
                <span>{SITE.contact.email}</span>
              </a>

              {SITE.contact.phone && (
                <a
                  href={`tel:${SITE.contact.phone.replace(/\s+/g, '')}`}
                  className="flex items-start gap-3 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Phone className="mt-0.5 size-4 shrink-0" />
                  <span>{SITE.contact.phone}</span>
                </a>
              )}

              {hasAddress() && (
                <p className="flex items-start gap-3 text-muted-foreground">
                  <MapPin className="mt-0.5 size-4 shrink-0" />
                  <span>
                    {address.map((line) => (
                      <span key={line} className="block">{line}</span>
                    ))}
                  </span>
                </p>
              )}

              <p className="flex items-start gap-3 text-muted-foreground">
                <Clock className="mt-0.5 size-4 shrink-0" />
                <span>{SITE.hours}</span>
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-muted/40 p-6">
            <h2 className="text-sm font-semibold">Already a client?</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Sign in to your portal and message us there — it threads against your project, so
              nothing gets lost.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-4">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </aside>
        </div>
      </div>
    </>
  );
}
