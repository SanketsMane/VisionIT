import { del, get, getList, patch, post } from './client';

export type ServiceCategory =
  | 'WEB_DEVELOPMENT' | 'ANDROID_APP' | 'IOS_APP' | 'AI_SOFTWARE' | 'FINTECH_PLATFORM'
  | 'VPS_HOSTING' | 'WINDOWS_HOSTING' | 'SOCIAL_MEDIA' | 'DIGITAL_MARKETING'
  | 'SEO' | 'LEAD_GENERATION' | 'OTHER';

export type PricingModel = 'QUOTE_ONLY' | 'FROM' | 'FIXED' | 'TIERED';
export type QuoteStatus = 'NEW' | 'CONTACTED' | 'QUOTED' | 'WON' | 'LOST';

export interface PlanPrice {
  termMonths: number;
  price: number;
  renewalPrice: number | null;
  compareAtPrice: number | null;
  setupFee: number | null;
  currency: string;
  discountPercent: number | null;
  totalForTerm: number;
}

export interface ServicePlan {
  id: string;
  name: string;
  slug: string;
  summary: string | null;
  specs: { label: string; value: string }[];
  features: string[];
  isPopular: boolean;
  sortOrder: number;
  prices: PlanPrice[];
}

export interface Service {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  category: ServiceCategory;
  pricingModel: PricingModel;
  icon: string | null;
  coverImageUrl: string | null;
  accentColor: string | null;
  features: string[];
  deliverables: string[];
  currency: string;
  priceSuffix: string | null;
  startingPrice: number | null;
  isActive: boolean;
  isFeatured: boolean;
  isPublic: boolean;
  sortOrder: number;
  plans: ServicePlan[];
}

/** One plan+term with a coupon applied. */
export interface DiscountedPrice {
  planId: string;
  serviceId: string;
  termMonths: number;
  listPrice: number;
  price: number;
  amountOff: number;
  totalForTerm: number;
}

export interface AppliedCoupon {
  code: string;
  description: string | null;
  discountType: 'PERCENT' | 'FIXED';
  discountValue: number;
  minTermMonths: number | null;
  endsAt: string | null;
  prices: DiscountedPrice[];
}

export interface QuoteRequest {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  message: string | null;
  budget: string | null;
  timeline: string | null;
  status: QuoteStatus;
  source: string;
  couponCode: string | null;
  discountAmount: number | null;
  quotedPrice: number | null;
  termMonths: number | null;
  internalNotes: string | null;
  respondedAt: string | null;
  createdAt: string;
  service: { id: string; name: string; category: ServiceCategory; slug?: string } | null;
  requestedBy?: { id: string; name: string; email: string } | null;
  assignedTo?: { id: string; name: string } | null;
}

export interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discountType: 'PERCENT' | 'FIXED';
  discountValue: number;
  maxDiscountAmount: number | null;
  scope: 'ALL' | 'CATEGORY' | 'SERVICE';
  categories: ServiceCategory[];
  serviceIds: string[];
  minTermMonths: number | null;
  startsAt: string | null;
  endsAt: string | null;
  usageLimit: number | null;
  usedCount: number;
  isActive: boolean;
}

export const servicesApi = {
  // Public — no session required.
  publicCatalog: () => get<Service[]>('/services/public'),
  publicService: (slug: string) => get<Service>(`/services/public/${slug}`),
  applyCoupon: (code: string, serviceId?: string) =>
    post<AppliedCoupon>('/services/public/coupon', { code, serviceId }),
  submitQuote: (payload: Record<string, unknown>) =>
    post<{ id: string | null }>('/services/public/quote', payload),

  // Studio.
  list: (params: { category?: ServiceCategory; includeInactive?: boolean } = {}) =>
    get<Service[]>('/services', { params }),
  stats: () => get<{
    activeServices: number; totalQuotes: number; newQuotes: number;
    wonQuotes: number; conversionRate: number;
  }>('/services/stats'),
  getById: (id: string) => get<Service>(`/services/${id}`),
  create: (payload: Record<string, unknown>) => post<Service>('/services', payload),
  update: (id: string, payload: Record<string, unknown>) => patch<Service>(`/services/${id}`, payload),
  remove: (id: string) => del<null>(`/services/${id}`),
  reorder: (items: { id: string; sortOrder: number }[]) => post<null>('/services/reorder', { items }),

  quotes: (params: { status?: QuoteStatus; search?: string; page?: number; limit?: number } = {}) =>
    getList<QuoteRequest>('/services/quotes', { params }),
  quote: (id: string) => get<QuoteRequest>(`/services/quotes/${id}`),
  updateQuote: (id: string, payload: { status?: QuoteStatus; internalNotes?: string | null }) =>
    patch<QuoteRequest>(`/services/quotes/${id}`, payload),

  coupons: () => get<Coupon[]>('/services/coupons'),
  createCoupon: (payload: Record<string, unknown>) => post<Coupon>('/services/coupons', payload),
  updateCoupon: (id: string, payload: Record<string, unknown>) =>
    patch<Coupon>(`/services/coupons/${id}`, payload),
  removeCoupon: (id: string) => del<null>(`/services/coupons/${id}`),
};

export const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  WEB_DEVELOPMENT: 'Web Development',
  ANDROID_APP: 'Android',
  IOS_APP: 'iOS',
  AI_SOFTWARE: 'AI Software',
  FINTECH_PLATFORM: 'Fintech',
  VPS_HOSTING: 'VPS Hosting',
  WINDOWS_HOSTING: 'Windows Hosting',
  SOCIAL_MEDIA: 'Social Media',
  DIGITAL_MARKETING: 'Digital Marketing',
  SEO: 'SEO',
  LEAD_GENERATION: 'Lead Generation',
  OTHER: 'Other',
};

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  QUOTED: 'Quoted',
  WON: 'Won',
  LOST: 'Lost',
};

/** Term labels, so "24" never reaches a card as a bare number. */
export const TERM_LABELS: Record<number, string> = {
  1: 'Monthly',
  12: '12 months',
  24: '24 months',
  48: '48 months',
};
