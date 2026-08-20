import type { Request, Response } from 'express';
import { asyncHandler } from '@utils/async-handler';
import { sendCreated, sendSuccess } from '@utils/api-response';
import { getProjectAccess } from '@middlewares/project-access.middleware';
import type { AuthedRequest } from '@/types/common.types';
import { MembersService } from './members.service';

export const MembersController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = getProjectAccess(req);
    return sendSuccess(res, await MembersService.list(projectId), 'Team fetched');
  }),

  roles: asyncHandler(async (_req: Request, res: Response) =>
    sendSuccess(res, MembersService.roleCatalogue(), 'Roles fetched'),
  ),

  updateRole: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    const access = getProjectAccess(req);
    const data = await MembersService.updateRole(access.projectId, params.memberId, req.body.role, {
      id: user.id,
      isInternal: access.isInternal,
    });
    return sendSuccess(res, data, 'Role updated');
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    const access = getProjectAccess(req);
    await MembersService.remove(access.projectId, params.memberId, {
      id: user.id,
      isInternal: access.isInternal,
    });
    return sendSuccess(res, null, 'Member removed');
  }),

  restore: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    const { projectId } = getProjectAccess(req);
    const data = await MembersService.restore(projectId, params.memberId, user.id);
    return sendSuccess(res, data, 'Access restored');
  }),

  addInternal: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    const { projectId } = getProjectAccess(req);
    const data = await MembersService.addInternal(projectId, req.body.userId, user.id);
    return sendCreated(res, data, 'Team member assigned');
  }),
};

export default MembersController;
