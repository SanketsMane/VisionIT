'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  CheckCircle2, Circle, Download, FileArchive, GitBranch, PackageCheck,
  ShieldCheck, Upload, XCircle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input, Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogBody, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { PageHeader, SectionHeader } from '@/components/shared/page-header';
import { Field } from '@/components/shared/form-field';
import { ErrorState } from '@/components/shared/empty-state';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { DeliveryBadge } from '@/components/shared/portal-badges';
import { deliveryApi } from '@/lib/api/portal.api';
import { queryKeys } from '@/lib/hooks/query-keys';
import { useMutationHandlers } from '@/lib/hooks/use-mutation-toast';
import { formatDate, formatDateTime, formatFileSize } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ProjectDeliveryStatus, SourceCodeMethod } from '@/types/portal';

const FLOW: ProjectDeliveryStatus[] = [
  'NOT_STARTED', 'PREPARING', 'READY_FOR_CLIENT',
  'CLIENT_REVIEWING', 'OWNERSHIP_TRANSFER', 'DELIVERED', 'COMPLETED',
];

/**
 * The delivery and ownership-transfer workspace.
 *
 * Shared by both sides: `isInternal` decides whether you see the studio's
 * controls (checklist, archive upload, publish, admin confirm) or the client's
 * (choose source method, submit GitHub details, confirm receipt).
 */
