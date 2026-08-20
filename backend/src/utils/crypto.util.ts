import crypto from 'node:crypto';
import { env } from '@config/env';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

const key = Buffer.from(env.ENCRYPTION_KEY, 'hex');

/**
 * Reversible AES-256-GCM used for third-party credentials we must replay
 * (SMTP passwords, provider API keys). Never use this for user passwords —
 * those are one-way hashed with bcrypt in `password.util.ts`.
 *
 * Format: base64( iv | authTag | ciphertext )
 */
export const encrypt = (plainText: string): string => {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
};

export const decrypt = (payload: string): string => {
  const buffer = Buffer.from(payload, 'base64');
  const iv = buffer.subarray(0, IV_LENGTH);
  const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = buffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
};

export const encryptOptional = (value?: string | null): string | null =>
  value ? encrypt(value) : null;

export const decryptOptional = (value?: string | null): string | null =>
  value ? decrypt(value) : null;

/** Opaque, URL-safe token for password resets, public invoice links, etc. */
export const generateToken = (bytes = 32): string =>
  crypto.randomBytes(bytes).toString('base64url');

/** SHA-256 — used to store refresh tokens so a DB leak isn't a session leak. */
export const sha256 = (value: string): string =>
  crypto.createHash('sha256').update(value).digest('hex');

/** Constant-time comparison to avoid timing oracles on token checks. */
export const safeCompare = (a: string, b: string): boolean => {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
};
