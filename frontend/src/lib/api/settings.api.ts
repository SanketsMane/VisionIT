import { get, getList, patch, post, del } from './client';
import type { CompanyProfile, User } from '@/types';

export interface ReferenceData {
  currencies: { code: string; symbol: string }[];
  fiscalYearStartMonths: { value: number; label: string }[];
  timezones: string[];
  features: {
    aiEnabled: boolean;
    aiModel: string;
    globalSmtpConfigured: boolean;
    globalResendConfigured: boolean;
    maxUploadMb: number;
  };
}

export interface ActivityLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

export const settingsApi = {
  company: () => get<CompanyProfile>('/settings/company'),
  updateCompany: (payload: Partial<CompanyProfile>) =>
    patch<CompanyProfile>('/settings/company', payload),

  updateProfile: (payload: Partial<User>) => patch<User>('/settings/profile', payload),
  reference: () => get<ReferenceData>('/settings/reference'),

  activity: (params: { page?: number; limit?: number } = {}) =>
    getList<ActivityLog>('/settings/activity', { params }),

  // Notifications moved to `/notifications`: the settings router is gated to
  // studio users, and client-portal members have an inbox too.
  notifications: () => get<Notification[]>('/notifications'),
  markRead: (id: string) => patch<Notification>(`/notifications/${id}/read`),
  markAllRead: () => patch<{ updated: number }>('/notifications/read-all'),
};

export interface FileAsset {
  id: string;
  key: string;
  url: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export const uploadsApi = {
  list: (params: { ownerType?: string; ownerId?: string } = {}) =>
    get<FileAsset[]>('/uploads', { params }),

  /** Multipart — the browser must set its own boundary, so Content-Type is cleared. */
  uploadImage: (file: File, owner?: { ownerType: string; ownerId: string }) => {
    const form = new FormData();
    form.append('file', file);
    if (owner) {
      form.append('ownerType', owner.ownerType);
      form.append('ownerId', owner.ownerId);
    }
    return post<FileAsset>('/uploads/image', form, { headers: { 'Content-Type': undefined } as never });
  },

  uploadDocument: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return post<FileAsset>('/uploads/document', form, {
      headers: { 'Content-Type': undefined } as never,
    });
  },

  remove: (id: string) => del<null>(`/uploads/${id}`),
};
