import { DocumentType, type Prisma } from '@prisma/client';
import { prisma } from '@config/database';
import type { ListInvoicesDto } from './invoices.validation';

const scope = (userId: string): Prisma.InvoiceWhereInput => ({ userId, deletedAt: null });

/** Statuses that represent money the business is still owed. */
export const OPEN_STATUSES = ['SENT', 'VIEWED', 'PARTIALLY_PAID', 'OVERDUE'] as const;

export const invoiceListSelect = {
  id: true,
  number: true,
  documentType: true,
  status: true,
  currency: true,
  issueDate: true,
  dueDate: true,
  total: true,
  amountPaid: true,
  balanceDue: true,
  sentAt: true,
  paidAt: true,
  isRecurring: true,
  createdAt: true,
  client: { select: { id: true, name: true, companyName: true, email: true, avatarUrl: true } },
  project: { select: { id: true, title: true, slug: true } },
  _count: { select: { items: true, payments: true } },
} satisfies Prisma.InvoiceSelect;

export const invoiceDetailInclude = {
  items: { orderBy: { sortOrder: 'asc' } },
  client: { include: { contacts: { where: { isPrimary: true }, take: 1 } } },
  project: { select: { id: true, title: true, slug: true, category: true } },
  payments: {
    orderBy: { paidAt: 'desc' },
    include: { account: { select: { id: true, name: true, code: true } } },
  },
  user: { select: { id: true, name: true, email: true, company: true } },
} satisfies Prisma.InvoiceInclude;

