import { CouponDiscountType, CouponScope, PricingModel, QuoteStatus, ServiceCategory } from '@prisma/client';
import { z } from 'zod';

export const serviceIdSchema = z.object({ id: z.string().min(1) });
export const serviceSlugSchema = z.object({ slug: z.string().min(1) });

const specSchema = z.object({
  label: z.string().trim().min(1).max(60),
  value: z.string().trim().min(1).max(80),
});

const priceSchema = z.object({
  /** 1, 12 or 24 today; any positive count is accepted so new terms need no migration. */
  termMonths: z.coerce.number().int().min(1).max(120),
  price: z.coerce.number().nonnegative(),
  renewalPrice: z.coerce.number().nonnegative().optional().nullable(),
  compareAtPrice: z.coerce.number().nonnegative().optional().nullable(),
  setupFee: z.coerce.number().nonnegative().optional().nullable(),
  currency: z.string().trim().length(3).toUpperCase().optional(),
});

const planSchema = z.object({
  name: z.string().trim().min(1).max(80),
  slug: z.string().trim().max(80).optional(),
  summary: z.string().trim().max(300).optional().nullable(),
  specs: z.array(specSchema).max(20).optional(),
  features: z.array(z.string().trim().max(160)).max(30).optional(),
  isPopular: z.boolean().optional(),
  sortOrder: z.coerce.number().int().optional(),
  prices: z.array(priceSchema).max(10).optional(),
});

const serviceFields = z.object({
  name: z.string().trim().min(2, 'Give the service a name').max(120),
  slug: z.string().trim().max(120).regex(/^[a-z0-9-]*$/, 'Lowercase letters, numbers and dashes only').optional(),
  tagline: z.string().trim().max(200).optional().nullable(),
  description: z.string().trim().max(8000).optional().nullable(),
  category: z.nativeEnum(ServiceCategory),
  pricingModel: z.nativeEnum(PricingModel).default(PricingModel.QUOTE_ONLY),

  icon: z.string().trim().max(40).optional().nullable(),
  coverImageUrl: z.string().trim().url().optional().nullable().or(z.literal('')),
  accentColor: z.string().trim().max(20).optional().nullable(),

  features: z.array(z.string().trim().max(160)).max(30).default([]),
  deliverables: z.array(z.string().trim().max(160)).max(30).default([]),

  startingPrice: z.coerce.number().nonnegative().optional().nullable(),
  currency: z.string().trim().length(3).toUpperCase().default('INR'),
  priceSuffix: z.string().trim().max(30).optional().nullable(),

  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  isPublic: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),

  metaTitle: z.string().trim().max(120).optional().nullable(),
  metaDescription: z.string().trim().max(320).optional().nullable(),

  plans: z.array(planSchema).max(20).optional(),
});

export const createServiceSchema = serviceFields;
export const updateServiceSchema = serviceFields.partial();

export const listServicesSchema = z.object({
  category: z.nativeEnum(ServiceCategory).optional(),
  includeInactive: z.coerce.boolean().default(false),
});

export const reorderServicesSchema = z.object({
  items: z.array(z.object({ id: z.string().min(1), sortOrder: z.coerce.number().int() })).max(100),
});

/**
 * A quote enquiry. Reachable without a session, so every field is bounded and
 * `website` is a honeypot — a real person never sees it, so anything filled in
 * came from a bot.
 */
export const quoteRequestSchema = z.object({
  serviceId: z.string().min(1).optional(),
  serviceSlug: z.string().trim().max(120).optional(),
  planId: z.string().min(1).optional(),
  termMonths: z.coerce.number().int().min(1).max(120).optional(),

  name: z.string().trim().min(2, 'Tell us your name').max(120),
  email: z.email('Enter a valid email address'),
  phone: z.string().trim().max(30).optional(),
  company: z.string().trim().max(150).optional(),
  message: z.string().trim().max(4000).optional(),
  budget: z.string().trim().max(80).optional(),
  timeline: z.string().trim().max(80).optional(),
  couponCode: z.string().trim().max(40).optional(),

  /**
   * Honeypot. Accepted as any string rather than rejected by the schema: a 422
   * here would tell a bot the field is a trap. The controller discards the
   * submission silently and answers as though it worked.
   */
  website: z.string().max(200).optional(),
});

export const updateQuoteSchema = z.object({
  status: z.nativeEnum(QuoteStatus).optional(),
  internalNotes: z.string().trim().max(4000).optional().nullable(),
  assignedToId: z.string().min(1).optional().nullable(),
});

export const couponPreviewSchema = z.object({
  code: z.string().trim().min(1, 'Enter a coupon code').max(40),
  serviceId: z.string().min(1).optional(),
});

/**
 * Unrefined on purpose: Zod 4 refuses `.partial()` on a schema carrying a
 * refinement, so the cross-field rule lives on the create schema below and the
 * update schema derives from this plain shape.
 */
const couponBase = z.object({
  code: z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9_-]+$/, 'Letters, numbers, dash and underscore only'),
  description: z.string().trim().max(200).optional().nullable(),
  discountType: z.nativeEnum(CouponDiscountType).default(CouponDiscountType.PERCENT),
  discountValue: z.coerce.number().positive(),
  maxDiscountAmount: z.coerce.number().nonnegative().optional().nullable(),
  scope: z.nativeEnum(CouponScope).default(CouponScope.ALL),
  categories: z.array(z.nativeEnum(ServiceCategory)).max(20).default([]),
  serviceIds: z.array(z.string().min(1)).max(50).default([]),
  minTermMonths: z.coerce.number().int().min(1).max(120).optional().nullable(),
  startsAt: z.coerce.date().optional().nullable(),
  endsAt: z.coerce.date().optional().nullable(),
  usageLimit: z.coerce.number().int().positive().optional().nullable(),
  isActive: z.boolean().default(true),
});

const percentCap = (d: { discountType: CouponDiscountType; discountValue?: number }) =>
  d.discountType !== CouponDiscountType.PERCENT || (d.discountValue ?? 0) <= 100;

export const couponFields = couponBase.refine(percentCap, {
  message: 'A percentage discount cannot exceed 100',
  path: ['discountValue'],
});

export const updateCouponSchema = couponBase.partial();

export const listQuotesSchema = z.object({
  status: z.nativeEnum(QuoteStatus).optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
});

export type CreateServiceDto = z.infer<typeof createServiceSchema>;
export type UpdateServiceDto = z.infer<typeof updateServiceSchema>;
export type QuoteRequestDto = z.infer<typeof quoteRequestSchema>;
