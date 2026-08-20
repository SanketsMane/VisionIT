'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { homeFor } from '@/lib/utils';

/** Entry point — routes to the dashboard or the login screen once auth settles. */
export default function RootPage() {
  const router = useRouter();
  const isReady = useAuthStore((state) => state.isReady);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    if (!isReady) return;
    router.replace(isAuthenticated ? homeFor(user?.userType) : '/login');
  }, [isReady, isAuthenticated, user, router]);

  return (
    <div className="grid min-h-dvh place-items-center bg-background">
      <Loader2 className="size-6 animate-spin text-primary" />
    </div>
  );
}
