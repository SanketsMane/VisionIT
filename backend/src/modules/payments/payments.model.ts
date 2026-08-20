import type { Prisma } from '@prisma/client';
import { prisma } from '@config/database';
import type { ListPaymentsDto } from './payments.validation';

export const paymentInclude = {
  invoice: {
    select: {
      id: true, number: true, total: true, balanceDue: true, currency: true, status: true,
      client: { select: { id: true, name: true, companyName: true } },
    },
  },
  account: { select: { id: true, code: true, name: true } },
} satisfies Prisma.PaymentInclude;

export const PaymentsModel = {
  buildWhere(userId: string, query: ListPaymentsDto): Prisma.PaymentWhereInput {
    const where: Prisma.PaymentWhereInput = { userId };
    if (query.method) where.method = query.method;
    if (query.accountId) where.accountId = query.accountId;
    if (query.clientId) where.invoice = { clientId: query.clientId };
    if (query.from || query.to) {
      where.paidAt = {
        ...(query.from ? { gte: query.from } : {}),
        ...(query.to ? { lte: query.to } : {}),
      };
    }
    if (query.search) {
      where.OR = [
        { reference: { contains: query.search, mode: 'insensitive' } },
        { notes: { contains: query.search, mode: 'insensitive' } },
        { invoice: { number: { contains: query.search, mode: 'insensitive' } } },
        { invoice: { client: { name: { contains: query.search, mode: 'insensitive' } } } },
      ];
    }
    return where;
  },

  findMany: (where: Prisma.PaymentWhereInput, args: { skip: number; take: number; orderBy: Prisma.PaymentOrderByWithRelationInput }) =>
    prisma.payment.findMany({ where, ...args, include: paymentInclude }),

  count: (where: Prisma.PaymentWhereInput) => prisma.payment.count({ where }),

  sum: (where: Prisma.PaymentWhereInput) =>
    prisma.payment.aggregate({ where, _sum: { amount: true, feeAmount: true }, _count: { _all: true } }),

  findById: (userId: string, id: string) =>
    prisma.payment.findFirst({ where: { id, userId }, include: paymentInclude }),

  byMethod: (userId: string, range: { from?: Date; to?: Date } = {}) =>
    prisma.payment.groupBy({
      by: ['method'],
      where: {
        userId,
        ...(range.from || range.to
          ? { paidAt: { ...(range.from ? { gte: range.from } : {}), ...(range.to ? { lte: range.to } : {}) } }
          : {}),
      },
      _sum: { amount: true },
      _count: { _all: true },
    }),

  collectedBetween: (userId: string, from: Date, to: Date) =>
    prisma.payment.aggregate({
      where: { userId, paidAt: { gte: from, lte: to } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
};

export default PaymentsModel;
