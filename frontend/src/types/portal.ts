import type { SupportSummary } from '@/lib/api/support.api';

// ── Portal enums (mirrors the Prisma schema) ────────────────────────────────

export type UserType = 'INTERNAL' | 'CLIENT' | 'LEAD';

export type ProjectRole =
  | 'CLIENT_OWNER' | 'CLIENT_MANAGER' | 'TESTER' | 'VIEWER' | 'INTERNAL_MEMBER';

export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';

export type ProjectDeliveryStatus =
  | 'NOT_STARTED' | 'PREPARING' | 'READY_FOR_CLIENT' | 'CLIENT_REVIEWING'
  | 'OWNERSHIP_TRANSFER' | 'DELIVERED' | 'COMPLETED';

export type SourceCodeMethod = 'NOT_CHOSEN' | 'GITHUB' | 'ZIP';

export type HandoverStatus =
  | 'NOT_STARTED' | 'CLIENT_DETAILS_SUBMITTED' | 'TRANSFER_IN_PROGRESS'
  | 'ADMIN_CONFIRMED' | 'CLIENT_CONFIRMED' | 'COMPLETED';

export type PaymentRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export type BugPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type BugSeverity = 'COSMETIC' | 'MINOR' | 'MAJOR' | 'CRITICAL' | 'BLOCKER';

export type BugStatus =
  | 'SUBMITTED' | 'ACKNOWLEDGED' | 'ASSIGNED' | 'IN_PROGRESS' | 'FIXED'
  | 'READY_FOR_RETEST' | 'RETESTED' | 'CLOSED' | 'REJECTED' | 'DUPLICATE'
  | 'CANNOT_REPRODUCE' | 'DEFERRED';

export type DocumentCategory =
  | 'PROPOSAL' | 'AGREEMENT' | 'SOW' | 'REQUIREMENTS' | 'DESIGN'
  | 'TECHNICAL_DOC' | 'USER_DOC' | 'TESTING_REPORT' | 'DEPLOYMENT_DOC'
  | 'CREDENTIALS' | 'FINAL_REPORT' | 'INVOICE' | 'RECEIPT' | 'BUILD'
  | 'SOURCE_CODE' | 'OTHER';

export type DocumentVisibility = 'ADMIN_ONLY' | 'CLIENT_VISIBLE';

export type Permission = string;

// ── Models ──────────────────────────────────────────────────────────────────

export interface PortalUserRef {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string | null;
  userType?: UserType;
}

export interface ProjectMember {
  id: string;
  role: ProjectRole;
  roleLabel: string;
  isActive: boolean;
  joinedAt: string;
  permissions: Permission[];
  user: PortalUserRef & { phone?: string | null; lastLoginAt?: string | null };
}

export interface ProjectInvitation {
  id: string;
  projectId: string;
  email: string;
  name: string | null;
  role: ProjectRole;
  status: InvitationStatus;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  lastSentAt: string | null;
  sendCount: number;
  createdAt: string;
  invitedBy: { id: string; name: string };
  acceptedBy: PortalUserRef | null;
}

export interface InvitePreview {
  email: string;
  name: string | null;
  role: ProjectRole;
  roleLabel: string;
  expiresAt: string;
  hasAccount: boolean;
  project: { title: string; code: string | null; summary: string | null; logoUrl: string | null };
  invitedBy: string;
  studio: { name: string; logoUrl: string | null };
}

export interface PaymentRequest {
  id: string;
  projectId: string;
  invoiceId: string | null;
  amount: number;
  currency: string;
  paidAt: string;
  method: string;
  reference: string | null;
  reason: string;
  notes: string | null;
  proofFilename: string | null;
  proofMimeType: string | null;
  status: PaymentRequestStatus;
  reviewedAt: string | null;
  rejectionReason: string | null;
  paymentId: string | null;
  createdAt: string;
  submittedBy: PortalUserRef;
  reviewedBy: { id: string; name: string } | null;
  invoice: {
    id: string; number: string; total: number; balanceDue: number; currency: string;
  } | null;
  project: { id: string; title: string; code: string | null };
}

export interface BugComment {
  id: string;
  body: string;
  isInternal: boolean;
  createdAt: string;
  author: PortalUserRef;
}

export interface BugAttachment {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  uploadedBy?: { id: string; name: string };
}

export interface BugActivity {
  id: string;
  action: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  isInternal: boolean;
  createdAt: string;
  actor: PortalUserRef | null;
}

export interface BugSummary {
  id: string;
  key: string;
  number: number;
  title: string;
  priority: BugPriority;
  severity: BugSeverity;
  status: BugStatus;
  module: string | null;
  browser: string | null;
  device: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  reportedBy: PortalUserRef;
  assignedTo: PortalUserRef | null;
  _count?: { comments: number; attachments: number };
}

export interface Bug extends BugSummary {
  description: string;
  expectedBehavior: string | null;
  actualBehavior: string | null;
  stepsToReproduce: string | null;
  environment: string | null;
  os: string | null;
  url: string | null;
  internalNote?: string | null;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  statusLabel: string;
  availableTransitions: { value: BugStatus; label: string }[];
  duplicateOf: { id: string; key: string; title: string } | null;
  comments: BugComment[];
  attachments: BugAttachment[];
  activities: BugActivity[];
}

export interface BugStats {
  total: number;
  open: number;
  resolved: number;
  overdue: number;
  critical: number;
  blockers: number;
  byStatus: { status: BugStatus; label: string; count: number }[];
  byPriority: { priority: BugPriority; count: number }[];
  bySeverity: { severity: BugSeverity; count: number }[];
}

