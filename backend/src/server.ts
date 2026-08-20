import type { Server } from 'node:http';
import { createApp } from './app';
import { env } from '@config/env';
import { logger } from '@config/logger';
import { connectDatabase, disconnectDatabase } from '@config/database';
import { closeAllTransports } from '@config/mailer';
import { closePdfBrowser } from '@modules/invoices/invoices.pdf';
import { attachChatGateway, closeChatGateway } from '@modules/chat/chat.gateway';
import { startScheduledJobs, stopScheduledJobs } from './jobs';

let server: Server | undefined;
let shuttingDown = false;

/**
 * Drains in-flight requests before tearing down external resources, so a deploy
 * never severs a half-written transaction or a PDF mid-render.
 */
const shutdown = async (signal: string, exitCode = 0): Promise<void> => {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info(`${signal} received — shutting down gracefully`);
  stopScheduledJobs();

  const forceExit = setTimeout(() => {
    logger.error('Graceful shutdown timed out after 15s — forcing exit');
    process.exit(1);
  }, 15_000);
  forceExit.unref();

  try {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server?.close((error) => (error ? reject(error) : resolve()));
      });
      logger.info('HTTP server closed');
    }

    await Promise.allSettled([closeChatGateway(), closePdfBrowser(), disconnectDatabase()]);
    closeAllTransports();

    clearTimeout(forceExit);
    logger.info('Shutdown complete');
    process.exit(exitCode);
  } catch (error) {
    logger.error('Error during shutdown', { error: String(error) });
    process.exit(1);
  }
};

const bootstrap = async (): Promise<void> => {
  try {
    await connectDatabase();

    const app = createApp();

    server = app.listen(env.PORT, env.HOST, () => {
      logger.info(`🚀 ${env.APP_NAME} API listening on http://${env.HOST}:${env.PORT}`);
      logger.info(`   Environment : ${env.NODE_ENV}`);
      logger.info(`   API base    : http://localhost:${env.PORT}${env.API_PREFIX}`);
      if (env.ENABLE_SWAGGER) {
        logger.info(`   API docs    : http://localhost:${env.PORT}/api-docs`);
      }
      logger.info(`   AI writer   : ${env.hasOpenAi ? `enabled (${env.OPENAI_MODEL})` : 'disabled — set OPENAI_API_KEY'}`);
    });

    server.keepAliveTimeout = 65_000;
    server.headersTimeout = 66_000;

    // Chat rides on the same HTTP server, so it inherits the port, the TLS
    // termination at nginx and the shutdown path below.
    attachChatGateway(server);

    if (env.ENABLE_CRON) startScheduledJobs();
  } catch (error) {
    logger.error('Failed to start server', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: String(reason) });
  void shutdown('unhandledRejection', 1);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  void shutdown('uncaughtException', 1);
});

void bootstrap();
