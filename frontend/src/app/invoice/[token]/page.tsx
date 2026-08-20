'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { InvoiceStatusBadge } from '@/components/shared/status-badge';
import { Money } from '@/components/shared/money';
import { invoicesApi } from '@/lib/api/invoices.api';
import { queryKeys } from '@/lib/hooks/query-keys';
import { formatDate } from '@/lib/format';

/**
 * The client-facing view of a shared invoice link. Deliberately outside the
 * authenticated shell: the token in the URL is the only credential, and the
 * recipient has no account here.
 */
export default function PublicInvoicePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [html, setHtml] = useState<string | null>(null);

  const invoice = useQuery({
    queryKey: queryKeys.invoices.public(token),
    queryFn: () => invoicesApi.byPublicToken(token),
    enabled: Boolean(token),
    retry: false,
  });

  // The share token is the only credential, so no auth header is needed here.
  useEffect(() => {
    if (!invoice.data) return;
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch(invoicesApi.publicPreviewUrl(token));
        if (!response.ok) return;
        const text = await response.text();
        if (!cancelled) setHtml(text);
      } catch {
        // Falls through to the plain fallback document below.
      }
    })();

    return () => { cancelled = true; };
  }, [invoice.data, token]);

  if (invoice.isLoading) {
    return (
      <div className="grid min-h-dvh place-items-center bg-muted">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (invoice.isError || !invoice.data) {
    return (
      <div className="grid min-h-dvh place-items-center bg-muted px-6">
        <div className="max-w-sm text-center">
          <Image src="/logo-mark.png" alt="" width={64} height={64} className="mx-auto size-12 object-contain" />
          <h1 className="mt-4 text-lg font-semibold">This invoice link isn&apos;t valid</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            It may have been revoked, or the invoice may have been deleted. Please ask the sender for
            an up-to-date link.
          </p>
        </div>
      </div>
    );
  }

  const data = invoice.data;
  const company = data.user?.company;

  return (
    <div className="min-h-dvh bg-muted pb-16">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-4xl flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            {company?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={company.logoUrl} alt="" className="h-9 w-auto max-w-[160px] object-contain" />
            ) : (
              <Image src="/logo-mark.png" alt="" width={64} height={64} className="size-9 object-contain" />
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {company?.tradeName ?? company?.legalName ?? 'Invoice'}
              </p>
              <p className="truncate text-[11px] text-muted-foreground tabular">{data.number}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <InvoiceStatusBadge status={data.status} />
            <Button asChild>
              <a href={invoicesApi.publicPdfUrl(token)} target="_blank" rel="noreferrer">
                <Download /> Download PDF
              </a>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <SummaryTile label="Amount due" value={<Money value={data.balanceDue} currency={data.currency} />} emphasis />
          <SummaryTile label="Issued" value={formatDate(data.issueDate)} />
          <SummaryTile
            label={data.documentType === 'QUOTATION' ? 'Valid until' : 'Due'}
            value={formatDate(data.dueDate)}
            tone={data.isOverdue ? 'danger' : undefined}
          />
        </div>

        {data.isOverdue && data.daysOverdue ? (
          <div className="mb-4 rounded-lg border border-danger/30 bg-danger-muted/50 px-4 py-3">
            <p className="text-sm font-medium text-danger">
              This invoice is {data.daysOverdue} day{data.daysOverdue > 1 ? 's' : ''} overdue
            </p>
          </div>
        ) : null}

        <div className="overflow-hidden rounded-card border border-border bg-white shadow-soft">
          {html ? (
            <iframe title="Invoice" srcDoc={html} sandbox="" className="h-[1000px] w-full border-0" />
          ) : (
            <FallbackDocument invoice={data} />
          )}
        </div>

        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          Questions about this invoice? Reply to the email it came from.
        </p>
      </main>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  emphasis,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  emphasis?: boolean;
  tone?: 'danger';
}) {
  return (
    <div className="rounded-card border border-border bg-card p-4">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className={[
          'mt-1 font-semibold tabular',
          emphasis ? 'text-xl' : 'text-sm',
          tone === 'danger' ? 'text-danger' : '',
        ].join(' ')}
      >
        {value}
      </p>
    </div>
  );
}

/** Rendered if the styled HTML document could not be fetched. */
function FallbackDocument({ invoice }: { invoice: import('@/types').Invoice }) {
  return (
    <div className="p-6 text-slate-900">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-[10px] uppercase tracking-wider text-slate-500">
            <th className="py-2">Description</th>
            <th className="py-2 text-right">Qty</th>
            <th className="py-2 text-right">Rate</th>
            <th className="py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item, index) => (
            <tr key={index} className="border-b border-slate-100">
              <td className="py-2">
                <p className="font-medium">{item.title}</p>
                {item.description && <p className="text-xs text-slate-500">{item.description}</p>}
              </td>
              <td className="py-2 text-right tabular">{item.quantity}</td>
              <td className="py-2 text-right tabular">
                <Money value={item.unitPrice} currency={invoice.currency} />
              </td>
              <td className="py-2 text-right font-medium tabular">
                <Money value={item.lineTotal} currency={invoice.currency} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 ml-auto max-w-xs space-y-1 text-sm">
        <Line label="Subtotal" value={<Money value={invoice.subtotal} currency={invoice.currency} />} />
        {Number(invoice.taxAmount) > 0 && (
          <Line label="Tax" value={<Money value={invoice.taxAmount} currency={invoice.currency} />} />
        )}
        <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold">
          <span>Total</span>
          <span className="tabular"><Money value={invoice.total} currency={invoice.currency} /></span>
        </div>
      </div>
    </div>
  );
}

function Line({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between text-slate-600">
      <span>{label}</span>
      <span className="tabular">{value}</span>
    </div>
  );
}
