import { ApiError } from '@utils/api-error';
import { toNumber } from '@utils/money.util';
import { resolvePagination } from '@utils/pagination.util';
import { PaymentsModel } from './payments.model';
import type { ListPaymentsDto } from './payments.validation';

const SORTABLE = ['paidAt', 'createdAt', 'amount'];

/**
 * Read-only view over receipts. Payments are *created* through the invoice
 * module so that recording money always settles a specific invoice and posts
 * the matching ledger entry — there is deliberately no standalone create here.
 */
export const PaymentsService = {
  async list(userId: string, query: ListPaymentsDto) {
    const pagination = resolvePagination(query, { allowedSortFields: SORTABLE, defaultSortBy: 'paidAt' });
    const where = PaymentsModel.buildWhere(userId, query);

    const [items, total, totals] = await Promise.all([
      PaymentsModel.findMany(where, { skip: pagination.skip, take: pagination.take, orderBy: pagination.orderBy }),
      PaymentsModel.count(where),
      PaymentsModel.sum(where),
    ]);

    return {
      items,
      total,
      page: pagination.page,
      limit: pagination.limit,
      summary: {
        totalCollected: toNumber(totals._sum.amount),
        totalFees: toNumber(totals._sum.feeAmount),
        count: totals._count._all,
      },
    };
  },

  async getById(userId: string, id: string) {
    const payment = await PaymentsModel.findById(userId, id);
    if (!payment) throw ApiError.notFound('Payment');
    return payment;
  },

  async stats(userId: string, range: { from?: Date; to?: Date } = {}) {
    const grouped = await PaymentsModel.byMethod(userId, range);
    return {
      byMethod: grouped
        .map((row) => ({ method: row.method, total: toNumber(row._sum.amount), count: row._count._all }))
        .sort((a, b) => b.total - a.total),
    };
  },
};

export default PaymentsService;
