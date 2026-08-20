import type { Prisma } from '@prisma/client';
import { prisma } from '@config/database';

export const journalEntryInclude = {
  lines: {
    include: { account: { select: { id: true, code: true, name: true, type: true, subtype: true } } },
    orderBy: { sortOrder: 'asc' },
  },
} satisfies Prisma.JournalEntryInclude;

export const LedgerModel = {
  create: (data: Prisma.JournalEntryCreateInput, tx: Prisma.TransactionClient = prisma) =>
    tx.journalEntry.create({ data, include: journalEntryInclude }),

  findById: (userId: string, id: string) =>
    prisma.journalEntry.findFirst({ where: { id, userId }, include: journalEntryInclude }),

  findMany: (where: Prisma.JournalEntryWhereInput, args: { skip: number; take: number }) =>
    prisma.journalEntry.findMany({
      where,
      ...args,
      include: journalEntryInclude,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    }),

  count: (where: Prisma.JournalEntryWhereInput) => prisma.journalEntry.count({ where }),

  findBySource: (
    userId: string,
    field: 'invoiceId' | 'paymentId' | 'expenseId',
    sourceId: string,
    tx: Prisma.TransactionClient = prisma,
  ) => tx.journalEntry.findMany({ where: { userId, [field]: sourceId, status: 'POSTED' }, include: journalEntryInclude }),

  void: (userId: string, id: string, tx: Prisma.TransactionClient = prisma) =>
    tx.journalEntry.update({ where: { id, userId }, data: { status: 'VOID' } }),

  voidBySource: (
    userId: string,
    field: 'invoiceId' | 'paymentId' | 'expenseId',
    sourceId: string,
    tx: Prisma.TransactionClient = prisma,
  ) =>
    tx.journalEntry.updateMany({
      where: { userId, [field]: sourceId, status: 'POSTED' },
      data: { status: 'VOID' },
    }),

  /**
   * Highest sequence used this year, read inside the caller's transaction so
   * two concurrent postings can't mint the same entry number.
   */
  lastEntryNumberForYear: (userId: string, year: number, tx: Prisma.TransactionClient = prisma) =>
    tx.journalEntry.findFirst({
      where: { userId, entryNumber: { startsWith: `JE-${year}-` } },
      orderBy: { entryNumber: 'desc' },
      select: { entryNumber: true },
    }),
};

export default LedgerModel;
