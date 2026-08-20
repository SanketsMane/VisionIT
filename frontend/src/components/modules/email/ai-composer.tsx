'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Bot, RefreshCw, Send, Sparkles, Wand2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogBody, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/misc';
import { Field, FieldRow } from '@/components/shared/form-field';
import { aiApi, emailApi, type ComposeInput } from '@/lib/api/email.api';
import { clientsApi } from '@/lib/api/clients.api';
import { invoicesApi } from '@/lib/api/invoices.api';
import { projectsApi } from '@/lib/api/projects.api';
import { queryKeys } from '@/lib/hooks/query-keys';
import { useMutationHandlers } from '@/lib/hooks/use-mutation-toast';
import { humanize } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { AiTone, EmailPurpose } from '@/types';

/** Splits a comma/semicolon/space separated list into clean addresses. */
const parseAddresses = (value: string): string[] =>
  value
    .split(/[,;\s]+/)
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.includes('@'));

export function AiEmailComposer({
  open,
  onOpenChange,
  presetClientId,
  presetInvoiceId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presetClientId?: string;
  presetInvoiceId?: string;
}) {
  const { onSuccess, onError } = useMutationHandlers();

  // ── Context the AI is allowed to reference ────────────────────────────────
  const [clientId, setClientId] = useState('');
  const [invoiceId, setInvoiceId] = useState('');
  const [projectId, setProjectId] = useState('');

  // ── Generation controls ───────────────────────────────────────────────────
  const [purpose, setPurpose] = useState<EmailPurpose>('PAYMENT_REMINDER');
  const [tone, setTone] = useState<AiTone>('PROFESSIONAL');
  const [lengthHint, setLengthHint] = useState<'short' | 'medium' | 'detailed'>('medium');
  const [instructions, setInstructions] = useState('');
  const [language, setLanguage] = useState('English');

  // ── The draft itself ──────────────────────────────────────────────────────
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [alternatives, setAlternatives] = useState<string[]>([]);
  const [attachPdf, setAttachPdf] = useState(false);
  const [improveInstruction, setImproveInstruction] = useState('');
  const [tab, setTab] = useState('generate');

  useEffect(() => {
    if (!open) return;
    setClientId(presetClientId ?? '');
    setInvoiceId(presetInvoiceId ?? '');
    setProjectId('');
    setSubject('');
    setBodyHtml('');
    setAlternatives([]);
    setImproveInstruction('');
    setTab('generate');
    setAttachPdf(Boolean(presetInvoiceId));
    if (presetInvoiceId) setPurpose('INVOICE_DELIVERY');
  }, [open, presetClientId, presetInvoiceId]);

  const aiOptions = useQuery({
    queryKey: queryKeys.ai.options,
    queryFn: aiApi.options,
    enabled: open,
  });

  const aiUsage = useQuery({
    queryKey: queryKeys.ai.usage({}),
    queryFn: () => aiApi.usage(),
    enabled: open,
  });

  const clients = useQuery({
    queryKey: queryKeys.clients.list({ limit: 100 }),
    queryFn: () => clientsApi.list({ limit: 100 }),
    enabled: open,
  });

  const invoices = useQuery({
    queryKey: queryKeys.invoices.list({ limit: 50, clientId: clientId || undefined }),
    queryFn: () => invoicesApi.list({ limit: 50, clientId: clientId || undefined }),
    enabled: open && Boolean(clientId),
  });

  const projects = useQuery({
    queryKey: queryKeys.projects.list({ limit: 50, clientId: clientId || undefined }),
    queryFn: () => projectsApi.list({ limit: 50, clientId: clientId || undefined }),
    enabled: open && Boolean(clientId),
  });

  const templates = useQuery({
    queryKey: queryKeys.email.templates,
    queryFn: emailApi.templates,
    enabled: open,
  });

  // Choosing a client pre-fills the recipient from their contact details.
  useEffect(() => {
    if (!clientId) return;
    const client = clients.data?.items.find((item) => item.id === clientId);
    if (client?.email) setTo(client.email);
  }, [clientId, clients.data]);

  const aiEnabled = aiUsage.data?.isConfigured ?? true;

  const generate = useMutation({
    mutationFn: () =>
      aiApi.generateEmail({
        purpose,
        tone,
        lengthHint,
        language,
        instructions: instructions.trim() || undefined,
        clientId: clientId || undefined,
        invoiceId: invoiceId || undefined,
        projectId: projectId || undefined,
      }),
    onSuccess: (result) => {
      setSubject(result.email.subject);
      setBodyHtml(result.email.bodyHtml);
      setAlternatives(result.email.subjectAlternatives);
      setTab('draft');
      toast.success('Draft ready', {
        description: `${result.usage.totalTokens} tokens · $${result.usage.costUsd.toFixed(4)}`,
      });
    },
    onError: (error) => onError(error, 'Could not generate the email'),
  });

  const improve = useMutation({
    mutationFn: () =>
      aiApi.improveEmail({
        subject,
        bodyHtml,
        instruction: improveInstruction.trim(),
        tone,
      }),
    onSuccess: (result) => {
      setSubject(result.email.subject);
      setBodyHtml(result.email.bodyHtml);
      setAlternatives(result.email.subjectAlternatives);
      setImproveInstruction('');
      toast.success('Draft rewritten');
    },
    onError: (error) => onError(error, 'Could not rewrite the draft'),
  });

  const suggestSubjects = useMutation({
    mutationFn: () => aiApi.suggestSubjects({ bodyHtml, purpose }),
    onSuccess: (result) => {
      setAlternatives(result.subjects);
      toast.success('Subject lines suggested');
    },
    onError: (error) => onError(error, 'Could not suggest subjects'),
  });

  const applyTemplate = useMutation({
    mutationFn: (templateId: string) =>
      emailApi.renderTemplate(templateId, {
        clientId: clientId || undefined,
        invoiceId: invoiceId || undefined,
        projectId: projectId || undefined,
      }),
    onSuccess: (result) => {
      setSubject(result.subject);
      setBodyHtml(result.bodyHtml);
      setTab('draft');
      toast.success('Template applied with your data merged in');
    },
    onError: (error) => onError(error, 'Could not apply the template'),
  });

  const buildPayload = (): ComposeInput => ({
    toAddresses: parseAddresses(to),
    ccAddresses: parseAddresses(cc),
    subject: subject.trim(),
    bodyHtml,
    purpose,
    clientId: clientId || null,
    invoiceId: invoiceId || null,
    aiGenerated: true,
    attachInvoicePdf: attachPdf && Boolean(invoiceId),
  });

  const saveDraft = useMutation({
    mutationFn: () => emailApi.saveDraft(buildPayload()),
    onSuccess: () => {
      onSuccess('Draft saved', [queryKeys.email.all]);
      onOpenChange(false);
    },
    onError: (error) => onError(error, 'Could not save the draft'),
  });

  const sendNow = useMutation({
    mutationFn: () => emailApi.composeAndSend(buildPayload()),
    onSuccess: () => {
      onSuccess('Email sent', [queryKeys.email.all]);
      onOpenChange(false);
    },
    onError: (error) => onError(error, 'Could not send the email'),
  });

  const recipients = parseAddresses(to);
  const canSend = recipients.length > 0 && subject.trim().length > 0 && bodyHtml.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            Compose with AI
          </DialogTitle>
          <DialogDescription>
            The model only sees the client, invoice and project you attach — it is instructed never to
            invent figures, dates or commitments.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="generate"><Bot /> Generate</TabsTrigger>
              <TabsTrigger value="draft"><Wand2 /> Draft &amp; send</TabsTrigger>
            </TabsList>

            {/* ── Generate ──────────────────────────────────────────────── */}
            <TabsContent value="generate" className="space-y-5">
              {!aiEnabled && (
                <div className="rounded-lg border border-warning/40 bg-warning-muted/50 p-3 text-xs">
                  <p className="font-medium">AI generation is not configured</p>
                  <p className="mt-0.5 text-muted-foreground">
                    Add <code className="font-mono">OPENAI_API_KEY</code> to the backend environment to enable it.
                    You can still write emails by hand or start from a template.
                  </p>
                </div>
              )}

              <div className="grid gap-4 lg:grid-cols-3">
                <Field label="Client" hint="Gives the AI the recipient's name.">
                  <Select value={clientId || 'none'} onValueChange={(v) => setClientId(v === 'none' ? '' : v)}>
                    <SelectTrigger><SelectValue placeholder="No client" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No client</SelectItem>
                      {clients.data?.items.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.companyName ?? client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Invoice" hint="Supplies real numbers, dates and balances.">
                  <Select
                    value={invoiceId || 'none'}
                    onValueChange={(v) => setInvoiceId(v === 'none' ? '' : v)}
                    disabled={!clientId}
                  >
                    <SelectTrigger><SelectValue placeholder="No invoice" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No invoice</SelectItem>
                      {invoices.data?.items.map((invoice) => (
                        <SelectItem key={invoice.id} value={invoice.id}>
                          {invoice.number} · {invoice.status.toLowerCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Project" hint="Adds project context to the prompt.">
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
              </div>

              <Field label="What kind of email is this?">
                <div className="flex flex-wrap gap-1.5">
                  {(aiOptions.data?.purposes ?? []).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setPurpose(option.value as EmailPurpose)}
                      title={option.description}
                      className={cn(
                        'rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors',
                        purpose === option.value
                          ? 'border-primary bg-primary-muted text-primary'
                          : 'border-border hover:bg-accent',
                      )}
                    >
                      {humanize(option.value)}
                    </button>
                  ))}
                </div>
              </Field>

              <FieldRow className="lg:grid-cols-3">
                <Field label="Tone">
                  <Select value={tone} onValueChange={(v) => setTone(v as AiTone)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(aiOptions.data?.tones ?? []).map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {humanize(option.value)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Length">
                  <Select value={lengthHint} onValueChange={(v) => setLengthHint(v as typeof lengthHint)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="short">Short — 2 paragraphs</SelectItem>
                      <SelectItem value="medium">Medium — 3 paragraphs</SelectItem>
                      <SelectItem value="detailed">Detailed — with a list</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Language">
                  <Input value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="English" />
                </Field>
              </FieldRow>

              <Field
                label="Anything specific to say?"
                hint="These instructions take priority over the general purpose guidance."
              >
                <Textarea
                  rows={3}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Mention that the scope grew after the second review call, and offer a 15-minute call this week."
                />
              </Field>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  loading={generate.isPending}
                  disabled={!aiEnabled}
                  onClick={() => generate.mutate()}
                >
                  <Sparkles /> Generate draft
                </Button>

                {templates.data && templates.data.length > 0 && (
                  <Select onValueChange={(id) => applyTemplate.mutate(id)}>
                    <SelectTrigger className="w-auto min-w-[200px]">
                      <SelectValue placeholder="…or start from a template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.data.map((template) => (
                        <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {aiUsage.data && (
                  <span className="ml-auto text-[11px] text-muted-foreground">
                    {aiUsage.data.model} · {aiUsage.data.totalRequests} calls this month ·
                    ${aiUsage.data.totalCostUsd.toFixed(4)}
                  </span>
                )}
              </div>
            </TabsContent>

            {/* ── Draft ─────────────────────────────────────────────────── */}
            <TabsContent value="draft" className="space-y-4">
              <FieldRow>
                <Field label="To" required hint="Comma separated for multiple recipients.">
                  <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="client@example.com" />
                </Field>
                <Field label="Cc">
                  <Input value={cc} onChange={(e) => setCc(e.target.value)} placeholder="Optional" />
                </Field>
              </FieldRow>

              <Field label="Subject" required>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject line" />
              </Field>

              {alternatives.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-muted-foreground">Alternatives:</span>
                  {alternatives.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setSubject(option)}
                      className="rounded-full border border-border px-2 py-0.5 text-[11px] transition-colors hover:bg-accent"
                    >
                      {option}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setAlternatives([])}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                    aria-label="Dismiss alternatives"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              )}

              <div className="grid gap-4 lg:grid-cols-2">
                <Field label="Body (HTML)" hint="Semantic HTML — <p>, <ul>, <strong>.">
                  <Textarea
                    rows={16}
                    value={bodyHtml}
                    onChange={(e) => setBodyHtml(e.target.value)}
                    className="font-mono text-xs"
                    placeholder="<p>Hi there,</p>"
                  />
                </Field>

                <Field label="Preview">
                  <div className="h-[368px] overflow-y-auto rounded-lg border border-border bg-white p-5 scrollbar-slim">
                    {bodyHtml ? (
                      <div
                        className="text-sm leading-relaxed text-slate-900 [&_a]:text-indigo-600 [&_li]:ml-4 [&_li]:list-disc [&_p]:mb-3 [&_strong]:font-semibold [&_ul]:mb-3"
                        // Server-sanitised on generation; this is the author's
                        // own draft rendering into their own preview pane.
                        dangerouslySetInnerHTML={{ __html: bodyHtml }}
                      />
                    ) : (
                      <p className="text-xs text-slate-400">Your draft will render here.</p>
                    )}
                  </div>
                </Field>
              </div>

              {bodyHtml && (
                <div className="space-y-2 rounded-lg border border-border p-3">
                  <p className="text-xs font-medium">Rewrite with AI</p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'Make it shorter',
                      'Make it warmer',
                      'Make it more direct',
                      'Add a clear call to action',
                      'Make it more formal',
                    ].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        disabled={!aiEnabled || improve.isPending}
                        onClick={() => {
                          setImproveInstruction(preset);
                          improve.mutate();
                        }}
                        className="rounded-full border border-border px-2.5 py-1 text-[11px] transition-colors hover:bg-accent disabled:opacity-50"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={improveInstruction}
                      onChange={(e) => setImproveInstruction(e.target.value)}
                      placeholder="…or describe the change you want"
                      className="h-8"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!aiEnabled || !improveInstruction.trim()}
                      loading={improve.isPending}
                      onClick={() => improve.mutate()}
                    >
                      <RefreshCw /> Rewrite
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!aiEnabled}
                      loading={suggestSubjects.isPending}
                      onClick={() => suggestSubjects.mutate()}
                    >
                      Subjects
                    </Button>
                  </div>
                </div>
              )}

              {invoiceId && (
                <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <p className="text-xs font-medium">Attach the invoice PDF</p>
                    <p className="text-[11px] text-muted-foreground">
                      Rendered fresh at send time from the current invoice data.
                    </p>
                  </div>
                  <Switch checked={attachPdf} onCheckedChange={setAttachPdf} />
                </label>
              )}

              {recipients.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-muted-foreground">Sending to:</span>
                  {recipients.map((address) => (
                    <Badge key={address} variant="primary" size="sm">{address}</Badge>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="secondary"
            disabled={!subject.trim() || !bodyHtml.trim()}
            loading={saveDraft.isPending}
            onClick={() => saveDraft.mutate()}
          >
            Save draft
          </Button>
          <Button disabled={!canSend} loading={sendNow.isPending} onClick={() => sendNow.mutate()}>
            <Send /> Send now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
