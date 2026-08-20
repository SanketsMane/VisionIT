/* eslint-disable no-console */
import { prisma } from '@config/database';
import { seedServices } from './services';

/**
 * Loads the service catalog on its own.
 *
 * Separate from `db:seed`, which tears the workspace down first — that is the
 * right behaviour for provisioning a fresh install and completely the wrong one
 * for adding a catalog to a workspace that already has real clients in it.
 */
const run = async (): Promise<void> => {
  const owner = await prisma.user.findFirst({
    where: { userType: 'INTERNAL', isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true, email: true },
  });
  if (!owner) throw new Error('No internal user found — run the main seed first.');

  const result = await seedServices(prisma, owner.id);
  console.log(`\n  Catalog loaded for ${owner.email}`);
  console.log(`    ${result.created} created, ${result.updated} updated, ${result.total} total`);

  const plans = await prisma.servicePlan.count();
  const prices = await prisma.servicePlanPrice.count();
  const coupons = await prisma.coupon.count({ where: { userId: owner.id } });
  console.log(`    ${plans} plan(s), ${prices} price row(s), ${coupons} coupon(s)\n`);

  await prisma.$disconnect();
};

run().catch(async (error) => {
  console.error('\n❌ Catalog seed failed:', error);
  await prisma.$disconnect();
  process.exit(1);
});
