import 'dotenv/config';
import path from 'node:path';
import { defineConfig, env } from 'prisma/config';

/**
 * Prisma 7 moved connection configuration out of `schema.prisma`.
 * The CLI (migrate/studio/db push) reads the URL from here; the runtime
 * client gets it through the `@prisma/adapter-pg` driver adapter in
 * `src/config/database.ts`.
 */
export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  datasource: {
    url: env('DATABASE_URL'),
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
  migrations: {
    path: path.join('prisma', 'migrations'),
    seed: 'tsx src/db/seed/index.ts',
  },
});
