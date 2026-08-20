import type { NextFunction, Request, Response } from 'express';
import { prisma } from '@config/database';
import { ApiError } from '@utils/api-error';
import { verifyAccessToken } from '@utils/jwt.util';
import { asyncHandler } from '@utils/async-handler';

const extractToken = (req: Request): string | null => {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();
  const cookieToken = (req.cookies as Record<string, string> | undefined)?.accessToken;
  return cookieToken ?? null;
};

/**
 * Verifies the access token and re-reads the user, so a deactivated or deleted
 * account is rejected immediately instead of staying valid until token expiry.
 */
export const authenticate = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const token = extractToken(req);
  if (!token) throw ApiError.unauthorized('Authentication required');

  const payload = verifyAccessToken(token);

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true, email: true, role: true, name: true,
      isActive: true, userType: true, ownerId: true,
    },
  });

  if (!user) throw ApiError.unauthorized('Account no longer exists');
  if (!user.isActive) throw ApiError.forbidden('This account has been deactivated');

  req.user = {
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    userType: user.userType,
    ownerId: user.ownerId,
    // Carried through so anything the impersonator does is attributed to them
    // in the audit trail, not to the client whose seat they are sitting in.
    ...(payload.act ? { impersonatedBy: payload.act } : {}),
  };
  next();
});

/** Attaches `req.user` when a valid token is present, but never rejects. */
export const optionalAuthenticate = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const token = extractToken(req);
    if (!token) return next();
    try {
      const payload = verifyAccessToken(token);
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true, email: true, role: true, name: true,
          isActive: true, userType: true, ownerId: true,
        },
      });
      if (user?.isActive) {
        req.user = {
          id: user.id,
          email: user.email,
          role: user.role,
          name: user.name,
          userType: user.userType,
          ownerId: user.ownerId,
        };
      }
    } catch {
      // An invalid token on an optional route is simply an anonymous request.
    }
    next();
  },
);
