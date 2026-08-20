import { CouponDiscountType, CouponScope, Prisma, type ServiceCategory } from '@prisma/client';
import { prisma } from '@config/database';
import { ApiError } from '@utils/api-error';
import { toNumber } from '@utils/money.util';

/**
 * Coupon validation and pricing.
 *
 * Kept apart from the catalog on purpose: published prices are what a visitor
 * sees unprompted, and a coupon is a separate, time-boxed offer applied on top.
 * Because of that split the public page never has to misstate the standard
 * rate, and a promotion can start or end without editing a single price.
 *
 * Every rule below is enforced here rather than in the UI, since the preview
 * endpoint is public and the same function decides what a quote records.
 */

export interface CouponContext {
  category?: ServiceCategory;
  serviceId?: string;
  termMonths?: number;
}

export interface AppliedDiscount {
  code: string;
  description: string | null;
  discountType: CouponDiscountType;
  discountValue: number;
  /** Rupees off one month at this price. */
  amountOff: number;
  priceAfter: number;
}

const reason = (message: string) => ApiError.badRequest(message);

/**
 * Finds a usable coupon or explains why it isn't.
 *
 * The messages are deliberately specific — "expired" and "not valid on monthly
 * billing" send someone in completely different directions, and a flat
 * "invalid code" would have them retyping a code that was never going to work.
 */
export const resolveCoupon = async (ownerId: string, rawCode: string, context: CouponContext = {}) => {
  const code = rawCode.trim().toUpperCase();
  if (!code) throw reason('Enter a coupon code');

  const coupon = await prisma.coupon.findFirst({
    where: { userId: ownerId, code },
  });

  if (!coupon || !coupon.isActive) throw reason('That coupon code is not valid');

  const now = new Date();
  if (coupon.startsAt && now < coupon.startsAt) throw reason('That coupon is not active yet');
  if (coupon.endsAt && now > coupon.endsAt) throw reason('That coupon has expired');

  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    throw reason('That coupon has been fully claimed');
  }

  if (coupon.minTermMonths && (context.termMonths ?? 0) < coupon.minTermMonths) {
    const months = coupon.minTermMonths;
    throw reason(
      months === 12
        ? 'That coupon applies to annual plans and longer'
        : `That coupon needs a term of at least ${months} months`,
    );
  }

  if (coupon.scope === CouponScope.CATEGORY && context.category) {
    if (!coupon.categories.includes(context.category)) {
      throw reason('That coupon does not apply to this service');
    }
  }

  if (coupon.scope === CouponScope.SERVICE && context.serviceId) {
    if (!coupon.serviceIds.includes(context.serviceId)) {
      throw reason('That coupon does not apply to this service');
    }
  }

  return coupon;
};

/**
 * Applies a coupon to one monthly price.
 *
 * Rounded to whole rupees because that is what appears on the card and on the
 * invoice; carrying paise through would show ₹479.20 next to a ₹479 total.
 */
export const applyCoupon = (
  coupon: {
    code: string;
    description: string | null;
    discountType: CouponDiscountType;
    discountValue: Prisma.Decimal;
    maxDiscountAmount: Prisma.Decimal | null;
  },
  price: number,
): AppliedDiscount => {
  const value = toNumber(coupon.discountValue);

  let amountOff =
    coupon.discountType === CouponDiscountType.PERCENT ? (price * value) / 100 : value;

  if (coupon.maxDiscountAmount) {
    amountOff = Math.min(amountOff, toNumber(coupon.maxDiscountAmount));
  }

  // Never below zero, and never more than the price itself.
  amountOff = Math.max(0, Math.min(amountOff, price));

  const rounded = Math.round(amountOff);
  return {
    code: coupon.code,
    description: coupon.description,
    discountType: coupon.discountType,
    discountValue: value,
    amountOff: rounded,
    priceAfter: Math.max(0, Math.round(price) - rounded),
  };
};

export const CouponsService = {
  /**
   * Public preview: what would this code do to this service's prices?
   *
   * Returns the whole plan-and-term grid already discounted, so the page can
   * re-render every card from one round trip instead of asking per tier.
   */
  async preview(ownerId: string, code: string, serviceId?: string) {
    const service = serviceId
      ? await prisma.service.findFirst({
          where: { id: serviceId, userId: ownerId, deletedAt: null },
          select: { id: true, category: true },
        })
      : null;

    if (serviceId && !service) throw ApiError.notFound('Service');

    const coupon = await resolveCoupon(ownerId, code, {
      category: service?.category,
      serviceId: service?.id,
    });

    const plans = await prisma.servicePlan.findMany({
      where: {
        isActive: true,
        service: {
          userId: ownerId,
          deletedAt: null,
          isActive: true,
          isPublic: true,
          ...(service ? { id: service.id } : {}),
        },
      },
      select: {
        id: true,
        serviceId: true,
        service: { select: { category: true } },
        prices: { select: { termMonths: true, price: true } },
      },
    });

    const results = plans.flatMap((plan) =>
      plan.prices
        // A term shorter than the coupon allows keeps its list price rather
        // than silently showing a discount that would be refused at checkout.
        .filter((price) => !coupon.minTermMonths || price.termMonths >= coupon.minTermMonths)
        .filter(() => {
          if (coupon.scope === CouponScope.CATEGORY) {
            return coupon.categories.includes(plan.service.category);
          }
          if (coupon.scope === CouponScope.SERVICE) {
            return coupon.serviceIds.includes(plan.serviceId);
          }
          return true;
        })
        .map((price) => {
          const listPrice = toNumber(price.price);
          const applied = applyCoupon(coupon, listPrice);
          return {
            planId: plan.id,
            serviceId: plan.serviceId,
            termMonths: price.termMonths,
            listPrice: Math.round(listPrice),
            price: applied.priceAfter,
            amountOff: applied.amountOff,
            totalForTerm: applied.priceAfter * price.termMonths,
          };
        }),
    );

    return {
      code: coupon.code,
      description: coupon.description,
      discountType: coupon.discountType,
      discountValue: toNumber(coupon.discountValue),
      minTermMonths: coupon.minTermMonths,
      endsAt: coupon.endsAt,
      /** Empty means the code is real but applies to nothing on this page. */
      prices: results,
    };
  },

  // ── Admin ────────────────────────────────────────────────────────────────

  list: (userId: string) =>
    prisma.coupon.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),

  async create(userId: string, dto: Record<string, unknown>) {
    const code = String(dto.code).trim().toUpperCase();
    const clash = await prisma.coupon.findFirst({ where: { userId, code } });
    if (clash) throw ApiError.conflict('A coupon with that code already exists');

    return prisma.coupon.create({
      data: { ...(dto as Prisma.CouponCreateManyInput), code, userId },
    });
  },

  async update(userId: string, id: string, dto: Record<string, unknown>) {
    const existing = await prisma.coupon.findFirst({ where: { id, userId } });
    if (!existing) throw ApiError.notFound('Coupon');

    const data = { ...dto } as Prisma.CouponUpdateInput;
    if (typeof dto.code === 'string') data.code = dto.code.trim().toUpperCase();

    return prisma.coupon.update({ where: { id }, data });
  },

  async remove(userId: string, id: string) {
    const existing = await prisma.coupon.findFirst({ where: { id, userId } });
    if (!existing) throw ApiError.notFound('Coupon');
    await prisma.coupon.delete({ where: { id } });
  },

  /** Called once an enquiry citing the code is recorded. */
  redeem: (couponId: string) =>
    prisma.coupon.update({ where: { id: couponId }, data: { usedCount: { increment: 1 } } }),
};

export default CouponsService;
