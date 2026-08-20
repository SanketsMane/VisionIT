import type { NextFunction, Request, Response } from 'express';
import { prisma } from '@config/database';
import { logger } from '@config/logger';

/**
 * Fire-and-forget audit trail for mutating routes. Recorded only for 2xx
 * responses, and never allowed to fail the request it is describing.
 */
export const logActivity =
  (action: string, entityType: string, entityIdFrom: (req: Request, res: Response) => string | undefined = (req) => (req.params.id as string | undefined)) =>
  (req: Request, res: Response, next: NextFunction): void => {
    res.on('finish', () => {
      if (res.statusCode >= 400 || !req.user) return;
      void prisma.activityLog
        .create({
          data: {
            userId: req.user.id,
            action,
            entityType,
            entityId: entityIdFrom(req, res) ?? null,
            metadata: {
              method: req.method,
              path: req.originalUrl,
              status: res.statusCode,
            },
            ipAddress: req.ip ?? null,
            userAgent: req.get('user-agent') ?? null,
          },
        })
        .catch((error: unknown) =>
          logger.warn('Failed to persist activity log', {
            action,
            entityType,
            error: error instanceof Error ? error.message : String(error),
          }),
        );
    });
    next();
  };
