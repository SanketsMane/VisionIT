/* eslint-disable no-console */
import { DocumentType, UserRole } from '@prisma/client';
import { prisma } from '@config/database';
import { env } from '@config/env';
import { hashPassword } from '@utils/password.util';
import {
  DEFAULT_CHART_OF_ACCOUNTS,
  DEFAULT_EXPENSE_CATEGORIES,
} from '@modules/accounts/accounts.constants';
import { DEFAULT_EMAIL_TEMPLATES } from '@modules/email/email.constants';

/**
 * Provisions the owner account and the scaffolding a workspace cannot run
 * without — chart of accounts, expense categories, invoice numbering and email
 * templates. It mirrors exactly what `AuthService.register` does on signup.
 *
 * It deliberately creates NO business data: no clients, projects, invoices,
 * expenses, emails or journal entries. Those are yours to enter, and inventing
 * them would put figures in your books that never happened.
 */

/**
 * Owner account details come from the environment.
 *
 * Hard-coding them would put a working password in version control, where it
 * stays in the history even after it is changed. `SEED_OWNER_PASSWORD` has no
 * default on purpose: a seed that silently falls back to a known password is
 * how a public instance ends up with a guessable admin.
 */
const OWNER_EMAIL = process.env.SEED_OWNER_EMAIL ?? 'owner@example.com';
const OWNER_PASSWORD = process.env.SEED_OWNER_PASSWORD;
const OWNER_NAME = process.env.SEED_OWNER_NAME ?? 'Workspace Owner';
const BUSINESS_NAME = process.env.SEED_BUSINESS_NAME ?? 'Vision IT Infra';

if (!OWNER_PASSWORD) {
  console.error(
    '\n❌ SEED_OWNER_PASSWORD is not set.\n' +
      '   Add it to backend/.env (along with SEED_OWNER_EMAIL and SEED_OWNER_NAME)\n' +
      '   before running the seed.\n',
  );
  process.exit(1);
}

/**
 * Removes an existing workspace so the seed is re-runnable.
 *
 * Not everything cascades from User: `JournalLine -> Account` and
 * `Invoice -> Client` are `Restrict` on purpose — you should not be able to
 * delete an account that has postings, or a client that has invoices. So the
 * teardown walks the graph itself, deepest dependency first.
 */
const resetWorkspace = async (userId: string): Promise<void> => {
  // Journal entries cascade to their lines, releasing the Restrict on accounts.
  await prisma.journalEntry.deleteMany({ where: { userId } });
  await prisma.payment.deleteMany({ where: { userId } });
  await prisma.emailMessage.deleteMany({ where: { userId } });
  await prisma.aiGeneration.deleteMany({ where: { userId } });
  await prisma.expense.deleteMany({ where: { userId } });
  // Invoices cascade to their items, releasing the Restrict on clients.
  await prisma.invoice.deleteMany({ where: { userId } });
  await prisma.account.deleteMany({ where: { userId } });
  await prisma.project.deleteMany({ where: { userId } });
  await prisma.client.deleteMany({ where: { userId } });

  await prisma.user.delete({ where: { id: userId } });

  /*
   * `Technology` is a global dictionary shared across users, not a per-user
   * table, so it isn't reached by the deletes above. Its join rows went with
   * the projects — clear the entries that are now referenced by nothing, so a
   * removed workspace leaves no trace in the autocomplete.
   */
  const { count } = await prisma.technology.deleteMany({
    where: { projects: { none: {} } },
  });
  if (count) console.log(`  ↻ Cleared ${count} orphaned technology entr${count === 1 ? 'y' : 'ies'}`);
};

