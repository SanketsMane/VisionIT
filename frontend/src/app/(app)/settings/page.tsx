'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Bot, Building2, CheckCircle2, Mail, Plus, ShieldCheck, Trash2, User, XCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input, Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogBody, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/misc';
import { PageHeader, SectionHeader } from '@/components/shared/page-header';
import { Field, FieldRow, FormSection } from '@/components/shared/form-field';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { EmptyState } from '@/components/shared/empty-state';
import { settingsApi } from '@/lib/api/settings.api';
import { emailApi } from '@/lib/api/email.api';
import { aiApi } from '@/lib/api/email.api';
import { authApi } from '@/lib/api/auth.api';
import { queryKeys } from '@/lib/hooks/query-keys';
import { useMutationHandlers } from '@/lib/hooks/use-mutation-toast';
import { useAuthStore } from '@/store/auth.store';
import { formatDateTime } from '@/lib/format';
import type { CompanyProfile, EmailAccount } from '@/types';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Your business profile, mailboxes and preferences." />

      <Tabs defaultValue="company">
        <TabsList>
          <TabsTrigger value="company"><Building2 /> Business</TabsTrigger>
          <TabsTrigger value="profile"><User /> Profile</TabsTrigger>
          <TabsTrigger value="email"><Mail /> Email</TabsTrigger>
          <TabsTrigger value="ai"><Bot /> AI</TabsTrigger>
          <TabsTrigger value="security"><ShieldCheck /> Security</TabsTrigger>
        </TabsList>

        <TabsContent value="company"><CompanyTab /></TabsContent>
        <TabsContent value="profile"><ProfileTab /></TabsContent>
        <TabsContent value="email"><EmailTab /></TabsContent>
        <TabsContent value="ai"><AiTab /></TabsContent>
        <TabsContent value="security"><SecurityTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function CompanyTab() {
  const { onSuccess, onError } = useMutationHandlers();
  const [form, setForm] = useState<Partial<CompanyProfile>>({});

  const company = useQuery({ queryKey: queryKeys.settings.company, queryFn: settingsApi.company });
  const reference = useQuery({ queryKey: queryKeys.settings.reference, queryFn: settingsApi.reference });

  useEffect(() => {
    if (company.data) setForm(company.data);
  }, [company.data]);

  const set = <K extends keyof CompanyProfile>(key: K, value: CompanyProfile[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const save = useMutation({
    mutationFn: () => settingsApi.updateCompany(form),
    onSuccess: () => onSuccess('Business profile updated', [queryKeys.settings.company]),
    onError: (error) => onError(error, 'Could not save'),
  });

  if (company.isLoading) return <Skeleton className="h-96" />;

  return (
    <Card>
      <SectionHeader
        title="Business profile"
        description="These details appear on every invoice and quotation you issue."
        actions={<Button loading={save.isPending} onClick={() => save.mutate()}>Save changes</Button>}
      />
      <CardContent className="space-y-6 p-5">
        <FormSection title="Identity">
          <FieldRow>
            <Field label="Legal name" required>
              <Input value={form.legalName ?? ''} onChange={(e) => set('legalName', e.target.value)} />
            </Field>
            <Field label="Trading name" hint="Shown on invoices if set.">
              <Input value={form.tradeName ?? ''} onChange={(e) => set('tradeName', e.target.value)} />
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
          <Field label="Website">
            <Input value={form.website ?? ''} onChange={(e) => set('website', e.target.value)} placeholder="https://…" />
          </Field>
          <FieldRow>
            <Field label="Logo URL" hint="Rendered at the top of every invoice.">
              <Input value={form.logoUrl ?? ''} onChange={(e) => set('logoUrl', e.target.value)} />
            </Field>
            <Field label="Signature image URL">
              <Input value={form.signatureUrl ?? ''} onChange={(e) => set('signatureUrl', e.target.value)} />
            </Field>
          </FieldRow>
        </FormSection>

        <FormSection title="Registered address">
          <Field label="Address line 1">
            <Input value={form.addressLine1 ?? ''} onChange={(e) => set('addressLine1', e.target.value)} />
          </Field>
          <Field label="Address line 2">
            <Input value={form.addressLine2 ?? ''} onChange={(e) => set('addressLine2', e.target.value)} />
          </Field>
          <FieldRow>
            <Field label="City"><Input value={form.city ?? ''} onChange={(e) => set('city', e.target.value)} /></Field>
            <Field label="State"><Input value={form.state ?? ''} onChange={(e) => set('state', e.target.value)} /></Field>
          </FieldRow>
          <FieldRow>
            <Field label="Postal code"><Input value={form.postalCode ?? ''} onChange={(e) => set('postalCode', e.target.value)} /></Field>
            <Field label="Country"><Input value={form.country ?? ''} onChange={(e) => set('country', e.target.value)} /></Field>
          </FieldRow>
        </FormSection>

        <FormSection title="Tax registration">
          <FieldRow>
            <Field label="Tax label" hint="GSTIN, VAT, ABN…">
              <Input value={form.taxLabel ?? ''} onChange={(e) => set('taxLabel', e.target.value)} />
            </Field>
            <Field label="Tax number">
              <Input value={form.taxNumber ?? ''} onChange={(e) => set('taxNumber', e.target.value)} />
            </Field>
          </FieldRow>
          <Field label="PAN">
            <Input value={form.panNumber ?? ''} onChange={(e) => set('panNumber', e.target.value)} />
          </Field>
        </FormSection>

        <FormSection title="Bank details" description="Printed in the payment panel on your invoices.">
          <FieldRow>
            <Field label="Bank name"><Input value={form.bankName ?? ''} onChange={(e) => set('bankName', e.target.value)} /></Field>
            <Field label="Account name"><Input value={form.bankAccountName ?? ''} onChange={(e) => set('bankAccountName', e.target.value)} /></Field>
          </FieldRow>
          <FieldRow>
            <Field label="Account number"><Input value={form.bankAccountNumber ?? ''} onChange={(e) => set('bankAccountNumber', e.target.value)} /></Field>
            <Field label="IFSC"><Input value={form.bankIfsc ?? ''} onChange={(e) => set('bankIfsc', e.target.value)} /></Field>
          </FieldRow>
          <FieldRow>
            <Field label="SWIFT"><Input value={form.bankSwift ?? ''} onChange={(e) => set('bankSwift', e.target.value)} /></Field>
            <Field label="UPI ID"><Input value={form.upiId ?? ''} onChange={(e) => set('upiId', e.target.value)} /></Field>
          </FieldRow>
        </FormSection>

        <FormSection title="Defaults">
          <FieldRow>
            <Field label="Base currency" hint="Used for all reports.">
              <Select value={form.baseCurrency ?? 'INR'} onValueChange={(v) => set('baseCurrency', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {reference.data?.currencies.map((currency) => (
                    <SelectItem key={currency.code} value={currency.code}>
                      {currency.symbol} {currency.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Fiscal year starts" hint="Drives the reporting year boundary.">
              <Select
                value={String(form.fiscalYearStartMonth ?? 4)}
                onValueChange={(v) => set('fiscalYearStartMonth', Number(v))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {reference.data?.fiscalYearStartMonths.map((option) => (
                    <SelectItem key={option.value} value={String(option.value)}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FieldRow>

          <FieldRow>
            <Field label="Default tax rate (%)">
              <Input
                type="number" step="0.01" min="0" max="100"
                value={form.defaultTaxRate ?? 18}
                onChange={(e) => set('defaultTaxRate', Number(e.target.value))}
                className="tabular"
              />
            </Field>
            <Field label="Default payment terms (days)">
              <Input
                type="number" min="0" max="365"
                value={form.defaultPaymentTerms ?? 15}
                onChange={(e) => set('defaultPaymentTerms', Number(e.target.value))}
                className="tabular"
              />
            </Field>
          </FieldRow>

          <Field label="Invoice footer note">
            <Input value={form.invoiceFooterNote ?? ''} onChange={(e) => set('invoiceFooterNote', e.target.value)} />
          </Field>

          <Field label="Default terms & conditions">
            <Textarea rows={4} value={form.defaultTerms ?? ''} onChange={(e) => set('defaultTerms', e.target.value)} />
          </Field>
        </FormSection>
      </CardContent>
    </Card>
  );
}

function ProfileTab() {
  const { onSuccess, onError } = useMutationHandlers();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const [form, setForm] = useState({ name: '', phone: '', designation: '', timezone: '' });

  const reference = useQuery({ queryKey: queryKeys.settings.reference, queryFn: settingsApi.reference });

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name,
        phone: user.phone ?? '',
        designation: user.designation ?? '',
        timezone: user.timezone,
      });
    }
  }, [user]);

  const save = useMutation({
    mutationFn: () => settingsApi.updateProfile(form),
    onSuccess: (updated) => {
      setUser(updated);
      onSuccess('Profile updated');
    },
    onError: (error) => onError(error, 'Could not save'),
  });

  return (
    <Card>
      <SectionHeader
        title="Your profile"
        description="How you appear on invoices and in email sign-offs."
        actions={<Button loading={save.isPending} onClick={() => save.mutate()}>Save changes</Button>}
      />
      <CardContent className="space-y-4 p-5">
        <FieldRow>
          <Field label="Full name" required>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Email" hint="Changing your sign-in email is not supported yet.">
            <Input value={user?.email ?? ''} disabled />
          </Field>
        </FieldRow>

        <FieldRow>
          <Field label="Phone">
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Designation">
            <Input
              value={form.designation}
              onChange={(e) => setForm({ ...form, designation: e.target.value })}
              placeholder="Full Stack Developer"
            />
          </Field>
        </FieldRow>

        <Field label="Timezone">
          <Select value={form.timezone} onValueChange={(v) => setForm({ ...form, timezone: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {reference.data?.timezones.map((zone) => (
                <SelectItem key={zone} value={zone}>{zone}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </CardContent>
    </Card>
  );
}

function EmailTab() {
  const { onSuccess, onError } = useMutationHandlers();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EmailAccount | null>(null);

  const accounts = useQuery({ queryKey: queryKeys.email.accounts, queryFn: emailApi.accounts });

  const verify = useMutation({
    mutationFn: (id: string) => emailApi.verifyAccount(id),
    onSuccess: () => onSuccess('Mailbox verified — SMTP connection works', [queryKeys.email.accounts]),
    onError: (error) => onError(error, 'Verification failed'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => emailApi.removeAccount(id),
    onSuccess: () => onSuccess('Mailbox removed', [queryKeys.email.accounts]),
    onError: (error) => onError(error, 'Could not remove'),
  });

  return (
    <Card>
      <SectionHeader
        title="Sending mailboxes"
        description="Emails are sent from your own SMTP account, so replies come back to you."
        actions={
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus /> Add mailbox
          </Button>
        }
      />
      <CardContent className="p-0">
        {accounts.isLoading ? (
          <Skeleton className="m-4 h-24" />
        ) : !accounts.data?.length ? (
          <EmptyState
            icon={Mail}
            title="No mailbox configured"
            description="Add an SMTP mailbox to send client emails. For Gmail, create an App Password first."
            action={
              <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
                <Plus /> Add mailbox
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {accounts.data.map((account) => (
              <li key={account.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{account.label}</p>
                    {account.isDefault && <Badge variant="primary" size="sm">Default</Badge>}
                    <Badge variant={account.isVerified ? 'success' : 'warning'} size="sm" className="gap-1">
                      {account.isVerified ? <CheckCircle2 /> : <XCircle />}
                      {account.isVerified ? 'Verified' : 'Unverified'}
                    </Badge>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {account.fromName} &lt;{account.fromEmail}&gt;
                    {account.smtpHost ? ` · ${account.smtpHost}:${account.smtpPort}` : ''}
                  </p>
                  {account.lastError && (
                    <p className="mt-0.5 truncate text-[11px] text-danger">{account.lastError}</p>
                  )}
                </div>

                <div className="flex shrink-0 gap-1.5">
                  <Button
                    variant="outline" size="sm"
                    loading={verify.isPending && verify.variables === account.id}
                    onClick={() => verify.mutate(account.id)}
                  >
                    Test connection
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { setEditing(account); setDialogOpen(true); }}>
                    Edit
                  </Button>
                  <ConfirmDialog
                    trigger={
                      <Button variant="ghost" size="icon-sm" aria-label="Remove mailbox">
                        <Trash2 className="text-danger" />
                      </Button>
                    }
                    title={`Remove ${account.label}?`}
                    description="Emails already sent from it are kept."
                    confirmLabel="Remove"
                    onConfirm={() => remove.mutateAsync(account.id)}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <MailboxDialog open={dialogOpen} onOpenChange={setDialogOpen} account={editing} />
    </Card>
  );
}

function MailboxDialog({
  open,
  onOpenChange,
  account,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: EmailAccount | null;
}) {
  const isEdit = Boolean(account);
  const { onSuccess, onError } = useMutationHandlers();
  type MailboxForm = Partial<EmailAccount> & { smtpPassword?: string; apiKey?: string };
  const [form, setForm] = useState<MailboxForm>({});

  useEffect(() => {
    if (!open) return;
    setForm(
      account
        ? { ...account, smtpPassword: '', apiKey: '' }
        : {
            label: '', provider: 'SMTP', fromName: '', fromEmail: '',
            smtpHost: 'smtp.gmail.com', smtpPort: 465, smtpSecure: true,
            smtpUser: '', smtpPassword: '', apiKey: '', isDefault: true,
          },
    );
  }, [open, account]);

  const set = <K extends keyof MailboxForm>(key: K, value: MailboxForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const isResend = form.provider === 'RESEND';

  const save = useMutation({
    mutationFn: () =>
      isEdit && account ? emailApi.updateAccount(account.id, form) : emailApi.createAccount(form),
    onSuccess: () => {
      onSuccess(isEdit ? 'Mailbox updated' : 'Mailbox added', [queryKeys.email.accounts]);
      onOpenChange(false);
    },
    onError: (error) => onError(error, 'Could not save the mailbox'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit mailbox' : 'Add a mailbox'}</DialogTitle>
          <DialogDescription>
            Send over your own SMTP, or via a Resend API key. Either way the credential is encrypted
            with AES-256-GCM before it touches the database and is never returned by the API.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <FieldRow>
            <Field label="Label" required hint="Just for you — e.g. 'Business Gmail'.">
              <Input value={form.label ?? ''} onChange={(e) => set('label', e.target.value)} />
            </Field>
            <Field label="Provider">
              <Select value={form.provider ?? 'SMTP'} onValueChange={(v) => set('provider', v as EmailAccount['provider'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SMTP">SMTP</SelectItem>
                  <SelectItem value="GMAIL">Gmail (SMTP)</SelectItem>
                  <SelectItem value="RESEND">Resend (API)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </FieldRow>

          <FieldRow>
            <Field label="From name" required>
              <Input value={form.fromName ?? ''} onChange={(e) => set('fromName', e.target.value)} placeholder="Sanket Patil" />
            </Field>
            <Field label="From email" required>
              <Input type="email" value={form.fromEmail ?? ''} onChange={(e) => set('fromEmail', e.target.value)} />
            </Field>
          </FieldRow>

          {isResend ? (
            <>
              <Field
                label={isEdit ? 'New API key' : 'Resend API key'}
                required={!isEdit}
                hint={
                  isEdit
                    ? 'Leave blank to keep the current key.'
                    : 'From resend.com → API Keys. Encrypted before storage.'
                }
              >
                <Input
                  type="password"
                  value={form.apiKey ?? ''}
                  onChange={(e) => set('apiKey', e.target.value)}
                  placeholder="re_xxxxxxxxxxxxxxxxxxxxxxxx"
                />
              </Field>

              <div className="rounded-lg border border-info/30 bg-info-muted/40 p-3">
                <p className="text-xs font-medium">Verify your domain to email clients</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Resend&apos;s shared <code className="font-mono">onboarding@resend.dev</code> sender only
                  delivers to the address that owns the Resend account. Add and verify your own domain,
                  then set the From address above to something like{' '}
                  <code className="font-mono">billing@yourdomain.com</code>.
                </p>
              </div>
            </>
          ) : (
            <>
              <FieldRow>
                <Field label="SMTP host" required>
                  <Input value={form.smtpHost ?? ''} onChange={(e) => set('smtpHost', e.target.value)} placeholder="smtp.gmail.com" />
                </Field>
                <Field label="Port" hint="465 for SSL, 587 for STARTTLS.">
                  <Input
                    type="number"
                    value={form.smtpPort ?? 465}
                    onChange={(e) => set('smtpPort', Number(e.target.value))}
                    className="tabular"
                  />
                </Field>
              </FieldRow>

              <FieldRow>
                <Field label="SMTP username" required>
                  <Input value={form.smtpUser ?? ''} onChange={(e) => set('smtpUser', e.target.value)} />
                </Field>
                <Field
                  label={isEdit ? 'New password' : 'Password'}
                  hint={isEdit ? 'Leave blank to keep the current one.' : 'Gmail requires an App Password.'}
                >
                  <Input
                    type="password"
                    value={form.smtpPassword ?? ''}
                    onChange={(e) => set('smtpPassword', e.target.value)}
                    placeholder="••••••••••••"
                  />
                </Field>
              </FieldRow>

              <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-xs font-medium">Use SSL</p>
                  <p className="text-[11px] text-muted-foreground">On for port 465, off for 587.</p>
                </div>
                <Switch checked={form.smtpSecure ?? true} onCheckedChange={(v) => set('smtpSecure', v)} />
              </label>
            </>
          )}

          <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-xs font-medium">Default mailbox</p>
              <p className="text-[11px] text-muted-foreground">Used when no mailbox is chosen explicitly.</p>
            </div>
            <Switch checked={form.isDefault ?? false} onCheckedChange={(v) => set('isDefault', v)} />
          </label>

          <Field label="Signature (HTML)" hint="Appended to every email sent from this mailbox.">
            <Textarea
              rows={3}
              value={form.signatureHtml ?? ''}
              onChange={(e) => set('signatureHtml', e.target.value)}
              className="font-mono text-xs"
              placeholder="<p><strong>Sanket Patil</strong><br/>Vision IT Infra</p>"
            />
          </Field>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button loading={save.isPending} onClick={() => save.mutate()}>
            {isEdit ? 'Save changes' : 'Add mailbox'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AiTab() {
  const usage = useQuery({ queryKey: queryKeys.ai.usage({}), queryFn: () => aiApi.usage() });

  return (
    <div className="space-y-4">
      <Card>
        <SectionHeader title="AI email writer" description="Powered by OpenAI, configured on the server." />
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-xs font-medium">Status</p>
              <p className="text-[11px] text-muted-foreground">
                {usage.data?.isConfigured
                  ? `Active — using ${usage.data.model}`
                  : 'Not configured. Add OPENAI_API_KEY to the backend environment.'}
              </p>
            </div>
            <Badge variant={usage.data?.isConfigured ? 'success' : 'warning'}>
              {usage.data?.isConfigured ? 'Enabled' : 'Disabled'}
            </Badge>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border p-3">
              <p className="text-[11px] text-muted-foreground">Requests this month</p>
              <p className="mt-0.5 text-lg font-semibold tabular">{usage.data?.totalRequests ?? 0}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[11px] text-muted-foreground">Tokens used</p>
              <p className="mt-0.5 text-lg font-semibold tabular">
                {(usage.data?.totalTokens ?? 0).toLocaleString('en-IN')}
              </p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[11px] text-muted-foreground">Estimated cost</p>
              <p className="mt-0.5 text-lg font-semibold tabular">
                ${(usage.data?.totalCostUsd ?? 0).toFixed(4)}
              </p>
            </div>
          </div>

          {(usage.data?.byFeature.length ?? 0) > 0 && (
            <div className="rounded-lg border border-border">
              <p className="border-b border-border px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                By feature
              </p>
              <ul className="divide-y divide-border">
                {usage.data?.byFeature.map((feature) => (
                  <li key={feature.feature} className="flex items-center justify-between px-3 py-2 text-xs">
                    <span className="font-mono">{feature.feature}</span>
                    <span className="text-muted-foreground tabular">
                      {feature.requests} calls · {feature.tokens.toLocaleString('en-IN')} tokens · ${feature.costUsd.toFixed(4)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SecurityTab() {
  const { onSuccess, onError } = useMutationHandlers();
  const logout = useAuthStore((state) => state.logout);
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });

  const sessions = useQuery({ queryKey: ['sessions'], queryFn: authApi.sessions });

  const change = useMutation({
    mutationFn: () => authApi.changePassword(passwords),
    onSuccess: async () => {
      onSuccess('Password updated — signing you out of all devices');
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
      await logout();
      window.location.href = '/login';
    },
    onError: (error) => onError(error, 'Could not change your password'),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => authApi.revokeSession(id),
    onSuccess: () => onSuccess('Session revoked', [['sessions']]),
    onError: (error) => onError(error, 'Could not revoke'),
  });

  const canSubmit =
    passwords.currentPassword.length > 0 &&
    passwords.newPassword.length >= 8 &&
    passwords.newPassword === passwords.confirmPassword;

  return (
    <div className="space-y-4">
      <Card>
        <SectionHeader title="Change password" description="You'll be signed out of every device afterwards." />
        <CardContent className="space-y-4 p-5">
          <Field label="Current password" required>
            <Input
              type="password"
              value={passwords.currentPassword}
              onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
            />
          </Field>
          <FieldRow>
            <Field label="New password" required hint="At least 8 characters with upper, lower and a number.">
              <Input
                type="password"
                value={passwords.newPassword}
                onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
              />
            </Field>
            <Field
              label="Confirm new password"
              required
              error={
                passwords.confirmPassword && passwords.newPassword !== passwords.confirmPassword
                  ? 'Passwords do not match'
                  : undefined
              }
            >
              <Input
                type="password"
                value={passwords.confirmPassword}
                onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
              />
            </Field>
          </FieldRow>
          <Button disabled={!canSubmit} loading={change.isPending} onClick={() => change.mutate()}>
            Update password
          </Button>
        </CardContent>
      </Card>

      <Card>
        <SectionHeader title="Active sessions" description="Devices currently signed in to your workspace." />
        <CardContent className="p-0">
          {sessions.isLoading ? (
            <Skeleton className="m-4 h-20" />
          ) : !sessions.data?.length ? (
            <EmptyState title="No other active sessions" className="py-10" />
          ) : (
            <ul className="divide-y divide-border">
              {sessions.data.map((session) => (
                <li key={session.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">{session.userAgent ?? 'Unknown device'}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {session.ipAddress ?? 'Unknown IP'} · started {formatDateTime(session.createdAt)}
                    </p>
                  </div>
                  <Button
                    variant="outline" size="sm"
                    loading={revoke.isPending && revoke.variables === session.id}
                    onClick={() => revoke.mutate(session.id)}
                  >
                    Revoke
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
