'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { GripVertical, Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import {
  Dialog, DialogBody, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/misc';
import { Field, FieldRow } from '@/components/shared/form-field';
import { Money } from '@/components/shared/money';
import { invoicesApi, type InvoiceInput, type InvoiceItemInput } from '@/lib/api/invoices.api';
import { clientsApi } from '@/lib/api/clients.api';
import { projectsApi } from '@/lib/api/projects.api';
import { settingsApi } from '@/lib/api/settings.api';
import { queryKeys } from '@/lib/hooks/query-keys';
import { useMutationHandlers } from '@/lib/hooks/use-mutation-toast';
import { cn } from '@/lib/utils';
import type { DocumentType, Invoice, TemplateKey } from '@/types';

const emptyItem = (sortOrder: number): InvoiceItemInput => ({
  title: '',
  description: '',
  hsnSac: '',
  quantity: 1,
  unit: 'nos',
  unitPrice: 0,
  discountPercent: 0,
  taxRate: 18,
  sortOrder,
});

const ACCENTS = ['#0076FF', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#0F172A'];

const todayInput = () => new Date().toISOString().slice(0, 10);

export function InvoiceBuilder({
  open,
  onOpenChange,
  invoice,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice?: Invoice | null;
  onSaved?: (invoice: Invoice) => void;
}) {
  const isEdit = Boolean(invoice);
  const { onSuccess, onError } = useMutationHandlers();

  const [documentType, setDocumentType] = useState<DocumentType>('INVOICE');
  const [clientId, setClientId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [issueDate, setIssueDate] = useState(todayInput());
  const [dueDate, setDueDate] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [items, setItems] = useState<InvoiceItemInput[]>([emptyItem(0)]);
  const [discountType, setDiscountType] = useState<'NONE' | 'PERCENTAGE' | 'FIXED'>('NONE');
  const [discountValue, setDiscountValue] = useState(0);
  const [shippingAmount, setShippingAmount] = useState(0);
  const [isInterState, setIsInterState] = useState(false);
  const [taxInclusive, setTaxInclusive] = useState(false);
  const [roundOffTotal, setRoundOffTotal] = useState(false);
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [templateKey, setTemplateKey] = useState<TemplateKey>('modern');
  const [accentColor, setAccentColor] = useState('#0076FF');

  const company = useQuery({
    queryKey: queryKeys.settings.company,
    queryFn: settingsApi.company,
    enabled: open,
  });

  const clients = useQuery({
    queryKey: queryKeys.clients.list({ limit: 100 }),
    queryFn: () => clientsApi.list({ limit: 100 }),
    enabled: open,
  });

  const projects = useQuery({
    queryKey: queryKeys.projects.list({ limit: 100, clientId: clientId || undefined }),
    queryFn: () => projectsApi.list({ limit: 100, clientId: clientId || undefined }),
    enabled: open && Boolean(clientId),
  });

  const templates = useQuery({
    queryKey: queryKeys.invoices.templates,
    queryFn: invoicesApi.templates,
    enabled: open,
  });

  /** Loads an existing invoice into the form, or resets to a fresh draft. */
  useEffect(() => {
    if (!open) return;

    if (invoice) {
      setDocumentType(invoice.documentType);
      setClientId(invoice.clientId);
      setProjectId(invoice.projectId ?? '');
      setCurrency(invoice.currency);
      setIssueDate(invoice.issueDate.slice(0, 10));
      setDueDate(invoice.dueDate.slice(0, 10));
      setPoNumber(invoice.poNumber ?? '');
      setItems(
        invoice.items.map((item, index) => ({
          title: item.title,
          description: item.description ?? '',
          hsnSac: item.hsnSac ?? '',
          quantity: Number(item.quantity),
          unit: item.unit,
          unitPrice: Number(item.unitPrice),
          discountPercent: Number(item.discountPercent),
          taxRate: Number(item.taxRate),
          sortOrder: item.sortOrder ?? index,
        })),
      );
      setDiscountType(invoice.discountType);
      setDiscountValue(Number(invoice.discountValue));
      setShippingAmount(Number(invoice.shippingAmount));
      setIsInterState(invoice.isInterState);
      setTaxInclusive(invoice.taxInclusive);
      setRoundOffTotal(Number(invoice.roundOff) !== 0);
      setNotes(invoice.notes ?? '');
      setTerms(invoice.terms ?? '');
      setTemplateKey(invoice.templateKey);
      setAccentColor(invoice.accentColor);
      return;
    }

    setDocumentType('INVOICE');
    setClientId('');
    setProjectId('');
    setCurrency(company.data?.baseCurrency ?? 'INR');
    setIssueDate(todayInput());
    setDueDate('');
    setPoNumber('');
    setItems([{ ...emptyItem(0), taxRate: Number(company.data?.defaultTaxRate ?? 18) }]);
    setDiscountType('NONE');
    setDiscountValue(0);
    setShippingAmount(0);
    setIsInterState(false);
    setTaxInclusive(false);
    setRoundOffTotal(false);
    setNotes('');
    setTerms(company.data?.defaultTerms ?? '');
    setTemplateKey('modern');
    setAccentColor('#0076FF');
  }, [open, invoice, company.data]);

  // Picking a client switches the currency and clears a now-unrelated project.
  const handleClientChange = (value: string) => {
    setClientId(value);
    setProjectId('');
    const client = clients.data?.items.find((item) => item.id === value);
    if (client?.currency) setCurrency(client.currency);
  };

  const updateItem = useCallback((index: number, patch: Partial<InvoiceItemInput>) => {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }, []);

  const removeItem = (index: number) =>
    setItems((current) =>
      current.length === 1
        ? current
        : current.filter((_, i) => i !== index).map((item, i) => ({ ...item, sortOrder: i })),
    );

  const payloadForTotals = useMemo(
    () => ({
      items: items.filter((item) => item.title.trim().length > 0),
      discountType,
      discountValue,
      shippingAmount,
      taxInclusive,
      isInterState,
      roundOffTotal,
    }),
    [items, discountType, discountValue, shippingAmount, taxInclusive, isInterState, roundOffTotal],
  );

  /**
   * Totals are computed *by the server* rather than duplicated here, so the
   * preview can never disagree with the saved invoice or the PDF. Debounced so
   * typing a rate doesn't fire a request per keystroke.
   */
  const [debounced, setDebounced] = useState(payloadForTotals);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(payloadForTotals), 400);
    return () => clearTimeout(timer);
  }, [payloadForTotals]);

  const totals = useQuery({
    queryKey: ['invoice-totals', debounced],
    queryFn: () => invoicesApi.previewTotals(debounced),
    enabled: open && debounced.items.length > 0,
    placeholderData: (previous) => previous,
  });

  const save = useMutation({
    mutationFn: (andSend: boolean) => {
      const payload: InvoiceInput = {
        clientId,
        projectId: projectId || null,
        documentType,
        currency,
        issueDate,
        dueDate: dueDate || undefined,
        poNumber: poNumber.trim() || null,
        items: items
          .filter((item) => item.title.trim().length > 0)
          .map((item, index) => ({ ...item, sortOrder: index })),
        discountType,
        discountValue,
        shippingAmount,
        taxInclusive,
        isInterState,
        roundOffTotal,
        notes: notes.trim() || null,
        terms: terms.trim() || null,
        templateKey,
        accentColor,
      };

      const request = isEdit && invoice
        ? invoicesApi.update(invoice.id, payload)
        : invoicesApi.create(payload);

      return andSend
        ? request.then((saved) => invoicesApi.send(saved.id))
        : request;
    },
    onSuccess: (saved) => {
      onSuccess(
        saved.status === 'DRAFT' ? 'Saved as draft' : 'Invoice issued and posted to your ledger',
        [queryKeys.invoices.all, queryKeys.dashboard.overview, queryKeys.accounts.all, queryKeys.ledger.all],
      );
      onOpenChange(false);
      onSaved?.(saved);
    },
    onError: (error) => onError(error, 'Could not save the invoice'),
  });

  const validItems = items.filter((item) => item.title.trim().length > 0);
  const canSave = Boolean(clientId) && validItems.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="full">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${invoice?.number}` : 'New invoice'}</DialogTitle>
          <DialogDescription>
            Totals are calculated by the server, so what you see here is exactly what the PDF will show.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-6">
          {/* ── Header fields ─────────────────────────────────────────── */}
          <div className="grid gap-4 lg:grid-cols-4">
            <Field label="Document type">
              <Select value={documentType} onValueChange={(v) => setDocumentType(v as DocumentType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="INVOICE">Invoice</SelectItem>
                  <SelectItem value="QUOTATION">Quotation</SelectItem>
                  <SelectItem value="PROFORMA">Proforma</SelectItem>
                  <SelectItem value="CREDIT_NOTE">Credit note</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="Client" required>
              <Select value={clientId} onValueChange={handleClientChange}>
                <SelectTrigger error={!clientId}><SelectValue placeholder="Choose a client" /></SelectTrigger>
                <SelectContent>
                  {clients.data?.items.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.companyName ?? client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Project" hint={clientId ? undefined : 'Pick a client first'}>
              <Select
                value={projectId || 'none'}
                onValueChange={(v) => setProjectId(v === 'none' ? '' : v)}
                disabled={!clientId}
              >
                <SelectTrigger><SelectValue placeholder="No project" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No project</SelectItem>
                  {projects.data?.items.map((project) => (
                    <SelectItem key={project.id} value={project.id}>{project.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Currency">
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD'].map((code) => (
                    <SelectItem key={code} value={code}>{code}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Field label="Issue date">
              <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            </Field>
            <Field
              label={documentType === 'QUOTATION' ? 'Valid until' : 'Due date'}
              hint="Leave blank to use the client's payment terms"
            >
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </Field>
            <Field label="PO number">
              <Input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder="Optional" />
            </Field>
          </div>

          {/* ── Line items ────────────────────────────────────────────── */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Line items</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setItems((current) => [...current, emptyItem(current.length)])}
              >
                <Plus /> Add line
              </Button>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border scrollbar-slim">
              <table className="w-full min-w-[860px] text-sm">
                <thead className="bg-muted/60">
                  <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="w-8 px-2 py-2" />
                    <th className="px-2 py-2 text-left font-semibold">Description</th>
                    <th className="w-24 px-2 py-2 text-left font-semibold">HSN/SAC</th>
                    <th className="w-20 px-2 py-2 text-right font-semibold">Qty</th>
                    <th className="w-20 px-2 py-2 text-left font-semibold">Unit</th>
                    <th className="w-28 px-2 py-2 text-right font-semibold">Rate</th>
                    <th className="w-20 px-2 py-2 text-right font-semibold">Disc %</th>
                    <th className="w-20 px-2 py-2 text-right font-semibold">Tax %</th>
                    <th className="w-28 px-2 py-2 text-right font-semibold">Amount</th>
                    <th className="w-10 px-2 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((item, index) => {
                    const computed = totals.data?.lines[index];
                    return (
                      <tr key={index} className="align-top">
                        <td className="px-2 py-2 text-muted-foreground">
                          <GripVertical className="size-3.5" />
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            value={item.title}
                            onChange={(e) => updateItem(index, { title: e.target.value })}
                            placeholder="What are you billing for?"
                            className="h-8"
                          />
                          <Input
                            value={item.description ?? ''}
                            onChange={(e) => updateItem(index, { description: e.target.value })}
                            placeholder="Optional detail"
                            className="mt-1 h-7 border-dashed text-xs"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            value={item.hsnSac ?? ''}
                            onChange={(e) => updateItem(index, { hsnSac: e.target.value })}
                            className="h-8"
                            placeholder="998314"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            type="number" step="0.01" min="0"
                            value={item.quantity}
                            onChange={(e) => updateItem(index, { quantity: Number(e.target.value) })}
                            className="h-8 text-right tabular"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            value={item.unit ?? 'nos'}
                            onChange={(e) => updateItem(index, { unit: e.target.value })}
                            className="h-8"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            type="number" step="0.01" min="0"
                            value={item.unitPrice}
                            onChange={(e) => updateItem(index, { unitPrice: Number(e.target.value) })}
                            className="h-8 text-right tabular"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            type="number" step="0.01" min="0" max="100"
                            value={item.discountPercent ?? 0}
                            onChange={(e) => updateItem(index, { discountPercent: Number(e.target.value) })}
                            className="h-8 text-right tabular"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            type="number" step="0.01" min="0" max="100"
                            value={item.taxRate ?? 0}
                            onChange={(e) => updateItem(index, { taxRate: Number(e.target.value) })}
                            className="h-8 text-right tabular"
                          />
                        </td>
                        <td className="px-2 py-2 text-right text-sm font-medium tabular">
                          {computed ? (
                            <Money value={computed.lineTotal} currency={currency} />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-2 py-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => removeItem(index)}
                            disabled={items.length === 1}
                            aria-label="Remove line"
                          >
                            <Trash2 className="text-danger" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Adjustments + totals ──────────────────────────────────── */}
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <FieldRow>
                <Field label="Discount type">
                  <Select value={discountType} onValueChange={(v) => setDiscountType(v as typeof discountType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">No discount</SelectItem>
                      <SelectItem value="PERCENTAGE">Percentage</SelectItem>
                      <SelectItem value="FIXED">Fixed amount</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Discount value">
                  <Input
                    type="number" step="0.01" min="0"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(Number(e.target.value))}
                    disabled={discountType === 'NONE'}
                    className="tabular"
                  />
                </Field>
              </FieldRow>

              <Field label="Shipping / other charges">
                <Input
                  type="number" step="0.01" min="0"
                  value={shippingAmount}
                  onChange={(e) => setShippingAmount(Number(e.target.value))}
                  className="tabular"
                />
              </Field>

              <div className="space-y-2 rounded-lg border border-border p-3">
                <ToggleRow
                  label="Inter-state supply (IGST)"
                  hint="Off splits tax into CGST + SGST."
                  checked={isInterState}
                  onChange={setIsInterState}
                />
                <ToggleRow
                  label="Prices include tax"
                  hint="Back-calculates the taxable value from the rate you entered."
                  checked={taxInclusive}
                  onChange={setTaxInclusive}
                />
                <ToggleRow
                  label="Round off the total"
                  hint="Rounds to the nearest whole unit and posts the difference."
                  checked={roundOffTotal}
                  onChange={setRoundOffTotal}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/40 p-4">
                {totals.isFetching && !totals.data ? (
                  <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
                    <Loader2 className="mr-2 size-3.5 animate-spin" /> Calculating…
                  </div>
                ) : (
                  <dl className="space-y-1.5 text-sm">
                    <TotalRow label="Subtotal" value={totals.data?.subtotal ?? 0} currency={currency} />
                    {(totals.data?.discountAmount ?? 0) > 0 && (
                      <TotalRow label="Discount" value={-(totals.data?.discountAmount ?? 0)} currency={currency} muted />
                    )}
                    {(totals.data?.taxAmount ?? 0) > 0 && (
                      <TotalRow label="Tax" value={totals.data?.taxAmount ?? 0} currency={currency} />
                    )}
                    {(totals.data?.shippingAmount ?? 0) > 0 && (
                      <TotalRow label="Shipping" value={totals.data?.shippingAmount ?? 0} currency={currency} />
                    )}
                    {(totals.data?.roundOff ?? 0) !== 0 && (
                      <TotalRow label="Round off" value={totals.data?.roundOff ?? 0} currency={currency} muted />
                    )}
                    <div className="flex items-center justify-between border-t border-border pt-2 text-base font-bold">
                      <dt>Total</dt>
                      <dd><Money value={totals.data?.total ?? 0} currency={currency} /></dd>
                    </div>
                  </dl>
                )}

                {(totals.data?.taxBreakdown.length ?? 0) > 0 && (
                  <div className="mt-3 border-t border-border pt-3">
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Tax breakdown
                    </p>
                    {totals.data?.taxBreakdown.map((row) => (
                      <div key={row.rate} className="flex justify-between text-[11px] text-muted-foreground tabular">
                        <span>
                          {row.rate}% on <Money value={row.taxableAmount} currency={currency} />
                        </span>
                        <span>
                          {row.igst > 0
                            ? `IGST ${row.igst.toFixed(2)}`
                            : `CGST ${row.cgst.toFixed(2)} + SGST ${row.sgst.toFixed(2)}`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Field label="Template">
                <div className="grid grid-cols-5 gap-1.5">
                  {(templates.data ?? []).map((template) => (
                    <button
                      key={template.key}
                      type="button"
                      onClick={() => setTemplateKey(template.key)}
                      title={template.description}
                      className={cn(
                        'rounded-lg border px-2 py-2 text-[11px] font-medium capitalize transition-colors',
                        templateKey === template.key
                          ? 'border-primary bg-primary-muted text-primary'
                          : 'border-border hover:bg-accent',
                      )}
                    >
                      {template.name}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Accent colour">
                <div className="flex flex-wrap gap-1.5">
                  {ACCENTS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setAccentColor(color)}
                      className={cn(
                        'size-7 rounded-full border-2 transition-transform',
                        accentColor === color ? 'scale-110 border-foreground' : 'border-transparent',
                      )}
                      style={{ backgroundColor: color }}
                      aria-label={`Accent ${color}`}
                    />
                  ))}
                  <Input
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="h-7 w-12 cursor-pointer p-0.5"
                  />
                </div>
              </Field>
            </div>
          </div>

          <FieldRow>
            <Field label="Notes" hint="Shown on the document under Notes.">
              <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
            <Field label="Terms & conditions">
              <Textarea rows={3} value={terms} onChange={(e) => setTerms(e.target.value)} />
            </Field>
          </FieldRow>
        </DialogBody>

        <DialogFooter>
          {!canSave && (
            <p className="mr-auto self-center text-[11px] text-muted-foreground">
              {!clientId ? 'Choose a client' : 'Add at least one line item'} to continue
            </p>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="secondary"
            disabled={!canSave}
            loading={save.isPending && save.variables === false}
            onClick={() => save.mutate(false)}
          >
            Save draft
          </Button>
          <Button
            disabled={!canSave}
            loading={save.isPending && save.variables === true}
            onClick={() => save.mutate(true)}
          >
            {documentType === 'INVOICE' ? 'Save & issue' : 'Save & send'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-1">
      <span className="min-w-0">
        <span className="block text-xs font-medium">{label}</span>
        <span className="block text-[11px] text-muted-foreground">{hint}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

function TotalRow({
  label,
  value,
  currency,
  muted,
}: {
  label: string;
  value: number;
  currency: string;
  muted?: boolean;
}) {
  return (
    <div className={cn('flex items-center justify-between', muted && 'text-muted-foreground')}>
      <dt>{label}</dt>
      <dd className="tabular"><Money value={value} currency={currency} /></dd>
    </div>
  );
}