const seed = async (): Promise<void> => {
  console.log(`\n🌱 Provisioning ${BUSINESS_NAME}\n`);

  const existing = await prisma.user.findUnique({
    where: { email: OWNER_EMAIL },
    select: { id: true },
  });

  if (existing) {
    console.log('  ↻ Removing the existing workspace…');
    await resetWorkspace(existing.id);
  }

  // ── Owner account ─────────────────────────────────────────────────────────
  const user = await prisma.user.create({
    data: {
      name: OWNER_NAME,
      email: OWNER_EMAIL,
      passwordHash: await hashPassword(OWNER_PASSWORD),
      role: UserRole.OWNER,
      designation: 'Software Developer',
      emailVerified: true,
    },
  });
  console.log(`  ✓ Owner account       ${user.email}`);

  /*
   * Company profile carries only what is actually known: the business name,
   * the owner's email and the real logo. Address, GSTIN, PAN and bank details
   * are left empty to fill in under Settings → Business — placeholder values
   * there would end up printed on real invoices sent to real clients.
   */
  await prisma.companyProfile.create({
    data: {
      userId: user.id,
      legalName: BUSINESS_NAME,
      tradeName: BUSINESS_NAME,
      email: OWNER_EMAIL,
      logoUrl: `${env.PUBLIC_BASE_URL}/uploads/brand/logo.png`,
      country: 'India',
      taxLabel: 'GSTIN',
      baseCurrency: 'INR',
      fiscalYearStartMonth: 4,
      defaultTaxRate: 18,
      defaultPaymentTerms: 15,
      defaultTerms:
        '1. Payment is due within 15 days of the invoice date.\n' +
        '2. Late payments may attract interest at 1.5% per month.\n' +
        `3. All deliverables remain the property of ${BUSINESS_NAME} until payment is received in full.`,
    },
  });
  console.log('  ✓ Company profile     name, email and logo only');

  // ── Chart of accounts ─────────────────────────────────────────────────────
  // Structure only — every account opens at a zero balance.
  await prisma.account.createMany({
    data: DEFAULT_CHART_OF_ACCOUNTS.map((account) => ({
      userId: user.id,
      code: account.code,
      name: account.name,
      type: account.type,
      subtype: account.subtype,
      isSystem: account.isSystem,
      description: account.description ?? null,
    })),
  });
  console.log(`  ✓ Chart of accounts   ${DEFAULT_CHART_OF_ACCOUNTS.length} accounts, all at zero`);

  await prisma.expenseCategory.createMany({
    data: DEFAULT_EXPENSE_CATEGORIES.map((category) => ({ userId: user.id, ...category })),
  });
  console.log(`  ✓ Expense categories  ${DEFAULT_EXPENSE_CATEGORIES.length} categories`);

  // ── Invoice numbering ─────────────────────────────────────────────────────
  const year = new Date().getFullYear();
  await prisma.numberSequence.createMany({
    data: [
      { userId: user.id, documentType: DocumentType.INVOICE, prefix: 'INV', year, nextNumber: 1 },
      { userId: user.id, documentType: DocumentType.QUOTATION, prefix: 'QUO', year, nextNumber: 1 },
      { userId: user.id, documentType: DocumentType.PROFORMA, prefix: 'PRO', year, nextNumber: 1 },
      { userId: user.id, documentType: DocumentType.CREDIT_NOTE, prefix: 'CN', year, nextNumber: 1 },
    ],
  });
  console.log(`  ✓ Numbering           INV/QUO/PRO/CN-${year}-0001 onwards`);

  await prisma.emailTemplate.createMany({
    data: DEFAULT_EMAIL_TEMPLATES.map((template) => ({
      userId: user.id,
      name: template.name,
      subject: template.subject,
      bodyHtml: template.bodyHtml,
      purpose: template.purpose,
      variables: template.variables,
      isSystem: true,
    })),
  });
  console.log(`  ✓ Email templates     ${DEFAULT_EMAIL_TEMPLATES.length} starter templates`);

  // ── Assert the workspace really is free of business data ─────────────────
  const [clients, projects, invoices, expenses, emails, entries] = await Promise.all([
    prisma.client.count({ where: { userId: user.id } }),
    prisma.project.count({ where: { userId: user.id } }),
    prisma.invoice.count({ where: { userId: user.id } }),
    prisma.expense.count({ where: { userId: user.id } }),
    prisma.emailMessage.count({ where: { userId: user.id } }),
    prisma.journalEntry.count({ where: { userId: user.id } }),
  ]);

  const total = clients + projects + invoices + expenses + emails + entries;
  if (total !== 0) {
    throw new Error(`Expected a clean workspace but found ${total} business record(s)`);
  }

  console.log(
    '\n  Clean check           0 clients · 0 projects · 0 invoices · 0 expenses · 0 ledger entries ✓',
  );
  console.log('\n✅ Workspace ready — empty, waiting for your real data.\n');
  console.log('   Sign in with:');
  console.log(`     Email    ${OWNER_EMAIL}`);
  console.log('     Password the value of SEED_OWNER_PASSWORD in your .env');
  console.log('     Role     OWNER\n');
  console.log('   First step: Settings → Business to add your GSTIN, address and bank details.\n');
};

seed()
  .catch((error: unknown) => {
    console.error('\n❌ Provisioning failed:', error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
