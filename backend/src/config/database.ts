import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { env } from './env';
import { logger } from './logger';

/**
 * Prisma 7 removed `url` from the datasource block — the runtime connection is
 * supplied by a driver adapter. A single pooled client is reused process-wide
 * and cached on `globalThis` so `tsx watch` reloads don't leak connections.
 */
const createPrismaClient = (): PrismaClient => {
  const adapter = new PrismaPg({
    connectionString: env.DATABASE_URL,
    max: env.DATABASE_POOL_MAX,
  });

  const client = new PrismaClient({
    adapter,
    log: env.isDevelopment
      ? [
          { emit: 'event', level: 'query' },
          { emit: 'event', level: 'warn' },
          { emit: 'event', level: 'error' },
        ]
      : [
          { emit: 'event', level: 'warn' },
          { emit: 'event', level: 'error' },
        ],
  });

  if (env.isDevelopment) {
    client.$on('query', (e: { query: string; params: string; duration: number }) => {
      if (e.duration >= 200) {
        logger.debug(`[prisma] slow query ${e.duration}ms :: ${e.query}`);
      }
    });
  }

  client.$on('error', (e: { message: string }) => logger.error(`[prisma] ${e.message}`));
  client.$on('warn', (e: { message: string }) => logger.warn(`[prisma] ${e.message}`));

  return client;
};

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (!env.isProduction) globalForPrisma.prisma = prisma;

export const connectDatabase = async (): Promise<void> => {
  await prisma.$connect();
  logger.info('🗄️  PostgreSQL connected via Prisma driver adapter');
};

export const disconnectDatabase = async (): Promise<void> => {
  await prisma.$disconnect();
  logger.info('🗄️  PostgreSQL disconnected');
};

/** Prisma transaction client — the type passed into `$transaction(cb)`. */
export type TxClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export default prisma;
