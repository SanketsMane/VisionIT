import type { Request, Response } from 'express';
import { asyncHandler } from '@utils/async-handler';
import { sendSuccess } from '@utils/api-response';
import { dayjs, fiscalYearRange, monthRange } from '@utils/date.util';
import type { AuthedRequest } from '@/types/common.types';
import { ReportsService } from './reports.service';
import { LedgerService } from '@modules/ledger/ledger.service';

/**
 * Resolves an explicit `from`/`to` window, defaulting to the current fiscal
 * year when the caller doesn't supply one.
 */
const resolvePeriod = async (
  userId: string,
  query: { from?: Date; to?: Date },
): Promise<{ from: Date; to: Date }> => {
  if (query.from && query.to) return { from: query.from, to: query.to };

  const startMonth = await ReportsService.fiscalStartMonth(userId);
  const today = dayjs.utc();
  const fyYear = today.month() + 1 >= startMonth ? today.year() : today.year() - 1;
  const fy = fiscalYearRange(fyYear, startMonth);

  return { from: query.from ?? fy.start, to: query.to ?? today.endOf('day').toDate() };
};

export const ReportsController = {
  profitAndLoss: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    const { from, to } = await resolvePeriod(user.id, req.query as never);
    return sendSuccess(res, await ReportsService.profitAndLoss(user.id, from, to), 'Profit & loss generated');
  }),

  balanceSheet: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    const asOf = (req.query as { asOf?: Date }).asOf ?? new Date();
    return sendSuccess(res, await ReportsService.balanceSheet(user.id, asOf), 'Balance sheet generated');
  }),

  cashFlow: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    const { from, to } = await resolvePeriod(user.id, req.query as never);
    return sendSuccess(res, await ReportsService.cashFlow(user.id, from, to), 'Cash flow statement generated');
  }),

  monthly: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    const { year, month } = req.query as unknown as { year: number; month: number };
    return sendSuccess(res, await ReportsService.monthlyStatement(user.id, year, month), 'Monthly statement generated');
  }),

  trend: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    const { months } = req.query as unknown as { months: number };
    const to = dayjs.utc().endOf('month').toDate();
    const from = dayjs.utc().subtract(months - 1, 'month').startOf('month').toDate();
    return sendSuccess(res, await ReportsService.trend(user.id, from, to), 'Trend data generated');
  }),

  taxSummary: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    const { from, to } = await resolvePeriod(user.id, req.query as never);
    return sendSuccess(res, await ReportsService.taxSummary(user.id, from, to), 'Tax summary generated');
  }),

  trialBalance: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    const asOf = (req.query as { asOf?: Date }).asOf ?? new Date();
    return sendSuccess(res, await LedgerService.trialBalance(user.id, asOf), 'Trial balance generated');
  }),

  /** One call that returns every statement for a month — the "close the books" view. */
  monthlyPack: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    const { year, month } = req.query as unknown as { year: number; month: number };
    const { start, end } = monthRange(year, month);

    const [statement, pnl, balanceSheet, cashFlow, tax] = await Promise.all([
      ReportsService.monthlyStatement(user.id, year, month),
      ReportsService.profitAndLoss(user.id, start, end),
      ReportsService.balanceSheet(user.id, end),
      ReportsService.cashFlow(user.id, start, end),
      ReportsService.taxSummary(user.id, start, end),
    ]);

    return sendSuccess(
      res,
      { statement, profitAndLoss: pnl, balanceSheet, cashFlow, tax },
      'Monthly financial pack generated',
    );
  }),
};

export default ReportsController;
