'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Archive, Building2, Mail, MoreVertical, Pencil, Phone, Plus, Users } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input, Textarea } from '@/components/ui/input';
import { Avatar } from '@/components/ui/misc';
import { TableSkeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogBody, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PageHeader } from '@/components/shared/page-header';
import { SearchInput } from '@/components/shared/search-input';
import { Pagination } from '@/components/shared/pagination';
import { EmptyState, ErrorState } from '@/components/shared/empty-state';
import { ClientStatusBadge } from '@/components/shared/status-badge';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Field, FieldRow, FormSection } from '@/components/shared/form-field';
import { clientsApi, type ClientListParams } from '@/lib/api/clients.api';
import { queryKeys } from '@/lib/hooks/query-keys';
import { useMutationHandlers } from '@/lib/hooks/use-mutation-toast';
import type { Client, ClientStatus } from '@/types';

const STATUSES: ClientStatus[] = ['ACTIVE', 'PROSPECT', 'INACTIVE', 'ARCHIVED'];

export default function ClientsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ClientStatus | 'all'>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);

  useEffect(() => {
    if (searchParams.get('new')) {
      setEditing(null);
      setFormOpen(true);
      router.replace('/clients');
    }
  }, [searchParams, router]);

  const params: ClientListParams = useMemo(
    () => ({ page, limit: 20, search: search || undefined, status: status === 'all' ? undefined : status }),
    [page, search, status],
  );

  const clients = useQuery({
    queryKey: queryKeys.clients.list(params),
    queryFn: () => clientsApi.list(params),
  });

  const stats = useQuery({ queryKey: queryKeys.clients.stats, queryFn: clientsApi.stats });

  const { onSuccess, onError } = useMutationHandlers();

  const archive = useMutation({
    mutationFn: (id: string) => clientsApi.remove(id),
    onSuccess: () => onSuccess('Client archived', [queryKeys.clients.all, queryKeys.dashboard.overview]),
    onError: (error) => onError(error, 'Could not archive the client'),
  });

  const items = clients.data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        description="Everyone you work with, and what they're worth."
        actions={
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus /> Add client
          </Button>
        }
      />

      {stats.data && (
        <div className="grid gap-3 sm:grid-cols-4">
          {([
            ['Total', stats.data.total], ['Active', stats.data.active],
            ['Prospects', stats.data.prospect], ['Archived', stats.data.archived],
          ] as const).map(([label, value]) => (
            <Card key={label} className="p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-xl font-semibold tabular">{value}</p>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center">
          <SearchInput
            value={search}
            onChange={(value) => { setSearch(value); setPage(1); }}
            placeholder="Search by name, company or email…"
            className="sm:max-w-xs"
          />
          <Select value={status} onValueChange={(v) => { setStatus(v as ClientStatus | 'all'); setPage(1); }}>
            <SelectTrigger className="w-auto min-w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map((key) => (
                <SelectItem key={key} value={key}>
                  {key.charAt(0) + key.slice(1).toLowerCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {clients.isError ? (
          <ErrorState onRetry={() => void clients.refetch()} />
        ) : clients.isLoading ? (
          <TableSkeleton rows={6} columns={5} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No clients yet"
            description="Add your first client to start invoicing and tracking revenue."
            action={
              <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}>
                <Plus /> Add client
              </Button>
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">Projects</TableHead>
                <TableHead className="text-right">Invoices</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((client) => (
                <TableRow key={client.id} interactive onClick={() => router.push(`/clients/${client.id}`)}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={client.companyName ?? client.name} src={client.avatarUrl} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{client.companyName ?? client.name}</p>
                        {client.companyName && (
                          <p className="truncate text-[11px] text-muted-foreground">{client.name}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-0.5 text-[11px] text-muted-foreground">
                      {client.email && (
                        <p className="flex items-center gap-1 truncate"><Mail className="size-3" /> {client.email}</p>
                      )}
                      {client.phone && (
                        <p className="flex items-center gap-1 truncate"><Phone className="size-3" /> {client.phone}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {[client.billingCity, client.billingCountry].filter(Boolean).join(', ') || '—'}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular">{client._count?.projects ?? 0}</TableCell>
                  <TableCell className="text-right text-sm tabular">{client._count?.invoices ?? 0}</TableCell>
                  <TableCell><ClientStatusBadge status={client.status} /></TableCell>
                  <TableCell onClick={(event) => event.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label="Client actions"><MoreVertical /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => { setEditing(client); setFormOpen(true); }}>
                          <Pencil /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => router.push(`/invoices?new=1`)}>
                          New invoice
                        </DropdownMenuItem>
                        <ConfirmDialog
                          trigger={
                            <button type="button" className="relative flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-danger outline-none transition-colors hover:bg-danger-muted [&_svg]:size-3.5">
                              <Archive /> Archive
                            </button>
                          }
                          title={`Archive ${client.companyName ?? client.name}?`}
                          description="Their history stays intact. Clients with unpaid invoices cannot be archived."
                          confirmLabel="Archive"
                          onConfirm={() => archive.mutateAsync(client.id)}
                        />
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Pagination meta={clients.data?.meta} onPageChange={setPage} label="clients" />
      </Card>

      <ClientFormDialog open={formOpen} onOpenChange={setFormOpen} client={editing} />
    </div>
  );
}

function ClientFormDialog({
  open,
  onOpenChange,
  client,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: Client | null;
}) {
  const isEdit = Boolean(client);
  const { onSuccess, onError } = useMutationHandlers();

  const [form, setForm] = useState<Partial<Client>>({});

  useEffect(() => {
    if (!open) return;
    setForm(
      client ?? {
        name: '', companyName: '', email: '', phone: '', website: '',
        status: 'ACTIVE', currency: 'INR', paymentTermsDays: 15, billingCountry: 'India',
      },
    );
  }, [open, client]);

  const set = <K extends keyof Client>(key: K, value: Client[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const save = useMutation({
    mutationFn: () =>
      isEdit && client ? clientsApi.update(client.id, form) : clientsApi.create(form),
    onSuccess: () => {
      onSuccess(isEdit ? 'Client updated' : 'Client added', [queryKeys.clients.all]);
      onOpenChange(false);
    },
    onError: (error) => onError(error, 'Could not save the client'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit client' : 'Add a client'}</DialogTitle>
          <DialogDescription>
            Billing details here pre-fill every invoice you raise for them.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-5">
          <FormSection title="Who they are">
            <FieldRow>
              <Field label="Contact name" required>
                <Input value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} placeholder="Rohan Mehta" />
              </Field>
              <Field label="Company">
                <Input value={form.companyName ?? ''} onChange={(e) => set('companyName', e.target.value)} placeholder="Nimbus Retail Pvt Ltd" />
              </Field>
            </FieldRow>

            <FieldRow>
              <Field label="Email">
                <Input type="email" value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} />
              </Field>
              <Field label="Phone">
                <Input value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} />
              </Field>
            </FieldRow>

            <FieldRow>
              <Field label="Status">
                <Select value={form.status ?? 'ACTIVE'} onValueChange={(v) => set('status', v as ClientStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((key) => (
                      <SelectItem key={key} value={key}>{key.charAt(0) + key.slice(1).toLowerCase()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Website">
                <Input value={form.website ?? ''} onChange={(e) => set('website', e.target.value)} placeholder="https://…" />
              </Field>
            </FieldRow>
          </FormSection>

          <FormSection title="Billing">
            <FieldRow>
              <Field label="Currency">
                <Select value={form.currency ?? 'INR'} onValueChange={(v) => set('currency', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD'].map((code) => (
                      <SelectItem key={code} value={code}>{code}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Payment terms (days)" hint="Drives the default due date on invoices.">
                <Input
                  type="number" min="0" max="365"
                  value={form.paymentTermsDays ?? 15}
                  onChange={(e) => set('paymentTermsDays', Number(e.target.value))}
                  className="tabular"
                />
              </Field>
            </FieldRow>

            <Field label="Tax number (GSTIN / VAT)">
              <Input value={form.taxNumber ?? ''} onChange={(e) => set('taxNumber', e.target.value)} />
            </Field>

            <Field label="Address line 1">
              <Input value={form.billingAddressLine1 ?? ''} onChange={(e) => set('billingAddressLine1', e.target.value)} />
            </Field>

            <FieldRow>
              <Field label="City">
                <Input value={form.billingCity ?? ''} onChange={(e) => set('billingCity', e.target.value)} />
              </Field>
              <Field label="State">
                <Input value={form.billingState ?? ''} onChange={(e) => set('billingState', e.target.value)} />
              </Field>
            </FieldRow>

            <FieldRow>
              <Field label="Postal code">
                <Input value={form.billingPostalCode ?? ''} onChange={(e) => set('billingPostalCode', e.target.value)} />
              </Field>
              <Field label="Country">
                <Input value={form.billingCountry ?? ''} onChange={(e) => set('billingCountry', e.target.value)} />
              </Field>
            </FieldRow>
          </FormSection>

          <Field label="Notes">
            <Textarea rows={3} value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
          </Field>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={!form.name?.trim()}
            loading={save.isPending}
            onClick={() => save.mutate()}
          >
            {isEdit ? 'Save changes' : 'Add client'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
