import type { Prisma } from '@prisma/client';
import { prisma } from '@config/database';
import type { ListExpensesDto } from './expenses.validation';

const scope = (userId: string): Prisma.ExpenseWhereInput => ({ userId, deletedAt: null });

export const expenseInclude = {
  category: { select: { id: true, name: true, color: true } },
  project: { select: { id: true, title: true, slug: true } },
  paidFrom: { select: { id: true, code: true, name: true } },
} satisfies Prisma.ExpenseInclude;

export const ExpensesModel = {
  buildWhere(userId: string, query: ListExpensesDto): Prisma.ExpenseWhereInput {
    const where: Prisma.ExpenseWhereInput = scope(userId);
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.projectId) where.projectId = query.projectId;
    if (query.billable !== undefined) where.billable = query.billable;
    if (query.from || query.to) {
      where.date = {
        ...(query.from ? { gte: query.from } : {}),
        ...(query.to ? { lte: query.to } : {}),
      };
    }
    if (query.search) {
      where.OR = [
        { vendor: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { reference: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    return where;
  },

  findMany: (where: Prisma.ExpenseWhereInput, args: { skip: number; take: number; orderBy: Prisma.ExpenseOrderByWithRelationInput }) =>
    prisma.expense.findMany({ where, ...args, include: expenseInclude }),

  count: (where: Prisma.ExpenseWhereInput) => prisma.expense.count({ where }),

  sum: (where: Prisma.ExpenseWhereInput) =>
    prisma.expense.aggregate({ where, _sum: { total: true, taxAmount: true }, _count: { _all: true } }),

  findById: (userId: string, id: string) =>
    prisma.expense.findFirst({ where: { id, ...scope(userId) }, include: expenseInclude }),

  create: (data: Prisma.ExpenseCreateInput, tx: Prisma.TransactionClient = prisma) =>
    tx.expense.create({ data, include: expenseInclude }),

  update: (userId: string, id: string, data: Prisma.ExpenseUpdateInput, tx: Prisma.TransactionClient = prisma) =>
    tx.expense.update({ where: { id, userId }, data, include: expenseInclude }),

  softDelete: (userId: string, id: string, tx: Prisma.TransactionClient = prisma) =>
    tx.expense.update({ where: { id, userId }, data: { deletedAt: new Date() } }),

  byCategory: (userId: string, range: { from?: Date; to?: Date } = {}) =>
    prisma.expense.groupBy({
      by: ['categoryId'],
      where: {
        ...scope(userId),
        ...(range.from || range.to
          ? { date: { ...(range.from ? { gte: range.from } : {}), ...(range.to ? { lte: range.to } : {}) } }
          : {}),
      },
      _sum: { total: true },
      _count: { _all: true },
    }),

  // ---- Categories ---------------------------------------------------------

  listCategories: (userId: string) =>
    prisma.expenseCategory.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { expenses: true } } },
    }),

  createCategory: (userId: string, data: { name: string; slug: string; color?: string | null }) =>
    prisma.expenseCategory.create({ data: { ...data, userId } }),

  updateCategory: (userId: string, id: string, data: Prisma.ExpenseCategoryUpdateInput) =>
    prisma.expenseCategory.update({ where: { id, userId }, data }),

  deleteCategory: (userId: string, id: string) =>
    prisma.expenseCategory.delete({ where: { id, userId } }),

  categoryHasExpenses: async (id: string): Promise<boolean> =>
    (await prisma.expense.count({ where: { categoryId: id, deletedAt: null } })) > 0,
};

export default ExpensesModel;
