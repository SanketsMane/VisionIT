import { Badge, type BadgeProps } from '@/components/ui/badge';
import { humanize } from '@/lib/format';
import type {
  BugPriority, BugSeverity, BugStatus, DocumentVisibility,
  InvitationStatus, PaymentRequestStatus, ProjectDeliveryStatus, ProjectRole,
} from '@/types/portal';

type Variant = NonNullable<BadgeProps['variant']>;

/**
 * One place that decides what colour every portal status is, so "critical"
 * looks the same on the QA board, the bug page and the project overview.
 */

const BUG_STATUS: Record<BugStatus, Variant> = {
  SUBMITTED: 'info',
  ACKNOWLEDGED: 'primary',
  ASSIGNED: 'primary',
  IN_PROGRESS: 'warning',
  FIXED: 'success',
  READY_FOR_RETEST: 'warning',
  RETESTED: 'success',
  CLOSED: 'default',
  REJECTED: 'danger',
  DUPLICATE: 'default',
  CANNOT_REPRODUCE: 'default',
  DEFERRED: 'outline',
};

export const BUG_STATUS_LABELS: Record<BugStatus, string> = {
  SUBMITTED: 'Submitted',
  ACKNOWLEDGED: 'Acknowledged',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In progress',
  FIXED: 'Fixed',
  READY_FOR_RETEST: 'Ready for retest',
  RETESTED: 'Retested',
  CLOSED: 'Closed',
  REJECTED: 'Rejected',
  DUPLICATE: 'Duplicate',
  CANNOT_REPRODUCE: 'Cannot reproduce',
  DEFERRED: 'Deferred',
};

const PRIORITY: Record<BugPriority, Variant> = {
  LOW: 'outline',
  MEDIUM: 'info',
  HIGH: 'warning',
  CRITICAL: 'danger',
};

const SEVERITY: Record<BugSeverity, Variant> = {
  COSMETIC: 'outline',
  MINOR: 'default',
  MAJOR: 'info',
  CRITICAL: 'warning',
  BLOCKER: 'danger',
};

const PAYMENT_REQUEST: Record<PaymentRequestStatus, Variant> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'default',
};

const INVITATION: Record<InvitationStatus, Variant> = {
  PENDING: 'warning',
  ACCEPTED: 'success',
  EXPIRED: 'default',
  REVOKED: 'danger',
};

const DELIVERY: Record<ProjectDeliveryStatus, Variant> = {
  NOT_STARTED: 'outline',
  PREPARING: 'info',
  READY_FOR_CLIENT: 'primary',
  CLIENT_REVIEWING: 'warning',
  OWNERSHIP_TRANSFER: 'warning',
  DELIVERED: 'success',
  COMPLETED: 'success',
};

const ROLE: Record<ProjectRole, Variant> = {
  CLIENT_OWNER: 'primary',
  CLIENT_MANAGER: 'info',
  TESTER: 'warning',
  VIEWER: 'outline',
  INTERNAL_MEMBER: 'success',
};

export const ROLE_LABELS: Record<ProjectRole, string> = {
  CLIENT_OWNER: 'Client Owner',
  CLIENT_MANAGER: 'Client Manager',
  TESTER: 'Tester',
  VIEWER: 'Viewer',
  INTERNAL_MEMBER: 'Internal Member',
};

export const DELIVERY_LABELS: Record<ProjectDeliveryStatus, string> = {
  NOT_STARTED: 'Not started',
  PREPARING: 'Preparing delivery',
  READY_FOR_CLIENT: 'Ready for client',
  CLIENT_REVIEWING: 'Client reviewing',
  OWNERSHIP_TRANSFER: 'Ownership transfer',
  DELIVERED: 'Delivered',
  COMPLETED: 'Completed',
};

export const BugStatusBadge = ({ status, size }: { status: BugStatus; size?: BadgeProps['size'] }) => (
  <Badge variant={BUG_STATUS[status] ?? 'default'} size={size}>{BUG_STATUS_LABELS[status]}</Badge>
);

export const PriorityBadge = ({ priority, size }: { priority: BugPriority; size?: BadgeProps['size'] }) => (
  <Badge variant={PRIORITY[priority] ?? 'default'} size={size}>{humanize(priority)}</Badge>
);

export const SeverityBadge = ({ severity, size }: { severity: BugSeverity; size?: BadgeProps['size'] }) => (
  <Badge variant={SEVERITY[severity] ?? 'default'} size={size}>{humanize(severity)}</Badge>
);

export const PaymentRequestBadge = ({ status, size }: { status: PaymentRequestStatus; size?: BadgeProps['size'] }) => (
  <Badge variant={PAYMENT_REQUEST[status] ?? 'default'} size={size}>{humanize(status)}</Badge>
);

export const InvitationBadge = ({ status, size }: { status: InvitationStatus; size?: BadgeProps['size'] }) => (
  <Badge variant={INVITATION[status] ?? 'default'} size={size}>{humanize(status)}</Badge>
);

export const DeliveryBadge = ({ status, size }: { status: ProjectDeliveryStatus; size?: BadgeProps['size'] }) => (
  <Badge variant={DELIVERY[status] ?? 'default'} size={size}>{DELIVERY_LABELS[status]}</Badge>
);

export const RoleBadge = ({ role, size }: { role: ProjectRole; size?: BadgeProps['size'] }) => (
  <Badge variant={ROLE[role] ?? 'default'} size={size}>{ROLE_LABELS[role]}</Badge>
);

export const VisibilityBadge = ({ visibility }: { visibility: DocumentVisibility }) => (
  <Badge variant={visibility === 'CLIENT_VISIBLE' ? 'success' : 'outline'} size="sm">
    {visibility === 'CLIENT_VISIBLE' ? 'Shared with client' : 'Internal only'}
  </Badge>
);

/** Traffic-light project health, computed server-side. */
export function HealthBadge({ status }: { status: 'ON_TRACK' | 'AT_RISK' | 'DELAYED' }) {
  const map = {
    ON_TRACK: { variant: 'success' as Variant, label: 'On track', dot: '🟢' },
    AT_RISK: { variant: 'warning' as Variant, label: 'At risk', dot: '🟡' },
    DELAYED: { variant: 'danger' as Variant, label: 'Delayed', dot: '🔴' },
  };
  const meta = map[status];
  return <Badge variant={meta.variant} className="gap-1">{meta.dot} {meta.label}</Badge>;
}
