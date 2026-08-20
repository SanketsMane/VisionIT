import { Router } from 'express';
import { authenticate, authLimiter, validate } from '@middlewares/index';
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
router.post('/register', authLimiter, validate({ body: registerSchema }), AuthController.register);
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

export default router;
