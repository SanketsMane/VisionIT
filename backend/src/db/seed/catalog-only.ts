/* eslint-disable no-console */
import { prisma } from '@config/database';
import { CATALOG, seedCatalog } from './catalog';

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

  /**
   * Confirm every declared entry actually landed.
   *
   * The counters above report what the loop *did*, not what the database
   * *has*, and those have disagreed twice — a create was counted but the row
   * was not there afterwards, and nothing failed loudly. Reading the slugs
   * back is the only claim worth making, so a silent drop now exits non-zero
   * instead of being discovered later by counting cards on the website.
   */
  const stored = await prisma.portfolioItem.findMany({
    where: { ownerId: owner.id },
    select: { slug: true },
  });
  const have = new Set(stored.map((row) => row.slug));
  const missing = CATALOG.filter((entry) => !have.has(entry.slug)).map((entry) => entry.slug);

  if (missing.length) {
    console.error(`\n  ${missing.length} declared entr(ies) did not persist:`);
    for (const slug of missing) console.error(`    - ${slug}`);
    console.error('  Re-run the seed. If it recurs, the database write is failing silently.\n');
    await prisma.$disconnect();
    process.exit(1);
  }
  console.log(`    all ${CATALOG.length} declared entries verified in the database`);

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
