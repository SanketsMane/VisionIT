import { SupportPlan } from '@prisma/client';

/**
 * The live state of a support term.
 *
 * Derived on every read rather than stored, because all but `CANCELLED` are a
 * function of the clock — a stored status would be wrong the moment nobody
 * looked at it, and the countdown in the portal would disagree with the badge
 * next to it.
 */
export type SupportState =
  | 'NOT_CONFIGURED'
  | 'SCHEDULED'
  | 'ACTIVE'
  | 'EXPIRING_SOON'
  | 'EXPIRED'
  | 'CANCELLED';

/** A term is "expiring soon" inside this window, which also drives reminders. */
export const EXPIRING_SOON_DAYS = 30;

/** Days before expiry that a warning email goes out, plus the day it lapses. */
export const REMINDER_DAYS = [30, 7, 1] as const;

export const SUPPORT_PLAN_LABELS: Record<SupportPlan, string> = {
  [SupportPlan.BASIC]: 'Basic Support',
  [SupportPlan.STANDARD]: 'Standard Support',
  [SupportPlan.PREMIUM]: 'Premium Support',
  [SupportPlan.CUSTOM]: 'Support',
};

export const SUPPORT_STATE_LABELS: Record<SupportState, string> = {
  NOT_CONFIGURED: 'Not set up',
  SCHEDULED: 'Starts soon',
  ACTIVE: 'Active',
  EXPIRING_SOON: 'Expiring soon',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled',
};

/**
 * What the portal needs to render a ticking countdown.
 *
 * `serverTime` is the important field: the browser computes the remaining time
 * itself so the display ticks without polling, but a machine with a wrong
 * clock would then show a wrong answer. Sending our own clock alongside the
 * deadline lets the client measure the offset once and stay correct.
 */
export interface SupportSummary {
  state: SupportState;
  stateLabel: string;
  planLabel: string;
  startDate: string | null;
  endDate: string | null;
  serverTime: string;
  /** Whole days left, floored. Negative once expired. */
  daysRemaining: number | null;
  /** Milliseconds left, for the second-by-second display. Never negative. */
  msRemaining: number;
  totalDays: number | null;
  /** 0–100. How much of the term has been used. */
  percentElapsed: number;
  durationMonths: number | null;
  renewalCount: number;
  inclusions: string[];
  responseTime: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  /** Studio-only. Omitted entirely from client responses. */
  notes?: string | null;
}
