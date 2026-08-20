'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Eye } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogBody, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useAuthStore } from '@/store/auth.store';
import { ApiRequestError } from '@/lib/api/client';

/**
 * Opens the client portal as one of your clients, without their password.
 *
 * Confirmed rather than one-click on purpose: it swaps the whole session, and
 * doing that by accident from a table row would be disorienting. The dialog is
 * also where the two things worth knowing get said — that the client is not
 * notified, and that anything done is recorded against your name.
 */
export function ViewAsButton({
  userId,
  name,
  disabled,
}: {
  userId: string;
  name: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => setOpen(true)}
        title={disabled ? 'This account is deactivated' : `View the portal as ${name}`}
      >
        <Eye /> View as
      </Button>
      <ViewAsDialog target={{ id: userId, name }} open={open} onOpenChange={setOpen} />
    </>
  );
}

/**
 * The confirmation itself, usable on its own.
 *
 * Confirmed rather than one-click on purpose: it swaps the whole session, and
 * doing that by accident from a table row would be disorienting. The dialog is
 * also where the two things worth knowing get said — that the client is not
 * notified, and that anything done is recorded against your name.
 */
export function ViewAsDialog({
  target,
  open,
  onOpenChange,
}: {
  target: { id: string; name: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const impersonate = useAuthStore((s) => s.impersonate);
  const [busy, setBusy] = useState(false);

  if (!target) return null;

  const start = async () => {
    setBusy(true);
    try {
      await impersonate(target.id);
      // The cache is full of studio data fetched as you; none of it applies to
      // the session you are about to land in.
      queryClient.clear();
      toast.success(`You are now logged in as ${target.name}`);
      router.push('/portal');
    } catch (error) {
      toast.error(
        error instanceof ApiRequestError
          ? error.message
          : 'Could not open the portal as this client',
      );
      setBusy(false);
      return;
    }
    setBusy(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>View the portal as {target.name}?</DialogTitle>
          <DialogDescription>
            You&apos;ll see exactly what they see, without needing their password.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-2.5 text-xs text-muted-foreground">
          <p>
            A banner stays at the top of every screen until you come back, and
            <span className="font-medium text-foreground"> Return to my account </span>
            brings you straight back here.
          </p>
          <p>
            {target.name} is <span className="font-medium text-foreground">not notified</span>, and
            this does not sign them out. Anything you do while viewing is recorded against your name
            in the activity log.
          </p>
          <p>The session lasts 30 minutes, and ends if you reload the page.</p>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void start()} loading={busy}>
            <Eye /> View as {target.name.split(' ')[0]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
