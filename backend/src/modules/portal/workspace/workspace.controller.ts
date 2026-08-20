import type { Request, Response } from 'express';
import { asyncHandler } from '@utils/async-handler';
import { buildPaginationMeta, sendSuccess } from '@utils/api-response';
import { getProjectAccess } from '@middlewares/project-access.middleware';
import { roleCan } from '@modules/portal/portal.permissions';
import type { AuthedRequest } from '@/types/common.types';
import { WorkspaceService } from './workspace.service';

export const WorkspaceController = {
  overview: asyncHandler(async (req: Request, res: Response) => {
    const access = getProjectAccess(req);
    const data = await WorkspaceService.overview(access.projectId, access.isInternal);
    return sendSuccess(res, { ...data, access: { role: access.role, permissions: access.permissions } }, 'Workspace loaded');
  }),

  invoices: asyncHandler(async (req: Request, res: Response) => {
    const access = getProjectAccess(req);
    // Drafts are the studio's working state, not something a client should see.
    const data = await WorkspaceService.projectInvoices(access.projectId, access.isInternal);
    return sendSuccess(res, data, 'Invoices fetched');
  }),

  activity: asyncHandler(async (req: Request, res: Response) => {
    const access = getProjectAccess(req);
    const includeInternal = roleCan(access.role, 'bug:internal');
    const { items, total, page, limit } = await WorkspaceService.activity(
      access.projectId,
      req.query as never,
      includeInternal,
    );
    return sendSuccess(res, items, 'Activity fetched', 200, buildPaginationMeta(page, limit, total));
  }),

  /** The client portal landing page. */
  myProjects: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    return sendSuccess(res, await WorkspaceService.clientDashboard(user.id), 'Your projects');
  }),

  clients: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    return sendSuccess(res, await WorkspaceService.workspaceClients(user.id), 'Portal users fetched');
  }),

  deliveryBoard: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    return sendSuccess(res, await WorkspaceService.deliveryBoard(user.id), 'Delivery board fetched');
  }),
};

export default WorkspaceController;
