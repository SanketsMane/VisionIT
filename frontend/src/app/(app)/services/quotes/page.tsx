'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Building2, Mail, MessageSquareQuote, Phone, Search, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input, Textarea } from '@/components/ui/input';
import { TableSkeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState, ErrorState } from '@/components/shared/empty-state';
import {
  QUOTE_STATUS_LABELS, servicesApi,
  type QuoteRequest, type QuoteStatus,
} from '@/lib/api/services.api';
import { queryKeys } from '@/lib/hooks/query-keys';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';

const STATUS_TONE: Record<QuoteStatus, 'warning' | 'primary' | 'info' | 'success' | 'outline'> = {
  NEW: 'warning',
  CONTACTED: 'primary',
  QUOTED: 'info',
  WON: 'success',
  LOST: 'outline',
};

const rupees = (value: number) => `₹${value.toLocaleString('en-IN')}`;
const STATUSES: QuoteStatus[] = ['NEW', 'CONTACTED', 'QUOTED', 'WON', 'LOST'];

/** The enquiry inbox: a list on the left, the selected enquiry on the right. */
export default function QuotesPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<QuoteStatus | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);

  const quotes = useQuery({
    queryKey: queryKeys.services.quotes({ status, search }),
    queryFn: () =>
      servicesApi.quotes({
        ...(status === 'ALL' ? {} : { status }),
        ...(search.trim() ? { search: search.trim() } : {}),
        limit: 50,
      }),
    refetchInterval: 60_000,
  });

  const items = quotes.data?.items ?? [];
  const byStatus = (quotes.data as unknown as { byStatus?: Record<string, number> })?.byStatus ?? {};
  const active = items.find((q) => q.id === activeId) ?? items[0] ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Enquiries"
        description="Quote requests from your services page."
        actions={
          <Button asChild variant="ghost">
            <Link href="/services"><ArrowLeft /> Services</Link>
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, company or message"
          leading={<Search className="size-3.5" />}
          className="max-w-xs"
        />
        <div className="flex flex-wrap gap-1.5">
          {(['ALL', ...STATUSES] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatus(value)}
              className={cn(
                'rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
                status === value
                  ? 'border-primary bg-primary-muted text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground',
              )}
            >
              {value === 'ALL' ? 'All' : QUOTE_STATUS_LABELS[value]}
              {value !== 'ALL' && byStatus[value] ? (
                <span className="ml-1.5 text-[10px] opacity-70">{byStatus[value]}</span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {quotes.isError ? (
        <Card><ErrorState onRetry={() => void quotes.refetch()} /></Card>
      ) : quotes.isLoading ? (
        <Card><TableSkeleton rows={6} columns={4} /></Card>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            icon={MessageSquareQuote}
            title={search || status !== 'ALL' ? 'Nothing matches' : 'No enquiries yet'}
            description={search || status !== 'ALL' ? undefined : 'They will land here as they come in.'}
            className="py-16"
          />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,360px)_1fr]">
          <Card className="overflow-hidden">
            <div className="max-h-[70vh] overflow-y-auto scrollbar-slim">
              {items.map((quote) => (
                <button
                  key={quote.id}
                  type="button"
                  onClick={() => setActiveId(quote.id)}
                  className={cn(
                    'block w-full border-b border-border px-3.5 py-3 text-left transition-colors',
                    active?.id === quote.id ? 'bg-primary-muted' : 'hover:bg-accent',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-xs font-semibold">{quote.name}</p>
                    <Badge variant={STATUS_TONE[quote.status]} size="sm">
                      {QUOTE_STATUS_LABELS[quote.status]}
                    </Badge>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {quote.service?.name ?? 'General enquiry'}
                  </p>
                  {quote.message && (
                    <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{quote.message}</p>
                  )}
                  <p className="mt-1 text-[10px] text-muted-foreground">{formatRelative(quote.createdAt)}</p>
                </button>
              ))}
            </div>
          </Card>

          {active && <QuoteDetail quote={active} onSaved={() => queryClient.invalidateQueries({ queryKey: ['services'] })} />}
        </div>
      )}
    </div>
  );
}

function QuoteDetail({ quote, onSaved }: { quote: QuoteRequest; onSaved: () => void }) {
  const [notes, setNotes] = useState(quote.internalNotes ?? '');

  const update = useMutation({
    mutationFn: (payload: { status?: QuoteStatus; internalNotes?: string | null }) =>
      servicesApi.updateQuote(quote.id, payload),
    onSuccess: () => { toast.success('Enquiry updated'); onSaved(); },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Could not save'),
  });

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-base font-semibold">{quote.name}</p>
            <p className="text-xs text-muted-foreground">
              {quote.service?.name ?? 'General enquiry'} · {formatRelative(quote.createdAt)} · via {quote.source}
            </p>
          </div>
          <Select
            value={quote.status}
            onValueChange={(value) => update.mutate({ status: value as QuoteStatus })}
          >
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{QUOTE_STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
          <a href={`mailto:${quote.email}`} className="inline-flex items-center gap-1.5 text-primary hover:underline">
            <Mail className="size-3.5" /> {quote.email}
          </a>
          {quote.phone && (
            <a href={`tel:${quote.phone}`} className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
              <Phone className="size-3.5" /> {quote.phone}
            </a>
          )}
          {quote.company && (
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <Building2 className="size-3.5" /> {quote.company}
            </span>
          )}
        </div>

        {(quote.quotedPrice || quote.budget || quote.timeline) && (
          <dl className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/40 p-3 sm:grid-cols-3">
            {quote.quotedPrice !== null && (
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Price shown</dt>
                <dd className="mt-0.5 text-xs font-semibold">
                  {rupees(quote.quotedPrice)}/mo
                  {quote.termMonths ? ` · ${quote.termMonths}mo` : ''}
                </dd>
              </div>
            )}
            {quote.budget && (
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Budget</dt>
                <dd className="mt-0.5 text-xs font-semibold">{quote.budget}</dd>
              </div>
            )}
            {quote.timeline && (
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Timeline</dt>
                <dd className="mt-0.5 text-xs font-semibold">{quote.timeline}</dd>
              </div>
            )}
          </dl>
        )}

        {quote.couponCode && (
          <p className="inline-flex items-center gap-1.5 rounded-lg bg-success-muted px-2.5 py-1.5 text-[11px] font-medium text-success">
            <Tag className="size-3" />
            Applied {quote.couponCode}
            {quote.discountAmount ? ` — ${rupees(quote.discountAmount)}/mo off` : ''}
          </p>
        )}

        {quote.message && (
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">What they said</p>
            <p className="whitespace-pre-wrap rounded-lg border-l-2 border-primary bg-muted/40 p-3 text-xs">
              {quote.message}
            </p>
          </div>
        )}

        <div>
          <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            Internal notes — never shown to them
          </p>
          <Textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What you quoted, what they said on the call…"
          />
          <div className="mt-2 flex justify-end gap-2">
            <Button size="sm" asChild variant="outline">
              <a href={`mailto:${quote.email}?subject=${encodeURIComponent(`Re: ${quote.service?.name ?? 'your enquiry'}`)}`}>
                <Mail /> Reply
              </a>
            </Button>
            <Button
              size="sm"
              loading={update.isPending}
              disabled={notes === (quote.internalNotes ?? '')}
              onClick={() => update.mutate({ internalNotes: notes })}
            >
              Save notes
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
