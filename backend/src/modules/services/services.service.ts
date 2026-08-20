import { PricingModel, Prisma, QuoteStatus, type ServiceCategory } from '@prisma/client';
import { prisma } from '@config/database';
import { logger } from '@config/logger';
import { ApiError } from '@utils/api-error';
import { toNumber } from '@utils/money.util';
import { uniqueSlug } from '@utils/slug.util';
import { NotificationService } from '@modules/notifications/notification.service';
import { CouponsService, applyCoupon, resolveCoupon } from './coupons.service';
import type { CreateServiceDto, QuoteRequestDto, UpdateServiceDto } from './services.validation';

const planInclude = {
  prices: { orderBy: { termMonths: 'asc' } },
} satisfies Prisma.ServicePlanInclude;

const serviceInclude = {
  plans: {
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    include: planInclude,
  },
} satisfies Prisma.ServiceInclude;

type ServiceRow = Prisma.ServiceGetPayload<{ include: typeof serviceInclude }>;

/**
 * The percentage struck through on a card.
 *
 * Derived from `compareAtPrice` rather than stored: a saved percentage drifts
 * the moment either price is edited, and "62% off" next to the wrong numbers is
 * worse than no badge at all.
 */
const discountPercent = (price: number, compareAt: number | null): number | null => {
  if (!compareAt || compareAt <= price) return null;
  return Math.round(((compareAt - price) / compareAt) * 100);
};

const shapePrice = (row: { termMonths: number; price: Prisma.Decimal; renewalPrice: Prisma.Decimal | null; compareAtPrice: Prisma.Decimal | null; setupFee: Prisma.Decimal | null; currency: string }) => {
  const price = toNumber(row.price);
  const compareAt = row.compareAtPrice ? toNumber(row.compareAtPrice) : null;
  return {
    termMonths: row.termMonths,
    price,
    renewalPrice: row.renewalPrice ? toNumber(row.renewalPrice) : null,
    compareAtPrice: compareAt,
    setupFee: row.setupFee ? toNumber(row.setupFee) : null,
    currency: row.currency,
    discountPercent: discountPercent(price, compareAt),
    /** Total billed up front for the term, which is what actually leaves their account. */
    totalForTerm: Math.round(price * row.termMonths),
  };
};

const shapeService = (service: ServiceRow) => {
  const plans = service.plans.map((plan) => ({
    id: plan.id,
    name: plan.name,
    slug: plan.slug,
    summary: plan.summary,
    specs: (plan.specs as { label: string; value: string }[] | null) ?? [],
    features: plan.features,
    isPopular: plan.isPopular,
    sortOrder: plan.sortOrder,
    prices: plan.prices.map(shapePrice),
  }));

  // A tiered service advertises its cheapest monthly rate across every plan and
  // term, which is the number a visitor scanning the catalog is comparing.
  const cheapest = plans
    .flatMap((p) => p.prices.map((price) => price.price))
    .reduce<number | null>((min, value) => (min === null || value < min ? value : min), null);

  return {
    id: service.id,
    slug: service.slug,
    name: service.name,
    tagline: service.tagline,
    description: service.description,
    category: service.category,
    pricingModel: service.pricingModel,
    icon: service.icon,
    coverImageUrl: service.coverImageUrl,
    accentColor: service.accentColor,
    features: service.features,
    deliverables: service.deliverables,
    currency: service.currency,
    priceSuffix: service.priceSuffix,
    startingPrice:
      service.pricingModel === PricingModel.TIERED
        ? cheapest
        : service.startingPrice
          ? toNumber(service.startingPrice)
          : null,
    isActive: service.isActive,
    isFeatured: service.isFeatured,
    isPublic: service.isPublic,
    sortOrder: service.sortOrder,
    plans,
  };
};

