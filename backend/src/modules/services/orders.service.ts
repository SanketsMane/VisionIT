import {
  PaymentMethod, Prisma, ServiceOrderStatus, UserType,
} from '@prisma/client';
import { prisma } from '@config/database';
import { env } from '@config/env';
import { logger } from '@config/logger';
import { ApiError } from '@utils/api-error';
import { decryptOptional, encryptOptional } from '@utils/crypto.util';
import { toNumber } from '@utils/money.util';
import { removePrivateFile } from '@utils/private-storage';
import { NotificationService } from '@modules/notifications/notification.service';
import { sendTemplatedEmail } from '@modules/notifications/email-sender';
import { applyCoupon, resolveCoupon } from './coupons.service';
import { quoteForAmount } from './slabs';

/**
 * Ordering a service, from "I want this" through to credentials landing in an
 * inbox.
 *
 * The lifecycle is deliberately explicit rather than a boolean soup:
 *
 *   QUOTE_REQUESTED → QUOTED → AWAITING_PAYMENT → PAYMENT_SUBMITTED → ACTIVE
 *                                      ↖──────── REJECTED ────────↙
 *
 * Anything publicly priced skips the first two states and starts at
 * AWAITING_PAYMENT. Anything quote-only cannot be paid until the studio has put
 * a number on it, which is what makes per-client pricing possible without
 * publishing it.
 */

const orderInclude = {
  service: { select: { id: true, name: true, slug: true, category: true, icon: true, accentColor: true } },
  plan: { select: { id: true, name: true, slug: true, specs: true } },
  clientUser: { select: { id: true, name: true, email: true } },
  client: { select: { id: true, name: true, companyName: true } },
} satisfies Prisma.ServiceOrderInclude;

type OrderRow = Prisma.ServiceOrderGetPayload<{ include: typeof orderInclude }>;

/** Client-facing shape. Internal notes and credentials never appear here. */
const shapeForClient = (order: OrderRow) => ({
  id: order.id,
  orderNumber: order.orderNumber,
  status: order.status,
  service: order.service,
  plan: order.plan,
  termMonths: order.termMonths,
  listPrice: toNumber(order.listPrice),
  couponCode: order.couponCode,
  discountAmount: order.discountAmount ? toNumber(order.discountAmount) : null,
  finalPrice: order.finalPrice ? toNumber(order.finalPrice) : null,
  currency: order.currency,
  quantity: order.quantity,
  unitPrice: order.unitPrice ? toNumber(order.unitPrice) : null,
  validityLabel: order.validityLabel,
  requirements: order.requirements,
  deliveryEmail: order.deliveryEmail,
  paymentMethod: order.paymentMethod,
  paymentReference: order.paymentReference,
  paidAt: order.paidAt,
  hasProof: Boolean(order.proofKey),
  proofFilename: order.proofFilename,
  submittedAt: order.submittedAt,
  rejectionReason: order.rejectionReason,
  deliveryNote: order.deliveryNote,
  deliveredAt: order.deliveredAt,
  expiresAt: order.expiresAt,
  createdAt: order.createdAt,
  /** Whether the client can act, so the UI does not have to re-derive the rules. */
  canPay: order.status === ServiceOrderStatus.AWAITING_PAYMENT || order.status === ServiceOrderStatus.QUOTED || order.status === ServiceOrderStatus.REJECTED,
  awaitingQuote: order.status === ServiceOrderStatus.QUOTE_REQUESTED,
});

const shapeForStudio = (order: OrderRow) => ({
  ...shapeForClient(order),
  customPrice: order.customPrice ? toNumber(order.customPrice) : null,
  internalNotes: order.internalNotes,
  clientUser: order.clientUser,
  client: order.client,
  reviewedAt: order.reviewedAt,
  hasCredentials: Boolean(order.credentialsEncrypted),
});

/**
 * Order numbers are sequential per studio per year.
 *
 * Generated inside the same transaction as the insert, and backed by a unique
 * constraint — two clients ordering at the same instant would otherwise both
 * read the same count and produce the same number.
 */
