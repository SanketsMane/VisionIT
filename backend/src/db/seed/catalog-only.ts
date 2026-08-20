/* eslint-disable no-console */
import { prisma } from '@config/database';
import { seedCatalog } from './catalog';

/**
 * Writes the catalog of shipped work the website shows.
 *
 * Non-destructive and idempotent: a re-run refreshes the facts and leaves
 * anything rewritten in the studio alone. Pass `--rewrite` to push the copy and
 * images in `catalog.ts` over the top, which is what you want after editing it.
 *
 *   npm run db:seed:catalog
 *   npm run db:seed:catalog -- --rewrite
 */
const run = async (): Promise<void> => {
  const rewrite = process.argv.includes('--rewrite');

  // The same account the public endpoints resolve to — see `publicOwnerId` in
  // portfolio.service.ts. Seeding against any other user would write a catalog
  // the website cannot see.
  const owner = await prisma.user.findFirst({
    where: { userType: 'INTERNAL', role: 'OWNER', isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true, email: true },
  });
  if (!owner) throw new Error('No owner account found — run the main seed first.');

  const result = await seedCatalog(prisma, owner.id, { rewrite });
  console.log(`\n  Catalog written for ${owner.email}`);
  console.log(
    `    ${result.created} created, ${result.refreshed} refreshed, ${result.rewritten} rewritten`,
  );

  const published = await prisma.portfolioItem.count({
    where: { ownerId: owner.id, isPublished: true },
  });
  const drafts = await prisma.portfolioItem.count({
    where: { ownerId: owner.id, isPublished: false },
  });
  console.log(`    ${published} live on the website, ${drafts} draft(s)\n`);

  await prisma.$disconnect();
};

run().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
