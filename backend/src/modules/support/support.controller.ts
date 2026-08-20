import type { Request, Response } from 'express';
import { asyncHandler } from '@utils/async-handler';
import { sendSuccess } from '@utils/api-response';
import type { AuthedRequest } from '@/types/common.types';
import { SupportService } from './support.service';

export const SupportController = {
  /** Studio view of one project's support term, including internal notes. */
  get: asyncHandler(async (req: Request, res: Response) => {
    const { params } = req as AuthedRequest;
    return sendSuccess(res, await SupportService.get(params.id, true), 'Support term fetched');
  }),

  save: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    const data = await SupportService.upsert(params.id, req.body, user);
    return sendSuccess(res, data, 'Support term saved');
  }),

  renew: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    const data = await SupportService.renew(params.id, req.body, user);
    return sendSuccess(res, data, 'Support renewed');
  }),

  cancel: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    const data = await SupportService.cancel(params.id, req.body, user);
    return sendSuccess(res, data, 'Support term cancelled');
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    await SupportService.remove(params.id, user);
    return sendSuccess(res, null, 'Support term removed');
  }),

  /** Every support term in the workspace — the renewals pipeline at a glance. */
  list: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    return sendSuccess(res, await SupportService.listForOwner(user.id), 'Support terms fetched');
  }),
};

export default SupportController;
