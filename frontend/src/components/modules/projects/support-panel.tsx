'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Check, Eye, Pencil, Plus, RotateCw, ShieldCheck, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogBody, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { queryKeys } from '@/lib/hooks/query-keys';
import { formatDate } from '@/lib/format';
import { ApiRequestError } from '@/lib/api/client';
import {
  SUPPORT_PLAN_OPTIONS, supportApi,
  type SupportPayload, type SupportPlan, type SupportSummary,
} from '@/lib/api/support.api';
import { SupportCountdown } from '@/components/modules/portal/support-countdown';
import { cn } from '@/lib/utils';

/** Common terms, so the usual case is one click rather than typing "12". */
const DURATIONS = [3, 6, 12, 24, 36];

/** Sensible starting point for a new term; the admin edits from here. */
const DEFAULT_INCLUSIONS = [
  'Bug fixes and stability patches',
  'Security and dependency updates',
  'Email support during business hours',
];

const toDateInput = (iso: string | null): string => (iso ? iso.slice(0, 10) : '');

const STATE_BADGE: Record<string, 'success' | 'warning' | 'danger' | 'primary' | 'outline'> = {
  ACTIVE: 'success',
  EXPIRING_SOON: 'warning',
  EXPIRED: 'danger',
  CANCELLED: 'danger',
  SCHEDULED: 'primary',
  NOT_CONFIGURED: 'outline',
};

/**
 * The studio's control over a project's technical support term.
 *
 * The client sees a live countdown built from exactly these values, so the
 * preview of the resulting end date is shown while editing — an admin should
 * never have to save and then go and look at the portal to check they picked
 * the right duration.
 */
