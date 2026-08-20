import { API_BASE_URL, api, del, get, getList, patch, post } from './client';
import { cleanParams } from '@/lib/utils';
import type {
  Announcement,
  Bug,
  BugPriority,
  BugSeverity,
  BugStats,
  BugStatus,
  BugSummary,
  ClientDashboard,
  DocumentCategory,
  DocumentVisibility,
  EmailLogEntry,
  InvitePreview,
  PaymentRequest,
  PaymentRequestStatus,
  PortalClientUser,
  PortalInvoice,
  ProjectActivityEntry,
  ProjectDelivery,
  ProjectDocument,
  ProjectDeliveryStatus,
  ProjectInvitation,
  ProjectMember,
  ProjectRole,
  SourceCodeMethod,
  WorkspaceOverview,
} from '@/types/portal';

const base = (projectId: string) => `/portal/projects/${projectId}`;

/** Multipart requests must let the browser set its own boundary header. */
const multipart = { headers: { 'Content-Type': undefined } } as never;

// ── Public invitation flow (no auth) ────────────────────────────────────────

export const inviteApi = {
  preview: (token: string) => get<InvitePreview>(`/portal/invite/${token}`),

  acceptNew: (
    token: string,
    payload: {
      name: string;
      mobile: string;
      password: string;
      confirmPassword: string;
      acceptTerms: true;
    },
  ) => post<{ projectId: string }>(`/portal/invite/${token}/accept`, payload),

  acceptExisting: (token: string, payload: { email: string; password: string }) =>
    post<{ projectId: string }>(`/portal/invite/${token}/accept-existing`, payload),
};

// ── Workspace ───────────────────────────────────────────────────────────────

export const workspaceApi = {
  overview: (projectId: string) => get<WorkspaceOverview>(base(projectId)),

  invoices: (projectId: string) => get<PortalInvoice[]>(`${base(projectId)}/invoices`),

  activity: (projectId: string, params: { page?: number; limit?: number } = {}) =>
    getList<ProjectActivityEntry>(`${base(projectId)}/activity`, { params: cleanParams(params) }),

  /** The client portal landing page. */
  myProjects: () => get<ClientDashboard>('/portal/my-projects'),

  /** Studio-only: every portal user across the workspace. */
  clients: () => get<PortalClientUser[]>('/portal/clients'),

  deliveryBoard: () =>
    get<
      {
        id: string;
        title: string;
        code: string | null;
        status: string;
        endDate: string | null;
        delivery: {
          status: ProjectDeliveryStatus;
          statusLabel: string;
          version: string | null;
          adminConfirmedAt: string | null;
          clientConfirmedAt: string | null;
          deliveredAt: string | null;
        };
      }[]
    >('/portal/delivery-board'),
};

// ── Team & invitations ──────────────────────────────────────────────────────

export const teamApi = {
  members: (projectId: string) => get<ProjectMember[]>(`${base(projectId)}/members`),

  roles: (projectId: string) =>
    get<
      {
        value: ProjectRole;
        label: string;
        description: string;
        permissions: string[];
        clientAssignable: boolean;
      }[]
    >(`${base(projectId)}/members/roles`),

  updateRole: (projectId: string, memberId: string, role: ProjectRole) =>
    patch<ProjectMember>(`${base(projectId)}/members/${memberId}/role`, { role }),

  removeMember: (projectId: string, memberId: string) =>
    del<null>(`${base(projectId)}/members/${memberId}`),

  restoreMember: (projectId: string, memberId: string) =>
    post<ProjectMember>(`${base(projectId)}/members/${memberId}/restore`),

  invitations: (projectId: string) =>
    get<ProjectInvitation[]>(`${base(projectId)}/invitations`),

  invite: (
    projectId: string,
    payload: { email: string; name?: string; role: ProjectRole; expiresInDays?: number },
  ) =>
    post<{ invitation: ProjectInvitation; inviteUrl: string }>(
      `${base(projectId)}/invitations`,
      payload,
    ),

  resendInvitation: (projectId: string, invitationId: string) =>
    post<{ invitation: ProjectInvitation; inviteUrl: string }>(
      `${base(projectId)}/invitations/${invitationId}/resend`,
    ),

  revokeInvitation: (projectId: string, invitationId: string) =>
    del<ProjectInvitation>(`${base(projectId)}/invitations/${invitationId}`),
};

// ── Payment requests ────────────────────────────────────────────────────────

