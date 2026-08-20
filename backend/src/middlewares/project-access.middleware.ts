import type { NextFunction, Request, Response } from 'express';
import { ProjectRole, UserType } from '@prisma/client';
import { prisma } from '@config/database';
import { ApiError } from '@utils/api-error';
import { asyncHandler } from '@utils/async-handler';
import { permissionsFor, roleCan, type Permission } from '@modules/portal/portal.permissions';

/**
 * The resolved answer to "may this user touch this project, and as what?".
 *
 * `workspaceOwnerId` is the internal user who owns the project's data. Client
 * users have no workspace of their own, so every downstream query that is
 * scoped by `userId` must use this rather than `req.user.id`.
 */
export interface ProjectAccess {
  projectId: string;
  workspaceOwnerId: string;
  role: ProjectRole;
  permissions: Permission[];
  isInternal: boolean;
  membershipId: string | null;
}

declare global {
  namespace Express {
    interface Request {
      projectAccess?: ProjectAccess;
    }
  }
}

/**
 * Resolves access to a project for the current user.
 *
 * This is the single choke point the spec's rule runs through:
 * **User → Membership → Project → Permission.** Knowing a project id grants
 * nothing; an internal user must own the project, and a client user must hold
 * an active membership row.
 */
export const resolveProjectAccess = async (
  user: Express.AuthenticatedUser,
  projectId: string,
): Promise<ProjectAccess> => {
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { id: true, userId: true },
  });

  if (!project) throw ApiError.notFound('Project');

  // Internal users reach only the projects inside their own workspace.
  if (user.userType === UserType.INTERNAL) {
    if (project.userId !== user.id) {
      // Deliberately a 404, not a 403: confirming the project exists would
      // leak that another workspace holds this id.
      throw ApiError.notFound('Project');
    }
    return {
      projectId: project.id,
      workspaceOwnerId: project.userId,
      role: ProjectRole.INTERNAL_MEMBER,
      permissions: permissionsFor(ProjectRole.INTERNAL_MEMBER),
      isInternal: true,
      membershipId: null,
    };
  }

  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
    select: { id: true, role: true, isActive: true },
  });

  if (!membership || !membership.isActive) throw ApiError.notFound('Project');

  return {
    projectId: project.id,
    workspaceOwnerId: project.userId,
    role: membership.role,
    permissions: permissionsFor(membership.role),
    isInternal: false,
    membershipId: membership.id,
  };
};

/**
 * Route guard. Reads the project id from `req.params[paramName]`, resolves
 * access, and requires every listed permission.
 */
export const requireProjectAccess = (
  ...required: Permission[]
): ReturnType<typeof asyncHandler> =>
  asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw ApiError.unauthorized('Authentication required');

    const projectId = (req.params.projectId ?? req.params.id) as string | undefined;
    if (!projectId) throw ApiError.badRequest('Project id is missing from this route');

    const access = await resolveProjectAccess(req.user, projectId);

    const missing = required.filter((permission) => !roleCan(access.role, permission));
    if (missing.length) {
      throw ApiError.forbidden(
        `Your role on this project (${access.role.replace(/_/g, ' ').toLowerCase()}) does not allow: ${missing.join(', ')}`,
      );
    }

    req.projectAccess = access;
    next();
  });

/** Rejects anyone who is not an internal team member of the workspace. */
export const requireInternal = (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.user) return next(ApiError.unauthorized('Authentication required'));
  if (req.user.userType !== UserType.INTERNAL) {
    return next(ApiError.forbidden('This area is restricted to the studio team'));
  }
  next();
};

/** Rejects internal users from client-portal-only routes. */
export const requireClient = (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.user) return next(ApiError.unauthorized('Authentication required'));
  if (req.user.userType !== UserType.CLIENT) {
    return next(ApiError.forbidden('This route is for client portal users'));
  }
  next();
};

/** Convenience accessor for handlers mounted behind `requireProjectAccess`. */
export const getProjectAccess = (req: Request): ProjectAccess => {
  if (!req.projectAccess) {
    throw ApiError.internal('Route is missing the requireProjectAccess guard');
  }
  return req.projectAccess;
};