const nextOrderNumber = async (tx: Prisma.TransactionClient, userId: string): Promise<string> => {
  const year = new Date().getFullYear();
  const prefix = `ORD-${year}-`;
  const latest = await tx.serviceOrder.findFirst({
    where: { userId, orderNumber: { startsWith: prefix } },
    orderBy: { orderNumber: 'desc' },
    select: { orderNumber: true },
  });
  const serial = latest ? Number(latest.orderNumber.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(serial).padStart(4, '0')}`;
};

/** The studio that owns the catalog. One internal workspace per install. */
const resolveVendor = async (): Promise<string> => {
  const owner = await prisma.user.findFirst({
    where: { userType: UserType.INTERNAL, isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!owner) throw ApiError.notFound('Catalog');
  return owner.id;
};

export const OrdersService = {
  /**
   * Places an order.
   *
   * A publicly priced plan is priced here and moves straight to awaiting
   * payment; anything else becomes a quote request. The price is resolved
   * server side from the catalog, never taken from the request — a client
   * cannot name their own figure.
   */
  async create(
    clientUser: Express.AuthenticatedUser,
    dto: {
      serviceId: string;
      planId?: string;
      termMonths?: number;
      couponCode?: string;
      requirements?: string;
      deliveryEmail: string;
      requestQuote?: boolean;
      /** SLAB services only: what the client wants to spend. */
      amount?: number;
    },
  ) {
    const vendorId = await resolveVendor();

    const service = await prisma.service.findFirst({
      where: { id: dto.serviceId, userId: vendorId, deletedAt: null, isActive: true },
      select: {
        id: true, name: true, category: true, pricingModel: true,
        startingPrice: true, minOrderAmount: true, unitLabel: true,
      },
    });
    if (!service) throw ApiError.notFound('Service');

    let listPrice = 0;
    let couponCode: string | null = null;
    let discountAmount: number | null = null;
    let finalPrice: number | null = null;

    // Slab services are priced from the amount the client typed. The band is
    // chosen here, not in the browser, so the credits written on the order are
    // ones we actually agreed to sell.
    if (service.pricingModel === 'SLAB') {
      const slabs = await prisma.servicePriceSlab.findMany({
        where: { serviceId: service.id },
        orderBy: { minAmount: 'asc' },
      });
      const quote = quoteForAmount(
        slabs,
        dto.amount ?? 0,
        service.minOrderAmount ? toNumber(service.minOrderAmount) : null,
      );
      const order = await prisma.$transaction(async (tx) => {
        const orderNumber = await nextOrderNumber(tx, vendorId);
        return tx.serviceOrder.create({
          data: {
            orderNumber,
            userId: vendorId,
            clientUserId: clientUser.id,
            serviceId: service.id,
            listPrice: quote.amount,
            finalPrice: quote.amount,
            quantity: quote.quantity,
            unitPrice: quote.unitPrice,
            validityLabel: quote.validityLabel,
            requirements: dto.requirements?.trim() || null,
            deliveryEmail: dto.deliveryEmail.trim().toLowerCase(),
            status: ServiceOrderStatus.AWAITING_PAYMENT,
          },
          include: orderInclude,
        });
      });

      NotificationService.emitAsync({
        event: 'order.placed',
        userIds: [vendorId],
        context: {
          actorName: clientUser.name,
          title: `${service.name} — ${quote.quantity.toLocaleString('en-IN')} ${service.unitLabel ?? 'units'}`,
          invoiceNumber: order.orderNumber,
          amount: `₹${quote.amount.toLocaleString('en-IN')}`,
          body: order.requirements ?? '',
          actionUrl: `${env.CLIENT_URL}/services/orders/${order.id}`,
          actionLabel: 'Open the order',
        },
        link: `/services/orders/${order.id}`,
      });

      logger.info('Slab order created', { orderId: order.id, amount: quote.amount, quantity: quote.quantity });
      return shapeForClient(order);
    }

    const wantsQuote = dto.requestQuote || !dto.planId || service.pricingModel === 'QUOTE_ONLY';

    if (!wantsQuote && dto.planId && dto.termMonths) {
      const priceRow = await prisma.servicePlanPrice.findFirst({
        where: { planId: dto.planId, termMonths: dto.termMonths, plan: { serviceId: service.id } },
        select: { price: true },
      });
      if (!priceRow) throw ApiError.badRequest('That plan is not available on the term you picked');

      listPrice = toNumber(priceRow.price);
      finalPrice = Math.round(listPrice);

      if (dto.couponCode) {
        try {
          const coupon = await resolveCoupon(vendorId, dto.couponCode, {
            category: service.category,
            serviceId: service.id,
            termMonths: dto.termMonths,
          });
          const applied = applyCoupon(coupon, listPrice);
          couponCode = applied.code;
          discountAmount = applied.amountOff;
          finalPrice = applied.priceAfter;
          await prisma.coupon.update({ where: { id: coupon.id }, data: { usedCount: { increment: 1 } } });
        } catch {
          // A bad code must not block the order — it proceeds at list price and
          // the client can raise it with the studio.
        }
      }
    }

    // Link the business record when this portal user already maps to one.
    const membership = await prisma.projectMember.findFirst({
      where: { userId: clientUser.id, isActive: true, project: { clientId: { not: null } } },
      select: { project: { select: { clientId: true } } },
    });

    const order = await prisma.$transaction(async (tx) => {
      const orderNumber = await nextOrderNumber(tx, vendorId);
      return tx.serviceOrder.create({
        data: {
          orderNumber,
          userId: vendorId,
          clientUserId: clientUser.id,
          clientId: membership?.project.clientId ?? null,
          serviceId: service.id,
          planId: wantsQuote ? null : (dto.planId ?? null),
          termMonths: wantsQuote ? null : (dto.termMonths ?? null),
          listPrice,
          couponCode,
          discountAmount,
          finalPrice,
          requirements: dto.requirements?.trim() || null,
          deliveryEmail: dto.deliveryEmail.trim().toLowerCase(),
          status: wantsQuote ? ServiceOrderStatus.QUOTE_REQUESTED : ServiceOrderStatus.AWAITING_PAYMENT,
        },
        include: orderInclude,
      });
    });

    NotificationService.emitAsync({
      event: wantsQuote ? 'order.quote_requested' : 'order.placed',
      userIds: [vendorId],
      context: {
        actorName: clientUser.name,
        title: `${service.name}${order.plan ? ` — ${order.plan.name}` : ''}`,
        invoiceNumber: order.orderNumber,
        amount: finalPrice ? `₹${finalPrice.toLocaleString('en-IN')}` : undefined,
        body: order.requirements ?? '',
        actionUrl: `${env.CLIENT_URL}/services/orders/${order.id}`,
        actionLabel: 'Open the order',
      },
      link: `/services/orders/${order.id}`,
    });

    logger.info('Service order created', { orderId: order.id, vendorId, status: order.status });
    return shapeForClient(order);
  },

  /** The client's own orders. */
  async listForClient(clientUserId: string) {
    const rows = await prisma.serviceOrder.findMany({
      where: { clientUserId },
      include: orderInclude,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(shapeForClient);
  },

  async getForClient(clientUserId: string, id: string) {
    const order = await prisma.serviceOrder.findFirst({
      where: { id, clientUserId },
      include: orderInclude,
    });
    if (!order) throw ApiError.notFound('Order');
    return shapeForClient(order);
  },

  /**
   * How to pay.
   *
   * Read from the studio's own company profile rather than hard-coded, and
   * returns only what has actually been filled in — showing an empty "IFSC:"
   * row is worse than omitting it.
   */
  async paymentDetails() {
    const vendorId = await resolveVendor();
    const company = await prisma.companyProfile.findUnique({
      where: { userId: vendorId },
      select: {
        legalName: true, tradeName: true, bankName: true, bankAccountName: true,
        bankAccountNumber: true, bankIfsc: true, bankSwift: true, upiId: true,
        email: true, phone: true,
      },
    });
    if (!company) return { methods: [], businessName: null };

    const methods: { type: string; label: string; rows: { label: string; value: string }[] }[] = [];

    if (company.upiId) {
      methods.push({
        type: 'UPI',
        label: 'UPI',
        rows: [{ label: 'UPI ID', value: company.upiId }],
      });
    }

    const bankRows = [
      company.bankName ? { label: 'Bank', value: company.bankName } : null,
      company.bankAccountName ? { label: 'Account name', value: company.bankAccountName } : null,
      company.bankAccountNumber ? { label: 'Account number', value: company.bankAccountNumber } : null,
      company.bankIfsc ? { label: 'IFSC', value: company.bankIfsc } : null,
      company.bankSwift ? { label: 'SWIFT', value: company.bankSwift } : null,
    ].filter(Boolean) as { label: string; value: string }[];

    if (bankRows.length) {
      methods.push({ type: 'BANK_TRANSFER', label: 'Bank transfer', rows: bankRows });
    }

    return {
      businessName: company.tradeName ?? company.legalName,
      supportEmail: company.email,
      supportPhone: company.phone,
      methods,
    };
  },

  /**
   * Records that the client says they have paid.
   *
   * Nothing is marked paid here — only that proof was submitted. The money is
   * not real until a person has looked at it.
   */
  async submitPayment(
    clientUser: Express.AuthenticatedUser,
    id: string,
    dto: { method: PaymentMethod; reference?: string; paidAt: Date; note?: string },
    file?: { storageKey: string; filename: string; mimeType: string },
  ) {
    const order = await prisma.serviceOrder.findFirst({
      where: { id, clientUserId: clientUser.id },
      include: orderInclude,
    });
    if (!order) throw ApiError.notFound('Order');

    if (order.status === ServiceOrderStatus.QUOTE_REQUESTED) {
      throw ApiError.badRequest('This is still waiting for a price — we will send it shortly');
    }
    if (order.status === ServiceOrderStatus.ACTIVE) {
      throw ApiError.badRequest('This order is already active');
    }
    if (order.status === ServiceOrderStatus.PAYMENT_SUBMITTED) {
      throw ApiError.badRequest('Your payment is already with us for verification');
    }
    if (!order.finalPrice) throw ApiError.badRequest('This order has no price yet');

    // Replacing a rejected proof should not leave the old file behind.
    if (file && order.proofKey) {
      try { removePrivateFile(order.proofKey); } catch { /* already gone */ }
    }

    const updated = await prisma.serviceOrder.update({
      where: { id },
      data: {
        paymentMethod: dto.method,
        paymentReference: dto.reference?.trim() || null,
        paidAt: dto.paidAt,
        ...(file
          ? { proofKey: file.storageKey, proofFilename: file.filename, proofMimeType: file.mimeType }
          : {}),
        ...(dto.note ? { requirements: order.requirements } : {}),
        status: ServiceOrderStatus.PAYMENT_SUBMITTED,
        submittedAt: new Date(),
        rejectionReason: null,
      },
      include: orderInclude,
    });

    NotificationService.emitAsync({
      event: 'order.payment_submitted',
      userIds: [order.userId],
      context: {
        actorName: clientUser.name,
        title: `${order.service.name}${order.plan ? ` — ${order.plan.name}` : ''}`,
        invoiceNumber: order.orderNumber,
        amount: `₹${toNumber(order.finalPrice).toLocaleString('en-IN')}`,
        method: dto.method,
        reference: dto.reference ?? undefined,
        actionUrl: `${env.CLIENT_URL}/services/orders/${order.id}`,
        actionLabel: 'Verify the payment',
      },
      link: `/services/orders/${order.id}`,
    });

    return shapeForClient(updated);
  },

  // ── Studio ───────────────────────────────────────────────────────────────

  async listForStudio(userId: string, filters: { status?: ServiceOrderStatus } = {}) {
    const rows = await prisma.serviceOrder.findMany({
      where: { userId, ...(filters.status ? { status: filters.status } : {}) },
      include: orderInclude,
      orderBy: { createdAt: 'desc' },
    });

    const counts = await prisma.serviceOrder.groupBy({
      by: ['status'],
      where: { userId },
      _count: { _all: true },
    });

    return {
      items: rows.map(shapeForStudio),
      byStatus: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
    };
  },

  async getForStudio(userId: string, id: string) {
    const order = await prisma.serviceOrder.findFirst({ where: { id, userId }, include: orderInclude });
    if (!order) throw ApiError.notFound('Order');
    return shapeForStudio(order);
  },

  /**
   * Puts a price on a quote request — the per-client price.
   *
   * Stored as `customPrice` and copied to `finalPrice`, so the catalog rate and
   * the negotiated one stay distinguishable long after the fact.
   */
  async setPrice(userId: string, id: string, price: number, note?: string) {
    const order = await prisma.serviceOrder.findFirst({ where: { id, userId }, include: orderInclude });
    if (!order) throw ApiError.notFound('Order');
    if (order.status === ServiceOrderStatus.ACTIVE) {
      throw ApiError.badRequest('This order is already active');
    }

    const updated = await prisma.serviceOrder.update({
      where: { id },
      data: {
        customPrice: price,
        finalPrice: price,
        status: ServiceOrderStatus.QUOTED,
        ...(note ? { deliveryNote: note } : {}),
      },
      include: orderInclude,
    });

    NotificationService.emitAsync({
      event: 'order.quoted',
      userIds: [order.clientUserId],
      context: {
        recipientName: order.clientUser.name,
        title: `${order.service.name}${order.plan ? ` — ${order.plan.name}` : ''}`,
        invoiceNumber: order.orderNumber,
        amount: `₹${price.toLocaleString('en-IN')}`,
        body: note ?? '',
        actionUrl: `${env.CLIENT_URL}/portal/services/orders/${order.id}`,
        actionLabel: 'View and pay',
      },
      link: `/portal/services/orders/${order.id}`,
    });

    return shapeForStudio(updated);
  },

  /**
   * Approves the payment and hands over.
   *
   * Credentials are encrypted with the same key that protects stored SMTP
   * passwords, and go out to the address the client nominated — often a
   * personal Gmail rather than the one they sign in with.
   */
  async approve(
    userId: string,
    id: string,
    dto: { credentials?: string; deliveryNote?: string; expiresAt?: Date },
  ) {
    const order = await prisma.serviceOrder.findFirst({ where: { id, userId }, include: orderInclude });
    if (!order) throw ApiError.notFound('Order');
    if (order.status !== ServiceOrderStatus.PAYMENT_SUBMITTED) {
      throw ApiError.badRequest('Only a submitted payment can be approved');
    }

    const updated = await prisma.serviceOrder.update({
      where: { id },
      data: {
        status: ServiceOrderStatus.ACTIVE,
        reviewedById: userId,
        reviewedAt: new Date(),
        rejectionReason: null,
        credentialsEncrypted: encryptOptional(dto.credentials ?? null),
        deliveryNote: dto.deliveryNote?.trim() || order.deliveryNote,
        deliveredAt: new Date(),
        expiresAt:
          dto.expiresAt ??
          (order.termMonths
            ? new Date(new Date().setMonth(new Date().getMonth() + order.termMonths))
            : null),
      },
      include: orderInclude,
    });

    NotificationService.emitAsync({
      event: 'order.approved',
      userIds: [order.clientUserId],
      context: {
        recipientName: order.clientUser.name,
        title: `${order.service.name}${order.plan ? ` — ${order.plan.name}` : ''}`,
        invoiceNumber: order.orderNumber,
        amount: order.finalPrice ? `₹${toNumber(order.finalPrice).toLocaleString('en-IN')}` : undefined,
        body: dto.deliveryNote ?? '',
        // Credentials themselves are deliberately not in the notification —
        // they go in their own email to the nominated address.
        reason: dto.credentials ? 'credentials' : undefined,
        actionUrl: `${env.CLIENT_URL}/portal/services/orders/${order.id}`,
        actionLabel: 'View your order',
      },
      link: `/portal/services/orders/${order.id}`,
    });

    // Credentials go in their own email, to the address the client nominated —
    // often a personal Gmail rather than the one they sign in with. Kept apart
    // from the "your order is active" notice so it is easy to find later and
    // easy not to forward by accident.
    if (dto.credentials?.trim()) {
      void sendTemplatedEmail({
        to: order.deliveryEmail,
        event: 'order.credentials',
        userId: order.clientUserId,
        context: {
          recipientName: order.clientUser.name,
          title: `${order.service.name}${order.plan ? ` — ${order.plan.name}` : ''}`,
          body: dto.credentials.trim(),
          reason: dto.deliveryNote?.trim() || undefined,
          actionUrl: `${env.CLIENT_URL}/portal/services/orders/${order.id}`,
          actionLabel: 'View your order',
        },
      }).catch((error: unknown) =>
        logger.error('Could not email credentials', { orderId: id, error: String(error) }),
      );
    }

    logger.info('Service order approved', { orderId: id, hasCredentials: Boolean(dto.credentials) });
    return shapeForStudio(updated);
  },

  async reject(userId: string, id: string, reason: string) {
    const order = await prisma.serviceOrder.findFirst({ where: { id, userId }, include: orderInclude });
    if (!order) throw ApiError.notFound('Order');
    if (order.status !== ServiceOrderStatus.PAYMENT_SUBMITTED) {
      throw ApiError.badRequest('Only a submitted payment can be rejected');
    }

    const updated = await prisma.serviceOrder.update({
      where: { id },
      data: {
        status: ServiceOrderStatus.REJECTED,
        reviewedById: userId,
        reviewedAt: new Date(),
        rejectionReason: reason.trim(),
      },
      include: orderInclude,
    });

    NotificationService.emitAsync({
      event: 'order.rejected',
      userIds: [order.clientUserId],
      context: {
        recipientName: order.clientUser.name,
        title: `${order.service.name}`,
        invoiceNumber: order.orderNumber,
        amount: order.finalPrice ? `₹${toNumber(order.finalPrice).toLocaleString('en-IN')}` : undefined,
        reason: reason.trim(),
        actionUrl: `${env.CLIENT_URL}/portal/services/orders/${order.id}`,
        actionLabel: 'Submit again',
      },
      link: `/portal/services/orders/${order.id}`,
    });

    return shapeForStudio(updated);
  },

  /** Reveals stored credentials to the studio, decrypted on read. */
  async credentials(userId: string, id: string) {
    const order = await prisma.serviceOrder.findFirst({
      where: { id, userId },
      select: { credentialsEncrypted: true },
    });
    if (!order) throw ApiError.notFound('Order');
    return { credentials: decryptOptional(order.credentialsEncrypted) };
  },

  async updateNotes(userId: string, id: string, internalNotes: string | null) {
    const order = await prisma.serviceOrder.findFirst({ where: { id, userId } });
    if (!order) throw ApiError.notFound('Order');
    return prisma.serviceOrder.update({ where: { id }, data: { internalNotes } });
  },

  // ── Help thread ──────────────────────────────────────────────────────────

  /**
   * Messages on an order.
   *
   * Separate from project chat because an order is not a project — a client
   * buying hosting may have no project at all, and the studio wants the
   * question beside the order rather than in a conversation list.
   */
  async messages(user: Express.AuthenticatedUser, id: string) {
    const isInternal = user.userType === UserType.INTERNAL;
    const order = await prisma.serviceOrder.findFirst({
      where: isInternal ? { id, userId: user.id } : { id, clientUserId: user.id },
      select: { id: true },
    });
    if (!order) throw ApiError.notFound('Order');

    return prisma.serviceOrderMessage.findMany({
      where: { orderId: id, ...(isInternal ? {} : { isInternal: false }) },
      include: { author: { select: { id: true, name: true, avatarUrl: true, userType: true } } },
      orderBy: { createdAt: 'asc' },
    });
  },

  async addMessage(user: Express.AuthenticatedUser, id: string, body: string, isInternal = false) {
    const actorIsInternal = user.userType === UserType.INTERNAL;
    const order = await prisma.serviceOrder.findFirst({
      where: actorIsInternal ? { id, userId: user.id } : { id, clientUserId: user.id },
      include: orderInclude,
    });
    if (!order) throw ApiError.notFound('Order');

    const message = await prisma.serviceOrderMessage.create({
      data: {
        orderId: id,
        authorId: user.id,
        body: body.trim(),
        // A client can never post an internal note, whatever they send.
        isInternal: actorIsInternal ? isInternal : false,
      },
      include: { author: { select: { id: true, name: true, avatarUrl: true, userType: true } } },
    });

    if (!message.isInternal) {
      NotificationService.emitAsync({
        event: 'order.message',
        userIds: [actorIsInternal ? order.clientUserId : order.userId],
        context: {
          actorName: user.name,
          title: `${order.service.name} · ${order.orderNumber}`,
          body: message.body,
          actionUrl: `${env.CLIENT_URL}${actorIsInternal ? '/portal' : ''}/services/orders/${order.id}`,
          actionLabel: 'Open the order',
        },
        link: `${actorIsInternal ? '/portal' : ''}/services/orders/${order.id}`,
      });
    }

    return message;
  },
};

export default OrdersService;
