import { JournalSource, type Prisma } from '@prisma/client';
import { prisma } from '@config/database';
import { ApiError } from '@utils/api-error';
import { add, round2, toNumber } from '@utils/money.util';
import { resolvePagination } from '@utils/pagination.util';
import { toSlug } from '@utils/slug.util';
import { AccountsModel } from '@modules/accounts/accounts.model';
import { LedgerService } from '@modules/ledger/ledger.service';
import type { JournalLineInput } from '@modules/ledger/ledger.types';
import { ExpensesModel } from './expenses.model';
import type { CreateExpenseDto, ListExpensesDto, UpdateExpenseDto } from './expenses.validation';

const SORTABLE = ['date', 'createdAt', 'total', 'vendor'];

/**
 * Every expense is booked as:
 *
 *   Dr Expense account      net amount
 *   Dr Input tax credit     recoverable tax (folded into the expense if no ITC account)
 *     Cr Bank / Cash / Card total
 */
const buildExpenseLines = (params: {
  expenseAccountId: string;
  paidFromAccountId: string;
  inputTaxAccountId?: string | null;
  amount: number;
  taxAmount: number;
  total: number;
  vendor: string;
}): JournalLineInput[] => {
  const lines: JournalLineInput[] = [
    {
      accountId: params.expenseAccountId,
      debit: params.amount,
      description: `Expense — ${params.vendor}`,
    },
  ];

  if (params.taxAmount > 0) {
    lines.push({
      accountId: params.inputTaxAccountId ?? params.expenseAccountId,
      debit: params.taxAmount,
      description: params.inputTaxAccountId ? `Input tax — ${params.vendor}` : `Non-recoverable tax — ${params.vendor}`,
    });
  }

  lines.push({
    accountId: params.paidFromAccountId,
    credit: params.total,
    description: `Paid to ${params.vendor}`,
  });

  return lines;
};

/** Input tax is only recoverable when an ITC asset account exists (code 1300). */
const findInputTaxAccount = async (userId: string): Promise<string | null> => {
  const account = await AccountsModel.findByCode(userId, '1300');
  return account?.id ?? null;
};