export function DeliveryPanel({
  projectId,
  isInternal,
}: {
  projectId: string;
  isInternal: boolean;
}) {
  const { onSuccess, onError } = useMutationHandlers();
  const [githubOpen, setGithubOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [archiveVersion, setArchiveVersion] = useState('v1.0.0');

  const delivery = useQuery({
    queryKey: queryKeys.portal.delivery(projectId),
    queryFn: () => deliveryApi.get(projectId),
    enabled: Boolean(projectId),
  });

  const invalidate = [
    queryKeys.portal.delivery(projectId),
    queryKeys.portal.workspace(projectId),
  ];

  const setStatus = useMutation({
    mutationFn: (status: ProjectDeliveryStatus) => deliveryApi.setStatus(projectId, status),
    onSuccess: (updated) => onSuccess(`Delivery is now ${updated.statusLabel}`, invalidate),
    onError: (error) => onError(error, 'Could not update the delivery status'),
  });

  const toggleItem = useMutation({
    mutationFn: ({ itemId, isComplete }: { itemId: string; isComplete: boolean }) =>
      deliveryApi.toggleChecklist(projectId, itemId, isComplete),
    onSuccess: () => onSuccess('Checklist updated', invalidate),
    onError: (error) => onError(error, 'Could not update the checklist'),
  });

  const chooseMethod = useMutation({
    mutationFn: (method: SourceCodeMethod) => deliveryApi.chooseSourceMethod(projectId, method),
    onSuccess: () => onSuccess('Preference saved', invalidate),
    onError: (error) => onError(error, 'Could not save your choice'),
  });

  const confirmTransfer = useMutation({
    mutationFn: () => deliveryApi.confirmGithubTransfer(projectId),
    onSuccess: () => onSuccess('Repository transfer recorded', invalidate),
    onError: (error) => onError(error, 'Could not record the transfer'),
  });

  const uploadArchive = useMutation({
    mutationFn: (file: File) => deliveryApi.uploadArchive(projectId, file, archiveVersion),
    onSuccess: () => onSuccess('Source archive uploaded', invalidate),
    onError: (error) => onError(error, 'Could not upload the archive'),
  });

  const downloadArchive = useMutation({
    mutationFn: (filename: string) => deliveryApi.downloadArchive(projectId, filename),
    onError: (error) => onError(error, 'Could not download the archive'),
  });

  const confirmAdmin = useMutation({
    mutationFn: () => deliveryApi.confirmAdmin(projectId),
    onSuccess: () => onSuccess('Handover confirmed — waiting on the client', invalidate),
    onError: (error) => onError(error, 'Could not confirm the handover'),
  });

  const confirmClient = useMutation({
    mutationFn: () => deliveryApi.confirmClient(projectId),
    onSuccess: () => onSuccess('Thank you — receipt confirmed', invalidate),
    onError: (error) => onError(error, 'Could not confirm'),
  });

  if (delivery.isError) {
    return (
      <Card>
        <ErrorState
          title="Could not load the delivery"
          message={delivery.error instanceof Error ? delivery.error.message : undefined}
          onRetry={() => void delivery.refetch()}
        />
      </Card>
    );
  }

  if (delivery.isLoading || !delivery.data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const data = delivery.data;
  const currentStep = FLOW.indexOf(data.status);
  const requiredDone = data.checklist.filter((i) => i.isRequired && i.isComplete).length;
  const requiredTotal = data.checklist.filter((i) => i.isRequired).length;

  return (
    <div className="space-y-6">
      <div>
        <PageHeader
          title="Delivery"
          description="The final handover: source code, documents and ownership transfer."
          actions={
            isInternal && (
              <Select onValueChange={(value) => setStatus.mutate(value as ProjectDeliveryStatus)}>
                <SelectTrigger className="w-auto min-w-[180px]">
                  <SelectValue placeholder="Advance status…" />
                </SelectTrigger>
                <SelectContent>
                  {FLOW.map((status) => (
                    <SelectItem key={status} value={status} disabled={status === data.status}>
                      {status.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )
          }
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <DeliveryBadge status={data.status} />
          {data.version && <Badge variant="outline" className="font-mono">{data.version}</Badge>}
        </div>
      </div>

      {/* ── Progress rail ─────────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-5">
          <ol className="flex flex-wrap items-center gap-x-1 gap-y-3">
            {FLOW.map((status, index) => {
              const done = index < currentStep;
              const active = index === currentStep;
              return (
                <li key={status} className="flex items-center gap-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        'grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-bold',
                        done && 'bg-success text-success-foreground',
                        active && 'bg-primary text-primary-foreground',
                        !done && !active && 'bg-muted text-muted-foreground',
                      )}
                    >
                      {done ? <CheckCircle2 className="size-3.5" /> : index + 1}
                    </span>
                    <span
                      className={cn(
                        'whitespace-nowrap text-[11px]',
                        active ? 'font-semibold' : 'text-muted-foreground',
                      )}
                    >
                      {status.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase())}
                    </span>
                  </div>
                  {index < FLOW.length - 1 && (
                    <span className={cn('mx-1 h-px w-6', done ? 'bg-success' : 'bg-border')} />
                  )}
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>

      {/* ── Readiness gate ────────────────────────────────────────────── */}
      <Card
        className={
          data.readiness.isReady ? 'border-success/40 bg-success-muted/20' : 'border-warning/40'
        }
      >
        <SectionHeader
          title="Delivery readiness"
          description="Checked live — a project cannot be marked delivered until these pass."
          actions={
            <Badge variant={data.readiness.isReady ? 'success' : 'danger'}>
              {data.readiness.isReady ? '🟢 Ready' : `🔴 ${data.readiness.blockers} blocker(s)`}
            </Badge>
          }
        />
        <CardContent className="p-5 pt-4">
          <ul className="space-y-2">
            {data.readiness.checks.map((check) => (
              <li key={check.key} className="flex items-start gap-2.5">
                {check.passed ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                ) : (
                  <XCircle
                    className={cn(
                      'mt-0.5 size-4 shrink-0',
                      check.blocking ? 'text-danger' : 'text-muted-foreground',
                    )}
                  />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium">{check.label}</p>
                  <p className="text-[11px] text-muted-foreground">{check.detail}</p>
                </div>
                {!check.blocking && (
                  <Badge variant="outline" size="sm" className="ml-auto">Optional</Badge>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ── Source code handover ────────────────────────────────────── */}
        <Card className="lg:col-span-2">
          <SectionHeader
            title="Source code"
            description="How the code gets to you, and confirmation it arrived."
          />
          <CardContent className="space-y-4 p-5 pt-4">
            {data.sourceCodeMethod === 'NOT_CHOSEN' ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {isInternal
                    ? 'The client has not chosen how they want the source code yet.'
                    : 'How would you like to receive the source code?'}
                </p>

                {!isInternal && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => chooseMethod.mutate('GITHUB')}
                      className="rounded-lg border border-border p-4 text-left transition-colors hover:border-primary hover:bg-accent"
                    >
                      <GitBranch className="mb-2 size-5 text-primary" />
                      <p className="text-sm font-medium">Transfer on GitHub</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        We transfer the repository to your GitHub account or organisation.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => chooseMethod.mutate('ZIP')}
                      className="rounded-lg border border-border p-4 text-left transition-colors hover:border-primary hover:bg-accent"
                    >
                      <FileArchive className="mb-2 size-5 text-primary" />
                      <p className="text-sm font-medium">Download an archive</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        We publish a versioned ZIP you can download.
                      </p>
                    </button>
                  </div>
                )}
              </div>
            ) : data.sourceCodeMethod === 'GITHUB' ? (
              <div className="space-y-3">
                <div className="flex items-start gap-3 rounded-lg border border-border p-3">
                  <GitBranch className="mt-0.5 size-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">GitHub transfer</p>
                    {data.githubRepoUrl ? (
                      <a
                        href={data.githubRepoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate text-[11px] text-primary hover:underline"
                      >
                        {data.githubRepoUrl}
                      </a>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">
                        Waiting for the client&apos;s GitHub details
                      </p>
                    )}
                    {data.githubUsername && (
                      <p className="text-[11px] text-muted-foreground">
                        Recipient: {data.githubUsername}
                      </p>
                    )}
                  </div>
                  <Badge
                    variant={data.handoverStatus === 'CLIENT_CONFIRMED' ? 'success' : 'warning'}
                    size="sm"
                  >
                    {data.handoverStatus.replace(/_/g, ' ').toLowerCase()}
                  </Badge>
                </div>

                {!isInternal && (
                  <Button variant="outline" size="sm" onClick={() => setGithubOpen(true)}>
                    {data.githubRepoUrl ? 'Update GitHub details' : 'Submit GitHub details'}
                  </Button>
                )}

                {isInternal && data.githubRepoUrl && data.handoverStatus !== 'ADMIN_CONFIRMED' && (
                  <Button size="sm" loading={confirmTransfer.isPending} onClick={() => confirmTransfer.mutate()}>
                    Mark repository as transferred
                  </Button>
                )}

                {data.transferredAt && (
                  <p className="text-[11px] text-muted-foreground">
                    Transferred {formatDateTime(data.transferredAt)}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start gap-3 rounded-lg border border-border p-3">
                  <FileArchive className="mt-0.5 size-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{data.zipFilename ?? 'No archive uploaded yet'}</p>
                    {data.zipSizeBytes && (
                      <p className="text-[11px] text-muted-foreground">
                        {formatFileSize(data.zipSizeBytes)}
                        {data.zipVersion ? ` · ${data.zipVersion}` : ''}
                        {` · ${data.zipDownloadCount} download(s)`}
                      </p>
                    )}
                    {data.zipChecksum && (
                      <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">
                        SHA-256 {data.zipChecksum.slice(0, 32)}…
                      </p>
                    )}
                  </div>
                </div>

                {isInternal ? (
                  <div className="flex flex-wrap items-end gap-2">
                    <Field label="Version" className="w-32">
                      <Input
                        value={archiveVersion}
                        onChange={(e) => setArchiveVersion(e.target.value)}
                        className="h-8"
                      />
                    </Field>
                    <label className="flex h-8 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-3 text-xs text-muted-foreground transition-colors hover:bg-accent">
                      <Upload className="size-3.5" />
                      {uploadArchive.isPending ? 'Uploading…' : 'Upload archive'}
                      <input
                        type="file"
                        accept=".zip,.gz,.tar,.7z"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) uploadArchive.mutate(file);
                        }}
                      />
                    </label>
                  </div>
                ) : (
                  data.hasArchive && (
                    <Button
                      size="sm"
                      loading={downloadArchive.isPending}
                      onClick={() => downloadArchive.mutate(data.zipFilename ?? 'source.zip')}
                    >
                      <Download /> Download source code
                    </Button>
                  )
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Ownership transfer ──────────────────────────────────────── */}
        <Card>
          <SectionHeader title="Ownership transfer" />
          <CardContent className="space-y-3 p-5 pt-4">
            <ConfirmRow
              label="Studio confirmation"
              confirmed={Boolean(data.adminConfirmedAt)}
              by={data.adminConfirmedBy?.name}
              at={data.adminConfirmedAt}
            />
            <ConfirmRow
              label="Client confirmation"
              confirmed={Boolean(data.clientConfirmedAt)}
              by={data.clientConfirmedBy?.name}
              at={data.clientConfirmedAt}
            />

            {isInternal && !data.adminConfirmedAt && (
              <ConfirmDialog
                trigger={
                  <Button className="w-full" size="sm">
                    <ShieldCheck /> Confirm handover
                  </Button>
                }
                title="Confirm the handover"
                description="You're confirming the final deliverables and agreed source code have been handed to the client. This is recorded permanently."
                confirmLabel="I confirm"
                destructive={false}
                onConfirm={() => confirmAdmin.mutateAsync()}
              />
            )}

            {!isInternal && data.adminConfirmedAt && !data.clientConfirmedAt && (
              <ConfirmDialog
                trigger={
                  <Button className="w-full" size="sm">
                    <ShieldCheck /> Confirm I&apos;ve received everything
                  </Button>
                }
                title="Confirm receipt"
                description="You're confirming you have received the deliverables, documents and source code for this project. This is recorded permanently."
                confirmLabel="I confirm receipt"
                destructive={false}
                onConfirm={() => confirmClient.mutateAsync()}
              />
            )}

            {data.deliveredAt && (
              <div className="rounded-lg border border-success/40 bg-success-muted/40 p-3 text-center">
                <PackageCheck className="mx-auto mb-1 size-5 text-success" />
                <p className="text-xs font-medium">Delivered</p>
                <p className="text-[11px] text-muted-foreground">{formatDate(data.deliveredAt)}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Checklist (studio only) ───────────────────────────────────── */}
      {isInternal && (
        <Card>
          <SectionHeader
            title="Handover checklist"
            description={`${requiredDone} of ${requiredTotal} required items complete`}
            actions={
              <Button variant="outline" size="sm" onClick={() => setPublishOpen(true)}>
                Publish version
              </Button>
            }
          />
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {data.checklist.map((item) => (
                <li key={item.id} className="flex items-center gap-3 px-5 py-2.5">
                  <button
                    type="button"
                    onClick={() => toggleItem.mutate({ itemId: item.id, isComplete: !item.isComplete })}
                    aria-label={item.isComplete ? 'Mark incomplete' : 'Mark complete'}
                  >
                    {item.isComplete ? (
                      <CheckCircle2 className="size-4 text-success" />
                    ) : (
                      <Circle className="size-4 text-muted-foreground" />
                    )}
                  </button>
                  <span
                    className={cn(
                      'flex-1 text-sm',
                      item.isComplete && 'text-muted-foreground line-through',
                    )}
                  >
                    {item.label}
                  </span>
                  {!item.isRequired && <Badge variant="outline" size="sm">Optional</Badge>}
                  {item.completedAt && (
                    <span className="text-[10px] text-muted-foreground">
                      {formatDate(item.completedAt)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* ── Version history ───────────────────────────────────────────── */}
      {data.versions.length > 0 && (
        <Card>
          <SectionHeader title="Delivery history" description={`${data.versions.length} version(s)`} />
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {data.versions.map((version) => (
                <li key={version.id} className="px-5 py-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="primary" className="font-mono">{version.version}</Badge>
                    <span className="text-[11px] text-muted-foreground">
                      Published {formatDate(version.publishedAt)} by {version.publishedBy.name}
                    </span>
                    {version.clientConfirmedAt && (
                      <Badge variant="success" size="sm">Client confirmed</Badge>
                    )}
                  </div>
                  {version.releaseNotes && (
                    <p className="mt-1.5 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
                      {version.releaseNotes}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <GithubDialog open={githubOpen} onOpenChange={setGithubOpen} projectId={projectId} />
      <PublishDialog open={publishOpen} onOpenChange={setPublishOpen} projectId={projectId} />
    </div>
  );
}

function ConfirmRow({
  label,
  confirmed,
  by,
  at,
}: {
  label: string;
  confirmed: boolean;
  by?: string;
  at?: string | null;
}) {
  return (
    <div className="flex items-start gap-2.5">
      {confirmed ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
      ) : (
        <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      )}
      <div className="min-w-0">
        <p className="text-xs font-medium">{label}</p>
        <p className="text-[11px] text-muted-foreground">
          {confirmed && at ? `${by} · ${formatDate(at)}` : 'Not confirmed yet'}
        </p>
      </div>
    </div>
  );
}

function GithubDialog({
  open,
  onOpenChange,
  projectId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}) {
  const { onSuccess, onError } = useMutationHandlers();
  const [githubUsername, setUsername] = useState('');
  const [githubRepoUrl, setRepoUrl] = useState('');

  const submit = useMutation({
    mutationFn: () => deliveryApi.submitGithub(projectId, { githubUsername, githubRepoUrl }),
    onSuccess: () => {
      onSuccess('GitHub details submitted', [queryKeys.portal.delivery(projectId)]);
      onOpenChange(false);
    },
    onError: (error) => onError(error, 'Could not save your GitHub details'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>GitHub handover details</DialogTitle>
          <DialogDescription>
            Tell us where to transfer the repository. Make sure the account can accept transfers.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <Field label="GitHub username or organisation" required>
            <Input
              value={githubUsername}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="abc-pvt-ltd"
              autoFocus
            />
          </Field>

          <Field label="Repository URL" required hint="Where the code should end up.">
            <Input
              value={githubRepoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/abc-pvt-ltd/echosoul"
            />
          </Field>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={!githubUsername.trim() || !githubRepoUrl.includes('github.com')}
            loading={submit.isPending}
            onClick={() => submit.mutate()}
          >
            Submit details
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PublishDialog({
  open,
  onOpenChange,
  projectId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}) {
  const { onSuccess, onError } = useMutationHandlers();
  const [version, setVersion] = useState('v1.0.0');
  const [releaseNotes, setReleaseNotes] = useState('');

  const publish = useMutation({
    mutationFn: () => deliveryApi.publishVersion(projectId, { version, releaseNotes }),
    onSuccess: () => {
      onSuccess(`Version ${version} published`, [queryKeys.portal.delivery(projectId)]);
      setReleaseNotes('');
      onOpenChange(false);
    },
    onError: (error) => onError(error, 'Could not publish the version'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Publish a delivery version</DialogTitle>
          <DialogDescription>
            Snapshots the current source code and notifies the client it&apos;s ready.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <Field label="Version" required>
            <Input value={version} onChange={(e) => setVersion(e.target.value)} className="font-mono" />
          </Field>

          <Field label="Release notes" hint="What changed in this delivery.">
            <Textarea
              rows={4}
              value={releaseNotes}
              onChange={(e) => setReleaseNotes(e.target.value)}
              placeholder="Final production release with all reported issues resolved."
            />
          </Field>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!version.trim()} loading={publish.isPending} onClick={() => publish.mutate()}>
            Publish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
