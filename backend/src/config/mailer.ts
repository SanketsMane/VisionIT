import nodemailer, { type Transporter } from 'nodemailer';
import { env } from './env';
import { logger } from './logger';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
}

/**
 * Transports are cached per configuration so repeated sends reuse the same
 * pooled connection instead of opening a new TCP/TLS session per email.
 */
const transportCache = new Map<string, Transporter>();

const cacheKey = (config: SmtpConfig): string =>
  `${config.host}:${config.port}:${config.secure}:${config.user}`;

export const createTransport = (config: SmtpConfig): Transporter => {
  const key = cacheKey(config);
  const cached = transportCache.get(key);
  if (cached) return cached;

  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.password },
    pool: true,
    maxConnections: 3,
    maxMessages: 50,
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
  });

  transportCache.set(key, transport);
  return transport;
};

export const invalidateTransport = (config: SmtpConfig): void => {
  const key = cacheKey(config);
  transportCache.get(key)?.close();
  transportCache.delete(key);
};

/** Falls back to the process-wide SMTP settings when a user has no own account. */
export const getFallbackSmtp = (): SmtpConfig | null => {
  if (!env.hasGlobalSmtp) return null;
  return {
    host: env.SMTP_HOST as string,
    port: env.SMTP_PORT ?? 587,
    secure: env.SMTP_SECURE,
    user: env.SMTP_USER as string,
    password: env.SMTP_PASSWORD as string,
  };
};

export const verifyTransport = async (config: SmtpConfig): Promise<{ ok: boolean; error?: string }> => {
  try {
    await createTransport(config).verify();
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn('SMTP verification failed', { host: config.host, message });
    return { ok: false, error: message };
  }
};

export const closeAllTransports = (): void => {
  for (const transport of transportCache.values()) transport.close();
  transportCache.clear();
};
