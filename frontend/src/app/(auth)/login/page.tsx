'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/shared/form-field';
import { useAuthStore } from '@/store/auth.store';
import { ApiRequestError } from '@/lib/api/client';
import { homeFor } from '@/lib/utils';

const schema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const isReady = useAuthStore((state) => state.isReady);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [showPassword, setShowPassword] = useState(false);

  // Someone landing here with a live session should go straight through.
  const currentUser = useAuthStore((state) => state.user);

  useEffect(() => {
    if (isReady && isAuthenticated) router.replace(homeFor(currentUser?.userType));
  }, [isReady, isAuthenticated, currentUser, router]);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    try {
      const user = await login(values.email, values.password);
      toast.success(`Welcome back, ${user.name.split(' ')[0]}`);
      // Client-portal users have no studio app to land in.
      router.replace(homeFor(user.userType));
    } catch (error) {
      if (error instanceof ApiRequestError) {
        // Field-level issues (validation) attach to their inputs; anything
        // else is a credential problem and belongs on the password field.
        const fields = error.fieldErrors;
        if (Object.keys(fields).length) {
          for (const [field, message] of Object.entries(fields)) {
            setError(field as keyof FormValues, { message });
          }
        } else {
          setError('password', { message: error.message });
        }
        return;
      }
      toast.error('Could not sign in. Please try again.');
    }
  };

  if (isReady && isAuthenticated) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="size-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="animate-in-up">
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Welcome back. Enter your details to reach your workspace.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4" noValidate>
        <Field label="Email" htmlFor="email" error={errors.email?.message} required>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            autoFocus
            placeholder="you@example.com"
            error={Boolean(errors.email)}
            {...register('email')}
          />
        </Field>

        <Field label="Password" htmlFor="password" error={errors.password?.message} required>
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
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

        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-xs font-medium text-primary hover:underline">
            Forgot password?
          </Link>
        </div>

        <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
          Sign in
        </Button>
      </form>

      {/* Sign-up is closed: this is a single-studio platform, not a service
          anyone can join. Clients get in through an invitation link instead. */}
      <p className="mt-6 text-center text-xs text-muted-foreground">
        Been invited to a project? Open the invitation link we emailed you.
      </p>
    </div>
  );
}
