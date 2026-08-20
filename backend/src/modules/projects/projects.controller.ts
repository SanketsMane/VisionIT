import type { Request, Response } from 'express';
import { asyncHandler } from '@utils/async-handler';
import { sendCreated, sendPaginated, sendSuccess } from '@utils/api-response';
import type { AuthedRequest } from '@/types/common.types';
import { ProjectsService } from './projects.service';

export const ProjectsController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    const { items, total, page, limit } = await ProjectsService.list(user.id, req.query as never);
    return sendPaginated(res, items, { page, limit, total }, 'Projects fetched');
  }),

  stats: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    return sendSuccess(res, await ProjectsService.stats(user.id), 'Project stats fetched');
  }),

  technologies: asyncHandler(async (_req: Request, res: Response) =>
    sendSuccess(res, await ProjectsService.listTechnologies(), 'Technologies fetched'),
  ),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    return sendSuccess(res, await ProjectsService.getById(user.id, params.id), 'Project fetched');
  }),

  getPublicBySlug: asyncHandler(async (req: Request, res: Response) => {
    const { params } = req as AuthedRequest;
    const data = await ProjectsService.getPublicBySlug(params.userId, params.slug);
    return sendSuccess(res, data, 'Project fetched');
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    return sendCreated(res, await ProjectsService.create(user.id, req.body), 'Project added to your catalog');
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    return sendSuccess(res, await ProjectsService.update(user.id, params.id, req.body), 'Project updated');
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    await ProjectsService.remove(user.id, params.id);
    return sendSuccess(res, null, 'Project removed');
  }),

  logHours: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    const data = await ProjectsService.logHours(user.id, params.id, req.body.hours);
    return sendSuccess(res, data, 'Hours logged');
  }),

  reorder: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    await ProjectsService.reorder(user.id, req.body.items);
    return sendSuccess(res, null, 'Catalog order updated');
  }),

  addMilestone: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    return sendCreated(res, await ProjectsService.addMilestone(user.id, params.id, req.body), 'Milestone added');
  }),

  updateMilestone: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    const data = await ProjectsService.updateMilestone(user.id, params.id, params.milestoneId, req.body);
    return sendSuccess(res, data, 'Milestone updated');
  }),

  removeMilestone: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    await ProjectsService.removeMilestone(user.id, params.id, params.milestoneId);
    return sendSuccess(res, null, 'Milestone removed');
  }),
};

export default ProjectsController;
