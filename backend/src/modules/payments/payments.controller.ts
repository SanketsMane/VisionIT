import type { Request, Response } from 'express';
import { asyncHandler } from '@utils/async-handler';
import { buildPaginationMeta, sendSuccess } from '@utils/api-response';
import type { AuthedRequest } from '@/types/common.types';
import { PaymentsService } from './payments.service';

export const PaymentsController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    const { items, total, page, limit, summary } = await PaymentsService.list(user.id, req.query as never);
    return sendSuccess(res, items, 'Payments fetched', 200, {
      ...buildPaginationMeta(page, limit, total),
      summary,
    });
  }),

  stats: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    const { from, to } = req.query as { from?: Date; to?: Date };
    return sendSuccess(res, await PaymentsService.stats(user.id, { from, to }), 'Payment stats fetched');
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    return sendSuccess(res, await PaymentsService.getById(user.id, params.id), 'Payment fetched');
  }),
};

export default PaymentsController;
