import type { NextFunction, Request, Response } from 'express';
import type { UserRole } from '@prisma/client';
import { ApiError } from '@utils/api-error';

/**
 * Role gate. Must be mounted *after* `authenticate`; the missing-user case is
 * treated as 401 rather than 403 so the frontend can trigger a refresh.
 */
export const authorize =
  (...allowedRoles: UserRole[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(ApiError.unauthorized('Authentication required'));
    if (allowedRoles.length && !allowedRoles.includes(req.user.role)) {
      return next(
        ApiError.forbidden(
          `This action requires one of the following roles: ${allowedRoles.join(', ')}`,
        ),
      );
    }
    next();
  };
