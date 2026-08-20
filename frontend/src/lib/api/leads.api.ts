import { del, get, patch, post } from './client';
import type { LeadSource } from './public.api';

export type LeadStatus = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'CONVERTED' | 'ARCHIVED';

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  QUALIFIED: 'Qualified',
  CONVERTED: 'Converted',
  ARCHIVED: 'Archived',
};

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  FREELANCER: 'Freelancer platform',
  GOOGLE: 'Google search',
  SOCIAL_MEDIA: 'Social media',
  REFERRAL: 'Referral',
  OTHER: 'Other',
};

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  leadSource: LeadSource | null;
  leadStatus: LeadStatus | null;
  leadCompany: string | null;
  leadNote: string | null;
  leadReferrer: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  projectCount?: number;
}

export interface LeadDetail extends Lead {
  memberships: {
    role: string;
    joinedAt: string;
    project: { id: string; title: string; code: string | null; status: string };
  }[];
}

export interface LeadStats {
  total: number;
  unreadEnquiries: number;
  byStatus: Partial<Record<LeadStatus, number>>;
  bySource: Partial<Record<LeadSource, number>>;
}

export interface Enquiry {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  subject: string | null;
  message: string;
  source: LeadSource | null;
  isRead: boolean;
  handledAt: string | null;
  createdAt: string;
}

interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export const leadsApi = {
  list: (params?: { status?: LeadStatus; source?: LeadSource; search?: string; page?: number }) =>
    get<Paged<Lead>>('/leads', { params }),

  stats: () => get<LeadStats>('/leads/stats'),

  getById: (id: string) => get<LeadDetail>(`/leads/${id}`),

  update: (id: string, body: { status?: LeadStatus; note?: string }) =>
    patch<Lead>(`/leads/${id}`, body),

  enquiries: (page = 1) => get<Paged<Enquiry>>('/leads/enquiries', { params: { page } }),

  markEnquiryRead: (id: string) => post<{ id: string }>(`/leads/enquiries/${id}/read`),
};

// ---- Portfolio ------------------------------------------------------------

export type WorkCategory =
  | 'WEB_DEVELOPMENT' | 'ANDROID_APP' | 'IOS_APP' | 'CROSS_PLATFORM_APP'
  | 'AI_ML' | 'DATA_ENGINEERING' | 'DEVOPS_CLOUD' | 'UI_UX_DESIGN'
  | 'BLOCKCHAIN' | 'DESKTOP_APP' | 'OTHER';

export interface PortfolioItem {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  summary: string;
  category: WorkCategory;
  industry: string | null;
  liveUrl: string | null;
  coverImage: string | null;
  gallery: string[];
  techStack: string[];
  highlights: string[];
  deliveredAt: string | null;
  clientLabel: string | null;
  testimonial: string | null;
  isPublished: boolean;
  isFeatured: boolean;
  sortOrder: number;
  viewCount: number;
  sourceProjectId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PortfolioInput = Partial<
  Omit<PortfolioItem, 'id' | 'viewCount' | 'createdAt' | 'updatedAt'>
>;

export const portfolioApi = {
  list: (params?: { category?: WorkCategory; search?: string; published?: 'true' | 'false' }) =>
    get<{ items: PortfolioItem[]; total: number }>('/portfolio', { params }),

  getById: (id: string) => get<PortfolioItem>(`/portfolio/${id}`),

  create: (body: PortfolioInput) => post<PortfolioItem>('/portfolio', body),

  update: (id: string, body: PortfolioInput) => patch<PortfolioItem>(`/portfolio/${id}`, body),

  remove: (id: string) => del<{ id: string }>(`/portfolio/${id}`),

  /** Pre-fills an entry from a real project, with the client stripped out. */
  draftFromProject: (projectId: string) =>
    get<PortfolioInput & { sourceProjectId: string }>(`/portfolio/from-project/${projectId}`),
};
