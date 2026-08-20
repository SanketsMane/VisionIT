'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, Loader2, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth.store';

/**
 * The "you are not yourself right now" bar.
 *
 * Deliberately loud and always at the very top of the viewport: the whole risk
 * of an impersonation feature is forgetting you are in one and mistaking a
 * client's data for your own. It cannot be dismissed — the only way to remove
 * it is to actually end the session.
 */
export function ImpersonationBanner() {
  const router = useRouter();
  const impersonation = useAuthStore((s) => s.impersonation);
  const stop = useAuthStore((s) => s.stopImpersonating);
  const [leaving, setLeaving] = useState(false);

  if (!impersonation) return null;

  const handleStop = async () => {
    setLeaving(true);
    try {
      await stop();
      toast.success('Back to your own account');
      router.replace('/portal-users');
    } catch {
      // The 30-minute token may simply have run out. A reload restores the
      // studio session from the refresh cookie, so send them somewhere safe.
      toast.error('That session has ended — signing you back in');
      window.location.href = '/dashboard';
    } finally {
      setLeaving(false);
    }
  };

  return (
    <div className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 bg-warning px-4 py-2 text-warning-foreground">
      <span className="inline-flex items-center gap-2 text-xs font-semibold sm:text-sm">
        <Eye className="size-4 shrink-0" />
        You are now logged in as {impersonation.clientName}
      </span>

      <span className="hidden text-[11px] opacity-90 sm:inline">
        Viewing as a client — signed in as {impersonation.actorName}
      </span>

      <button
        type="button"
        onClick={() => void handleStop()}
        disabled={leaving}
        className="inline-flex items-center gap-1.5 rounded-md bg-warning-foreground/15 px-2.5 py-1 text-xs font-semibold transition-colors hover:bg-warning-foreground/25 disabled:opacity-60"
      >
        {leaving ? <Loader2 className="size-3.5 animate-spin" /> : <LogOut className="size-3.5" />}
        Return to my account
      </button>
    </div>
  );
}
