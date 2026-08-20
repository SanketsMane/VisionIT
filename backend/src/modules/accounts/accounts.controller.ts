import type { Request, Response } from 'express';
import { asyncHandler } from '@utils/async-handler';
import { sendCreated, sendSuccess } from '@utils/api-response';
import { buildPaginationMeta } from '@utils/api-response';
import type { AuthedRequest } from '@/types/common.types';
import { AccountsService } from './accounts.service';
import { DEFAULT_CHART_OF_ACCOUNTS } from './accounts.constants';

export const AccountsController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    const { accounts, totals } = await AccountsService.list(user.id, req.query as never);
    return sendSuccess(res, accounts, 'Chart of accounts fetched', 200, totals ? { totals } : undefined);
  }),

  template: asyncHandler(async (_req: Request, res: Response) =>
    sendSuccess(res, DEFAULT_CHART_OF_ACCOUNTS, 'Default chart of accounts template'),
  ),

  cashPosition: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    return sendSuccess(res, await AccountsService.cashPosition(user.id), 'Cash position fetched');
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    return sendSuccess(res, await AccountsService.getById(user.id, params.id), 'Account fetched');
  }),

  ledger: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    const { total, page, limit, ...rest } = await AccountsService.ledger(
      user.id,
      params.id,
      req.query as never,
    );
    return sendSuccess(res, rest, 'Account ledger fetched', 200, buildPaginationMeta(page, limit, total));
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    return sendCreated(res, await AccountsService.create(user.id, req.body), 'Account created');
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    return sendSuccess(res, await AccountsService.update(user.id, params.id, req.body), 'Account updated');
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    await AccountsService.remove(user.id, params.id);
    return sendSuccess(res, null, 'Account deleted');
  }),

  transfer: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    return sendCreated(res, await AccountsService.transfer(user.id, req.body), 'Transfer recorded');
  }),
};

export default AccountsController;
