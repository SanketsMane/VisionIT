'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertTriangle, Check, Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/misc';
import { Field } from '@/components/shared/form-field';
import { RoleBadge } from '@/components/shared/portal-badges';
import { inviteApi } from '@/lib/api/portal.api';
import { queryKeys } from '@/lib/hooks/query-keys';
import { ApiRequestError } from '@/lib/api/client';
import { useAuthStore } from '@/store/auth.store';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

const signUpSchema = z
  .object({
    name: z.string().trim().min(2, 'Enter your full name').max(120),
    mobile: z.string().trim().min(6, 'Enter your mobile number').max(25),
    password: z
      .string()
      .min(8, 'At least 8 characters')
      .regex(/[a-z]/, 'Include a lowercase letter')
      .regex(/[A-Z]/, 'Include an uppercase letter')
      .regex(/\d/, 'Include a number'),
    confirmPassword: z.string().min(1, 'Confirm your password'),
    acceptTerms: z.literal(true, { message: 'You must accept the terms to continue' }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

const signInSchema = z.object({
  password: z.string().min(1, 'Enter your password'),
});

type SignUpValues = z.infer<typeof signUpSchema>;
type SignInValues = z.infer<typeof signInSchema>;

const RULES: { label: string; test: (v: string) => boolean }[] = [
  { label: '8+ characters', test: (v) => v.length >= 8 },
  { label: 'Lowercase', test: (v) => /[a-z]/.test(v) },
  { label: 'Uppercase', test: (v) => /[A-Z]/.test(v) },
  { label: 'Number', test: (v) => /\d/.test(v) },
];

/**
 * Public invitation landing page.
 *
 * The token in the URL is the only credential — the recipient has no account
 * yet. It shows just enough (project name, who invited them, what role) to be
 * trustworthy without leaking anything about the studio's other work.
 */
export default function InvitePage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const token = params.token;
  const login = useAuthStore((state) => state.login);
  const [showPassword, setShowPassword] = useState(false);

  const preview = useQuery({
    queryKey: queryKeys.portal.invitePreview(token),
    queryFn: () => inviteApi.preview(token),
    enabled: Boolean(token),
    retry: false,
  });

  const signUpForm = useForm<SignUpValues>({ resolver: zodResolver(signUpSchema), mode: 'onBlur' });
  const signInForm = useForm<SignInValues>({ resolver: zodResolver(signInSchema) });

  const password = signUpForm.watch('password') ?? '';

  // Pre-fill the name the inviter typed, so the client doesn't retype it.
  useEffect(() => {
    if (preview.data?.name) signUpForm.setValue('name', preview.data.name);
  }, [preview.data, signUpForm]);

  const accept = useMutation({
    mutationFn: (values: SignUpValues) =>
      inviteApi.acceptNew(token, {
        name: values.name,
        mobile: values.mobile,
        password: values.password,
        confirmPassword: values.confirmPassword,
        acceptTerms: true,
      }),
    onSuccess: async (_result, values) => {
      toast.success('Account created — welcome aboard');
      // Sign them straight in; making someone log in immediately after
      // creating a password is pure friction.
      try {
        await login(preview.data!.email, values.password);
        router.replace('/portal');
      } catch {
        router.replace('/login');
      }
    },
    onError: (error) => {
      if (error instanceof ApiRequestError) {
        for (const [field, message] of Object.entries(error.fieldErrors)) {
          signUpForm.setError(field as keyof SignUpValues, { message });
        }
        if (!error.issues.length) toast.error(error.message);
        return;
      }
      toast.error('Could not create your account');
    },
  });

  const joinExisting = useMutation({
    mutationFn: (values: SignInValues) =>
      inviteApi.acceptExisting(token, { email: preview.data!.email, password: values.password }),
    onSuccess: async (_result, values) => {
      toast.success('You now have access to this project');
      try {
        await login(preview.data!.email, values.password);
        router.replace('/portal');
      } catch {
        router.replace('/login');
      }
    },
    onError: (error) => {
      signInForm.setError('password', {
        message: error instanceof ApiRequestError ? error.message : 'Could not sign you in',
      });
    },
  });

  if (preview.isLoading) {
    return (
      <div className="grid min-h-dvh place-items-center bg-muted">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (preview.isError || !preview.data) {
    const message =
      preview.error instanceof ApiRequestError
        ? preview.error.message
        : 'This invitation link is not valid.';

    return (
      <div className="grid min-h-dvh place-items-center bg-muted px-6">
        <div className="max-w-sm text-center">
          <span className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-danger-muted text-danger">
            <AlertTriangle className="size-5" />
          </span>
          <h1 className="text-lg font-semibold">Invitation unavailable</h1>
          <p className="mt-1 text-sm text-muted-foreground">{message}</p>
          <Button variant="outline" className="mt-5" asChild>
            <Link href="/login">Go to sign in</Link>
          </Button>
        </div>
      </div>
    );
  }

  const invite = preview.data;

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* ── Form ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm animate-in-up">
          <div className="mb-6 flex items-center gap-2.5">
            {invite.studio.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={invite.studio.logoUrl} alt="" className="h-9 w-auto max-w-[150px] object-contain" />
            ) : (
              <Image src="/logo-mark.png" alt="" width={72} height={72} className="size-9 object-contain" />
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight">{invite.studio.name}</p>
              <p className="text-[11px] text-muted-foreground">Client portal</p>
            </div>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight">
            You&apos;ve been invited to {invite.project.title}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {invite.invitedBy} invited <span className="font-medium text-foreground">{invite.email}</span> to
            join as <RoleBadge role={invite.role} size="sm" />
          </p>

          {invite.hasAccount ? (
            <form
              onSubmit={signInForm.handleSubmit((values) => joinExisting.mutate(values))}
              className="mt-8 space-y-4"
              noValidate
            >
              <div className="rounded-lg border border-info/30 bg-info-muted/40 p-3">
                <p className="text-xs font-medium">You already have an account</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Sign in with your existing password to add this project to your portal.
                </p>
              </div>

              <Field label="Email">
                <Input value={invite.email} disabled />
              </Field>

              <Field label="Password" error={signInForm.formState.errors.password?.message} required>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  autoFocus
                  autoComplete="current-password"
                  error={Boolean(signInForm.formState.errors.password)}
                  trailing={
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff /> : <Eye />}
                    </button>
                  }
                  {...signInForm.register('password')}
                />
              </Field>

              <Button type="submit" className="w-full" size="lg" loading={joinExisting.isPending}>
                Join {invite.project.title}
              </Button>
            </form>
          ) : (
            <form
              onSubmit={signUpForm.handleSubmit((values) => accept.mutate(values))}
              className="mt-8 space-y-4"
              noValidate
            >
              <Field label="Full name" error={signUpForm.formState.errors.name?.message} required>
                <Input
                  autoFocus
                  autoComplete="name"
                  placeholder="Priya Raghavan"
                  error={Boolean(signUpForm.formState.errors.name)}
                  {...signUpForm.register('name')}
                />
              </Field>

              <Field label="Email">
                <Input value={invite.email} disabled />
              </Field>

              <Field label="Mobile number" error={signUpForm.formState.errors.mobile?.message} required>
                <Input
                  autoComplete="tel"
                  placeholder="+91 98765 43210"
                  error={Boolean(signUpForm.formState.errors.mobile)}
                  {...signUpForm.register('mobile')}
                />
              </Field>

              <Field label="Password" error={signUpForm.formState.errors.password?.message} required>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  error={Boolean(signUpForm.formState.errors.password)}
                  trailing={
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff /> : <Eye />}
                    </button>
                  }
                  {...signUpForm.register('password')}
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

              <Field
                label="Confirm password"
                error={signUpForm.formState.errors.confirmPassword?.message}
                required
              >
                <Input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  error={Boolean(signUpForm.formState.errors.confirmPassword)}
                  {...signUpForm.register('confirmPassword')}
                />
              </Field>

              <label className="flex cursor-pointer items-start gap-2.5">
                <Checkbox
                  className="mt-0.5"
                  checked={signUpForm.watch('acceptTerms') === true}
                  onCheckedChange={(checked) =>
                    signUpForm.setValue('acceptTerms', checked === true ? true : (false as never), {
                      shouldValidate: true,
                    })
                  }
                />
                <span className="text-xs leading-relaxed text-muted-foreground">
                  I accept the terms of service and privacy policy.
                </span>
              </label>
              {signUpForm.formState.errors.acceptTerms && (
                <p className="-mt-2 text-[11px] font-medium text-danger">
                  {signUpForm.formState.errors.acceptTerms.message}
                </p>
              )}

              <Button type="submit" className="w-full" size="lg" loading={accept.isPending}>
                Create account
              </Button>

              <p className="text-center text-[11px] text-muted-foreground">
                This invitation expires on {formatDate(invite.expiresAt)}
              </p>
            </form>
          )}
        </div>
      </div>

      {/* ── Project panel ─────────────────────────────────────────────── */}
      <div className="relative hidden overflow-hidden bg-slate-950 lg:block">
        <div
          className="absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              'radial-gradient(ellipse 80% 55% at 20% 10%, rgba(0,118,255,0.35), transparent), radial-gradient(ellipse 70% 60% at 85% 85%, rgba(14,165,233,0.25), transparent)',
          }}
        />
        <div className="relative flex h-full flex-col justify-center p-12 text-white">
          <div className="max-w-md">
            {invite.project.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={invite.project.logoUrl} alt="" className="mb-6 h-14 w-auto object-contain" />
            )}

            {invite.project.code && (
              <p className="mb-2 font-mono text-xs tracking-wider text-white/50">
                {invite.project.code}
              </p>
            )}

            <h2 className="text-3xl font-semibold leading-tight tracking-tight">
              {invite.project.title}
            </h2>

            {invite.project.summary && (
              <p className="mt-4 text-sm leading-relaxed text-white/70">{invite.project.summary}</p>
            )}

            <dl className="mt-10 grid grid-cols-2 gap-6">
              {[
                ['Track progress', 'Milestones, delivery status and activity'],
                ['See the money', 'Invoices, payments and outstanding balance'],
                ['Report issues', 'File bugs with screenshots and follow them'],
                ['Get the handover', 'Documents, source code and sign-off'],
              ].map(([title, copy]) => (
                <div key={title}>
                  <dt className="text-xs font-semibold text-white/90">{title}</dt>
                  <dd className="mt-0.5 text-[11px] leading-relaxed text-white/55">{copy}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
