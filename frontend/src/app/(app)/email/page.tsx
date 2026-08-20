'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Mail, Send, Sparkles, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/misc';
import { TableSkeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader, SectionHeader } from '@/components/shared/page-header';
import { SearchInput } from '@/components/shared/search-input';
import { Pagination } from '@/components/shared/pagination';
import { EmptyState, ErrorState } from '@/components/shared/empty-state';
import { EmailStatusBadge } from '@/components/shared/status-badge';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { AiEmailComposer } from '@/components/modules/email/ai-composer';
import { emailApi } from '@/lib/api/email.api';
import { queryKeys } from '@/lib/hooks/query-keys';
import { useMutationHandlers } from '@/lib/hooks/use-mutation-toast';
import { formatDateTime, humanize } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { EmailMessage, EmailStatus } from '@/types';

const TABS: { value: EmailStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'DRAFT', label: 'Drafts' },
  { value: 'SENT', label: 'Sent' },
  { value: 'FAILED', label: 'Failed' },
];

export default function EmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<EmailStatus | 'all'>('all');
  const [composerOpen, setComposerOpen] = useState(false);
  const [preset, setPreset] = useState<{ clientId?: string; invoiceId?: string }>({});
  const [selected, setSelected] = useState<EmailMessage | null>(null);

  // Deep link from an invoice: /email?compose=1&invoiceId=…&clientId=…
  useEffect(() => {
    if (!searchParams.get('compose')) return;
    setPreset({
      clientId: searchParams.get('clientId') ?? undefined,
      invoiceId: searchParams.get('invoiceId') ?? undefined,
    });
    setComposerOpen(true);
    router.replace('/email');
  }, [searchParams, router]);

  const params = useMemo(
    () => ({
      page,
      limit: 20,
      search: search || undefined,
      status: status === 'all' ? undefined : status,
    }),
    [page, search, status],
  );

  const emails = useQuery({
    queryKey: queryKeys.email.list(params),
    queryFn: () => emailApi.list(params),
  });

  const stats = useQuery({ queryKey: queryKeys.email.stats, queryFn: emailApi.stats });

  const { onSuccess, onError } = useMutationHandlers();

  const send = useMutation({
    mutationFn: (id: string) => emailApi.send(id),
    onSuccess: () => onSuccess('Email sent', [queryKeys.email.all]),
    onError: (error) => onError(error, 'Could not send the email'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => emailApi.remove(id),
    onSuccess: () => {
      onSuccess('Email deleted', [queryKeys.email.all]);
      setSelected(null);
    },
    onError: (error) => onError(error, 'Could not delete'),
  });

  const items = emails.data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Email"
        description="Draft client emails with AI and send them from your own mailbox."
        actions={
          <Button onClick={() => { setPreset({}); setComposerOpen(true); }}>
            <Sparkles /> Compose with AI
          </Button>
        }
      />

      {stats.data && (
        <div className="grid gap-3 sm:grid-cols-4">
          {([
            ['Total', stats.data.total],
            ['Drafts', stats.data.draft],
            ['Sent', stats.data.sent],
            ['Failed', stats.data.failed],
          ] as const).map(([label, value]) => (
            <Card key={label} className="p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className={cn('mt-1 text-xl font-semibold tabular', label === 'Failed' && value > 0 && 'text-danger')}>
                {value}
              </p>
            </Card>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <div className="space-y-3 border-b border-border p-4">
            <SearchInput
              value={search}
              onChange={(value) => { setSearch(value); setPage(1); }}
              placeholder="Search subject or recipient…"
            />
            <Tabs value={status} onValueChange={(v) => { setStatus(v as EmailStatus | 'all'); setPage(1); }}>
              <TabsList className="w-full">
                {TABS.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value} className="flex-1">{tab.label}</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          {emails.isError ? (
            <ErrorState onRetry={() => void emails.refetch()} />
          ) : emails.isLoading ? (
            <TableSkeleton rows={6} columns={1} />
          ) : items.length === 0 ? (
            <EmptyState
              icon={Mail}
              title="No emails here"
              description="Compose your first AI-assisted client email."
              action={
                <Button size="sm" onClick={() => { setPreset({}); setComposerOpen(true); }}>
                  <Sparkles /> Compose
                </Button>
              }
            />
          ) : (
            <ul className="max-h-[640px] divide-y divide-border overflow-y-auto scrollbar-slim">
              {items.map((email) => (
                <li key={email.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(email)}
                    className={cn(
                      'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50',
                      selected?.id === email.id && 'bg-primary-muted/50',
                    )}
                  >
                    <Avatar name={email.client?.name ?? email.toAddresses[0]} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-xs font-medium">
                          {email.client?.companyName ?? email.client?.name ?? email.toAddresses[0]}
                        </p>
                        {email.aiGenerated && <Sparkles className="size-2.5 shrink-0 text-primary" />}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{email.subject}</p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <EmailStatusBadge status={email.status} size="sm" />
                        <span className="truncate text-[10px] text-muted-foreground">
                          {formatDateTime(email.sentAt ?? email.createdAt)}
                        </span>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <Pagination meta={emails.data?.meta} onPageChange={setPage} label="emails" />
        </Card>

        <Card className="lg:col-span-3">
          {!selected ? (
            <EmptyState
              icon={Mail}
              title="Select an email"
              description="Pick a message on the left to read it here."
              className="h-full min-h-[400px]"
            />
          ) : (
            <>
              <SectionHeader
                title={selected.subject}
                description={`To ${selected.toAddresses.join(', ')}`}
                actions={
                  <div className="flex gap-1.5">
                    {selected.status !== 'SENT' && (
                      <Button size="sm" loading={send.isPending} onClick={() => send.mutate(selected.id)}>
                        <Send /> Send
                      </Button>
                    )}
                    {selected.status !== 'SENT' && (
                      <ConfirmDialog
                        trigger={
                          <Button variant="ghost" size="icon-sm" aria-label="Delete email">
                            <Trash2 className="text-danger" />
                          </Button>
                        }
                        title="Delete this email?"
                        description="Drafts are removed permanently. Sent emails are always kept as a record."
                        confirmLabel="Delete"
                        onConfirm={() => remove.mutateAsync(selected.id)}
                      />
                    )}
                  </div>
                }
              />
              <CardContent className="space-y-4 p-5">
                <div className="flex flex-wrap gap-2">
                  <EmailStatusBadge status={selected.status} />
                  <Badge variant="outline">{humanize(selected.purpose)}</Badge>
                  {selected.aiGenerated && (
                    <Badge variant="primary" className="gap-1"><Sparkles className="size-2.5" /> AI drafted</Badge>
                  )}
                  {selected.invoice && <Badge variant="info">{selected.invoice.number}</Badge>}
                </div>

                {selected.errorMessage && (
                  <div className="rounded-lg border border-danger/40 bg-danger-muted/50 p-3">
                    <p className="text-xs font-medium text-danger">Delivery failed</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{selected.errorMessage}</p>
                  </div>
                )}

                <div className="rounded-lg border border-border bg-white p-6">
                  <div
                    className="text-sm leading-relaxed text-slate-900 [&_a]:text-indigo-600 [&_li]:ml-4 [&_li]:list-disc [&_p]:mb-3 [&_strong]:font-semibold [&_ul]:mb-3"
                    dangerouslySetInnerHTML={{ __html: selected.bodyHtml }}
                  />
                </div>

                <dl className="grid grid-cols-2 gap-3 border-t border-border pt-3 text-[11px]">
                  <div>
                    <dt className="text-muted-foreground">Created</dt>
                    <dd className="font-medium">{formatDateTime(selected.createdAt)}</dd>
                  </div>
                  {selected.sentAt && (
                    <div>
                      <dt className="text-muted-foreground">Sent</dt>
                      <dd className="font-medium">{formatDateTime(selected.sentAt)}</dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </>
          )}
        </Card>
      </div>

      <AiEmailComposer
        open={composerOpen}
        onOpenChange={setComposerOpen}
        presetClientId={preset.clientId}
        presetInvoiceId={preset.invoiceId}
      />
    </div>
  );
}
