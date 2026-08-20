'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCheck, Inbox, Mail, Phone, TrendingUp, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { SearchInput } from '@/components/shared/search-input';
import { EmptyState, ErrorState } from '@/components/shared/empty-state';
import {
  LEAD_SOURCE_LABELS, LEAD_STATUS_LABELS, leadsApi,
  type Lead, type LeadStatus,
} from '@/lib/api/leads.api';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

const STATUS_TONE: Record<LeadStatus, 'default' | 'primary' | 'success' | 'warning'> = {
  NEW: 'primary',
  CONTACTED: 'warning',
  QUALIFIED: 'warning',
  CONVERTED: 'success',
  ARCHIVED: 'default',
};

/** Everyone who signed up on the website, plus the contact-form inbox. */
export default function LeadsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<LeadStatus | 'ALL'>('ALL');
  const queryClient = useQueryClient();

  const stats = useQuery({ queryKey: ['leads', 'stats'], queryFn: leadsApi.stats });
  const leads = useQuery({
    queryKey: ['leads', 'list', status, search],
    queryFn: () =>
      leadsApi.list({
        status: status === 'ALL' ? undefined : status,
        search: search || undefined,
      }),
  });
  const enquiries = useQuery({ queryKey: ['leads', 'enquiries'], queryFn: () => leadsApi.enquiries() });

  const updateStatus = useMutation({
    mutationFn: ({ id, next }: { id: string; next: LeadStatus }) =>
      leadsApi.update(id, { status: next }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Lead updated');
    },
    onError: () => toast.error('Could not update that lead'),
  });

  const markRead = useMutation({
    mutationFn: (id: string) => leadsApi.markEnquiryRead(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['leads'] }),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads"
        description="People who signed up on the website, and messages from the contact form."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total sign-ups" value={stats.data?.total ?? 0} format="number" icon={Users} tone="primary" />
        <StatCard label="New" value={stats.data?.byStatus.NEW ?? 0} format="number" icon={UserPlus} tone={(stats.data?.byStatus.NEW ?? 0) > 0 ? 'warning' : 'default'} />
        <StatCard label="Converted" value={stats.data?.byStatus.CONVERTED ?? 0} format="number" icon={TrendingUp} tone="success" />
        <StatCard label="Unread enquiries" value={stats.data?.unreadEnquiries ?? 0} format="number" icon={Inbox} tone={(stats.data?.unreadEnquiries ?? 0) > 0 ? 'danger' : 'default'} />
      </div>

      <Tabs defaultValue="leads">
        <TabsList>
          <TabsTrigger value="leads">Sign-ups</TabsTrigger>
          <TabsTrigger value="enquiries">
            Enquiries
            {(stats.data?.unreadEnquiries ?? 0) > 0 && (
              <Badge variant="danger" size="sm" className="ml-1.5">
                {stats.data?.unreadEnquiries}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Sign-ups ──────────────────────────────────────────────────── */}
        <TabsContent value="leads" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput value={search} onChange={setSearch} placeholder="Name, email, company or phone" className="max-w-xs" />
            <div className="flex flex-wrap gap-1.5">
              {(['ALL', 'NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'ARCHIVED'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStatus(value)}
                  className={cn(
                    'rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
                    status === value
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border text-muted-foreground hover:text-foreground',
                  )}
                >
                  {value === 'ALL' ? 'All' : LEAD_STATUS_LABELS[value]}
                </button>
              ))}
            </div>
          </div>

          {leads.isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((key) => <Skeleton key={key} className="h-24 rounded-xl" />)}
            </div>
          ) : leads.isError ? (
            <ErrorState onRetry={() => void leads.refetch()} />
          ) : !leads.data?.items.length ? (
            <Card>
              <EmptyState
                icon={Users}
                title={search || status !== 'ALL' ? 'Nothing matches that' : 'No sign-ups yet'}
                description={
                  search || status !== 'ALL'
                    ? 'Try a different search or filter.'
                    : 'When someone registers on the website, they will appear here.'
                }
                className="py-12"
              />
            </Card>
          ) : (
            <div className="space-y-2">
              {leads.data.items.map((lead) => (
                <LeadRow
                  key={lead.id}
                  lead={lead}
                  onStatus={(next) => updateStatus.mutate({ id: lead.id, next })}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Enquiries ─────────────────────────────────────────────────── */}
        <TabsContent value="enquiries" className="space-y-2">
          {enquiries.isLoading ? (
            <div className="space-y-2">
              {[0, 1].map((key) => <Skeleton key={key} className="h-28 rounded-xl" />)}
            </div>
          ) : !enquiries.data?.items.length ? (
            <Card>
              <EmptyState
                icon={Inbox}
                title="No enquiries yet"
                description="Messages sent through the website contact form land here."
                className="py-12"
              />
            </Card>
          ) : (
            enquiries.data.items.map((enquiry) => (
              <Card key={enquiry.id} className={cn(!enquiry.isRead && 'border-primary')}>
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold">{enquiry.name}</p>
                        {!enquiry.isRead && <Badge variant="primary" size="sm">New</Badge>}
                        {enquiry.source && (
                          <span className="text-[11px] text-muted-foreground">
                            via {LEAD_SOURCE_LABELS[enquiry.source]}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        <a href={`mailto:${enquiry.email}`} className="hover:text-foreground">{enquiry.email}</a>
                        {enquiry.phone && <span>{enquiry.phone}</span>}
                        {enquiry.company && <span>{enquiry.company}</span>}
                        <span>{formatDate(enquiry.createdAt)}</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button asChild size="sm" variant="outline">
                        <a href={`mailto:${enquiry.email}?subject=${encodeURIComponent(`Re: ${enquiry.subject ?? 'your enquiry'}`)}`}>
                          <Mail /> Reply
                        </a>
                      </Button>
                      {!enquiry.isRead && (
                        <Button size="sm" variant="ghost" onClick={() => markRead.mutate(enquiry.id)}>
                          <CheckCheck /> Mark read
                        </Button>
                      )}
                    </div>
                  </div>

                  {enquiry.subject && <p className="mt-3 text-xs font-medium">{enquiry.subject}</p>}
                  <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                    {enquiry.message}
                  </p>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LeadRow({ lead, onStatus }: { lead: Lead; onStatus: (next: LeadStatus) => void }) {
  const status = lead.leadStatus ?? 'NEW';

  return (
    <Card>
      <CardContent className="flex flex-wrap items-start justify-between gap-4 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">{lead.name}</p>
            <Badge variant={STATUS_TONE[status]} size="sm">{LEAD_STATUS_LABELS[status]}</Badge>
            {(lead.projectCount ?? 0) > 0 && (
              <Badge variant="success" size="sm">
                {lead.projectCount} project{lead.projectCount === 1 ? '' : 's'}
              </Badge>
            )}
          </div>

          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <a href={`mailto:${lead.email}`} className="inline-flex items-center gap-1 hover:text-foreground">
              <Mail className="size-3" /> {lead.email}
            </a>
            {lead.phone && (
              <a href={`tel:${lead.phone.replace(/\s+/g, '')}`} className="inline-flex items-center gap-1 hover:text-foreground">
                <Phone className="size-3" /> {lead.phone}
              </a>
            )}
            {lead.leadCompany && <span>{lead.leadCompany}</span>}
            {lead.leadSource && <span>via {LEAD_SOURCE_LABELS[lead.leadSource]}</span>}
            <span>{formatDate(lead.createdAt)}</span>
          </div>

          {lead.leadNote && (
            <p className="mt-2 rounded-lg bg-muted/60 p-2.5 text-xs leading-relaxed text-muted-foreground">
              {lead.leadNote}
            </p>
          )}
          {lead.leadReferrer && (
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Referred by / found via: {lead.leadReferrer}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={status}
            onChange={(event) => onStatus(event.target.value as LeadStatus)}
            aria-label={`Status for ${lead.name}`}
            className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus-visible:border-primary"
          >
            {(Object.keys(LEAD_STATUS_LABELS) as LeadStatus[]).map((value) => (
              <option key={value} value={value}>{LEAD_STATUS_LABELS[value]}</option>
            ))}
          </select>
          <Button asChild size="sm" variant="outline">
            <Link href="/projects">Add to project</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
