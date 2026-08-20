'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, Check, Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Field } from '@/components/shared/form-field';
import { LEAD_SOURCE_OPTIONS, type LeadSource } from '@/lib/api/public.api';
import { authApi } from '@/lib/api/auth.api';
import { ApiRequestError } from '@/lib/api/client';
import { useAuthStore } from '@/store/auth.store';
import { cn } from '@/lib/utils';

/**
 * Public sign-up.
 *
 * This creates a LEAD and nothing else — the account type is decided by the
 * server, not by anything on this form. Clients still arrive only through an
 * invitation link, and studio accounts cannot be created here at all.
 */
export default function RegisterPage() {
  const router = useRouter();
  const applySession = useAuthStore((state) => state.applySession);

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    company: '',
    requirement: '',
    source: '' as LeadSource | '',
    sourceDetail: '',
    website: '',
  });
  const [showPassword, setShowPassword] = useState(false);

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  // Mirrors the server's rule exactly, so the form never accepts a password the
  // API will then reject.
  const rules = [
    { label: 'At least 8 characters', ok: form.password.length >= 8 },
    { label: 'A lowercase letter', ok: /[a-z]/.test(form.password) },
    { label: 'An uppercase letter', ok: /[A-Z]/.test(form.password) },
    { label: 'A number', ok: /[0-9]/.test(form.password) },
  ];
  const passwordValid = rules.every((rule) => rule.ok);

  // Only asked when the answer means something — "Google search" needs no
  // follow-up, "someone referred me" does.
  const needsDetail = form.source === 'REFERRAL' || form.source === 'OTHER';

  const register = useMutation({
    mutationFn: () =>
      authApi.registerLead({
        name: form.name,
        email: form.email,
        phone: form.phone,
        password: form.password,
        source: form.source as LeadSource,
        sourceDetail: form.sourceDetail || undefined,
        company: form.company || undefined,
        requirement: form.requirement || undefined,
        website: form.website,
      }),
    onSuccess: (result) => {
      // A honeypot hit returns 201 with no user. Send the bot somewhere
      // plausible rather than crashing on a null.
      if (!result?.user) {
        router.replace('/login');
        return;
      }
      applySession(result.user, result.accessToken);
      toast.success(`Welcome, ${result.user.name.split(' ')[0]}`);
      router.replace('/portal/catalog');
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiRequestError ? error.message : 'Could not create your account.',
      ),
  });

  const canSubmit =
    form.name.trim().length >= 2 &&
    form.email.includes('@') &&
    form.phone.trim().length >= 7 &&
    passwordValid &&
    form.source !== '';

  return (
    <div className="w-full max-w-lg">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Back to site
      </Link>

      <div className="mt-5">
        <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Browse everything we have built, price up a service, and talk to us directly.
        </p>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (canSubmit) register.mutate();
        }}
        className="mt-7 space-y-4"
      >
        <Field label="Full name" htmlFor="name" required>
          <Input
            id="name"
            value={form.name}
            onChange={(e) => set('name')(e.target.value)}
            placeholder="Your name"
            autoComplete="name"
            required
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" htmlFor="email" required>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => set('email')(e.target.value)}
              placeholder="you@company.com"
              autoComplete="email"
              required
            />
          </Field>

          <Field label="Mobile number" htmlFor="phone" required>
            <Input
              id="phone"
              type="tel"
              value={form.phone}
              onChange={(e) => set('phone')(e.target.value)}
              placeholder="+91 00000 00000"
              autoComplete="tel"
              required
            />
          </Field>
        </div>

        <Field label="Company" htmlFor="company" hint="Optional">
          <Input
            id="company"
            value={form.company}
            onChange={(e) => set('company')(e.target.value)}
            placeholder="Company or brand name"
            autoComplete="organization"
          />
        </Field>

        <Field label="Password" htmlFor="password" required>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={(e) => set('password')(e.target.value)}
              placeholder="Create a password"
              autoComplete="new-password"
              className="pr-10"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </Field>

        {form.password.length > 0 && (
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {rules.map((rule) => (
              <li
                key={rule.label}
                className={cn(
                  'flex items-center gap-1.5 text-xs',
                  rule.ok ? 'text-success' : 'text-muted-foreground',
                )}
              >
                <Check className={cn('size-3.5', !rule.ok && 'opacity-30')} />
                {rule.label}
              </li>
            ))}
          </ul>
        )}

        <Field label="How did you find us?" htmlFor="source" required>
          <select
            id="source"
            value={form.source}
            onChange={(e) => set('source')(e.target.value)}
            required
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
          >
            <option value="" disabled>
              Choose one
            </option>
            {LEAD_SOURCE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>

        {needsDetail && (
          <Field
            label={form.source === 'REFERRAL' ? 'Who referred you?' : 'Where did you hear about us?'}
            htmlFor="sourceDetail"
            hint="Optional"
          >
            <Input
              id="sourceDetail"
              value={form.sourceDetail}
              onChange={(e) => set('sourceDetail')(e.target.value)}
              placeholder={form.source === 'REFERRAL' ? 'Their name' : 'Tell us where'}
            />
          </Field>
        )}

        <Field label="What are you looking for?" htmlFor="requirement" hint="Optional">
          <textarea
            id="requirement"
            value={form.requirement}
            onChange={(e) => set('requirement')(e.target.value)}
            rows={3}
            placeholder="A short brief helps us reply with something useful."
            className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
          />
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

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={!canSubmit || register.isPending}
        >
          {register.isPending ? <Loader2 className="animate-spin" /> : 'Create account'}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