export const ServicesService = {
  /** The studio's own catalog, including anything hidden from the public page. */
  async list(userId: string, filters: { category?: ServiceCategory; includeInactive?: boolean } = {}) {
    const rows = await prisma.service.findMany({
      where: {
        userId,
        deletedAt: null,
        ...(filters.category ? { category: filters.category } : {}),
        ...(filters.includeInactive ? {} : { isActive: true }),
      },
      include: serviceInclude,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map(shapeService);
  },

  /**
   * The public catalog.
   *
   * Scoped by the workspace owner rather than the caller, because nobody is
   * signed in — and filtered to `isPublic`, so a draft or an internal-only
   * offering never leaks onto the marketing page.
   */
  async publicCatalog(ownerId: string) {
    const rows = await prisma.service.findMany({
      where: { userId: ownerId, deletedAt: null, isActive: true, isPublic: true },
      include: serviceInclude,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map(shapeService);
  },

  async getById(userId: string, id: string) {
    const service = await prisma.service.findFirst({
      where: { id, userId, deletedAt: null },
      include: serviceInclude,
    });
    if (!service) throw ApiError.notFound('Service');
    return shapeService(service);
  },

  async getBySlug(ownerId: string, slug: string) {
    const service = await prisma.service.findFirst({
      where: { slug, userId: ownerId, deletedAt: null, isActive: true, isPublic: true },
      include: serviceInclude,
    });
    if (!service) throw ApiError.notFound('Service');
    return shapeService(service);
  },

  async create(userId: string, dto: CreateServiceDto) {
    const slug = await uniqueSlug(dto.slug || dto.name, async (candidate) =>
      Boolean(await prisma.service.findFirst({ where: { userId, slug: candidate } })),
    );

    const { plans, ...fields } = dto;
    const service = await prisma.service.create({
      data: {
        ...fields,
        slug,
        userId,
        ...(plans?.length
          ? {
              plans: {
                create: plans.map((plan, index) => ({
                  name: plan.name,
                  slug: plan.slug || plan.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                  summary: plan.summary ?? null,
                  specs: plan.specs ?? Prisma.JsonNull,
                  features: plan.features ?? [],
                  isPopular: plan.isPopular ?? false,
                  sortOrder: plan.sortOrder ?? index,
                  prices: {
                    create: (plan.prices ?? []).map((price) => ({
                      termMonths: price.termMonths,
                      price: price.price,
                      renewalPrice: price.renewalPrice ?? null,
                      compareAtPrice: price.compareAtPrice ?? null,
                      setupFee: price.setupFee ?? null,
                      currency: price.currency ?? fields.currency ?? 'INR',
                    })),
                  },
                })),
              },
            }
          : {}),
      },
      include: serviceInclude,
    });

    logger.info('Service created', { userId, serviceId: service.id, name: service.name });
    return shapeService(service);
  },

  async update(userId: string, id: string, dto: UpdateServiceDto) {
    const existing = await prisma.service.findFirst({ where: { id, userId, deletedAt: null } });
    if (!existing) throw ApiError.notFound('Service');

    const { plans, ...fields } = dto;

    // Plans are replaced wholesale when supplied. The alternative — diffing by
    // id — invites orphaned prices when a tier is renamed, and the editor sends
    // the full set anyway.
    if (plans) {
      await prisma.servicePlan.deleteMany({ where: { serviceId: id } });
    }

    const service = await prisma.service.update({
      where: { id },
      data: {
        ...fields,
        ...(plans
          ? {
              plans: {
                create: plans.map((plan, index) => ({
                  name: plan.name,
                  slug: plan.slug || plan.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                  summary: plan.summary ?? null,
                  specs: plan.specs ?? Prisma.JsonNull,
                  features: plan.features ?? [],
                  isPopular: plan.isPopular ?? false,
                  sortOrder: plan.sortOrder ?? index,
                  prices: {
                    create: (plan.prices ?? []).map((price) => ({
                      termMonths: price.termMonths,
                      price: price.price,
                      renewalPrice: price.renewalPrice ?? null,
                      compareAtPrice: price.compareAtPrice ?? null,
                      setupFee: price.setupFee ?? null,
                      currency: price.currency ?? 'INR',
                    })),
                  },
                })),
              },
            }
          : {}),
      },
      include: serviceInclude,
    });

    return shapeService(service);
  },

  /** Soft delete: quotes reference the service and should keep reading sensibly. */
  async remove(userId: string, id: string) {
    const existing = await prisma.service.findFirst({ where: { id, userId, deletedAt: null } });
    if (!existing) throw ApiError.notFound('Service');
    await prisma.service.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  },

  async reorder(userId: string, items: { id: string; sortOrder: number }[]) {
    await prisma.$transaction(
      items.map((item) =>
        prisma.service.updateMany({
          where: { id: item.id, userId },
          data: { sortOrder: item.sortOrder },
        }),
      ),
    );
  },

  // ── Quotes ───────────────────────────────────────────────────────────────

  /**
   * Records an enquiry and tells the studio.
   *
   * Open to the public, so it is treated as untrusted: the service and plan are
   * verified to belong to the workspace before being linked, and the notification
   * carries only what the sender typed.
   */
  async submitQuote(
    ownerId: string,
    dto: QuoteRequestDto,
    context: { ipAddress?: string; userAgent?: string; requestedById?: string; source?: string },
  ) {
    let serviceId: string | null = null;
    let serviceName: string | null = null;

    if (dto.serviceId || dto.serviceSlug) {
      const service = await prisma.service.findFirst({
        where: {
          userId: ownerId,
          deletedAt: null,
          ...(dto.serviceId ? { id: dto.serviceId } : { slug: dto.serviceSlug }),
        },
        select: { id: true, name: true },
      });
      // An unknown reference is dropped rather than rejected — the enquiry
      // itself is still worth capturing.
      serviceId = service?.id ?? null;
      serviceName = service?.name ?? null;
    }

    let planId: string | null = null;
    if (dto.planId && serviceId) {
      const plan = await prisma.servicePlan.findFirst({
        where: { id: dto.planId, serviceId },
        select: { id: true },
      });
      planId = plan?.id ?? null;
    }

    // A coupon on the enquiry is re-validated server side, never trusted from
    // the form: the price recorded must be one we would actually honour.
    let couponCode: string | null = null;
    let discountAmount: number | null = null;
    let quotedPrice: number | null = null;
    let redeemableCouponId: string | null = null;

    if (dto.couponCode && planId && dto.termMonths) {
      const priceRow = await prisma.servicePlanPrice.findUnique({
        where: { planId_termMonths: { planId, termMonths: dto.termMonths } },
        select: { price: true },
      });
      if (priceRow) {
        const service = serviceId
          ? await prisma.service.findUnique({ where: { id: serviceId }, select: { category: true } })
          : null;
        try {
          const coupon = await resolveCoupon(ownerId, dto.couponCode, {
            category: service?.category,
            serviceId: serviceId ?? undefined,
            termMonths: dto.termMonths,
          });
          const applied = applyCoupon(coupon, toNumber(priceRow.price));
          couponCode = applied.code;
          discountAmount = applied.amountOff;
          quotedPrice = applied.priceAfter;
          redeemableCouponId = coupon.id;
        } catch {
          // An expired or wrong code must not lose the enquiry — record it at
          // list price and let the studio decide whether to honour it.
          quotedPrice = Math.round(toNumber(priceRow.price));
        }
      }
    }

    const quote = await prisma.quoteRequest.create({
      data: {
        userId: ownerId,
        serviceId,
        planId,
        termMonths: dto.termMonths ?? null,
        name: dto.name.trim(),
        email: dto.email.trim().toLowerCase(),
        phone: dto.phone?.trim() || null,
        company: dto.company?.trim() || null,
        message: dto.message?.trim() || null,
        budget: dto.budget?.trim() || null,
        timeline: dto.timeline?.trim() || null,
        source: context.source ?? 'public',
        requestedById: context.requestedById ?? null,
        ipAddress: context.ipAddress ?? null,
        userAgent: context.userAgent?.slice(0, 400) ?? null,
        couponCode,
        discountAmount,
        quotedPrice,
      },
    });

    if (redeemableCouponId) await CouponsService.redeem(redeemableCouponId);

    NotificationService.emitAsync({
      event: 'quote.received',
      userIds: [ownerId],
      context: {
        actorName: quote.name,
        title: serviceName ?? 'General enquiry',
        body: quote.message ?? '',
        reason: [quote.company, quote.budget, quote.timeline].filter(Boolean).join(' · '),
        recipientName: undefined,
        actionUrl: `${process.env.CLIENT_URL ?? ''}/services/quotes/${quote.id}`,
        actionLabel: 'Open the enquiry',
      },
      link: `/services/quotes/${quote.id}`,
    });

    logger.info('Quote request received', { ownerId, quoteId: quote.id, serviceId });
    // Only what the sender needs; the internal fields stay internal.
    return { id: quote.id, name: quote.name, email: quote.email, createdAt: quote.createdAt };
  },

  async listQuotes(
    userId: string,
    query: { status?: QuoteStatus; page: number; limit: number; search?: string },
  ) {
    const where: Prisma.QuoteRequestWhereInput = {
      userId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
              { company: { contains: query.search, mode: 'insensitive' } },
              { message: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total, counts] = await Promise.all([
      prisma.quoteRequest.findMany({
        where,
        include: { service: { select: { id: true, name: true, category: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.quoteRequest.count({ where }),
      prisma.quoteRequest.groupBy({
        by: ['status'],
        where: { userId },
        _count: { _all: true },
      }),
    ]);

    return {
      items,
      total,
      page: query.page,
      limit: query.limit,
      byStatus: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
    };
  },

  async getQuote(userId: string, id: string) {
    const quote = await prisma.quoteRequest.findFirst({
      where: { id, userId },
      include: {
        service: { select: { id: true, name: true, category: true, slug: true } },
        requestedBy: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    });
    if (!quote) throw ApiError.notFound('Enquiry');
    return quote;
  },

  async updateQuote(
    userId: string,
    id: string,
    dto: { status?: QuoteStatus; internalNotes?: string | null; assignedToId?: string | null },
  ) {
    const existing = await prisma.quoteRequest.findFirst({ where: { id, userId } });
    if (!existing) throw ApiError.notFound('Enquiry');

    return prisma.quoteRequest.update({
      where: { id },
      data: {
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.internalNotes !== undefined ? { internalNotes: dto.internalNotes } : {}),
        ...(dto.assignedToId !== undefined ? { assignedToId: dto.assignedToId } : {}),
        // Stamped the first time it leaves NEW, so response time is measurable.
        ...(dto.status && dto.status !== QuoteStatus.NEW && !existing.respondedAt
          ? { respondedAt: new Date() }
          : {}),
      },
    });
  },

  /** Headline numbers for the services dashboard. */
  async stats(userId: string) {
    const [services, quotes, newQuotes, won] = await Promise.all([
      prisma.service.count({ where: { userId, deletedAt: null, isActive: true } }),
      prisma.quoteRequest.count({ where: { userId } }),
      prisma.quoteRequest.count({ where: { userId, status: QuoteStatus.NEW } }),
      prisma.quoteRequest.count({ where: { userId, status: QuoteStatus.WON } }),
    ]);

    return {
      activeServices: services,
      totalQuotes: quotes,
      newQuotes,
      wonQuotes: won,
      conversionRate: quotes > 0 ? Math.round((won / quotes) * 100) : 0,
    };
  },
};

export default ServicesService;
