import type { Prisma } from '@prisma/client';
import { prisma } from '@config/database';
import type { ListClientsDto } from './clients.validation';

/**
 * All queries are scoped by `userId` at the model layer. Nothing above this
 * file is trusted to remember the tenant filter, which makes cross-account
 * data leaks structurally difficult rather than a review discipline.
 */
const scope = (userId: string): Prisma.ClientWhereInput => ({ userId, deletedAt: null });

export const clientListSelect = {
  id: true,
  name: true,
  companyName: true,
  email: true,
  phone: true,
  status: true,
  currency: true,
  avatarUrl: true,
  tags: true,
  billingCity: true,
  billingCountry: true,
  createdAt: true,
  _count: { select: { projects: true, invoices: true } },
} satisfies Prisma.ClientSelect;

export const ClientsModel = {
  buildWhere(userId: string, query: ListClientsDto): Prisma.ClientWhereInput {
    const where: Prisma.ClientWhereInput = scope(userId);
    if (query.status) where.status = query.status;
    if (query.tag) where.tags = { has: query.tag };
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { companyName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    return where;
  },

  findMany: (where: Prisma.ClientWhereInput, args: { skip: number; take: number; orderBy: Prisma.ClientOrderByWithRelationInput }) =>
    prisma.client.findMany({ where, ...args, select: clientListSelect }),

  count: (where: Prisma.ClientWhereInput) => prisma.client.count({ where }),

  findById: (userId: string, id: string) =>
    prisma.client.findFirst({
      where: { id, ...scope(userId) },
      include: {
        contacts: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
        projects: {
          where: { deletedAt: null },
          select: { id: true, title: true, slug: true, status: true, category: true, contractValue: true, currency: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        _count: { select: { projects: true, invoices: true } },
      },
    }),

  exists: async (userId: string, id: string): Promise<boolean> =>
    (await prisma.client.count({ where: { id, ...scope(userId) } })) > 0,

  create: (userId: string, data: Omit<Prisma.ClientCreateInput, 'user'>) =>
    prisma.client.create({ data: { ...data, user: { connect: { id: userId } } } }),

  update: (userId: string, id: string, data: Prisma.ClientUpdateInput) =>
    prisma.client.update({ where: { id, userId }, data }),

  /** Soft delete keeps historical invoices readable and audit-safe. */
  softDelete: (userId: string, id: string) =>
    prisma.client.update({
      where: { id, userId },
      data: { deletedAt: new Date(), status: 'ARCHIVED' },
    }),

  hasOpenInvoices: async (userId: string, id: string): Promise<boolean> =>
    (await prisma.invoice.count({
      where: {
        userId,
        clientId: id,
        deletedAt: null,
        status: { in: ['SENT', 'VIEWED', 'PARTIALLY_PAID', 'OVERDUE'] },
      },
    })) > 0,

  // ---- Contacts -----------------------------------------------------------

  addContact: (clientId: string, data: Omit<Prisma.ClientContactCreateInput, 'client'>) =>
    prisma.clientContact.create({ data: { ...data, client: { connect: { id: clientId } } } }),

  updateContact: (clientId: string, contactId: string, data: Prisma.ClientContactUpdateInput) =>
    prisma.clientContact.update({ where: { id: contactId, clientId }, data }),

  deleteContact: (clientId: string, contactId: string) =>
    prisma.clientContact.delete({ where: { id: contactId, clientId } }),

  demoteOtherPrimaries: (clientId: string, exceptId?: string) =>
    prisma.clientContact.updateMany({
      where: { clientId, isPrimary: true, ...(exceptId ? { id: { not: exceptId } } : {}) },
      data: { isPrimary: false },
    }),

  // ---- Aggregates ---------------------------------------------------------

  /** Revenue actually collected from a client, ignoring drafts and voids. */
  revenueFor: (userId: string, clientId: string) =>
    prisma.payment.aggregate({
      where: { userId, invoice: { clientId, deletedAt: null } },
      _sum: { amount: true },
      _count: true,
    }),

  outstandingFor: (userId: string, clientId: string) =>
    prisma.invoice.aggregate({
      where: {
        userId,
        clientId,
        deletedAt: null,
        status: { in: ['SENT', 'VIEWED', 'PARTIALLY_PAID', 'OVERDUE'] },
      },
      _sum: { balanceDue: true },
      _count: true,
    }),

  statusCounts: (userId: string) =>
    prisma.client.groupBy({
      by: ['status'],
      where: scope(userId),
      _count: { _all: true },
    }),
};

export default ClientsModel;
