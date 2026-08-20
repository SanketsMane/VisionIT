import type { Request, Response } from 'express';
import { asyncHandler } from '@utils/async-handler';
import { buildPaginationMeta, sendSuccess } from '@utils/api-response';
import type { AuthedRequest } from '@/types/common.types';
import { SettingsService } from './settings.service';

export const SettingsController = {
  getCompany: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    return sendSuccess(res, await SettingsService.getCompany(user.id), 'Company profile fetched');
  }),

  updateCompany: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    return sendSuccess(res, await SettingsService.updateCompany(user.id, req.body), 'Company profile updated');
  }),

  updateProfile: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    return sendSuccess(res, await SettingsService.updateProfile(user.id, req.body), 'Profile updated');
  }),

  reference: asyncHandler(async (_req: Request, res: Response) =>
    sendSuccess(res, SettingsService.reference(), 'Reference data fetched'),
  ),

  activity: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    const { page = 1, limit = 25 } = req.query as unknown as { page: number; limit: number };
    const { items, total } = await SettingsService.activity(user.id, page, limit);
    return sendSuccess(res, items, 'Activity fetched', 200, buildPaginationMeta(page, limit, total));
  }),

  notifications: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    return sendSuccess(res, await SettingsService.listNotifications(user.id), 'Notifications fetched');
  }),

  markNotificationRead: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    return sendSuccess(res, await SettingsService.markNotificationRead(user.id, params.id), 'Notification read');
  }),

  markAllRead: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    const { count } = await SettingsService.markAllNotificationsRead(user.id);
    return sendSuccess(res, { updated: count }, 'All notifications marked read');
  }),
};

export default SettingsController;
