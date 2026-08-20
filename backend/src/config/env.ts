import 'dotenv/config';
import { z } from 'zod';

/**
 * Fail-fast environment contract.
 * The process refuses to boot with an invalid config rather than throwing
 * cryptic runtime errors on the first request that touches a missing key.
 */
/**
 * An unset variable in a `.env` file arrives as `""`, not as `undefined`.
 * `z.coerce.number()` turns that into `0`, which then fails `.positive()` — so
 * a deliberately blank optional value would crash the boot. This normalises
 * empty strings back to absent before any coercion runs.
 */
const optionalNumber = () =>
  z.preprocess(
    (value) => (value === '' || value === undefined ? undefined : value),
    z.coerce.number().int().positive().optional(),
  );

/**
 * The same trap for strings, and a more dangerous one.
 *
 * `MAIL_FROM_EMAIL=` parses as `""`, which is not `undefined`, so every
 * `?? fallback` downstream is skipped and the value silently becomes the empty
 * string — Resend then rejects a `From` of `Vision IT Infra <>` on every send.
 * Blank means "not configured", so it is normalised to absent here, once,
 * rather than defended against at each use site.
 */
const optionalString = () =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().optional(),
  );

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5055),
  /**
   * Interface to bind. Defaults to loopback so a reverse proxy is the only way
   * in — behind nginx the API has no reason to answer on a public interface,
   * and relying on the firewall alone means one bad rule exposes it. Set to
   * 0.0.0.0 only when nothing fronts the process.
   */
  HOST: z.string().default('127.0.0.1'),
  API_PREFIX: z.string().default('/api/v1'),
  APP_NAME: z.string().default('Vision IT Infra'),

  // ---- Database -----------------------------------------------------------
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),

  // ---- Auth ---------------------------------------------------------------
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 chars'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 chars'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(8).max(15).default(12),

  /// 32-byte hex key used to AES-256-GCM encrypt SMTP/API credentials at rest.
  ENCRYPTION_KEY: z.string().length(64, 'ENCRYPTION_KEY must be 64 hex chars (32 bytes)'),

  // ---- Client / CORS ------------------------------------------------------
  CLIENT_URL: z.string().url().default('http://localhost:3000'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  COOKIE_DOMAIN: z.string().optional(),

  // ---- OpenAI -------------------------------------------------------------
  OPENAI_API_KEY: optionalString(),
  OPENAI_MODEL: z.string().default('gpt-4o'),
  OPENAI_MAX_TOKENS: z.coerce.number().int().positive().default(1600),
  OPENAI_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.7),

  // ---- Email --------------------------------------------------------------
  SMTP_HOST: optionalString(),
  SMTP_PORT: optionalNumber(),
  SMTP_SECURE: z.coerce.boolean().default(true),
  SMTP_USER: optionalString(),
  SMTP_PASSWORD: optionalString(),
  MAIL_FROM_NAME: z.string().default('Vision IT Infra'),
  MAIL_FROM_EMAIL: optionalString(),
  /// Where "Reply" goes if it should differ from the sending address.
  MAIL_REPLY_TO: optionalString(),
  /**
   * Logo shown at the top of every email. Must be reachable from the public
   * internet — mail clients fetch it from Gmail's or Outlook's servers, not
   * from the recipient's machine, so a localhost URL silently renders nothing.
   * Left unset locally on purpose: the layout falls back to a text wordmark
   * rather than a broken-image icon. Resolved below.
   */
  MAIL_LOGO_URL: optionalString(),

  /// Optional Resend fallback — used when no per-user mailbox is configured.
  RESEND_API_KEY: optionalString(),

  // ---- Storage ------------------------------------------------------------
  UPLOAD_DIR: z.string().default('uploads'),
  MAX_UPLOAD_SIZE_MB: z.coerce.number().positive().default(10),
  PUBLIC_BASE_URL: z.string().url().default('http://localhost:5055'),

  // ---- Rate limiting ------------------------------------------------------
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  /**
   * Left unset so the default can depend on NODE_ENV — a single dashboard load
   * fires ~8 parallel requests, so a production-tight ceiling makes local
   * development feel broken. Resolved below.
   */
  RATE_LIMIT_MAX: optionalNumber(),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),

  // ---- Ops ----------------------------------------------------------------
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),
  ENABLE_SWAGGER: z.coerce.boolean().default(true),
  ENABLE_CRON: z.coerce.boolean().default(true),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  • ${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('\n');
  // eslint-disable-next-line no-console
  console.error(`\n❌ Invalid environment configuration:\n${issues}\n`);
  process.exit(1);
}

const raw = parsed.data;

const isProductionEnv = raw.NODE_ENV === 'production';

export const env = {
  ...raw,
  // Generous locally, deliberately tight in production.
  RATE_LIMIT_MAX: raw.RATE_LIMIT_MAX ?? (isProductionEnv ? 300 : 3000),
  isProduction: isProductionEnv,
  isDevelopment: raw.NODE_ENV === 'development',
  isTest: raw.NODE_ENV === 'test',
  corsOrigins: raw.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean),
  maxUploadBytes: raw.MAX_UPLOAD_SIZE_MB * 1024 * 1024,
  hasOpenAi: Boolean(raw.OPENAI_API_KEY),
  hasGlobalSmtp: Boolean(raw.SMTP_HOST && raw.SMTP_USER && raw.SMTP_PASSWORD),
  hasGlobalResend: Boolean(raw.RESEND_API_KEY),
  /**
   * Only hand the layout a real URL when it is publicly fetchable. Behind
   * localhost the image would 404 in every inbox, so we prefer the wordmark.
   */
  mailLogoUrl:
    raw.MAIL_LOGO_URL ??
    (/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:|\/|$)/i.test(raw.PUBLIC_BASE_URL)
      ? undefined
      : `${raw.PUBLIC_BASE_URL.replace(/\/+$/, '')}/uploads/brand/logo.png`),
} as const;

export type Env = typeof env;
