import type { Request, Response } from 'express';
import { asyncHandler } from '@utils/async-handler';
import { sendCreated, sendPaginated, sendSuccess } from '@utils/api-response';
import type { AuthedRequest } from '@/types/common.types';
import { ClientsService } from './clients.service';

export const ClientsController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    const { items, total, page, limit } = await ClientsService.list(user.id, req.query as never);
    return sendPaginated(res, items, { page, limit, total }, 'Clients fetched');
  }),

  stats: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    return sendSuccess(res, await ClientsService.stats(user.id), 'Client stats fetched');
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    return sendSuccess(res, await ClientsService.getById(user.id, params.id), 'Client fetched');
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    return sendCreated(res, await ClientsService.create(user.id, req.body), 'Client created');
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    return sendSuccess(res, await ClientsService.update(user.id, params.id, req.body), 'Client updated');
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    await ClientsService.remove(user.id, params.id);
    return sendSuccess(res, null, 'Client archived');
  }),

  addContact: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    return sendCreated(res, await ClientsService.addContact(user.id, params.id, req.body), 'Contact added');
  }),

  updateContact: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    const data = await ClientsService.updateContact(user.id, params.id, params.contactId, req.body);
    return sendSuccess(res, data, 'Contact updated');
  }),

  removeContact: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    await ClientsService.removeContact(user.id, params.id, params.contactId);
    return sendSuccess(res, null, 'Contact removed');
  }),
};

export default ClientsController;
