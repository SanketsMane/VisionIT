import rateLimit, { ipKeyGenerator, type Options } from 'express-rate-limit';
import { StatusCodes } from 'http-status-codes';
import { env } from '@config/env';

const base: Partial<Options> = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // Authenticated callers get their own bucket; anonymous ones share by IP.
  // `ipKeyGenerator` normalises IPv6 to a /64 subnet so a single client cannot
  // sidestep the limit by rotating through addresses in its own prefix.
  keyGenerator: (req, res) => req.user?.id ?? ipKeyGenerator(req.ip ?? '', 64) ?? 'unknown',
  handler: (_req, res, _next, options) => {
    res.status(StatusCodes.TOO_MANY_REQUESTS).json({
      success: false,
      code: 'TOO_MANY_REQUESTS',
      message: options.message as string,
      timestamp: new Date().toISOString(),
    });
  },
};

export const globalLimiter = rateLimit({
  ...base,
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
  message: 'Too many requests from this client. Please try again shortly.',
  // Health probes are polled continuously by load balancers and uptime checks;
  // rate-limiting them turns a busy period into a false "service down" alarm.
  skip: (req) => env.isTest || req.path === '/health',
});

/** Tight bucket for credential endpoints to blunt brute-force attempts. */
export const authLimiter = rateLimit({
  ...base,
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.AUTH_RATE_LIMIT_MAX,
  message: 'Too many authentication attempts. Please try again in a few minutes.',
  skipSuccessfulRequests: true,
  skip: () => env.isTest,
});

/** OpenAI calls cost money per request — throttle harder than normal reads. */
export const aiLimiter = rateLimit({
  ...base,
  windowMs: 60 * 1000,
  limit: 12,
  message: 'AI generation limit reached. Please wait a minute before generating again.',
  skip: () => env.isTest,
});

export const emailSendLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  limit: 100,
  message: 'Hourly email sending limit reached.',
  skip: () => env.isTest,
});
