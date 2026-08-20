import { Badge, type BadgeProps } from '@/components/ui/badge';
import { humanize } from '@/lib/format';
import type { ClientStatus, EmailStatus, InvoiceStatus, ProjectStatus } from '@/types';

type Variant = NonNullable<BadgeProps['variant']>;

/**
 * One place that decides what colour a status is. Keeping this centralised
 * means "overdue" is the same red everywhere it appears — list, detail, PDF
 * sidebar — instead of drifting per screen.
 */
const INVOICE_VARIANTS: Record<InvoiceStatus, Variant> = {
  DRAFT: 'outline',
  SENT: 'info',
  VIEWED: 'primary',
  PARTIALLY_PAID: 'warning',
  PAID: 'success',
  OVERDUE: 'danger',
  CANCELLED: 'default',
  WRITTEN_OFF: 'default',
};

const PROJECT_VARIANTS: Record<ProjectStatus, Variant> = {
  LEAD: 'outline',
  PLANNING: 'info',
  IN_PROGRESS: 'primary',
  ON_HOLD: 'warning',
  COMPLETED: 'success',
  MAINTENANCE: 'info',
  CANCELLED: 'danger',
};

const CLIENT_VARIANTS: Record<ClientStatus, Variant> = {
  ACTIVE: 'success',
  PROSPECT: 'info',
  INACTIVE: 'default',
  ARCHIVED: 'outline',
};

const EMAIL_VARIANTS: Record<EmailStatus, Variant> = {
  DRAFT: 'outline',
  QUEUED: 'info',
  SENDING: 'warning',
  SENT: 'success',
  FAILED: 'danger',
  BOUNCED: 'danger',
};

export function InvoiceStatusBadge({ status, size }: { status: InvoiceStatus; size?: BadgeProps['size'] }) {
  return <Badge variant={INVOICE_VARIANTS[status] ?? 'default'} size={size}>{humanize(status)}</Badge>;
}

export function ProjectStatusBadge({ status, size }: { status: ProjectStatus; size?: BadgeProps['size'] }) {
  return <Badge variant={PROJECT_VARIANTS[status] ?? 'default'} size={size}>{humanize(status)}</Badge>;
}

export function ClientStatusBadge({ status, size }: { status: ClientStatus; size?: BadgeProps['size'] }) {
  return <Badge variant={CLIENT_VARIANTS[status] ?? 'default'} size={size}>{humanize(status)}</Badge>;
}

export function EmailStatusBadge({ status, size }: { status: EmailStatus; size?: BadgeProps['size'] }) {
  return <Badge variant={EMAIL_VARIANTS[status] ?? 'default'} size={size}>{humanize(status)}</Badge>;
}

export const CATEGORY_LABELS: Record<string, string> = {
  WEB_DEVELOPMENT: 'Web',
  ANDROID_APP: 'Android',
  IOS_APP: 'iOS',
  CROSS_PLATFORM_APP: 'Cross-platform',
  AI_ML: 'AI / ML',
  DATA_ENGINEERING: 'Data',
  DEVOPS_CLOUD: 'DevOps',
  UI_UX_DESIGN: 'Design',
  BLOCKCHAIN: 'Blockchain',
  DESKTOP_APP: 'Desktop',
  OTHER: 'Other',
};

export function CategoryBadge({ category }: { category: string }) {
  return <Badge variant="outline">{CATEGORY_LABELS[category] ?? humanize(category)}</Badge>;
}
