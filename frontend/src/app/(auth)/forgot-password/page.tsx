'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/shared/form-field';
import { authApi } from '@/lib/api/auth.api';

const schema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
});

type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [devToken, setDevToken] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    // The endpoint answers identically whether or not the address is
    // registered, so there is nothing to branch on and nothing to leak — any
    // error here is a network problem, not "no such user".
    const result = await authApi.forgotPassword(values.email).catch(() => null);
    setDevToken(result?.resetToken ?? null);
    setSentTo(values.email);
  };

  if (sentTo) {
    return (
      <div>
        <div className="mb-5 grid size-11 place-items-center rounded-xl bg-success-muted text-success">
          <MailCheck className="size-5" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight">Check your inbox</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          If an account exists for <span className="font-medium text-foreground">{sentTo}</span>,
          we&apos;ve sent a link to reset your password. It expires in one hour.
        </p>

        {devToken && (
          <div className="mt-5 rounded-lg border border-warning/40 bg-warning-muted p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-warning">
              Development only
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              No mail transport is configured, so the token is shown here instead.
            </p>
            <Link
              href={`/reset-password?token=${devToken}`}
              className="mt-2 inline-block break-all text-xs font-medium text-primary hover:underline"
            >
              Continue to reset →
            </Link>
          </div>
        )}

        <p className="mt-6 text-xs text-muted-foreground">
          Didn&apos;t get it? Check your spam folder, or{' '}
          <button
            type="button"
            className="font-medium text-primary hover:underline"
            onClick={() => void onSubmit({ email: getValues('email') })}
          >
            send it again
          </button>
          .
        </p>

        <Button variant="outline" className="mt-6 w-full" asChild>
          <Link href="/login"><ArrowLeft /> Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">Forgot your password?</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Enter the email on your account and we&apos;ll send you a link to choose a new password.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-7 space-y-4" noValidate>
        <Field label="Email" htmlFor="email" error={errors.email?.message} required>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            autoFocus
            placeholder="you@company.com"
            error={Boolean(errors.email)}
            {...register('email')}
          />
        </Field>

        <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
          Send reset link
        </Button>
      </form>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Remembered it?{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
