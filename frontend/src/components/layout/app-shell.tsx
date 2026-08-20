'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useAuthStore } from '@/store/auth.store';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';

/**
 * Auth gate + chrome for every signed-in screen.
 *
 * Rendering is held until the session-restore attempt settles, otherwise a
 * refresh would flash the login page for a user who is in fact signed in.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const isReady = useAuthStore((state) => state.isReady);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!isReady) return;
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    // A client-portal user has no studio workspace — send them to theirs.
    if (user?.userType === 'CLIENT') router.replace('/portal');
  }, [isReady, isAuthenticated, user, router]);

  if (!isReady) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-6 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground">Restoring your session…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || user?.userType === 'CLIENT') return null;

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      <Dialog open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <DialogContent size="sm" className="left-0 top-0 h-dvh max-h-dvh w-64 translate-x-0 translate-y-0 overflow-hidden rounded-none p-0">
          <Sidebar onNavigate={() => setMobileNavOpen(false)} />
        </DialogContent>
      </Dialog>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenMobileNav={() => setMobileNavOpen(true)} />
        <main className="flex-1 overflow-y-auto scrollbar-slim">
          <div className="mx-auto w-full max-w-[1500px] space-y-6 p-4 sm:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
