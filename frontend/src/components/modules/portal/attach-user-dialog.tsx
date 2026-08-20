'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Loader2, Search, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/misc';
import { Field } from '@/components/shared/form-field';
import { teamApi, type AttachableUser } from '@/lib/api/portal.api';
import { ApiRequestError } from '@/lib/api/client';
import { cn } from '@/lib/utils';

const SOURCE_LABELS: Record<string, string> = {
  FREELANCER: 'Freelancer platform',
  GOOGLE: 'Google search',
  SOCIAL_MEDIA: 'Social media',
  REFERRAL: 'Referral',
  OTHER: 'Other',
};

/**
 * Adds someone who already has an account straight onto a project.
 *
 * Distinct from the invitation flow: these people signed up on the website or
 * were invited to a different project, so they can already sign in. Sending
 * them a token to click would be a slower route to the same result.
 */
export function AttachUserDialog({
  projectId,
  open,
  onOpenChange,
  onAttached,
  roles,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAttached: () => void;
  roles: { value: string; label: string; description?: string }[];
}) {
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [selected, setSelected] = useState<AttachableUser | null>(null);
  const [role, setRole] = useState(roles[0]?.value ?? 'CLIENT_MANAGER');

  // A query per keystroke would hammer the endpoint for no benefit — nobody
  // reads results that change four times a second.
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(term.trim()), 250);
    return () => clearTimeout(timer);
  }, [term]);

  useEffect(() => {
    if (!open) {
      setTerm('');
      setDebounced('');
      setSelected(null);
    }
  }, [open]);

  const results = useQuery({
    queryKey: ['project', projectId, 'attachable', debounced],
    queryFn: () => teamApi.searchAttachable(projectId, debounced),
    enabled: open && debounced.length >= 2,
  });

  const attach = useMutation({
    mutationFn: () => teamApi.attach(projectId, selected!.id, role),
    onSuccess: () => {
      onAttached();
      onOpenChange(false);
      toast.success(`${selected?.name} now has access`);
    },
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : 'Could not add them'),
  });

  const found = results.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add an existing account</DialogTitle>
          <DialogDescription>
            Search anyone who signed up on the website or already has a login. They get access
            immediately — no invitation to accept.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <Field label="Search by name, email, company or phone" htmlFor="attach-search">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="attach-search"
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="Start typing a name…"
                className="pl-9"
                autoFocus
              />
            </div>
          </Field>

          <div className="min-h-[9rem]">
            {debounced.length < 2 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                Type at least two characters to search.
              </p>
            ) : results.isLoading ? (
              <div className="grid place-items-center py-8">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : !found.length ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                Nobody matches that, and anyone already on this project is not listed. Use{' '}
                <span className="font-medium">Invite client</span> to bring in someone new.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {found.map((person) => (
                  <li key={person.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(person)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-colors',
                        selected?.id === person.id
                          ? 'border-primary bg-primary-muted'
                          : 'border-border hover:border-primary/50 hover:bg-accent',
                      )}
                    >
                      <Avatar name={person.name} src={person.avatarUrl} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="truncate text-sm font-medium">{person.name}</span>
                          <Badge
                            variant={person.userType === 'LEAD' ? 'primary' : 'success'}
                            size="sm"
                          >
                            {person.userType === 'LEAD' ? 'Lead' : 'Client'}
                          </Badge>
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {person.email}
                          {person.leadCompany ? ` · ${person.leadCompany}` : ''}
                          {person.leadSource ? ` · via ${SOURCE_LABELS[person.leadSource] ?? person.leadSource}` : ''}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {selected && (
            <Field label="Their role on this project" htmlFor="attach-role">
              <select
                id="attach-role"
                value={role}
                onChange={(event) => setRole(event.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-primary"
              >
                {roles.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => attach.mutate()} disabled={!selected || attach.isPending}>
            {attach.isPending ? <Loader2 className="animate-spin" /> : <UserPlus />}
            {selected ? `Add ${selected.name.split(' ')[0]}` : 'Add to project'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