export const InvoicesModel = {
  buildWhere(userId: string, query: ListInvoicesDto): Prisma.InvoiceWhereInput {
    const where: Prisma.InvoiceWhereInput = scope(userId);
    if (query.status) where.status = query.status;
    if (query.documentType) where.documentType = query.documentType;
    if (query.clientId) where.clientId = query.clientId;
    if (query.projectId) where.projectId = query.projectId;
    if (query.from || query.to) {
      where.issueDate = {
        ...(query.from ? { gte: query.from } : {}),
        ...(query.to ? { lte: query.to } : {}),
      };
    }
    if (query.overdueOnly) {
      where.status = { in: [...OPEN_STATUSES] };
      where.dueDate = { lt: new Date() };
    }
    if (query.search) {
      where.OR = [
        { number: { contains: query.search, mode: 'insensitive' } },
        { poNumber: { contains: query.search, mode: 'insensitive' } },
        { notes: { contains: query.search, mode: 'insensitive' } },
        { client: { name: { contains: query.search, mode: 'insensitive' } } },
        { client: { companyName: { contains: query.search, mode: 'insensitive' } } },
      ];
    }
    return where;
  },

  findMany: (where: Prisma.InvoiceWhereInput, args: { skip: number; take: number; orderBy: Prisma.InvoiceOrderByWithRelationInput }) =>
    prisma.invoice.findMany({ where, ...args, select: invoiceListSelect }),

  count: (where: Prisma.InvoiceWhereInput) => prisma.invoice.count({ where }),

  findById: (userId: string, id: string) =>
    prisma.invoice.findFirst({ where: { id, ...scope(userId) }, include: invoiceDetailInclude }),

  findByPublicToken: (token: string) =>
    prisma.invoice.findFirst({
      where: { publicToken: token, deletedAt: null, status: { not: 'DRAFT' } },
      include: invoiceDetailInclude,
    }),

  exists: async (userId: string, id: string): Promise<boolean> =>
    (await prisma.invoice.count({ where: { id, ...scope(userId) } })) > 0,

  create: (data: Prisma.InvoiceCreateInput, tx: Prisma.TransactionClient = prisma) =>
    tx.invoice.create({ data, include: invoiceDetailInclude }),

  update: (userId: string, id: string, data: Prisma.InvoiceUpdateInput, tx: Prisma.TransactionClient = prisma) =>
    tx.invoice.update({ where: { id, userId }, data, include: invoiceDetailInclude }),

  updateRaw: (userId: string, id: string, data: Prisma.InvoiceUpdateInput, tx: Prisma.TransactionClient = prisma) =>
    tx.invoice.update({ where: { id, userId }, data }),

  replaceItems: async (
    invoiceId: string,
    items: Prisma.InvoiceItemCreateManyInput[],
    tx: Prisma.TransactionClient,
  ) => {
    await tx.invoiceItem.deleteMany({ where: { invoiceId } });
    if (items.length) await tx.invoiceItem.createMany({ data: items });
  },

  softDelete: (userId: string, id: string, tx: Prisma.TransactionClient = prisma) =>
    tx.invoice.update({ where: { id, userId }, data: { deletedAt: new Date() } }),

  markViewed: (id: string) =>
    prisma.invoice.updateMany({
      where: { id, viewedAt: null, status: 'SENT' },
      data: { viewedAt: new Date(), status: 'VIEWED' },
    }),

  /** Nightly sweep: flips open invoices past their due date to OVERDUE. */
  flagOverdue: () =>
    prisma.invoice.updateMany({
      where: {
        deletedAt: null,
        status: { in: ['SENT', 'VIEWED', 'PARTIALLY_PAID'] },
        dueDate: { lt: new Date() },
      },
      data: { status: 'OVERDUE' },
    }),

  dueRecurring: (now: Date) =>
    prisma.invoice.findMany({
      where: { deletedAt: null, isRecurring: true, nextRunAt: { lte: now } },
      include: { items: true },
    }),

  // ---- Numbering ----------------------------------------------------------

  /**
   * Atomically reserves the next document number. The `update` returns the
   * post-increment row, so two concurrent creates can never collide.
   */
  async reserveNumber(
    userId: string,
    documentType: DocumentType,
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    const year = new Date().getFullYear();

    const sequence =
      (await tx.numberSequence.findUnique({ where: { userId_documentType_year: { userId, documentType, year } } })) ??
      (await tx.numberSequence.create({
        data: {
          userId,
          documentType,
          year,
          prefix: { INVOICE: 'INV', QUOTATION: 'QUO', PROFORMA: 'PRO', CREDIT_NOTE: 'CN' }[documentType],
        },
      }));

    const updated = await tx.numberSequence.update({
      where: { id: sequence.id },
      data: { nextNumber: { increment: 1 } },
    });

    const serial = String(updated.nextNumber - 1).padStart(updated.padding, '0');
    return updated.resetYearly
      ? `${updated.prefix}-${year}-${serial}`
      : `${updated.prefix}-${serial}`;
  },

  listSequences: (userId: string) =>
    prisma.numberSequence.findMany({ where: { userId }, orderBy: { documentType: 'asc' } }),

  updateSequence: (userId: string, documentType: DocumentType, data: Prisma.NumberSequenceUpdateInput) =>
    prisma.numberSequence.update({
      where: { userId_documentType_year: { userId, documentType, year: new Date().getFullYear() } },
      data,
    }),

  // ---- Aggregates ---------------------------------------------------------

  statusTotals: (userId: string) =>
    prisma.invoice.groupBy({
      by: ['status'],
      where: { ...scope(userId), documentType: DocumentType.INVOICE },
      _sum: { total: true, balanceDue: true },
      _count: { _all: true },
    }),

  outstandingAging: (userId: string) =>
    prisma.invoice.findMany({
      where: { ...scope(userId), documentType: DocumentType.INVOICE, status: { in: [...OPEN_STATUSES] } },
      select: { id: true, number: true, dueDate: true, balanceDue: true, currency: true, client: { select: { id: true, name: true } } },
      orderBy: { dueDate: 'asc' },
    }),

  revenueBetween: (userId: string, from: Date, to: Date) =>
    prisma.invoice.aggregate({
      where: {
        ...scope(userId),
        documentType: DocumentType.INVOICE,
        status: { notIn: ['DRAFT', 'CANCELLED'] },
        issueDate: { gte: from, lte: to },
      },
      _sum: { total: true, taxAmount: true, subtotal: true },
      _count: { _all: true },
    }),
};

export default InvoicesModel;