export function SupportPanel({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [renewOpen, setRenewOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const { data: support, isLoading } = useQuery({
    queryKey: queryKeys.portal.support(projectId),
    queryFn: () => supportApi.get(projectId),
    enabled: Boolean(projectId),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.portal.support(projectId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.portal.workspace(projectId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.portal.supportList });
  };

  const remove = useMutation({
    mutationFn: () => supportApi.remove(projectId),
    onSuccess: () => {
      toast.success('Support term removed');
      invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Could not remove it'),
  });

  const configured = support && support.state !== 'NOT_CONFIGURED';

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-lg bg-primary-muted text-primary">
              <ShieldCheck className="size-4" />
            </span>
            <div>
              <p className="text-sm font-semibold leading-tight">Technical support</p>
              <p className="text-[11px] text-muted-foreground">
                {configured
                  ? 'The client sees a live countdown of this in their portal'
                  : 'Not set up for this project'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {configured && support && (
              <Badge variant={STATE_BADGE[support.state] ?? 'outline'} size="sm">
                {support.stateLabel}
              </Badge>
            )}
            {configured ? (
              <>
                <Button variant="outline" size="sm" onClick={() => setRenewOpen(true)}>
                  <RotateCw /> Renew
                </Button>
                <Button variant="outline" size="icon-sm" aria-label="Edit support" onClick={() => setEditOpen(true)}>
                  <Pencil />
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Remove support"
                  disabled={remove.isPending}
                  onClick={() => {
                    if (window.confirm('Remove the support term? The client will stop seeing the countdown.')) {
                      remove.mutate();
                    }
                  }}
                >
                  <Trash2 />
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={() => setEditOpen(true)} disabled={isLoading}>
                <Plus /> Set up support
              </Button>
            )}
          </div>
        </div>

        {configured && support && (
          <>
            <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-3 sm:grid-cols-4">
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Plan</dt>
                <dd className="mt-0.5 truncate text-xs font-semibold">{support.planLabel}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Starts</dt>
                <dd className="mt-0.5 text-xs font-semibold">{formatDate(support.startDate)}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Ends</dt>
                <dd className="mt-0.5 text-xs font-semibold">{formatDate(support.endDate)}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Remaining</dt>
                <dd
                  className={cn(
                    'mt-0.5 text-xs font-semibold',
                    support.state === 'EXPIRING_SOON' && 'text-warning',
                    (support.state === 'EXPIRED' || support.state === 'CANCELLED') && 'text-danger',
                  )}
                >
                  {support.state === 'EXPIRED' || support.state === 'CANCELLED'
                    ? '—'
                    : `${Math.max(0, support.daysRemaining ?? 0)} days`}
                </dd>
              </div>
            </dl>

            {(support.renewalCount > 0 || support.notes) && (
              <div className="mt-3 space-y-1 border-t border-border pt-3 text-[11px] text-muted-foreground">
                {support.renewalCount > 0 && (
                  <p>Renewed {support.renewalCount} time{support.renewalCount === 1 ? '' : 's'}.</p>
                )}
                {support.notes && <p className="whitespace-pre-wrap">Internal note: {support.notes}</p>}
              </div>
            )}

            {/* The exact component the client sees, fed the same data. Worth
                the duplication: the inclusions and wording are being sold, and
                checking them shouldn't mean logging in as the client. */}
            <div className="mt-4 border-t border-border pt-3">
              <button
                type="button"
                onClick={() => setPreviewOpen((open) => !open)}
                className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                aria-expanded={previewOpen}
              >
                <Eye className="size-3.5" />
                {previewOpen ? 'Hide' : 'Show'} what the client sees
              </button>

              {previewOpen && (
                <div className="mt-3 rounded-xl bg-muted/40 p-3">
                  <SupportCountdown support={support} />
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>

      <SupportForm
        projectId={projectId}
        support={support}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={invalidate}
      />

      <RenewDialog
        projectId={projectId}
        support={support}
        open={renewOpen}
        onOpenChange={setRenewOpen}
        onSaved={invalidate}
      />
    </Card>
  );
}

function SupportForm({
  projectId, support, open, onOpenChange, onSaved,
}: {
  projectId: string;
  support: SupportSummary | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(support && support.state !== 'NOT_CONFIGURED');

  const [plan, setPlan] = useState<SupportPlan>('STANDARD');
  const [planLabel, setPlanLabel] = useState('');
  const [startDate, setStartDate] = useState('');
  const [months, setMonths] = useState(12);
  const [inclusions, setInclusions] = useState<string[]>(DEFAULT_INCLUSIONS);
  const [draftInclusion, setDraftInclusion] = useState('');
  const [responseTime, setResponseTime] = useState('Within 24 business hours');
  const [supportEmail, setSupportEmail] = useState('');
  const [supportPhone, setSupportPhone] = useState('');
  const [notes, setNotes] = useState('');

  // Re-seed each time the dialog opens so a cancelled edit doesn't leave stale
  // values behind for the next one.
  useEffect(() => {
    if (!open) return;
    if (isEdit && support) {
      setPlan((SUPPORT_PLAN_OPTIONS.find((o) => o.label === support.planLabel)?.value) ?? 'CUSTOM');
      setPlanLabel(support.planLabel ?? '');
      setStartDate(toDateInput(support.startDate));
      setMonths(support.durationMonths ?? 12);
      setInclusions(support.inclusions);
      setResponseTime(support.responseTime ?? '');
      setSupportEmail(support.supportEmail ?? '');
      setSupportPhone(support.supportPhone ?? '');
      setNotes(support.notes ?? '');
    } else {
      setPlan('STANDARD');
      setPlanLabel('');
      setStartDate(new Date().toISOString().slice(0, 10));
      setMonths(12);
      setInclusions(DEFAULT_INCLUSIONS);
      setResponseTime('Within 24 business hours');
      setSupportEmail('');
      setSupportPhone('');
      setNotes('');
    }
    setDraftInclusion('');
  }, [open, isEdit, support]);

  // Mirrors the server's rule exactly: start + N months, to the end of that day.
  const endPreview = useMemo(() => {
    if (!startDate) return null;
    const date = new Date(`${startDate}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return null;
    date.setUTCMonth(date.getUTCMonth() + months);
    return date;
  }, [startDate, months]);

  const save = useMutation({
    mutationFn: (payload: SupportPayload) => supportApi.save(projectId, payload),
    onSuccess: () => {
      toast.success(isEdit ? 'Support term updated' : 'Support is now active — the client has been notified');
      onSaved();
      onOpenChange(false);
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiRequestError ? error.message : 'Could not save the support term',
      ),
  });

  const addInclusion = () => {
    const value = draftInclusion.trim();
    if (!value || inclusions.includes(value)) return;
    setInclusions([...inclusions, value]);
    setDraftInclusion('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit technical support' : 'Set up technical support'}</DialogTitle>
          <DialogDescription>
            The client sees a live countdown of this in their portal, and is emailed before it expires.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="support-plan">Plan</Label>
              <Select value={plan} onValueChange={(value) => setPlan(value as SupportPlan)}>
                <SelectTrigger id="support-plan"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SUPPORT_PLAN_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="support-label">Display name (optional)</Label>
              <Input
                id="support-label"
                value={planLabel}
                onChange={(e) => setPlanLabel(e.target.value)}
                placeholder="e.g. 1 Year Warranty & Support"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="support-start">Support start date</Label>
            <Input
              id="support-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              Usually the go-live or handover date.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Duration</Label>
            <div className="flex flex-wrap gap-1.5">
              {DURATIONS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMonths(value)}
                  className={cn(
                    'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                    months === value
                      ? 'border-primary bg-primary-muted text-primary'
                      : 'border-border text-muted-foreground hover:text-foreground',
                  )}
                >
                  {value === 12 ? '1 year' : value === 24 ? '2 years' : value === 36 ? '3 years' : `${value} months`}
                </button>
              ))}
              <Input
                type="number"
                min={1}
                max={120}
                value={months}
                onChange={(e) => setMonths(Number(e.target.value) || 1)}
                className="h-8 w-20 text-xs"
                aria-label="Custom duration in months"
              />
            </div>

            {endPreview && (
              <p className="mt-1.5 flex items-center gap-1.5 rounded-lg bg-muted px-3 py-2 text-[11px] text-muted-foreground">
                <CalendarClock className="size-3.5 shrink-0" />
                Support will run until <strong className="text-foreground">{formatDate(endPreview.toISOString())}</strong>
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>What&apos;s covered</Label>
            <p className="text-[11px] text-muted-foreground">
              Listed on the client&apos;s support card, so they know what to expect.
            </p>
            <div className="space-y-1.5">
              {inclusions.map((item) => (
                <div key={item} className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5">
                  <Check className="size-3.5 shrink-0 text-success" />
                  <span className="flex-1 text-xs">{item}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${item}`}
                    className="text-muted-foreground hover:text-danger"
                    onClick={() => setInclusions(inclusions.filter((i) => i !== item))}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={draftInclusion}
                onChange={(e) => setDraftInclusion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); addInclusion(); }
                }}
                placeholder="Add another item"
              />
              <Button type="button" variant="outline" onClick={addInclusion}>Add</Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="support-sla">Response time</Label>
              <Input
                id="support-sla"
                value={responseTime}
                onChange={(e) => setResponseTime(e.target.value)}
                placeholder="Within 24 business hours"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="support-email">Support email</Label>
              <Input
                id="support-email"
                type="email"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                placeholder="support@visionitinfra.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="support-phone">Support phone</Label>
              <Input
                id="support-phone"
                value={supportPhone}
                onChange={(e) => setSupportPhone(e.target.value)}
                placeholder="+91 …"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="support-notes">Internal note</Label>
            <Textarea
              id="support-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Only your team sees this — never shown to the client."
            />
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={!startDate || save.isPending}
            onClick={() =>
              save.mutate({
                plan,
                planLabel: planLabel.trim() || null,
                startDate,
                durationMonths: months,
                inclusions,
                responseTime: responseTime.trim() || null,
                supportEmail: supportEmail.trim() || null,
                supportPhone: supportPhone.trim() || null,
                notes: notes.trim() || null,
              })
            }
          >
            {save.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Activate support'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RenewDialog({
  projectId, support, open, onOpenChange, onSaved,
}: {
  projectId: string;
  support: SupportSummary | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [months, setMonths] = useState(12);
  const hasLapsed = support?.state === 'EXPIRED' || support?.state === 'CANCELLED';
  const [restart, setRestart] = useState(false);

  useEffect(() => {
    if (open) {
      setMonths(12);
      // A lapsed term almost always restarts from today; a live one is being
      // topped up and should continue from where it ends.
      setRestart(hasLapsed);
    }
  }, [open, hasLapsed]);

  const renew = useMutation({
    mutationFn: () => supportApi.renew(projectId, { months, restartFromToday: restart }),
    onSuccess: (result) => {
      toast.success(`Support extended to ${formatDate(result.endDate)}`);
      onSaved();
      onOpenChange(false);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Could not renew'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Renew technical support</DialogTitle>
          <DialogDescription>
            {restart
              ? 'The new term starts today.'
              : `Continues from ${support?.endDate ? formatDate(support.endDate) : 'the current end date'}, so there is no gap in cover.`}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="space-y-1.5">
            <Label>Extend by</Label>
            <div className="flex flex-wrap gap-1.5">
              {DURATIONS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMonths(value)}
                  className={cn(
                    'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                    months === value
                      ? 'border-primary bg-primary-muted text-primary'
                      : 'border-border text-muted-foreground hover:text-foreground',
                  )}
                >
                  {value === 12 ? '1 year' : `${value} months`}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-start gap-2.5 rounded-lg border border-border p-3">
            <input
              type="checkbox"
              checked={restart}
              onChange={(e) => setRestart(e.target.checked)}
              className="mt-0.5 size-4 accent-[var(--color-primary)]"
            />
            <span className="text-xs">
              <span className="font-medium">Start the new term today</span>
              <span className="mt-0.5 block text-[11px] text-muted-foreground">
                Leave off to continue from the current end date and avoid an uncovered gap.
              </span>
            </span>
          </label>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={renew.isPending} onClick={() => renew.mutate()}>
            {renew.isPending ? 'Renewing…' : 'Renew support'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
