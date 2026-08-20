'use client';

import { useEffect, type ReactNode } from 'react';
import { useAuthStore } from '@/store/auth.store';

/**
 * Runs the one-time session restore. Children render immediately; screens that
 * need a signed-in user gate on `isReady` themselves, so public pages (the
 * shared invoice link) are not blocked behind an auth round-trip.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const restore = useAuthStore((state) => state.restore);
  const isReady = useAuthStore((state) => state.isReady);

  useEffect(() => {
    if (!isReady) void restore();
  }, [isReady, restore]);

  return <>{children}</>;
}