export interface ProjectDocument {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  category: DocumentCategory;
  version: string | null;
  visibility: DocumentVisibility;
  allowDownload: boolean;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string | null;
  downloadCount: number;
  createdAt: string;
  uploadedBy: PortalUserRef;
}

export interface DeliveryChecklistItem {
  id: string;
  key: string;
  label: string;
  isComplete: boolean;
  isRequired: boolean;
  sortOrder: number;
  completedAt: string | null;
  note: string | null;
}

export interface DeliveryVersion {
  id: string;
  version: string;
  releaseNotes: string | null;
  sourceMethod: SourceCodeMethod;
  filename: string | null;
  sizeBytes: number | null;
  checksum: string | null;
  githubUrl: string | null;
  publishedAt: string;
  clientConfirmedAt: string | null;
  publishedBy: { id: string; name: string };
}

export interface ReadinessCheck {
  key: string;
  label: string;
  passed: boolean;
  detail: string;
  blocking: boolean;
}

export interface ProjectDelivery {
  id: string;
  projectId: string;
  status: ProjectDeliveryStatus;
  statusLabel: string;
  version: string | null;
  sourceCodeMethod: SourceCodeMethod;
  githubRepoUrl: string | null;
  githubOwner: string | null;
  githubUsername: string | null;
  handoverStatus: HandoverStatus;
  transferNotes: string | null;
  transferredAt: string | null;
  zipFilename: string | null;
  zipSizeBytes: number | null;
  zipChecksum: string | null;
  zipVersion: string | null;
  zipDownloadCount: number;
  hasArchive: boolean;
  releaseNotes: string | null;
  adminConfirmedAt: string | null;
  clientConfirmedAt: string | null;
  deliveredAt: string | null;
  adminConfirmedBy: { id: string; name: string } | null;
  clientConfirmedBy: { id: string; name: string } | null;
  checklist: DeliveryChecklistItem[];
  versions: DeliveryVersion[];
  readiness: { checks: ReadinessCheck[]; isReady: boolean; blockers: number };
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  isPinned: boolean;
  publishedAt: string;
  publishedBy: PortalUserRef;
}

export interface ProjectActivityEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  isInternal: boolean;
  createdAt: string;
  actor: PortalUserRef | null;
}

export interface ProjectMilestoneRef {
  id: string;
  title: string;
  amount: number | null;
  dueDate: string | null;
  completedAt: string | null;
  status: string;
}

export interface WorkspaceOverview {
  project: {
    id: string;
    title: string;
    code: string | null;
    summary: string | null;
    description: string | null;
    status: string;
    category: string;
    logoUrl: string | null;
    currency: string;
    startDate: string | null;
    endDate: string | null;
    deliveryDate: string | null;
    client: { id: string; name: string; companyName: string | null; avatarUrl: string | null } | null;
    technologies: { id: string; name: string }[];
  };
  health: { status: 'ON_TRACK' | 'AT_RISK' | 'DELAYED'; reasons: string[] };
  progress: {
    percent: number;
    milestonesTotal: number;
    milestonesCompleted: number;
    currentMilestone: ProjectMilestoneRef | null;
    daysRemaining: number | null;
  };
  financial: {
    contractValue: number;
    invoiced: number;
    paid: number;
    pending: number;
    uninvoiced: number;
    invoiceCount: number;
    overdueInvoices: number;
    pendingPaymentRequests: number;
    paidPercent: number;
  };
  testing: { total: number; open: number; critical: number; byStatus: Record<string, number> };
  delivery: {
    status: ProjectDeliveryStatus;
    statusLabel: string;
    version: string | null;
    adminConfirmed: boolean;
    clientConfirmed: boolean;
  };
  /** Post-delivery technical support term. Drives the portal countdown. */
  support: SupportSummary;
  milestones: ProjectMilestoneRef[];
  counts: { members: number; documents: number };
  announcements: Announcement[];
  access: { role: ProjectRole; permissions: Permission[] };
}

export interface ClientProjectCard {
  id: string;
  title: string;
  code: string | null;
  summary: string | null;
  logoUrl: string | null;
  status: string;
  currency: string;
  endDate: string | null;
  role: ProjectRole;
  roleLabel: string;
  permissions: Permission[];
  financial: { contractValue: number; invoiced: number; paid: number; pending: number };
  openBugs: number;
  delivery: { status: ProjectDeliveryStatus; statusLabel: string; version: string | null };
  support: SupportSummary;
}

export interface ClientDashboard {
  projects: ClientProjectCard[];
  totals: { projects: number; openBugs: number; pending: number };
  studio: { name: string; logoUrl: string | null } | null;
}

export interface PortalInvoice {
  id: string;
  number: string;
  documentType: string;
  status: string;
  currency: string;
  issueDate: string;
  dueDate: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  publicToken: string | null;
  payments: {
    id: string; amount: number; paidAt: string; method: string; reference: string | null;
  }[];
}

export interface EmailLogEntry {
  id: string;
  event: string;
  toAddress: string;
  subject: string;
  status: 'QUEUED' | 'SENT' | 'FAILED';
  errorMessage: string | null;
  sentAt: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string } | null;
}

export interface PortalClientUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  memberships: {
    role: ProjectRole;
    roleLabel: string;
    project: { id: string; title: string; code: string | null; clientId: string | null };
  }[];
}
