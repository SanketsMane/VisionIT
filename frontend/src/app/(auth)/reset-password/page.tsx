'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/shared/form-field';
import { authApi } from '@/lib/api/auth.api';
import { ApiRequestError } from '@/lib/api/client';

const schema = z
  .object({
    newPassword: z
      .string()
      .min(8, 'Use at least 8 characters')
      .regex(/[A-Z]/, 'Include an uppercase letter')
      .regex(/[a-z]/, 'Include a lowercase letter')
      .regex(/[0-9]/, 'Include a number'),
    confirmPassword: z.string().min(1, 'Confirm your new password'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: 'Both passwords must match',
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof schema>;

function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get('token');
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  // A link that arrives without a token is either truncated by a mail client
  // or hand-edited. Say so plainly rather than failing on submit.
  if (!token) {
    return (
      <div>
        <div className="mb-5 grid size-11 place-items-center rounded-xl bg-danger-muted text-danger">
          <ShieldAlert className="size-5" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight">This link isn&apos;t complete</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The reset link is missing its token. Some mail clients shorten long links — try opening it
          again from the original email, or request a fresh one.
        </p>
        <Button className="mt-6 w-full" asChild>
          <Link href="/forgot-password">Request a new link</Link>
        </Button>
      </div>
    );
  }

  const onSubmit = async (values: FormValues) => {
    try {
      await authApi.resetPassword({
        token,
        newPassword: values.newPassword,
        confirmPassword: values.confirmPassword,
      });
      toast.success('Password updated — sign in with your new password');
      router.replace('/login');
    } catch (error) {
      if (error instanceof ApiRequestError) {
        const fields = error.fieldErrors;
        if (Object.keys(fields).length) {
          for (const [field, message] of Object.entries(fields)) {
            setError(field as keyof FormValues, { message });
          }
        } else {
          // An expired or already-used token surfaces here.
          setError('newPassword', { message: error.message });
        }
        return;
      }
      toast.error('Could not reset your password. Please try again.');
    }
  };

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">Choose a new password</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Once you save it, every other signed-in device is signed out.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-7 space-y-4" noValidate>
        <Field
          label="New password"
          htmlFor="newPassword"
          error={errors.newPassword?.message}
          hint="At least 8 characters, with upper and lower case and a number."
          required
        >
          <Input
            id="newPassword"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            autoFocus
            placeholder="••••••••"
            error={Boolean(errors.newPassword)}
            trailing={
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="transition-colors hover:text-foreground"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </button>
            }
            {...register('newPassword')}
          />
        </Field>

        <Field
          label="Confirm new password"
          htmlFor="confirmPassword"
          error={errors.confirmPassword?.message}
          required
        >
          <Input
            id="confirmPassword"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="••••••••"
            error={Boolean(errors.confirmPassword)}
            {...register('confirmPassword')}
          />
        </Field>

        <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
          Save new password
        </Button>
      </form>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        <Link href="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

export default function ResetPasswordPage() {
  // useSearchParams needs a Suspense boundary for the prerender pass.
  return (
    <Suspense fallback={<div className="h-64" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
