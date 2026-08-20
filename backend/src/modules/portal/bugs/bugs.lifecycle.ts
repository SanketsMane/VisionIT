import { BugStatus } from '@prisma/client';

/**
 * The bug lifecycle, encoded as an explicit transition table.
 *
 * The spec calls for a real lifecycle rather than a free-text status field, so
 * illegal jumps (SUBMITTED straight to CLOSED, or reopening a duplicate) are
 * rejected at the service layer instead of being merely discouraged in the UI.
 */
export const ALLOWED_TRANSITIONS: Record<BugStatus, BugStatus[]> = {
  [BugStatus.SUBMITTED]: [
    BugStatus.ACKNOWLEDGED,
    BugStatus.REJECTED,
    BugStatus.DUPLICATE,
    BugStatus.CANNOT_REPRODUCE,
    BugStatus.DEFERRED,
  ],
  [BugStatus.ACKNOWLEDGED]: [
    BugStatus.ASSIGNED,
    BugStatus.IN_PROGRESS,
    BugStatus.REJECTED,
    BugStatus.DUPLICATE,
    BugStatus.CANNOT_REPRODUCE,
    BugStatus.DEFERRED,
  ],
  [BugStatus.ASSIGNED]: [
    BugStatus.IN_PROGRESS,
    BugStatus.ACKNOWLEDGED,
    BugStatus.DEFERRED,
    BugStatus.CANNOT_REPRODUCE,
  ],
  [BugStatus.IN_PROGRESS]: [
    BugStatus.FIXED,
    BugStatus.ASSIGNED,
    BugStatus.DEFERRED,
    BugStatus.CANNOT_REPRODUCE,
  ],
  [BugStatus.FIXED]: [BugStatus.READY_FOR_RETEST, BugStatus.IN_PROGRESS],
  [BugStatus.READY_FOR_RETEST]: [
    BugStatus.RETESTED,
    // A failed retest sends it straight back to the developer.
    BugStatus.IN_PROGRESS,
  ],
  [BugStatus.RETESTED]: [BugStatus.CLOSED, BugStatus.IN_PROGRESS],
  [BugStatus.CLOSED]: [
    // Reopening is allowed — regressions happen.
    BugStatus.ACKNOWLEDGED,
  ],
  [BugStatus.REJECTED]: [BugStatus.ACKNOWLEDGED],
  [BugStatus.DUPLICATE]: [BugStatus.ACKNOWLEDGED],
  [BugStatus.CANNOT_REPRODUCE]: [BugStatus.ACKNOWLEDGED, BugStatus.SUBMITTED],
  [BugStatus.DEFERRED]: [BugStatus.ACKNOWLEDGED, BugStatus.ASSIGNED, BugStatus.IN_PROGRESS],
};

export const canTransition = (from: BugStatus, to: BugStatus): boolean =>
  from === to || (ALLOWED_TRANSITIONS[from]?.includes(to) ?? false);

export const nextStatuses = (from: BugStatus): BugStatus[] => ALLOWED_TRANSITIONS[from] ?? [];

/** Statuses a client-side tester may set themselves. */
export const CLIENT_SETTABLE: BugStatus[] = [
  BugStatus.READY_FOR_RETEST,
  BugStatus.RETESTED,
  BugStatus.CLOSED,
];

/** Terminal states — a bug here needs no further work. */
export const RESOLVED_STATUSES: BugStatus[] = [
  BugStatus.CLOSED,
  BugStatus.REJECTED,
  BugStatus.DUPLICATE,
  BugStatus.CANNOT_REPRODUCE,
];

export const OPEN_STATUSES: BugStatus[] = [
  BugStatus.SUBMITTED,
  BugStatus.ACKNOWLEDGED,
  BugStatus.ASSIGNED,
  BugStatus.IN_PROGRESS,
  BugStatus.FIXED,
  BugStatus.READY_FOR_RETEST,
  BugStatus.RETESTED,
];

export const STATUS_LABELS: Record<BugStatus, string> = {
  [BugStatus.SUBMITTED]: 'Submitted',
  [BugStatus.ACKNOWLEDGED]: 'Acknowledged',
  [BugStatus.ASSIGNED]: 'Assigned',
  [BugStatus.IN_PROGRESS]: 'In progress',
  [BugStatus.FIXED]: 'Fixed',
  [BugStatus.READY_FOR_RETEST]: 'Ready for retest',
  [BugStatus.RETESTED]: 'Retested',
  [BugStatus.CLOSED]: 'Closed',
  [BugStatus.REJECTED]: 'Rejected',
  [BugStatus.DUPLICATE]: 'Duplicate',
  [BugStatus.CANNOT_REPRODUCE]: 'Cannot reproduce',
  [BugStatus.DEFERRED]: 'Deferred',
};

/** Which notification a transition should fire, if any. */
export const STATUS_EVENT: Partial<
  Record<BugStatus, 'bug.acknowledged' | 'bug.fixed' | 'bug.closed' | 'bug.rejected' | 'bug.retest_requested' | 'bug.status_changed'>
> = {
  [BugStatus.ACKNOWLEDGED]: 'bug.acknowledged',
  [BugStatus.FIXED]: 'bug.fixed',
  [BugStatus.READY_FOR_RETEST]: 'bug.retest_requested',
  [BugStatus.CLOSED]: 'bug.closed',
  [BugStatus.REJECTED]: 'bug.rejected',
  [BugStatus.DUPLICATE]: 'bug.rejected',
  [BugStatus.CANNOT_REPRODUCE]: 'bug.rejected',
};