export const paymentRequestsApi = {
  list: (projectId: string, params: { page?: number; limit?: number; status?: PaymentRequestStatus } = {}) =>
    getList<PaymentRequest>(`${base(projectId)}/payment-requests`, { params: cleanParams(params) }),

  /** Studio-wide approvals queue. */
  queue: (params: { page?: number; limit?: number; status?: PaymentRequestStatus } = {}) =>
    getList<PaymentRequest>('/portal/payment-requests', { params: cleanParams(params) }),

  byId: (projectId: string, requestId: string) =>
    get<PaymentRequest>(`${base(projectId)}/payment-requests/${requestId}`),

  submit: (
    projectId: string,
    payload: {
      amount: number;
      paidAt: string;
      method: string;
      reason: string;
      reference?: string;
      notes?: string;
      invoiceId?: string;
      proof?: File | null;
    },
  ) => {
    const form = new FormData();
    form.append('amount', String(payload.amount));
    form.append('paidAt', payload.paidAt);
    form.append('method', payload.method);
    form.append('reason', payload.reason);
    if (payload.reference) form.append('reference', payload.reference);
    if (payload.notes) form.append('notes', payload.notes);
    if (payload.invoiceId) form.append('invoiceId', payload.invoiceId);
    if (payload.proof) form.append('proof', payload.proof);
    return post<PaymentRequest>(`${base(projectId)}/payment-requests`, form, multipart);
  },

  approve: (projectId: string, requestId: string, payload: { accountId: string; invoiceId?: string }) =>
    post<PaymentRequest>(`${base(projectId)}/payment-requests/${requestId}/approve`, payload),

  reject: (projectId: string, requestId: string, rejectionReason: string) =>
    post<PaymentRequest>(`${base(projectId)}/payment-requests/${requestId}/reject`, {
      rejectionReason,
    }),

  cancel: (projectId: string, requestId: string) =>
    post<PaymentRequest>(`${base(projectId)}/payment-requests/${requestId}/cancel`),

  /** Proof is streamed through an authorised route, so this needs the token. */
  proofUrl: (projectId: string, requestId: string) =>
    `${API_BASE_URL}${base(projectId)}/payment-requests/${requestId}/proof`,
};

// ── QA / bugs ───────────────────────────────────────────────────────────────

export interface BugListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: BugStatus;
  priority?: BugPriority;
  severity?: BugSeverity;
  module?: string;
  assignedToUserId?: string;
  openOnly?: boolean;
}

export const bugsApi = {
  list: (projectId: string, params: BugListParams = {}) =>
    getList<BugSummary>(`${base(projectId)}/bugs`, { params: cleanParams(params) }),

  stats: (projectId: string) => get<BugStats>(`${base(projectId)}/bugs/stats`),

  modules: (projectId: string) => get<string[]>(`${base(projectId)}/bugs/modules`),

  options: (projectId: string) =>
    get<{
      priorities: BugPriority[];
      severities: BugSeverity[];
      statuses: { value: BugStatus; label: string }[];
    }>(`${base(projectId)}/bugs/options`),

  byId: (projectId: string, bugId: string) => get<Bug>(`${base(projectId)}/bugs/${bugId}`),

  create: (
    projectId: string,
    payload: {
      title: string;
      description: string;
      expectedBehavior?: string;
      actualBehavior?: string;
      stepsToReproduce?: string;
      priority: BugPriority;
      severity: BugSeverity;
      module?: string;
      environment?: string;
      browser?: string;
      device?: string;
      os?: string;
      url?: string;
      attachments?: File[];
    },
  ) => {
    const form = new FormData();
    for (const [key, value] of Object.entries(payload)) {
      if (key === 'attachments' || value === undefined || value === null || value === '') continue;
      form.append(key, String(value));
    }
    for (const file of payload.attachments ?? []) form.append('attachments', file);
    return post<Bug>(`${base(projectId)}/bugs`, form, multipart);
  },

  changeStatus: (
    projectId: string,
    bugId: string,
    payload: { status: BugStatus; reason?: string; duplicateOfId?: string },
  ) => post<Bug>(`${base(projectId)}/bugs/${bugId}/status`, payload),

  acknowledge: (
    projectId: string,
    bugId: string,
    payload: {
      assignedToUserId?: string | null;
      priority?: BugPriority;
      dueDate?: string | null;
      internalNote?: string | null;
    },
  ) => post<Bug>(`${base(projectId)}/bugs/${bugId}/acknowledge`, payload),

  update: (
    projectId: string,
    bugId: string,
    payload: {
      priority?: BugPriority;
      severity?: BugSeverity;
      assignedToUserId?: string | null;
      dueDate?: string | null;
      module?: string | null;
      internalNote?: string | null;
    },
  ) => patch<Bug>(`${base(projectId)}/bugs/${bugId}`, payload),

  comment: (projectId: string, bugId: string, body: string, isInternal = false) =>
    post(`${base(projectId)}/bugs/${bugId}/comments`, { body, isInternal }),

  addAttachments: (projectId: string, bugId: string, files: File[]) => {
    const form = new FormData();
    for (const file of files) form.append('attachments', file);
    return post(`${base(projectId)}/bugs/${bugId}/attachments`, form, multipart);
  },

  attachmentUrl: (projectId: string, bugId: string, attachmentId: string) =>
    `${API_BASE_URL}${base(projectId)}/bugs/${bugId}/attachments/${attachmentId}`,
};

// ── Documents ───────────────────────────────────────────────────────────────

