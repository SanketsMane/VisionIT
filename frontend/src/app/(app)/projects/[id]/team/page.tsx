'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Copy, Mail, RotateCw, Trash2, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar } from '@/components/ui/misc';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogBody, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { PageHeader, SectionHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Field } from '@/components/shared/form-field';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { InvitationBadge, RoleBadge } from '@/components/shared/portal-badges';
import { ProjectWorkspaceTabs } from '@/components/modules/portal/project-tabs';
import { teamApi } from '@/lib/api/portal.api';
import { queryKeys } from '@/lib/hooks/query-keys';
import { useMutationHandlers } from '@/lib/hooks/use-mutation-toast';
import { formatDate, formatRelative } from '@/lib/format';
import type { ProjectRole } from '@/types/portal';

export default function AdminProjectTeamPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const [inviteOpen, setInviteOpen] = useState(false);
  const { onSuccess, onError } = useMutationHandlers();

  const members = useQuery({
    queryKey: queryKeys.portal.members(projectId),
    queryFn: () => teamApi.members(projectId),
    enabled: Boolean(projectId),
  });

  const invitations = useQuery({
    queryKey: queryKeys.portal.invitations(projectId),
    queryFn: () => teamApi.invitations(projectId),
    enabled: Boolean(projectId),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => teamApi.revokeInvitation(projectId, id),
    onSuccess: () => onSuccess('Invitation revoked', [queryKeys.portal.invitations(projectId)]),
    onError: (error) => onError(error, 'Could not revoke'),
  });

  const resend = useMutation({
    mutationFn: (id: string) => teamApi.resendInvitation(projectId, id),
    onSuccess: (result) => {
      onSuccess('Invitation re-sent', [queryKeys.portal.invitations(projectId)]);
      void navigator.clipboard.writeText(result.inviteUrl);
      toast.info('New link copied to your clipboard');
    },
    onError: (error) => onError(error, 'Could not resend'),
  });

  const removeMember = useMutation({
    mutationFn: (memberId: string) => teamApi.removeMember(projectId, memberId),
    onSuccess: () => onSuccess('Member removed', [queryKeys.portal.members(projectId)]),
    onError: (error) => onError(error, 'Could not remove'),
  });

  const active = (members.data ?? []).filter((m) => m.isActive);
  const pending = (invitations.data ?? []).filter((i) => i.status === 'PENDING');
  const history = (invitations.data ?? []).filter((i) => i.status !== 'PENDING');

  return (
    <div className="space-y-6">
      <ProjectWorkspaceTabs projectId={projectId} active="team" />

      <PageHeader
        title="Project team"
        description="Client contacts and your own people working on this project."
        actions={
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus /> Invite client
          </Button>
        }
      />

      <Card>
        <SectionHeader title="Members" description={`${active.length} with access`} />
        <CardContent className="p-0">
          {members.isLoading ? (
            <Skeleton className="m-4 h-24" />
          ) : !active.length ? (
            <EmptyState
              icon={Users}
              title="Nobody has access yet"
              description="Invite the client to give them a portal login for this project."
              action={<Button size="sm" onClick={() => setInviteOpen(true)}><UserPlus /> Invite client</Button>}
            />
          ) : (
            <ul className="divide-y divide-border">
              {active.map((member) => (
                <li key={member.id} className="flex items-center gap-3 px-5 py-3.5">
                  <Avatar name={member.user.name} src={member.user.avatarUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{member.user.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {member.user.email}
                      {member.user.phone ? ` · ${member.user.phone}` : ''}
                    </p>
                  </div>
                  <div className="hidden text-right sm:block">
                    <p className="text-[10px] text-muted-foreground">Joined {formatDate(member.joinedAt)}</p>
                    {member.user.lastLoginAt && (
                      <p className="text-[10px] text-muted-foreground">
                        Active {formatRelative(member.user.lastLoginAt)}
                      </p>
                    )}
                  </div>
                  <RoleBadge role={member.role} size="sm" />
                  {member.role !== 'INTERNAL_MEMBER' && (
                    <ConfirmDialog
                      trigger={
                        <Button variant="ghost" size="icon-sm" aria-label="Remove member">
                          <Trash2 className="text-danger" />
                        </Button>
                      }
                      title={`Remove ${member.user.name}?`}
                      description="They lose portal access immediately. Their reports and comments are kept."
                      confirmLabel="Remove"
                      onConfirm={() => removeMember.mutateAsync(member.id)}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <SectionHeader title="Invitations" description={`${pending.length} pending`} />
        <CardContent className="p-0">
          {!invitations.data?.length ? (
            <EmptyState icon={Mail} title="No invitations sent" className="py-10" />
          ) : (
            <ul className="divide-y divide-border">
              {[...pending, ...history].map((invitation) => (
                <li key={invitation.id} className="flex items-center gap-3 px-5 py-3.5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                    <Mail className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{invitation.email}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {invitation.status === 'PENDING'
                        ? `Expires ${formatDate(invitation.expiresAt)} · sent ${invitation.sendCount}×`
                        : invitation.acceptedBy
                          ? `Accepted by ${invitation.acceptedBy.name}`
                          : `${invitation.status.toLowerCase()}`}
                    </p>
                  </div>
                  <RoleBadge role={invitation.role} size="sm" />
                  <InvitationBadge status={invitation.status} size="sm" />
                  {invitation.status === 'PENDING' && (
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        loading={resend.isPending && resend.variables === invitation.id}
                        onClick={() => resend.mutate(invitation.id)}
                        aria-label="Resend"
                      >
                        <RotateCw />
                      </Button>
                      <ConfirmDialog
                        trigger={
                          <Button variant="ghost" size="icon-sm" aria-label="Revoke">
                            <Trash2 className="text-danger" />
                          </Button>
                        }
                        title="Revoke this invitation?"
                        description="The existing link stops working immediately."
                        confirmLabel="Revoke"
                        onConfirm={() => revoke.mutateAsync(invitation.id)}
                      />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <InviteClientDialog open={inviteOpen} onOpenChange={setInviteOpen} projectId={projectId} />
    </div>
  );
}

function InviteClientDialog({
  open,
  onOpenChange,
  projectId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}) {
  const { onSuccess, onError } = useMutationHandlers();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<ProjectRole>('CLIENT_OWNER');
  const [expiresInDays, setExpires] = useState(14);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  const roles = useQuery({
    queryKey: queryKeys.portal.roles(projectId),
    queryFn: () => teamApi.roles(projectId),
    enabled: open,
  });

  const invite = useMutation({
    mutationFn: () =>
      teamApi.invite(projectId, {
        email: email.trim(),
        name: name.trim() || undefined,
        role,
        expiresInDays,
      }),
    onSuccess: (result) => {
      onSuccess(`Invitation sent to ${email}`, [queryKeys.portal.invitations(projectId)]);
      setInviteUrl(result.inviteUrl);
      setEmail(''); setName('');
    },
    onError: (error) => onError(error, 'Could not send the invitation'),
  });

  // The studio can hand out any role, including its own team members.
  const options = roles.data ?? [];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setInviteUrl(null);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite the client</DialogTitle>
          <DialogDescription>
            They get a secure, single-use link to create their portal account.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {inviteUrl ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-success/40 bg-success-muted/40 p-3">
                <p className="text-xs font-medium">Invitation sent</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Share this link directly if the email is delayed. It works once, then expires.
                </p>
              </div>
              <div className="flex gap-2">
                <Input value={inviteUrl} readOnly className="font-mono text-[11px]" />
                <Button
                  variant="outline"
                  onClick={() => {
                    void navigator.clipboard.writeText(inviteUrl);
                    toast.success('Link copied');
                  }}
                >
                  <Copy /> Copy
                </Button>
              </div>
            </div>
          ) : (
            <>
              <Field label="Client email" required>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="rohan@client.com"
                  autoFocus
                />
              </Field>

              <Field label="Their name" hint="Optional — pre-fills their sign-up form.">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Rohan Mehta" />
              </Field>

              <Field label="Role">
                <Select value={role} onValueChange={(v) => setRole(v as ProjectRole)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {options.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              {options.find((r) => r.value === role) && (
                <p className="rounded-lg bg-muted/60 p-3 text-[11px] leading-relaxed text-muted-foreground">
                  {options.find((r) => r.value === role)?.description}
                </p>
              )}

              <Field label="Link expires in (days)">
                <Input
                  type="number"
                  min={1}
                  max={90}
                  value={expiresInDays}
                  onChange={(e) => setExpires(Number(e.target.value))}
                  className="tabular"
                />
              </Field>
            </>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {inviteUrl ? 'Done' : 'Cancel'}
          </Button>
          {!inviteUrl && (
            <Button disabled={!email.includes('@')} loading={invite.isPending} onClick={() => invite.mutate()}>
              Send invitation
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
