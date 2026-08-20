import path from 'node:path';
import express, { type Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { env } from '@config/env';
import { httpLogStream } from '@config/logger';
import {
  errorHandler,
  globalLimiter,
  notFoundHandler,
  requestContext,
} from '@middlewares/index';
import { mountSwagger } from './docs/swagger';
import apiRoutes from './routes';

export const createApp = (): Application => {
  const app = express();

  // Behind a load balancer this is what makes `req.ip` and secure cookies work.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      // Invoice previews are self-contained HTML served from this origin and
      // rendered in an iframe by the frontend, so the default CSP is relaxed
      // only enough to let their inline styles through.
      contentSecurityPolicy: env.isProduction
        ? {
            directives: {
              defaultSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", 'data:', 'https:'],
              scriptSrc: ["'self'"],
              objectSrc: ["'none'"],
              frameAncestors: [env.CLIENT_URL],
            },
          }
        : false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.use(
    cors({
      origin: (origin, callback) => {
        // Same-origin and server-to-server calls arrive without an Origin header.
        if (!origin) return callback(null, true);
        if (env.corsOrigins.includes(origin)) return callback(null, true);
        callback(new Error(`Origin ${origin} is not allowed by CORS`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id', 'Content-Disposition'],
      maxAge: 86400,
    }),
  );

  app.use(compression());
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));
  app.use(cookieParser());
  app.use(requestContext);

  app.use(
    morgan(env.isProduction ? 'combined' : 'dev', {
      stream: httpLogStream,
      skip: (req) => req.originalUrl === `${env.API_PREFIX}/health`,
    }),
  );

  // Uploaded assets are served directly in development; put these behind a CDN
  // or object storage in production.
  app.use(
    `/${env.UPLOAD_DIR}`,
    express.static(path.resolve(process.cwd(), env.UPLOAD_DIR), {
      maxAge: '7d',
      index: false,
      dotfiles: 'deny',
    }),
  );

  app.use(env.API_PREFIX, globalLimiter);
  app.use(env.API_PREFIX, apiRoutes);

  if (env.ENABLE_SWAGGER) mountSwagger(app);

  app.get('/', (_req, res) => {
    res.json({
      name: `${env.APP_NAME} API`,
      version: process.env.npm_package_version ?? '1.0.0',
      documentation: env.ENABLE_SWAGGER ? '/api-docs' : null,
      health: `${env.API_PREFIX}/health`,
    });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

export default createApp;