export const documentsApi = {
  list: (
    projectId: string,
    params: { page?: number; limit?: number; category?: DocumentCategory; search?: string } = {},
  ) => getList<ProjectDocument>(`${base(projectId)}/documents`, { params: cleanParams(params) }),

  stats: (projectId: string) =>
    get<{
      total: number;
      totalBytes: number;
      byCategory: { category: DocumentCategory; count: number }[];
    }>(`${base(projectId)}/documents/stats`),

  upload: (
    projectId: string,
    payload: {
      file: File;
      name?: string;
      description?: string;
      category: DocumentCategory;
      version?: string;
      visibility: DocumentVisibility;
      allowDownload: boolean;
    },
  ) => {
    const form = new FormData();
    form.append('file', payload.file);
    if (payload.name) form.append('name', payload.name);
    if (payload.description) form.append('description', payload.description);
    form.append('category', payload.category);
    if (payload.version) form.append('version', payload.version);
    form.append('visibility', payload.visibility);
    form.append('allowDownload', String(payload.allowDownload));
    return post<ProjectDocument>(`${base(projectId)}/documents`, form, multipart);
  },

  update: (projectId: string, documentId: string, payload: Partial<ProjectDocument>) =>
    patch<ProjectDocument>(`${base(projectId)}/documents/${documentId}`, payload),

  remove: (projectId: string, documentId: string) =>
    del<null>(`${base(projectId)}/documents/${documentId}`),

  /** Streams through the guarded route, so it goes via axios rather than a link. */
  download: async (projectId: string, documentId: string, filename: string) => {
    const response = await api.get(`${base(projectId)}/documents/${documentId}/download`, {
      responseType: 'blob',
    });
    const url = URL.createObjectURL(response.data as Blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  history: (projectId: string, documentId: string) =>
    get(`${base(projectId)}/documents/${documentId}/history`),
};

// ── Delivery ────────────────────────────────────────────────────────────────

export const deliveryApi = {
  get: (projectId: string) => get<ProjectDelivery>(`${base(projectId)}/delivery`),

  readiness: (projectId: string) =>
    get<{ checks: ProjectDelivery['readiness']['checks']; isReady: boolean; blockers: number }>(
      `${base(projectId)}/delivery/readiness`,
    ),

  setStatus: (projectId: string, status: ProjectDeliveryStatus) =>
    patch<ProjectDelivery>(`${base(projectId)}/delivery/status`, { status }),

  toggleChecklist: (projectId: string, itemId: string, isComplete: boolean, note?: string) =>
    patch<ProjectDelivery>(`${base(projectId)}/delivery/checklist/${itemId}`, {
      isComplete,
      note,
    }),

  chooseSourceMethod: (projectId: string, method: SourceCodeMethod) =>
    post<ProjectDelivery>(`${base(projectId)}/delivery/source-method`, { method }),

  submitGithub: (projectId: string, payload: { githubUsername: string; githubRepoUrl: string }) =>
    post<ProjectDelivery>(`${base(projectId)}/delivery/github`, payload),

  confirmGithubTransfer: (projectId: string, notes?: string) =>
    post<ProjectDelivery>(`${base(projectId)}/delivery/github/confirm`, { notes }),

  uploadArchive: (projectId: string, file: File, version: string) => {
    const form = new FormData();
    form.append('archive', file);
    form.append('version', version);
    return post<ProjectDelivery>(`${base(projectId)}/delivery/archive`, form, multipart);
  },

  downloadArchive: async (projectId: string, filename: string) => {
    const response = await api.get(`${base(projectId)}/delivery/archive`, { responseType: 'blob' });
    const url = URL.createObjectURL(response.data as Blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  publishVersion: (projectId: string, payload: { version: string; releaseNotes?: string }) =>
    post<ProjectDelivery>(`${base(projectId)}/delivery/versions`, payload),

  confirmAdmin: (projectId: string) =>
    post<ProjectDelivery>(`${base(projectId)}/delivery/confirm-admin`),

  confirmClient: (projectId: string) =>
    post<ProjectDelivery>(`${base(projectId)}/delivery/confirm-client`),

  handoverRecord: (projectId: string) => get(`${base(projectId)}/delivery/handover-record`),
};

// ── Announcements & notifications ───────────────────────────────────────────

export const announcementsApi = {
  list: (projectId: string) => get<Announcement[]>(`${base(projectId)}/announcements`),

  create: (projectId: string, payload: { title: string; body: string; isPinned?: boolean; notify?: boolean }) =>
    post<Announcement>(`${base(projectId)}/announcements`, payload),

  remove: (projectId: string, announcementId: string) =>
    del<null>(`${base(projectId)}/announcements/${announcementId}`),
};

export const notificationsApi = {
  emailLog: (params: { projectId?: string; page?: number; limit?: number } = {}) =>
    getList<EmailLogEntry>('/notifications/email-log', { params: cleanParams(params) }),

  events: () =>
    get<{ event: string; channels: string[]; sendsEmail: boolean }[]>('/notifications/events'),
};
