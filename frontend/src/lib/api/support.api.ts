import { del, get, post, put } from './client';

export type SupportPlan = 'BASIC' | 'STANDARD' | 'PREMIUM' | 'CUSTOM';

export type SupportState =
  | 'NOT_CONFIGURED'
  | 'SCHEDULED'
  | 'ACTIVE'
  | 'EXPIRING_SOON'
  | 'EXPIRED'
  | 'CANCELLED';

/**
 * What the countdown renders from.
 *
 * `serverTime` is paired with `endDate` on purpose: the browser ticks the
 * clock locally so there is no polling, but a machine with a skewed clock
 * would then show the wrong answer. Measuring the offset against the server's
 * own time once, at load, keeps the display honest.
 */
export interface SupportSummary {
  state: SupportState;
  stateLabel: string;
  planLabel: string;
  startDate: string | null;
  endDate: string | null;
  serverTime: string;
  daysRemaining: number | null;
  msRemaining: number;
  totalDays: number | null;
  percentElapsed: number;
  durationMonths: number | null;
  renewalCount: number;
  inclusions: string[];
  responseTime: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  /** Studio-only; absent from client responses. */
  notes?: string | null;
}

export interface SupportPayload {
  plan: SupportPlan;
  planLabel?: string | null;
  startDate: string;
  durationMonths: number;
  inclusions: string[];
  responseTime?: string | null;
  supportEmail?: string | null;
  supportPhone?: string | null;
  notes?: string | null;
}

export interface SupportListRow {
  project: {
    id: string;
    title: string;
    code: string | null;
    client: { id: string; name: string; companyName: string | null } | null;
  };
  support: SupportSummary;
}

export const supportApi = {
  list: () => get<SupportListRow[]>('/support'),
  get: (projectId: string) => get<SupportSummary>(`/support/${projectId}`),
  save: (projectId: string, payload: SupportPayload) =>
    put<SupportSummary>(`/support/${projectId}`, payload),
  renew: (projectId: string, payload: { months: number; restartFromToday?: boolean }) =>
    post<SupportSummary>(`/support/${projectId}/renew`, payload),
  cancel: (projectId: string, reason?: string) =>
    post<SupportSummary>(`/support/${projectId}/cancel`, { reason }),
  remove: (projectId: string) => del<null>(`/support/${projectId}`),
};

export const SUPPORT_PLAN_OPTIONS: { value: SupportPlan; label: string }[] = [
  { value: 'BASIC', label: 'Basic Support' },
  { value: 'STANDARD', label: 'Standard Support' },
  { value: 'PREMIUM', label: 'Premium Support' },
  { value: 'CUSTOM', label: 'Custom' },
];
