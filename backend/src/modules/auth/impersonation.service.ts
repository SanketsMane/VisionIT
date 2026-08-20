import { UserType } from '@prisma/client';
import { prisma } from '@config/database';
import { logger } from '@config/logger';
import { ApiError } from '@utils/api-error';
import { generateToken, sha256 } from '@utils/crypto.util';
import { expiresInMs, signAccessToken, signRefreshToken } from '@utils/jwt.util';
import { env } from '@config/env';
import { AuthModel } from './auth.model';

/**
 * "View as client" — lets the studio owner open the portal exactly as one of
 * their clients sees it, without knowing that client's password.
 *
 * The safety of this rests on four rules, all enforced here rather than in the
 * UI:
 *
 *   1. Only an INTERNAL user can start it.
 *   2. The target must be a CLIENT, so it can never be used to become another
 *      admin — impersonation must not be a route to more privilege than the
 *      impersonator already has.
 *   3. The target must belong to the impersonator's own workspace.
 *   4. Every session is recorded, and the token carries the real actor's id so
 *      anything done while impersonating is attributable to a person.
 *
 * The session is deliberately short and gets no refresh token: it should end
 * when the work ends, not linger for a week in a cookie.
 */

const IMPERSONATION_TTL = '30m';

export interface ImpersonationResult {
  accessToken: string;
  expiresIn: number;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    userType: UserType;
  };
  impersonating: true;
  /** Who is really behind the session, for the banner. */
  actor: { id: string; name: string };
}

export const ImpersonationService = {
  async start(
    actor: { id: string; name: string; userType: UserType },
    targetUserId: string,
  ): Promise<ImpersonationResult> {
    if (actor.userType !== UserType.INTERNAL) {
      throw ApiError.forbidden('Only studio users can view the portal as a client');
    }

    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true, name: true, email: true, role: true,
        userType: true, isActive: true, ownerId: true,
      },
    });

    // 404 rather than 403 for anything outside the workspace: a distinct
    // "forbidden" would confirm that an id belongs to a real user elsewhere.
    if (!target || target.ownerId !== actor.id) throw ApiError.notFound('Client user');

    if (target.userType !== UserType.CLIENT) {
      throw ApiError.forbidden('Only client-portal accounts can be viewed this way');
    }
    if (!target.isActive) {
      throw ApiError.badRequest('That client account is deactivated');
    }

    const accessToken = signAccessToken(
      { sub: target.id, email: target.email, role: target.role, act: actor.id },
      IMPERSONATION_TTL,
    );

    await prisma.activityLog
      .create({
        data: {
          userId: actor.id,
          action: 'client.impersonation.started',
          entityType: 'User',
          entityId: target.id,
          metadata: {
            summary: `${actor.name} started viewing the portal as ${target.name}`,
            targetEmail: target.email,
            targetName: target.name,
          },
        },
      })
      .catch((error: unknown) =>
        logger.warn('Could not record impersonation', { error: String(error) }),
      );

    logger.info('Impersonation started', { actorId: actor.id, targetId: target.id });

    return {
      accessToken,
      // Short-lived and refreshless on purpose — see the note above.
      expiresIn: Math.floor(expiresInMs(IMPERSONATION_TTL) / 1000),
      user: {
        id: target.id,
        name: target.name,
        email: target.email,
        role: target.role,
        userType: target.userType,
      },
      impersonating: true,
      actor: { id: actor.id, name: actor.name },
    };
  },

  /**
   * Ends the session and hands back a real one for the actor.
   *
   * The actor's id comes from the signed token, not the request body, so a
   * client cannot call this to mint a session as somebody else.
   */
  async stop(actorId: string | undefined, context: { userAgent?: string; ipAddress?: string }) {
    if (!actorId) throw ApiError.badRequest('This session is not an impersonation');

    const actor = await prisma.user.findUnique({
      where: { id: actorId },
      select: { id: true, name: true, email: true, role: true, isActive: true, userType: true },
    });

    if (!actor || !actor.isActive || actor.userType !== UserType.INTERNAL) {
      throw ApiError.unauthorized('The original session is no longer valid — please sign in again');
    }

    const jti = generateToken(24);
    const accessToken = signAccessToken({ sub: actor.id, email: actor.email, role: actor.role });
    const refreshToken = signRefreshToken({ sub: actor.id, jti });

    await AuthModel.storeRefreshToken({
      userId: actor.id,
      tokenHash: sha256(refreshToken),
      expiresAt: new Date(Date.now() + expiresInMs(env.JWT_REFRESH_EXPIRES_IN)),
      userAgent: context.userAgent ?? null,
      ipAddress: context.ipAddress ?? null,
    });

    logger.info('Impersonation ended', { actorId: actor.id });

    return {
      user: actor,
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: Math.floor(expiresInMs(env.JWT_ACCESS_EXPIRES_IN) / 1000),
      },
    };
  },
};

export default ImpersonationService;
