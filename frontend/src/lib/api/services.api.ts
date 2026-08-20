import { del, get, getList, patch, post } from './client';

export type ServiceCategory =
  | 'WEB_DEVELOPMENT' | 'ANDROID_APP' | 'IOS_APP' | 'AI_SOFTWARE' | 'FINTECH_PLATFORM'
  | 'TRADING_PLATFORM' | 'ALGO_TRADING' | 'AI_AGENT' | 'AUTOMATION' | 'MEDIA_GENERATION'
  | 'SMS_SERVICE' | 'VPS_HOSTING' | 'WINDOWS_HOSTING' | 'SOCIAL_MEDIA'
  | 'DIGITAL_MARKETING' | 'SEO' | 'LEAD_GENERATION' | 'OTHER';

export type PricingModel = 'QUOTE_ONLY' | 'FROM' | 'FIXED' | 'TIERED' | 'SLAB';
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

export interface PriceSlab {
  minAmount: number;
  maxAmount: number | null;
  unitPrice: number;
  validityLabel: string | null;
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
  minOrderAmount: number | null;
  unitLabel: string | null;
  priceNote: string | null;
  plans: ServicePlan[];
  slabs: PriceSlab[];
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
  TRADING_PLATFORM: 'Trading Platforms',
  ALGO_TRADING: 'Algo Trading',
  AI_AGENT: 'AI Agents',
  AUTOMATION: 'Automation',
  MEDIA_GENERATION: 'AI Media',
  SMS_SERVICE: 'Bulk SMS',
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
/**
 * Mirrors the server's band selection so the calculator can respond as the
 * client types. The server re-derives it on submit — this is a preview, never
 * the source of the price.
 */
export const quoteFromSlabs = (
  slabs: PriceSlab[],
  amount: number,
): { unitPrice: number; quantity: number; validityLabel: string | null } | null => {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const ordered = [...slabs].sort((a, b) => a.minAmount - b.minAmount);
  let match: PriceSlab | null = null;
  for (const slab of ordered) {
    if (amount >= slab.minAmount && amount <= (slab.maxAmount ?? Infinity)) match = slab;
  }
  if (!match) return null;
  return {
    unitPrice: match.unitPrice,
    // Floored, like the server — never promise a credit that will not arrive.
    quantity: Math.floor(amount / match.unitPrice),
    validityLabel: match.validityLabel,
  };
};

export const TERM_LABELS: Record<number, string> = {
  1: 'Monthly',
  12: '12 months',
  24: '24 months',
  48: '48 months',
};

// ── Orders ───────────────────────────────────────────────────────────────────

export type ServiceOrderStatus =
  | 'QUOTE_REQUESTED' | 'QUOTED' | 'AWAITING_PAYMENT'
  | 'PAYMENT_SUBMITTED' | 'ACTIVE' | 'REJECTED' | 'CANCELLED';

export interface ServiceOrder {
  id: string;
  orderNumber: string;
  status: ServiceOrderStatus;
  service: { id: string; name: string; slug: string; category: ServiceCategory; icon: string | null; accentColor: string | null };
  plan: { id: string; name: string; slug: string; specs: unknown } | null;
  termMonths: number | null;
  quantity: number | null;
  unitPrice: number | null;
  validityLabel: string | null;
  listPrice: number;
  couponCode: string | null;
  discountAmount: number | null;
  finalPrice: number | null;
  currency: string;
  requirements: string | null;
  deliveryEmail: string;
  paymentMethod: string | null;
  paymentReference: string | null;
  paidAt: string | null;
  hasProof: boolean;
  proofFilename: string | null;
  submittedAt: string | null;
  rejectionReason: string | null;
  deliveryNote: string | null;
  deliveredAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  canPay: boolean;
  awaitingQuote: boolean;
  // Studio-only.
  customPrice?: number | null;
  internalNotes?: string | null;
  clientUser?: { id: string; name: string; email: string };
  client?: { id: string; name: string; companyName: string | null } | null;
  hasCredentials?: boolean;
}

export interface PaymentDetails {
  businessName: string | null;
  supportEmail?: string | null;
  supportPhone?: string | null;
  methods: { type: string; label: string; rows: { label: string; value: string }[] }[];
}

export interface OrderMessage {
  id: string;
  body: string;
  isInternal: boolean;
  createdAt: string;
  author: { id: string; name: string; avatarUrl: string | null; userType: string };
}

export const ordersApi = {
  // Client.
  catalog: () => get<Service[]>('/services/catalog'),
  service: (slug: string) => get<Service>(`/services/catalog/${slug}`),
  applyCoupon: (code: string, serviceId?: string) =>
    post<AppliedCoupon>('/services/catalog/coupon', { code, serviceId }),
  paymentDetails: () => get<PaymentDetails>('/services/payment-details'),
  place: (payload: Record<string, unknown>) => post<ServiceOrder>('/services/orders', payload),
  mine: () => get<ServiceOrder[]>('/services/my-orders'),
  mineById: (id: string) => get<ServiceOrder>(`/services/my-orders/${id}`),

  async submitPayment(
    id: string,
    payload: { method: string; reference?: string; paidAt: string; proof?: File },
  ) {
    const form = new FormData();
    form.append('method', payload.method);
    if (payload.reference) form.append('reference', payload.reference);
    form.append('paidAt', payload.paidAt);
    if (payload.proof) form.append('proof', payload.proof);
    // Content-Type is left to the browser so the multipart boundary survives.
    return post<ServiceOrder>(`/services/my-orders/${id}/payment`, form, {
      headers: { 'Content-Type': undefined } as never,
    });
  },

  // Studio.
  list: (status?: ServiceOrderStatus) =>
    get<{ items: ServiceOrder[]; byStatus: Record<string, number> }>('/services/orders', {
      params: status ? { status } : {},
    }),
  getById: (id: string) => get<ServiceOrder>(`/services/orders/${id}`),
  setPrice: (id: string, price: number, note?: string) =>
    post<ServiceOrder>(`/services/orders/${id}/price`, { price, note }),
  approve: (id: string, payload: { credentials?: string; deliveryNote?: string }) =>
    post<ServiceOrder>(`/services/orders/${id}/approve`, payload),
  reject: (id: string, reason: string) => post<ServiceOrder>(`/services/orders/${id}/reject`, { reason }),
  credentials: (id: string) => get<{ credentials: string | null }>(`/services/orders/${id}/credentials`),

  // Both sides.
  messages: (id: string) => get<OrderMessage[]>(`/services/orders/${id}/messages`),
  sendMessage: (id: string, body: string, isInternal = false) =>
    post<OrderMessage>(`/services/orders/${id}/messages`, { body, isInternal }),
  proofUrl: (id: string) => `/services/orders/${id}/proof`,
};

export const ORDER_STATUS_LABELS: Record<ServiceOrderStatus, string> = {
  QUOTE_REQUESTED: 'Awaiting quote',
  QUOTED: 'Quote ready',
  AWAITING_PAYMENT: 'Awaiting payment',
  PAYMENT_SUBMITTED: 'Verifying payment',
  ACTIVE: 'Active',
  REJECTED: 'Payment not verified',
  CANCELLED: 'Cancelled',
};
