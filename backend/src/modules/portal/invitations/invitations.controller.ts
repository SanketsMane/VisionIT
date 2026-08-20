import type { Request, Response } from 'express';
import { asyncHandler } from '@utils/async-handler';
import { sendCreated, sendSuccess } from '@utils/api-response';
import { getProjectAccess } from '@middlewares/project-access.middleware';
import type { AuthedRequest } from '@/types/common.types';
import { InvitationsService } from './invitations.service';

export const InvitationsController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = getProjectAccess(req);
    const { status } = req.query as { status?: never };
    return sendSuccess(res, await InvitationsService.list(projectId, status), 'Invitations fetched');
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    const { projectId } = getProjectAccess(req);
    const result = await InvitationsService.create(projectId, user.id, req.body, user.name);
    return sendCreated(res, result, 'Invitation sent');
  }),

  resend: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    const { projectId } = getProjectAccess(req);
    const result = await InvitationsService.resend(projectId, params.invitationId, user.id, user.name);
    return sendSuccess(res, result, 'Invitation re-sent with a fresh link');
  }),

  revoke: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    const { projectId } = getProjectAccess(req);
    const invitation = await InvitationsService.revoke(projectId, params.invitationId, user.id);
    return sendSuccess(res, invitation, 'Invitation revoked — the old link no longer works');
  }),

  roles: asyncHandler(async (_req: Request, res: Response) =>
    sendSuccess(res, InvitationsService.assignableClientRoles(), 'Assignable roles fetched'),
  ),

  // ---- Public (no auth) ----------------------------------------------------

  preview: asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.params as { token: string };
    return sendSuccess(res, await InvitationsService.preview(token), 'Invitation found');
  }),

  acceptNew: asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.params as { token: string };
    const result = await InvitationsService.acceptAsNewUser(token, req.body);
    return sendCreated(res, { projectId: result.projectId }, 'Account created — you can sign in now');
  }),

  acceptExisting: asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.params as { token: string };
    const result = await InvitationsService.acceptAsExistingUser(
      token,
      req.body.email,
      req.body.password,
    );
    return sendSuccess(res, { projectId: result.projectId }, 'You now have access to this project');
  }),
};

export default InvitationsController;
