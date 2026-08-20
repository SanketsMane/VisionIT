/* eslint-disable no-console */
import { prisma } from '@config/database';
import { seedPortfolio } from './portfolio';

/**
 * Builds the public work catalog from the studio's real projects.
 *
 * Non-destructive and idempotent: re-running refreshes the facts read from each
 * project row and leaves the written copy alone, so it is safe against a
 * workspace with live clients in it.
 */
const run = async (): Promise<void> => {
  const owner = await prisma.user.findFirst({
    where: { userType: 'INTERNAL', isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true, email: true },
  });
  if (!owner) throw new Error('No internal user found — run the main seed first.');

  const result = await seedPortfolio(prisma, owner.id);
  console.log(`\n  Portfolio built for ${owner.email}`);
  console.log(`    ${result.created} created, ${result.updated} refreshed, ${result.skipped} skipped`);

  const published = await prisma.portfolioItem.count({ where: { ownerId: owner.id, isPublished: true } });
  const drafts = await prisma.portfolioItem.count({ where: { ownerId: owner.id, isPublished: false } });
  console.log(`    ${published} published, ${drafts} draft(s) awaiting copy\n`);

  await prisma.$disconnect();
};

run().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
