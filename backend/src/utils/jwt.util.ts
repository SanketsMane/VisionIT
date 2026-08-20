import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '@config/env';
import { ApiError } from './api-error';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: string;
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  type: 'refresh';
}

export const signAccessToken = (payload: Omit<AccessTokenPayload, 'type'>): string =>
  jwt.sign({ ...payload, type: 'access' }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
    issuer: env.APP_NAME,
  } as SignOptions);

export const signRefreshToken = (payload: Omit<RefreshTokenPayload, 'type'>): string =>
  jwt.sign({ ...payload, type: 'refresh' }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
    issuer: env.APP_NAME,
  } as SignOptions);

export const verifyAccessToken = (token: string): AccessTokenPayload => {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
    if (decoded.type !== 'access') throw ApiError.unauthorized('Invalid token type');
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new ApiError(401, 'Session expired, please sign in again', { code: 'TOKEN_EXPIRED' });
    }
    throw ApiError.unauthorized('Invalid or malformed access token');
  }
};

export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  try {
    const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
    if (decoded.type !== 'refresh') throw ApiError.unauthorized('Invalid token type');
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new ApiError(401, 'Refresh token expired, please sign in again', {
        code: 'REFRESH_TOKEN_EXPIRED',
      });
    }
    throw ApiError.unauthorized('Invalid refresh token');
  }
};

/** Converts `15m` / `30d` style spans into milliseconds for cookie maxAge. */
export const expiresInMs = (span: string): number => {
  const match = /^(\d+)([smhdw])$/.exec(span.trim());
  if (!match) return 0;
  const value = Number(match[1]);
  const unit = match[2] as 's' | 'm' | 'h' | 'd' | 'w';
  const factor = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 }[unit];
  return value * factor;
};
