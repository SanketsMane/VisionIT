import type { Request, Response } from 'express';
import { asyncHandler } from '@utils/async-handler';
import { sendCreated, sendPaginated, sendSuccess } from '@utils/api-response';
import type { AuthedRequest } from '@/types/common.types';
import { EmailService } from './email.service';
import { MERGE_FIELDS } from './email.constants';

export const EmailController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    const { items, total, page, limit } = await EmailService.list(user.id, req.query as never);
    return sendPaginated(res, items, { page, limit, total }, 'Emails fetched');
  }),

  stats: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    return sendSuccess(res, await EmailService.stats(user.id), 'Email stats fetched');
  }),

  mergeFields: asyncHandler(async (_req: Request, res: Response) =>
    sendSuccess(res, MERGE_FIELDS, 'Merge fields fetched'),
  ),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    return sendSuccess(res, await EmailService.getById(user.id, params.id), 'Email fetched');
  }),

  createDraft: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    return sendCreated(res, await EmailService.createDraft(user.id, req.body), 'Draft saved');
  }),

  updateDraft: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    return sendSuccess(res, await EmailService.updateDraft(user.id, params.id, req.body), 'Draft updated');
  }),

  send: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    return sendSuccess(res, await EmailService.send(user.id, params.id), 'Email sent');
  }),

  composeAndSend: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    return sendCreated(res, await EmailService.composeAndSend(user.id, req.body), 'Email sent');
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    await EmailService.remove(user.id, params.id);
    return sendSuccess(res, null, 'Email deleted');
  }),

  // ---- Accounts -----------------------------------------------------------

  listAccounts: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    return sendSuccess(res, await EmailService.listAccounts(user.id), 'Mailboxes fetched');
  }),

  createAccount: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    return sendCreated(res, await EmailService.createAccount(user.id, req.body), 'Mailbox added');
  }),

  updateAccount: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    return sendSuccess(res, await EmailService.updateAccount(user.id, params.id, req.body), 'Mailbox updated');
  }),

  removeAccount: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    await EmailService.removeAccount(user.id, params.id);
    return sendSuccess(res, null, 'Mailbox removed');
  }),

  verifyAccount: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    return sendSuccess(res, await EmailService.verifyAccount(user.id, params.id), 'Mailbox verified');
  }),

  // ---- Templates ----------------------------------------------------------

  listTemplates: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    return sendSuccess(res, await EmailService.listTemplates(user.id), 'Templates fetched');
  }),

  createTemplate: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    return sendCreated(res, await EmailService.createTemplate(user.id, req.body), 'Template created');
  }),

  updateTemplate: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    return sendSuccess(res, await EmailService.updateTemplate(user.id, params.id, req.body), 'Template updated');
  }),

  removeTemplate: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    await EmailService.removeTemplate(user.id, params.id);
    return sendSuccess(res, null, 'Template deleted');
  }),

  renderTemplate: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    const data = await EmailService.renderTemplate(user.id, params.id, req.body);
    return sendSuccess(res, data, 'Template rendered');
  }),
};

export default EmailController;
