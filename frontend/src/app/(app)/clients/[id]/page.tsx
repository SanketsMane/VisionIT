'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Briefcase, FileText, Globe, Mail, Phone } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar } from '@/components/ui/misc';
import { PageHeader, SectionHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { Money } from '@/components/shared/money';
import { EmptyState, ErrorState } from '@/components/shared/empty-state';
import {
  CategoryBadge, ClientStatusBadge, InvoiceStatusBadge, ProjectStatusBadge,
} from '@/components/shared/status-badge';
import { clientsApi } from '@/lib/api/clients.api';
import { invoicesApi } from '@/lib/api/invoices.api';
import { queryKeys } from '@/lib/hooks/query-keys';
import { formatDate } from '@/lib/format';

export default function ClientDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const client = useQuery({
    queryKey: queryKeys.clients.detail(id),
    queryFn: () => clientsApi.byId(id),
    enabled: Boolean(id),
  });

  const invoices = useQuery({
    queryKey: queryKeys.invoices.list({ clientId: id, limit: 25 }),
    queryFn: () => invoicesApi.list({ clientId: id, limit: 25 }),
    enabled: Boolean(id),
  });

  if (client.isError) {
    return (
      <Card>
        <ErrorState
          title="Could not load this client"
          message={client.error instanceof Error ? client.error.message : undefined}
          onRetry={() => void client.refetch()}
        />
      </Card>
    );
  }

  if (client.isLoading || !client.data) {
    return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-64" /></div>;
  }

  const data = client.data;
  const address = [
    data.billingAddressLine1, data.billingAddressLine2,
    [data.billingCity, data.billingState, data.billingPostalCode].filter(Boolean).join(', '),
    data.billingCountry,
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
          <Link href="/clients"><ArrowLeft /> All clients</Link>
        </Button>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Avatar name={data.companyName ?? data.name} src={data.avatarUrl} size="lg" />
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold tracking-tight">
                {data.companyName ?? data.name}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <ClientStatusBadge status={data.status} />
                <Badge variant="outline">{data.currency}</Badge>
                <span className="text-xs text-muted-foreground">
                  {data.paymentTermsDays}-day terms
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href={`/email?compose=1&clientId=${data.id}`}><Mail /> Email</Link>
            </Button>
            <Button asChild>
              <Link href="/invoices?new=1"><FileText /> New invoice</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total collected" value={data.summary?.totalRevenue ?? 0} currency={data.currency} tone="success" hint={`${data.summary?.paymentsCount ?? 0} payments`} />
        <StatCard label="Outstanding" value={data.summary?.outstandingAmount ?? 0} currency={data.currency} tone="warning" hint={`${data.summary?.openInvoicesCount ?? 0} open invoices`} />
        <StatCard label="Projects" value={data._count?.projects ?? 0} format="number" icon={Briefcase} />
        <StatCard label="Invoices" value={data._count?.invoices ?? 0} format="number" icon={FileText} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <SectionHeader title="Projects" />
            <CardContent className="p-0">
              {!data.projects?.length ? (
                <EmptyState icon={Briefcase} title="No projects yet" className="py-10" />
              ) : (
                <ul className="divide-y divide-border">
                  {data.projects.map((project) => (
                    <li key={project.id}>
                      <Link
                        href={`/projects/${project.id}`}
                        className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-accent/50"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{project.title}</p>
                          <div className="mt-1 flex gap-1.5">
                            <CategoryBadge category={project.category} />
                            <ProjectStatusBadge status={project.status} size="sm" />
                          </div>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <SectionHeader title="Invoices" />
            <CardContent className="p-0">
              {invoices.isLoading ? (
                <Skeleton className="m-4 h-32" />
              ) : !invoices.data?.items.length ? (
                <EmptyState icon={FileText} title="No invoices yet" className="py-10" />
              ) : (
                <ul className="divide-y divide-border">
                  {invoices.data.items.map((invoice) => (
                    <li key={invoice.id}>
                      <Link
                        href={`/invoices/${invoice.id}`}
                        className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-accent/50"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium tabular">{invoice.number}</p>
                          <p className="text-[11px] text-muted-foreground tabular">
                            {formatDate(invoice.issueDate)} · due {formatDate(invoice.dueDate)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <span className="text-sm font-semibold">
                            <Money value={invoice.total} currency={invoice.currency} />
                          </span>
                          <InvoiceStatusBadge status={invoice.status} size="sm" />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <SectionHeader title="Contact" />
            <CardContent className="space-y-2 p-5 pt-4 text-xs">
              {data.email && (
                <a href={`mailto:${data.email}`} className="flex items-center gap-2 text-primary hover:underline">
                  <Mail className="size-3.5" /> {data.email}
                </a>
              )}
              {data.phone && (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="size-3.5" /> {data.phone}
                </p>
              )}
              {data.website && (
                <a href={data.website} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-primary hover:underline">
                  <Globe className="size-3.5" /> {data.website}
                </a>
              )}
              {data.taxNumber && (
                <p className="pt-2 text-muted-foreground">
                  <span className="font-medium text-foreground">GSTIN:</span> {data.taxNumber}
                </p>
              )}
            </CardContent>
          </Card>

          {address.length > 0 && (
            <Card>
              <SectionHeader title="Billing address" />
              <CardContent className="p-5 pt-4">
                <address className="text-xs not-italic leading-relaxed text-muted-foreground">
                  {address.map((line) => <div key={line}>{line}</div>)}
                </address>
              </CardContent>
            </Card>
          )}

          {data.contacts && data.contacts.length > 0 && (
            <Card>
              <SectionHeader title="People" />
              <CardContent className="p-0">
                <ul className="divide-y divide-border">
                  {data.contacts.map((contact) => (
                    <li key={contact.id} className="flex items-center gap-2.5 px-5 py-3">
                      <Avatar name={contact.name} size="xs" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">{contact.name}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {contact.role ?? contact.email ?? ''}
                        </p>
                      </div>
                      {contact.isPrimary && <Badge variant="primary" size="sm">Primary</Badge>}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {data.notes && (
            <Card>
              <SectionHeader title="Notes" />
              <CardContent className="p-5 pt-4">
                <p className="whitespace-pre-line text-xs leading-relaxed text-muted-foreground">{data.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
