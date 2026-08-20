import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { env } from '@config/env';
import { asyncHandler } from '@utils/async-handler';
import { sendSuccess } from '@utils/api-response';
import { ApiError } from '@utils/api-error';
import { expiresInMs } from '@utils/jwt.util';
import { AuthService } from './auth.service';
import type { AuthedRequest } from '@/types/common.types';
import type { TokenPair } from './auth.types';

const REFRESH_COOKIE = 'refreshToken';

/**
 * The refresh token lives in an httpOnly cookie so XSS on the frontend cannot
 * read it; the short-lived access token is returned in the body for the SPA to
 * hold in memory.
 */
const setRefreshCookie = (res: Response, token: string): void => {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: env.isProduction ? 'none' : 'lax',
    maxAge: expiresInMs(env.JWT_REFRESH_EXPIRES_IN),
    path: '/',
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  });
};

const clearRefreshCookie = (res: Response): void => {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: env.isProduction ? 'none' : 'lax',
    path: '/',
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  });
};

/** Strips the refresh token out of the JSON body — it only travels by cookie. */
const bodyTokens = (tokens: TokenPair) => ({
  accessToken: tokens.accessToken,
  expiresIn: tokens.expiresIn,
});

const sessionContext = (req: Request) => ({
  userAgent: req.get('user-agent') ?? undefined,
  ipAddress: req.ip ?? undefined,
});

export const AuthController = {
  register: asyncHandler(async (req: Request, res: Response) => {
    const result = await AuthService.register(req.body, sessionContext(req));
    setRefreshCookie(res, result.tokens.refreshToken);
    return sendSuccess(
      res,
      { user: result.user, ...bodyTokens(result.tokens) },
      'Account created successfully. Your workspace is ready.',
      StatusCodes.CREATED,
    );
  }),

  login: asyncHandler(async (req: Request, res: Response) => {
    const result = await AuthService.login(req.body, sessionContext(req));
    setRefreshCookie(res, result.tokens.refreshToken);
    return sendSuccess(
      res,
      { user: result.user, ...bodyTokens(result.tokens) },
      `Welcome back, ${result.user.name.split(' ')[0]}`,
    );
  }),

  refresh: asyncHandler(async (req: Request, res: Response) => {
    const token = req.cookies?.[REFRESH_COOKIE] ?? req.body?.refreshToken;
    if (!token) throw ApiError.unauthorized('No refresh token provided');

    const result = await AuthService.refresh(token, sessionContext(req));
    setRefreshCookie(res, result.tokens.refreshToken);
    return sendSuccess(
      res,
      { user: result.user, ...bodyTokens(result.tokens) },
      'Session refreshed',
    );
  }),

  logout: asyncHandler(async (req: Request, res: Response) => {
    await AuthService.logout(req.cookies?.[REFRESH_COOKIE]);
    clearRefreshCookie(res);
    return sendSuccess(res, null, 'Signed out successfully');
  }),

  logoutAll: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    const count = await AuthService.logoutAll(user.id);
    clearRefreshCookie(res);
    return sendSuccess(res, { revokedSessions: count }, 'Signed out from all devices');
  }),

  me: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    return sendSuccess(res, await AuthService.me(user.id), 'Profile fetched');
  }),

  sessions: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    return sendSuccess(res, await AuthService.listSessions(user.id), 'Active sessions fetched');
  }),

  revokeSession: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    await AuthService.revokeSession(user.id, params.id);
    return sendSuccess(res, null, 'Session revoked');
  }),

  changePassword: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    await AuthService.changePassword(user.id, req.body.currentPassword, req.body.newPassword);
    clearRefreshCookie(res);
    return sendSuccess(res, null, 'Password updated. Please sign in again.');
  }),

  forgotPassword: asyncHandler(async (req: Request, res: Response) => {
    const { token } = await AuthService.requestPasswordReset(req.body.email);
    return sendSuccess(
      res,
      // The raw token is exposed only outside production, where there may be
      // no mail transport configured to deliver the reset link.
      env.isProduction ? null : { resetToken: token },
      'If an account exists for that email, a reset link has been sent.',
    );
  }),

  resetPassword: asyncHandler(async (req: Request, res: Response) => {
    await AuthService.resetPassword(req.body.token, req.body.newPassword);
    return sendSuccess(res, null, 'Password reset successfully. You can now sign in.');
  }),
};

export default AuthController;
