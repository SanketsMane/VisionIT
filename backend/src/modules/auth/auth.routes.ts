import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { env } from '@config/env';
import { ApiError } from '@utils/api-error';
import { z } from 'zod';
import { authenticate, authLimiter, validate } from '@middlewares/index';
import { requireInternal } from '@middlewares/project-access.middleware';
import { AuthController } from './auth.controller';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
  sessionIdSchema,
} from './auth.validation';

const router = Router();

/**
 * @route  /api/v1/auth
 * Public credential endpoints are rate limited; everything below
 * `authenticate` requires a valid access token.
 */
/**
 * Sign-up is closed unless explicitly enabled.
 *
 * The guard lives on the route rather than in the UI: removing the form only
 * hides the door, and the endpoint is what actually creates the account.
 */
const registrationGate = (_req: Request, _res: Response, next: NextFunction): void => {
  if (env.ALLOW_PUBLIC_REGISTRATION) return next();
  next(ApiError.forbidden('Sign-up is closed. Ask for an invitation link to join a project.'));
};

router.post(
  '/register',
  authLimiter,
  registrationGate,
  validate({ body: registerSchema }),
  AuthController.register,
);
router.post('/login', authLimiter, validate({ body: loginSchema }), AuthController.login);
router.post('/refresh', validate({ body: refreshSchema }), AuthController.refresh);
router.post('/logout', AuthController.logout);
router.post(
  '/forgot-password',
  authLimiter,
  validate({ body: forgotPasswordSchema }),
  AuthController.forgotPassword,
);
router.post(
  '/reset-password',
  authLimiter,
  validate({ body: resetPasswordSchema }),
  AuthController.resetPassword,
);

router.use(authenticate);

router.get('/me', AuthController.me);
router.get('/sessions', AuthController.sessions);
router.delete('/sessions/:id', validate({ params: sessionIdSchema }), AuthController.revokeSession);
router.post('/logout-all', AuthController.logoutAll);
router.patch(
  '/change-password',
  validate({ body: changePasswordSchema }),
  AuthController.changePassword,
);

/**
 * View the portal as one of your own clients. `requireInternal` blocks the
 * obvious abuse — a client calling it to hop into another client's account.
 */
router.post(
  '/impersonate/:userId',
  requireInternal,
  validate({ params: z.object({ userId: z.string().min(1) }) }),
  AuthController.impersonate,
);

/** Ends it. Open to any session, since only an impersonated one carries an actor. */
router.post('/stop-impersonating', AuthController.stopImpersonating);

export default router;
