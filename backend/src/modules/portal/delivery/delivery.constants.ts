import { ProjectDeliveryStatus } from '@prisma/client';

export interface ChecklistSeed {
  key: string;
  label: string;
  isRequired: boolean;
  sortOrder: number;
}

/**
 * The default handover checklist.
 *
 * `key` is stable and machine-readable so the readiness rules can reference an
 * item without depending on its wording — an admin can reword a label without
 * silently breaking the gate that blocks delivery.
 */
export const DEFAULT_CHECKLIST: ChecklistSeed[] = [
  { key: 'source_code', label: 'Final source code prepared', isRequired: true, sortOrder: 0 },
  { key: 'production_build', label: 'Production build prepared', isRequired: true, sortOrder: 1 },
  { key: 'database_export', label: 'Database / data export prepared (if applicable)', isRequired: false, sortOrder: 2 },
  { key: 'project_docs', label: 'Project documentation uploaded', isRequired: true, sortOrder: 3 },
  { key: 'deployment_docs', label: 'Deployment documentation uploaded', isRequired: true, sortOrder: 4 },
  { key: 'credentials', label: 'Credentials / handover information prepared', isRequired: true, sortOrder: 5 },
  { key: 'final_testing', label: 'Final testing completed', isRequired: true, sortOrder: 6 },
  { key: 'critical_bugs', label: 'Critical issues resolved', isRequired: true, sortOrder: 7 },
  { key: 'payments_checked', label: 'Pending payments checked', isRequired: true, sortOrder: 8 },
  { key: 'delivery_package', label: 'Client delivery package prepared', isRequired: true, sortOrder: 9 },
  { key: 'source_handover', label: 'Source-code handover completed', isRequired: true, sortOrder: 10 },
  { key: 'ownership_transfer', label: 'Ownership transfer completed', isRequired: true, sortOrder: 11 },
];

/**
 * Delivery status progression. Kept explicit so a project can't jump from
 * "Preparing" to "Completed" and skip the client's confirmation entirely.
 */
export const DELIVERY_FLOW: Record<ProjectDeliveryStatus, ProjectDeliveryStatus[]> = {
  [ProjectDeliveryStatus.NOT_STARTED]: [ProjectDeliveryStatus.PREPARING],
  [ProjectDeliveryStatus.PREPARING]: [
    ProjectDeliveryStatus.READY_FOR_CLIENT,
    ProjectDeliveryStatus.NOT_STARTED,
  ],
  [ProjectDeliveryStatus.READY_FOR_CLIENT]: [
    ProjectDeliveryStatus.CLIENT_REVIEWING,
    ProjectDeliveryStatus.PREPARING,
  ],
  [ProjectDeliveryStatus.CLIENT_REVIEWING]: [
    ProjectDeliveryStatus.OWNERSHIP_TRANSFER,
    ProjectDeliveryStatus.PREPARING,
  ],
  [ProjectDeliveryStatus.OWNERSHIP_TRANSFER]: [
    ProjectDeliveryStatus.DELIVERED,
    ProjectDeliveryStatus.CLIENT_REVIEWING,
  ],
  [ProjectDeliveryStatus.DELIVERED]: [ProjectDeliveryStatus.COMPLETED],
  [ProjectDeliveryStatus.COMPLETED]: [],
};

export const DELIVERY_STATUS_LABELS: Record<ProjectDeliveryStatus, string> = {
  [ProjectDeliveryStatus.NOT_STARTED]: 'Not started',
  [ProjectDeliveryStatus.PREPARING]: 'Preparing delivery',
  [ProjectDeliveryStatus.READY_FOR_CLIENT]: 'Ready for client',
  [ProjectDeliveryStatus.CLIENT_REVIEWING]: 'Client reviewing',
  [ProjectDeliveryStatus.OWNERSHIP_TRANSFER]: 'Ownership transfer',
  [ProjectDeliveryStatus.DELIVERED]: 'Delivered',
  [ProjectDeliveryStatus.COMPLETED]: 'Completed',
};

export const canAdvance = (
  from: ProjectDeliveryStatus,
  to: ProjectDeliveryStatus,
): boolean => from === to || (DELIVERY_FLOW[from]?.includes(to) ?? false);

/** A readiness rule that must hold before the project can be marked delivered. */
export interface ReadinessCheck {
  key: string;
  label: string;
  passed: boolean;
  detail: string;
  blocking: boolean;
}
