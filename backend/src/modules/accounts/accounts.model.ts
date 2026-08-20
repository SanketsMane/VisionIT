import { Prisma, type Account, type AccountType } from '@prisma/client';
import { prisma } from '@config/database';
import type { ListAccountsDto } from './accounts.validation';

export const AccountsModel = {
  buildWhere(userId: string, query: ListAccountsDto): Prisma.AccountWhereInput {
    const where: Prisma.AccountWhereInput = { userId };
    if (query.type) where.type = query.type;
    if (query.subtype) where.subtype = query.subtype;
    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    return where;
  },

  findMany: (where: Prisma.AccountWhereInput) =>
    prisma.account.findMany({
      where,
      orderBy: [{ type: 'asc' }, { code: 'asc' }],
      include: { _count: { select: { lines: true, children: true } } },
    }),

  findById: (userId: string, id: string) =>
    prisma.account.findFirst({ where: { id, userId }, include: { parent: true, children: true } }),

  findByCode: (userId: string, code: string): Promise<Account | null> =>
    prisma.account.findUnique({ where: { userId_code: { userId, code } } }),

  findManyByCodes: (userId: string, codes: string[]) =>
    prisma.account.findMany({ where: { userId, code: { in: codes } } }),

  create: (userId: string, data: Omit<Prisma.AccountCreateInput, 'user'>) =>
    prisma.account.create({ data: { ...data, user: { connect: { id: userId } } } }),

  update: (userId: string, id: string, data: Prisma.AccountUpdateInput) =>
    prisma.account.update({ where: { id, userId }, data }),

  delete: (userId: string, id: string) => prisma.account.delete({ where: { id, userId } }),

  hasTransactions: async (accountId: string): Promise<boolean> =>
    (await prisma.journalLine.count({ where: { accountId } })) > 0,

  /**
   * Debit/credit totals per account from POSTED entries only, optionally cut
   * off at a date. This is the single primitive every statement is built on —
   * trial balance, balance sheet, P&L and the account ledger all reduce to it.
   */
  balancesByAccount: (userId: string, options: { from?: Date; to?: Date } = {}) =>
    prisma.journalLine.groupBy({
      by: ['accountId'],
      where: {
        account: { userId },
        entry: {
          userId,
          status: 'POSTED',
          ...(options.from || options.to
            ? { date: { ...(options.from ? { gte: options.from } : {}), ...(options.to ? { lte: options.to } : {}) } }
            : {}),
        },
      },
      _sum: { debit: true, credit: true },
    }),

  /** Movement on a single account, newest first, for the drill-down view. */
  ledgerLines: (
    userId: string,
    accountId: string,
    options: { from?: Date; to?: Date; skip: number; take: number },
  ) =>
    prisma.journalLine.findMany({
      where: {
        accountId,
        account: { userId },
        entry: {
          status: 'POSTED',
          ...(options.from || options.to
            ? { date: { ...(options.from ? { gte: options.from } : {}), ...(options.to ? { lte: options.to } : {}) } }
            : {}),
        },
      },
      include: {
        entry: {
          select: {
            id: true, entryNumber: true, date: true, narration: true, reference: true,
            source: true, invoiceId: true, paymentId: true, expenseId: true,
          },
        },
      },
      orderBy: [{ entry: { date: 'desc' } }, { sortOrder: 'asc' }],
      skip: options.skip,
      take: options.take,
    }),

  ledgerLineCount: (userId: string, accountId: string, options: { from?: Date; to?: Date } = {}) =>
    prisma.journalLine.count({
      where: {
        accountId,
        account: { userId },
        entry: {
          status: 'POSTED',
          ...(options.from || options.to
            ? { date: { ...(options.from ? { gte: options.from } : {}), ...(options.to ? { lte: options.to } : {}) } }
            : {}),
        },
      },
    }),

  /** Sum of movement strictly before a date — the opening balance of a period. */
  openingMovement: (userId: string, accountId: string, before: Date) =>
    prisma.journalLine.aggregate({
      where: { accountId, account: { userId }, entry: { status: 'POSTED', date: { lt: before } } },
      _sum: { debit: true, credit: true },
    }),

  typeTotals: (userId: string, types: AccountType[], options: { from?: Date; to?: Date } = {}) =>
    prisma.journalLine.groupBy({
      by: ['accountId'],
      where: {
        account: { userId, type: { in: types } },
        entry: {
          status: 'POSTED',
          ...(options.from || options.to
            ? { date: { ...(options.from ? { gte: options.from } : {}), ...(options.to ? { lte: options.to } : {}) } }
            : {}),
        },
      },
      _sum: { debit: true, credit: true },
    }),
};

export default AccountsModel;