export const ExpensesService = {
  async list(userId: string, query: ListExpensesDto) {
    const pagination = resolvePagination(query, { allowedSortFields: SORTABLE, defaultSortBy: 'date' });
    const where = ExpensesModel.buildWhere(userId, query);

    const [items, total, totals] = await Promise.all([
      ExpensesModel.findMany(where, { skip: pagination.skip, take: pagination.take, orderBy: pagination.orderBy }),
      ExpensesModel.count(where),
      ExpensesModel.sum(where),
    ]);

    return {
      items,
      total,
      page: pagination.page,
      limit: pagination.limit,
      summary: {
        totalAmount: toNumber(totals._sum.total),
        totalTax: toNumber(totals._sum.taxAmount),
        count: totals._count._all,
      },
    };
  },

  async getById(userId: string, id: string) {
    const expense = await ExpensesModel.findById(userId, id);
    if (!expense) throw ApiError.notFound('Expense');
    return expense;
  },

  async create(userId: string, dto: CreateExpenseDto) {
    const [expenseAccount, paidFromAccount] = await Promise.all([
      AccountsModel.findById(userId, dto.expenseAccountId),
      AccountsModel.findById(userId, dto.paidFromAccountId),
    ]);

    if (!expenseAccount) throw ApiError.badRequest('The selected expense account does not exist');
    if (expenseAccount.type !== 'EXPENSE') {
      throw ApiError.badRequest('Costs must be booked against an account of type EXPENSE');
    }
    if (!paidFromAccount) throw ApiError.badRequest('The selected payment account does not exist');

    const total = round2(add(dto.amount, dto.taxAmount)).toNumber();
    const inputTaxAccountId = dto.taxAmount > 0 ? await findInputTaxAccount(userId) : null;

    return prisma.$transaction(async (tx) => {
      const expense = await ExpensesModel.create(
        {
          vendor: dto.vendor,
          description: dto.description ?? null,
          date: dto.date,
          amount: dto.amount,
          taxAmount: dto.taxAmount,
          total,
          currency: dto.currency,
          method: dto.method,
          reference: dto.reference ?? null,
          receiptUrl: dto.receiptUrl || null,
          billable: dto.billable,
          reimbursed: dto.reimbursed,
          notes: dto.notes ?? null,
          user: { connect: { id: userId } },
          paidFrom: { connect: { id: dto.paidFromAccountId } },
          ...(dto.categoryId ? { category: { connect: { id: dto.categoryId } } } : {}),
          ...(dto.projectId ? { project: { connect: { id: dto.projectId } } } : {}),
        },
        tx,
      );

      await LedgerService.createEntry(
        userId,
        {
          date: dto.date,
          source: JournalSource.EXPENSE,
          narration: `${dto.vendor}${dto.description ? ` — ${dto.description}` : ''}`,
          reference: dto.reference ?? null,
          expenseId: expense.id,
          lines: buildExpenseLines({
            expenseAccountId: dto.expenseAccountId,
            paidFromAccountId: dto.paidFromAccountId,
            inputTaxAccountId,
            amount: dto.amount,
            taxAmount: dto.taxAmount,
            total,
            vendor: dto.vendor,
          }),
        },
        tx,
      );

      return expense;
    });
  },

  /**
   * Editing an expense reverses its original posting and writes a fresh one,
   * so the ledger always reflects the current state without ever mutating a
   * posted entry in place.
   */
  async update(userId: string, id: string, dto: UpdateExpenseDto) {
    const existing = await ExpensesModel.findById(userId, id);
    if (!existing) throw ApiError.notFound('Expense');

    const amount = dto.amount ?? toNumber(existing.amount);
    const taxAmount = dto.taxAmount ?? toNumber(existing.taxAmount);
    const total = round2(add(amount, taxAmount)).toNumber();
    const date = dto.date ?? existing.date;
    const vendor = dto.vendor ?? existing.vendor;
    const paidFromAccountId = dto.paidFromAccountId ?? existing.paidFromAccountId;

    if (!paidFromAccountId) throw ApiError.badRequest('This expense has no payment account set');

    // The expense account isn't stored on the row — it lives on the debit line
    // of the original entry, so recover it when the caller doesn't supply one.
    let expenseAccountId = dto.expenseAccountId;
    if (!expenseAccountId) {
      const [entry] = await prisma.journalEntry.findMany({
        where: { userId, expenseId: id, status: 'POSTED' },
        include: { lines: { include: { account: true } } },
        take: 1,
      });
      expenseAccountId = entry?.lines.find((l) => l.account.type === 'EXPENSE')?.accountId;
    }
    if (!expenseAccountId) throw ApiError.badRequest('Could not determine the expense account to book against');

    const inputTaxAccountId = taxAmount > 0 ? await findInputTaxAccount(userId) : null;

    return prisma.$transaction(async (tx) => {
      await LedgerService.voidEntriesForSource(userId, 'expenseId', id, tx);

      const { expenseAccountId: _drop, categoryId, projectId, paidFromAccountId: _paidFrom, receiptUrl, ...scalars } = dto;

      const updated = await ExpensesModel.update(
        userId,
        id,
        {
          ...scalars,
          ...(receiptUrl !== undefined ? { receiptUrl: receiptUrl || null } : {}),
          amount,
          taxAmount,
          total,
          paidFrom: { connect: { id: paidFromAccountId } },
          ...(categoryId === null
            ? { category: { disconnect: true } }
            : categoryId
              ? { category: { connect: { id: categoryId } } }
              : {}),
          ...(projectId === null
            ? { project: { disconnect: true } }
            : projectId
              ? { project: { connect: { id: projectId } } }
              : {}),
        },
        tx,
      );

      await LedgerService.createEntry(
        userId,
        {
          date,
          source: JournalSource.EXPENSE,
          narration: `${vendor}${updated.description ? ` — ${updated.description}` : ''} (revised)`,
          reference: updated.reference,
          expenseId: id,
          lines: buildExpenseLines({
            expenseAccountId,
            paidFromAccountId,
            inputTaxAccountId,
            amount,
            taxAmount,
            total,
            vendor,
          }),
        },
        tx,
      );

      return updated;
    });
  },

  async remove(userId: string, id: string) {
    const expense = await ExpensesModel.findById(userId, id);
    if (!expense) throw ApiError.notFound('Expense');

    await prisma.$transaction(async (tx) => {
      await LedgerService.voidEntriesForSource(userId, 'expenseId', id, tx);
      await ExpensesModel.softDelete(userId, id, tx);
    });
  },

  async stats(userId: string, range: { from?: Date; to?: Date } = {}) {
    const [grouped, categories] = await Promise.all([
      ExpensesModel.byCategory(userId, range),
      ExpensesModel.listCategories(userId),
    ]);

    const nameById = new Map(categories.map((c) => [c.id, { name: c.name, color: c.color }]));

    const byCategory = grouped
      .map((row) => ({
        categoryId: row.categoryId,
        name: row.categoryId ? (nameById.get(row.categoryId)?.name ?? 'Unknown') : 'Uncategorised',
        color: row.categoryId ? (nameById.get(row.categoryId)?.color ?? null) : '#94A3B8',
        total: toNumber(row._sum.total),
        count: row._count._all,
      }))
      .sort((a, b) => b.total - a.total);

    return {
      byCategory,
      totalSpend: round2(add(...byCategory.map((c) => c.total))).toNumber(),
    };
  },

  // ---- Categories ---------------------------------------------------------

  listCategories: (userId: string) => ExpensesModel.listCategories(userId),

  createCategory: (userId: string, dto: { name: string; color?: string | null }) =>
    ExpensesModel.createCategory(userId, { name: dto.name, slug: toSlug(dto.name), color: dto.color ?? null }),

  updateCategory: (userId: string, id: string, dto: Prisma.ExpenseCategoryUpdateInput) =>
    ExpensesModel.updateCategory(userId, id, dto),

  async removeCategory(userId: string, id: string) {
    if (await ExpensesModel.categoryHasExpenses(id)) {
      throw ApiError.badRequest('This category is in use. Reassign its expenses before deleting it.');
    }
    await ExpensesModel.deleteCategory(userId, id);
  },
};

export default ExpensesService;
