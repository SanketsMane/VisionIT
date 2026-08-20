import type { Request, Response } from 'express';
import { asyncHandler } from '@utils/async-handler';
import { sendSuccess } from '@utils/api-response';
import { dayjs } from '@utils/date.util';
import type { AuthedRequest } from '@/types/common.types';
import { DashboardService } from './dashboard.service';
import { ReportsService } from '@modules/reports/reports.service';

export const DashboardController = {
  overview: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    return sendSuccess(res, await DashboardService.overview(user.id), 'Dashboard loaded');
  }),

  receivables: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    return sendSuccess(res, await DashboardService.receivables(user.id), 'Receivables fetched');
  }),

  trend: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    const months = Number((req.query as { months?: number }).months ?? 12);
    const to = dayjs.utc().endOf('month').toDate();
    const from = dayjs.utc().subtract(months - 1, 'month').startOf('month').toDate();
    return sendSuccess(res, await ReportsService.trend(user.id, from, to), 'Trend fetched');
  }),
};

export default DashboardController;
