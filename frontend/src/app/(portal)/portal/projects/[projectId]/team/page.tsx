'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Copy, Mail, MoreVertical, RotateCw, Trash2, UserPlus, Users } from 'lucide-react';
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
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PageHeader, SectionHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Field } from '@/components/shared/form-field';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { InvitationBadge, RoleBadge } from '@/components/shared/portal-badges';
import { teamApi, workspaceApi } from '@/lib/api/portal.api';
import { queryKeys } from '@/lib/hooks/query-keys';
import { useMutationHandlers } from '@/lib/hooks/use-mutation-toast';
import { formatDate, formatRelative } from '@/lib/format';
import type { ProjectRole } from '@/types/portal';

export default function PortalTeamPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const [inviteOpen, setInviteOpen] = useState(false);

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

  const workspace = useQuery({
    queryKey: queryKeys.portal.workspace(projectId),
    queryFn: () => workspaceApi.overview(projectId),
    enabled: Boolean(projectId),
  });

  const { onSuccess, onError } = useMutationHandlers();

  const canInvite = workspace.data?.access.permissions.includes('team:invite') ?? false;
  const canManage = workspace.data?.access.permissions.includes('team:manage') ?? false;

  const removeMember = useMutation({
    mutationFn: (memberId: string) => teamApi.removeMember(projectId, memberId),
    onSuccess: () => onSuccess('Member removed', [queryKeys.portal.members(projectId)]),
    onError: (error) => onError(error, 'Could not remove the member'),
  });

  const changeRole = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: ProjectRole }) =>
      teamApi.updateRole(projectId, memberId, role),
    onSuccess: () => onSuccess('Role updated', [queryKeys.portal.members(projectId)]),
    onError: (error) => onError(error, 'Could not change the role'),
  });

  const revoke = useMutation({
    mutationFn: (invitationId: string) => teamApi.revokeInvitation(projectId, invitationId),
    onSuccess: () => onSuccess('Invitation revoked', [queryKeys.portal.invitations(projectId)]),
    onError: (error) => onError(error, 'Could not revoke'),
  });

  const resend = useMutation({
    mutationFn: (invitationId: string) => teamApi.resendInvitation(projectId, invitationId),
    onSuccess: (result) => {
      onSuccess('Invitation re-sent with a fresh link', [queryKeys.portal.invitations(projectId)]);
      void navigator.clipboard.writeText(result.inviteUrl);
      toast.info('New invite link copied to your clipboard');
    },
    onError: (error) => onError(error, 'Could not resend'),
  });

  const active = (members.data ?? []).filter((m) => m.isActive);
  const pending = (invitations.data ?? []).filter((i) => i.status === 'PENDING');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team"
        description="Who can see this project, and what they can do."
        actions={
          canInvite && (
            <Button onClick={() => setInviteOpen(true)}>
              <UserPlus /> Invite teammate
            </Button>
          )
        }
      />

      <Card>
        <SectionHeader title="Members" description={`${active.length} with access`} />
        <CardContent className="p-0">
          {members.isLoading ? (
            <Skeleton className="m-4 h-24" />
          ) : !active.length ? (
            <EmptyState icon={Users} title="No members yet" className="py-10" />
          ) : (
            <ul className="divide-y divide-border">
              {active.map((member) => (
                <li key={member.id} className="flex items-center gap-3 px-5 py-3.5">
                  <Avatar name={member.user.name} src={member.user.avatarUrl} size="sm" />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{member.user.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{member.user.email}</p>
                  </div>

                  <div className="hidden text-right sm:block">
                    <p className="text-[10px] text-muted-foreground">
                      Joined {formatDate(member.joinedAt)}
                    </p>
                    {member.user.lastLoginAt && (
                      <p className="text-[10px] text-muted-foreground">
                        Active {formatRelative(member.user.lastLoginAt)}
                      </p>
                    )}
                  </div>

                  <RoleBadge role={member.role} size="sm" />

                  {canManage && member.role !== 'INTERNAL_MEMBER' && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label="Member actions">
                          <MoreVertical />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {(['CLIENT_MANAGER', 'TESTER', 'VIEWER'] as ProjectRole[])
                          .filter((role) => role !== member.role)
                          .map((role) => (
                            <DropdownMenuItem
                              key={role}
                              onSelect={() => changeRole.mutate({ memberId: member.id, role })}
                            >
                              Make {role.replace(/_/g, ' ').toLowerCase()}
                            </DropdownMenuItem>
                          ))}
                        <ConfirmDialog
                          trigger={
                            <button
                              type="button"
                              className="relative flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-danger outline-none transition-colors hover:bg-danger-muted [&_svg]:size-3.5"
                            >
                              <Trash2 /> Remove
                            </button>
                          }
                          title={`Remove ${member.user.name}?`}
                          description="They lose access immediately. Their reports and comments are kept."
                          confirmLabel="Remove"
                          onConfirm={() => removeMember.mutateAsync(member.id)}
                        />
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {canInvite && (
        <Card>
          <SectionHeader title="Pending invitations" description={`${pending.length} outstanding`} />
          <CardContent className="p-0">
            {!pending.length ? (
              <EmptyState icon={Mail} title="No pending invitations" className="py-10" />
            ) : (
              <ul className="divide-y divide-border">
                {pending.map((invitation) => (
                  <li key={invitation.id} className="flex items-center gap-3 px-5 py-3.5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                      <Mail className="size-4" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{invitation.email}</p>
                      <p className="text-[11px] text-muted-foreground">
                        Expires {formatDate(invitation.expiresAt)} · sent {invitation.sendCount}×
                      </p>
                    </div>

                    <RoleBadge role={invitation.role} size="sm" />
                    <InvitationBadge status={invitation.status} size="sm" />

                    {canManage && (
                      <div className="flex shrink-0 gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          loading={resend.isPending && resend.variables === invitation.id}
                          onClick={() => resend.mutate(invitation.id)}
                          aria-label="Resend invitation"
                        >
                          <RotateCw />
                        </Button>
                        <ConfirmDialog
                          trigger={
                            <Button variant="ghost" size="icon-sm" aria-label="Revoke invitation">
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
      )}

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} projectId={projectId} />
    </div>
  );
}

function InviteDialog({
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
  const [role, setRole] = useState<ProjectRole>('TESTER');
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  const roles = useQuery({
    queryKey: queryKeys.portal.roles(projectId),
    queryFn: () => teamApi.roles(projectId),
    enabled: open,
  });

  const invite = useMutation({
    mutationFn: () => teamApi.invite(projectId, { email: email.trim(), name: name.trim() || undefined, role }),
    onSuccess: (result) => {
      onSuccess(`Invitation sent to ${email}`, [queryKeys.portal.invitations(projectId)]);
      // Shown so it can be shared directly if the email is slow or filtered.
      setInviteUrl(result.inviteUrl);
      setEmail(''); setName('');
    },
    onError: (error) => onError(error, 'Could not send the invitation'),
  });

  const assignable = (roles.data ?? []).filter((r) => r.clientAssignable);

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
          <DialogTitle>Invite a teammate</DialogTitle>
          <DialogDescription>
            They&apos;ll get an email with a secure link to set up their own account.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {inviteUrl ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-success/40 bg-success-muted/40 p-3">
                <p className="text-xs font-medium">Invitation sent</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  You can also share this link directly. It works once, then expires.
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
              <Field label="Email address" required>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="teammate@company.com"
                  autoFocus
                />
              </Field>

              <Field label="Their name" hint="Optional — pre-fills their sign-up form.">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Amit Kumar" />
              </Field>

              <Field label="Role">
                <Select value={role} onValueChange={(v) => setRole(v as ProjectRole)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {assignable.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              {assignable.find((r) => r.value === role) && (
                <p className="rounded-lg bg-muted/60 p-3 text-[11px] leading-relaxed text-muted-foreground">
                  {assignable.find((r) => r.value === role)?.description}
                </p>
              )}
            </>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {inviteUrl ? 'Done' : 'Cancel'}
          </Button>
          {!inviteUrl && (
            <Button
              disabled={!email.includes('@')}
              loading={invite.isPending}
              onClick={() => invite.mutate()}
            >
              Send invitation
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
