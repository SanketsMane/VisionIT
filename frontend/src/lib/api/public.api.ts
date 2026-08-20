import { get, post } from './client';
import type { Service } from './services.api';

export type WorkCategory =
  | 'WEB_DEVELOPMENT'
  | 'ANDROID_APP'
  | 'IOS_APP'
  | 'CROSS_PLATFORM_APP'
  | 'AI_ML'
  | 'DATA_ENGINEERING'
  | 'DEVOPS_CLOUD'
  | 'UI_UX_DESIGN'
  | 'BLOCKCHAIN'
  | 'DESKTOP_APP'
  | 'OTHER';

export const WORK_CATEGORY_LABELS: Record<WorkCategory, string> = {
  WEB_DEVELOPMENT: 'Web platforms',
  ANDROID_APP: 'Android apps',
  IOS_APP: 'iOS apps',
  CROSS_PLATFORM_APP: 'Cross-platform apps',
  AI_ML: 'AI & machine learning',
  DATA_ENGINEERING: 'Data engineering',
  DEVOPS_CLOUD: 'DevOps & cloud',
  UI_UX_DESIGN: 'Design',
  BLOCKCHAIN: 'Blockchain',
  DESKTOP_APP: 'Desktop apps',
  OTHER: 'Other work',
};

export interface WorkItem {
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
  isFeatured: boolean;
  sortOrder: number;
}

export interface WorkCatalog {
  items: WorkItem[];
  total: number;
  categories: { category: WorkCategory; count: number }[];
}

export type LeadSource = 'FREELANCER' | 'GOOGLE' | 'SOCIAL_MEDIA' | 'REFERRAL' | 'OTHER';

export const LEAD_SOURCE_OPTIONS: { value: LeadSource; label: string }[] = [
  { value: 'FREELANCER', label: 'A freelancer platform' },
  { value: 'GOOGLE', label: 'Google search' },
  { value: 'SOCIAL_MEDIA', label: 'Social media' },
  { value: 'REFERRAL', label: 'Someone referred me' },
  { value: 'OTHER', label: 'Somewhere else' },
];

export interface LeadRegisterInput {
  name: string;
  email: string;
  phone: string;
  password: string;
  source: LeadSource;
  sourceDetail?: string;
  company?: string;
  requirement?: string;
  /** Honeypot. Left empty by people, filled by bots. */
  website?: string;
}

export interface ContactInput {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  subject?: string;
  message: string;
  source?: LeadSource;
  website?: string;
}

/**
 * Endpoints that work without a session.
 *
 * The signed-in equivalents live under `/catalog` and return the same shape, so
 * the lead-facing Catalog page and the public Work page share components.
 */
export const publicApi = {
  work: (category?: WorkCategory) =>
    get<WorkCatalog>('/portfolio/public', category ? { params: { category } } : undefined),

  workItem: (slug: string) => get<WorkItem>(`/portfolio/public/${slug}`),

  services: () => get<Service[]>('/services/public'),

  contact: (input: ContactInput) => post<{ id: string | null }>('/leads/contact', input),
};

/** The same catalog, for a signed-in lead. */
export const catalogApi = {
  work: (category?: WorkCategory) =>
    get<WorkCatalog>('/portfolio/catalog', category ? { params: { category } } : undefined),
  workItem: (slug: string) => get<WorkItem>(`/portfolio/catalog/${slug}`),
};

/** Formats a delivery date as "March 2026". Absent dates render nothing. */
export const deliveredLabel = (value: string | null): string | null => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
};
