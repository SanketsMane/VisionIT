'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Check, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/shared/form-field';
import { useAuthStore } from '@/store/auth.store';
import { ApiRequestError } from '@/lib/api/client';
import { cn } from '@/lib/utils';

const schema = z
  .object({
    name: z.string().min(2, 'Enter your full name').max(100),
    email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
    companyName: z.string().max(150).optional(),
    password: z
      .string()
      .min(8, 'At least 8 characters')
      .regex(/[a-z]/, 'Include a lowercase letter')
      .regex(/[A-Z]/, 'Include an uppercase letter')
      .regex(/\d/, 'Include a number'),
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof schema>;

/** Live checklist — clearer than a single error that changes on every keystroke. */
const RULES: { label: string; test: (value: string) => boolean }[] = [
  { label: '8+ characters', test: (v) => v.length >= 8 },
  { label: 'Lowercase letter', test: (v) => /[a-z]/.test(v) },
  { label: 'Uppercase letter', test: (v) => /[A-Z]/.test(v) },
  { label: 'Number', test: (v) => /\d/.test(v) },
];

export default function RegisterPage() {
  const router = useRouter();
  const registerUser = useAuthStore((state) => state.register);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), mode: 'onBlur' });

  const password = watch('password') ?? '';

  const onSubmit = async (values: FormValues) => {
    try {
      await registerUser({
        name: values.name,
        email: values.email,
        password: values.password,
        companyName: values.companyName || undefined,
      });
      toast.success('Workspace created — welcome aboard');
      router.replace('/dashboard');
    } catch (error) {
      if (error instanceof ApiRequestError) {
        const fields = error.fieldErrors;
        if (Object.keys(fields).length) {
          for (const [field, message] of Object.entries(fields)) {
            setError(field as keyof FormValues, { message });
          }
        } else {
          setError('email', { message: error.message });
        }
        return;
      }
      toast.error('Could not create your account. Please try again.');
    }
  };

  return (
    <div className="animate-in-up">
      <h1 className="text-2xl font-semibold tracking-tight">Create your workspace</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        We&apos;ll set up your chart of accounts, invoice numbering and email templates automatically.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4" noValidate>
        <Field label="Full name" htmlFor="name" error={errors.name?.message} required>
          <Input id="name" autoComplete="name" autoFocus placeholder="Sanket Patil" error={Boolean(errors.name)} {...register('name')} />
        </Field>

        <Field label="Email" htmlFor="email" error={errors.email?.message} required>
          <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" error={Boolean(errors.email)} {...register('email')} />
        </Field>

        <Field
          label="Business name"
          htmlFor="companyName"
          error={errors.companyName?.message}
          hint="Appears on your invoices. You can change it later."
        >
          <Input id="companyName" placeholder="Vision IT Infra" {...register('companyName')} />
        </Field>

        <Field label="Password" htmlFor="password" error={errors.password?.message} required>
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="••••••••"
            error={Boolean(errors.password)}
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
            {...register('password')}
          />
        </Field>

        {password.length > 0 && (
          <ul className="grid grid-cols-2 gap-1.5">
            {RULES.map((rule) => {
              const met = rule.test(password);
              return (
                <li
                  key={rule.label}
                  className={cn(
                    'flex items-center gap-1.5 text-[11px]',
                    met ? 'text-success' : 'text-muted-foreground',
                  )}
                >
                  <Check className={cn('size-3', !met && 'opacity-30')} strokeWidth={3} />
                  {rule.label}
                </li>
              );
            })}
          </ul>
        )}

        <Field label="Confirm password" htmlFor="confirmPassword" error={errors.confirmPassword?.message} required>
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
          Create workspace
        </Button>
      </form>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
