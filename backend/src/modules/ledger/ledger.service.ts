import { AccountType, JournalSource, type Prisma } from '@prisma/client';
import { prisma } from '@config/database';
import { logger } from '@config/logger';
import { ApiError } from '@utils/api-error';
import { add, round2, subtract, toDecimal, toNumber } from '@utils/money.util';
import { resolvePagination } from '@utils/pagination.util';
import { NORMAL_BALANCE, SYSTEM_ACCOUNT_CODES, type SystemAccountKey } from '@modules/accounts/accounts.constants';
import { AccountsModel } from '@modules/accounts/accounts.model';
import { LedgerModel } from './ledger.model';
import type { CreateEntryInput, JournalLineInput, TrialBalance, TrialBalanceRow } from './ledger.types';

/**
 * Allocates the next `JE-<year>-<seq>` number. Called inside the posting
 * transaction so the read-then-write stays atomic under concurrency.
 */
const nextEntryNumber = async (
  userId: string,
  date: Date,
  tx: Prisma.TransactionClient,
): Promise<string> => {
  const year = date.getUTCFullYear();
  const last = await LedgerModel.lastEntryNumberForYear(userId, year, tx);
  const lastSeq = last ? Number(last.entryNumber.split('-')[2] ?? 0) : 0;
  return `JE-${year}-${String(lastSeq + 1).padStart(5, '0')}`;
};

/**
 * Rejects an unbalanced entry before it reaches the database. Without this the
 * trial balance silently drifts and every downstream statement becomes wrong,
 * so it is enforced here rather than trusted to callers.
 */
const assertBalanced = (lines: JournalLineInput[]): { debit: number; credit: number } => {
  if (lines.length < 2) {
    throw ApiError.badRequest('A journal entry needs at least two lines');
  }

  const totalDebit = round2(add(...lines.map((l) => l.debit ?? 0)));
  const totalCredit = round2(add(...lines.map((l) => l.credit ?? 0)));

  for (const line of lines) {
    const debit = toDecimal(line.debit ?? 0);
    const credit = toDecimal(line.credit ?? 0);
    if (debit.isNegative() || credit.isNegative()) {
      throw ApiError.badRequest('Debit and credit amounts cannot be negative');
    }
    if (debit.greaterThan(0) && credit.greaterThan(0)) {
      throw ApiError.badRequest('A single line cannot carry both a debit and a credit');
    }
    if (debit.isZero() && credit.isZero()) {
      throw ApiError.badRequest('Every line must carry either a debit or a credit amount');
    }
  }

  if (!totalDebit.equals(totalCredit)) {
    throw ApiError.unprocessable(
      `Entry does not balance — debits ${totalDebit.toFixed(2)} vs credits ${totalCredit.toFixed(2)}`,
    );
  }

  if (totalDebit.isZero()) throw ApiError.badRequest('Entry total cannot be zero');

  return { debit: totalDebit.toNumber(), credit: totalCredit.toNumber() };
};

export const LedgerService = {
  /** Resolves the system account ids the automatic posting rules depend on. */
  async resolveSystemAccounts(
    userId: string,
    keys: SystemAccountKey[],
  ): Promise<Record<SystemAccountKey, string>> {
    const codes = keys.map((k) => SYSTEM_ACCOUNT_CODES[k]);
    const accounts = await AccountsModel.findManyByCodes(userId, codes);
    const byCode = new Map(accounts.map((a) => [a.code, a.id]));

    const resolved = {} as Record<SystemAccountKey, string>;
    for (const key of keys) {
      const id = byCode.get(SYSTEM_ACCOUNT_CODES[key]);
      if (!id) {
        throw ApiError.internal(
          `Chart of accounts is missing the system account "${key}" (${SYSTEM_ACCOUNT_CODES[key]}). Re-run workspace provisioning.`,
        );
      }
      resolved[key] = id;
    }
    return resolved;
  },

  /**
   * The single write path into the general ledger. Everything — manual entries,
   * invoices, payments, expenses, transfers — posts through here so validation
   * and numbering can never be bypassed.
   */
  async createEntry(
    userId: string,
    input: CreateEntryInput,
    tx?: Prisma.TransactionClient,
  ) {
    assertBalanced(input.lines);

    const run = async (client: Prisma.TransactionClient) => {
      const accountIds = [...new Set(input.lines.map((l) => l.accountId))];
      const owned = await client.account.count({ where: { userId, id: { in: accountIds } } });
      if (owned !== accountIds.length) {
        throw ApiError.badRequest('One or more accounts in this entry do not exist');
      }

      const entryNumber = await nextEntryNumber(userId, input.date, client);

      return LedgerModel.create(
        {
          entryNumber,
          date: input.date,
          narration: input.narration ?? null,
          reference: input.reference ?? null,
          source: input.source ?? JournalSource.MANUAL,
          user: { connect: { id: userId } },
          ...(input.invoiceId ? { invoice: { connect: { id: input.invoiceId } } } : {}),
          ...(input.paymentId ? { payment: { connect: { id: input.paymentId } } } : {}),
          ...(input.expenseId ? { expense: { connect: { id: input.expenseId } } } : {}),
          lines: {
            create: input.lines.map((line, index) => ({
              accountId: line.accountId,
              debit: round2(line.debit ?? 0),
              credit: round2(line.credit ?? 0),
              description: line.description ?? null,
              sortOrder: index,
            })),
          },
        },
        client,
      );
    };

    return tx ? run(tx) : prisma.$transaction(run);
  },

  /**
   * Voids the postings attached to a source document. Used when an invoice is
   * cancelled or a payment is deleted — the history stays visible as VOID
   * rather than being erased, which keeps the audit trail intact.
   */
  async voidEntriesForSource(
    userId: string,
    field: 'invoiceId' | 'paymentId' | 'expenseId',
    sourceId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const client = tx ?? prisma;
    const { count } = await LedgerModel.voidBySource(userId, field, sourceId, client);
    if (count) logger.info('Voided ledger entries', { userId, field, sourceId, count });
    return count;
  },

  async list(
    userId: string,
    query: { page?: number; limit?: number; from?: Date; to?: Date; source?: JournalSource; accountId?: string; search?: string },
  ) {
    const pagination = resolvePagination(query, { defaultLimit: 25 });

    const where: Prisma.JournalEntryWhereInput = { userId, status: { not: 'VOID' } };
    if (query.source) where.source = query.source;
    if (query.from || query.to) {
      where.date = {
        ...(query.from ? { gte: query.from } : {}),
        ...(query.to ? { lte: query.to } : {}),
      };
    }
    if (query.accountId) where.lines = { some: { accountId: query.accountId } };
    if (query.search) {
      where.OR = [
        { narration: { contains: query.search, mode: 'insensitive' } },
        { reference: { contains: query.search, mode: 'insensitive' } },
        { entryNumber: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      LedgerModel.findMany(where, { skip: pagination.skip, take: pagination.take }),
      LedgerModel.count(where),
    ]);

    return { items, total, page: pagination.page, limit: pagination.limit };
  },

  async getById(userId: string, id: string) {
    const entry = await LedgerModel.findById(userId, id);
    if (!entry) throw ApiError.notFound('Journal entry');
    return entry;
  },

  async voidEntry(userId: string, id: string) {
    const entry = await LedgerModel.findById(userId, id);
    if (!entry) throw ApiError.notFound('Journal entry');
    if (entry.status === 'VOID') throw ApiError.badRequest('This entry is already voided');
    if (entry.source !== JournalSource.MANUAL) {
      throw ApiError.badRequest(
        'System-generated entries cannot be voided directly. Cancel or delete the source document instead.',
      );
    }
    return LedgerModel.void(userId, id);
  },

  /** Signed balance for an account, respecting its normal balance side. */
  signedBalance(type: AccountType, debitTotal: number, creditTotal: number): number {
    return NORMAL_BALANCE[type] === 'debit'
      ? round2(subtract(debitTotal, creditTotal)).toNumber()
      : round2(subtract(creditTotal, debitTotal)).toNumber();
  },

  /**
   * Trial balance as of a date. Opening balances are folded in so the report
   * reconciles even before any journal activity exists.
   */
  async trialBalance(userId: string, asOf: Date = new Date()): Promise<TrialBalance> {
    const [accounts, grouped] = await Promise.all([
      prisma.account.findMany({
        where: { userId },
        orderBy: [{ code: 'asc' }],
        select: { id: true, code: true, name: true, type: true, subtype: true, openingBalance: true },
      }),
      AccountsModel.balancesByAccount(userId, { to: asOf }),
    ]);

    const movement = new Map(grouped.map((g) => [g.accountId, g._sum]));

    const rows: TrialBalanceRow[] = accounts.map((account) => {
      const sums = movement.get(account.id);
      const opening = toDecimal(account.openingBalance);
      const normalSide = NORMAL_BALANCE[account.type];

      // An opening balance sits on the account's normal side by definition.
      const debitTotal = round2(
        add(sums?.debit ?? 0, normalSide === 'debit' ? opening : 0),
      ).toNumber();
      const creditTotal = round2(
        add(sums?.credit ?? 0, normalSide === 'credit' ? opening : 0),
      ).toNumber();

      const balance = this.signedBalance(account.type, debitTotal, creditTotal);

      return {
        accountId: account.id,
        code: account.code,
        name: account.name,
        type: account.type,
        subtype: account.subtype,
        debitTotal,
        creditTotal,
        balance,
        debitBalance: normalSide === 'debit' && balance > 0 ? balance : normalSide === 'credit' && balance < 0 ? Math.abs(balance) : 0,
        creditBalance: normalSide === 'credit' && balance > 0 ? balance : normalSide === 'debit' && balance < 0 ? Math.abs(balance) : 0,
      };
    });

    const active = rows.filter((r) => r.debitTotal !== 0 || r.creditTotal !== 0);
    const totalDebit = round2(add(...active.map((r) => r.debitBalance))).toNumber();
    const totalCredit = round2(add(...active.map((r) => r.creditBalance))).toNumber();

    return {
      asOf: asOf.toISOString(),
      rows: active,
      totalDebit,
      totalCredit,
      // Tolerance of one paisa absorbs rounding on split tax lines.
      isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
    };
  },

  /** Net movement for a set of account types over a window — the P&L primitive. */
  async totalsForTypes(
    userId: string,
    types: AccountType[],
    range: { from?: Date; to?: Date } = {},
  ): Promise<number> {
    const [accounts, grouped] = await Promise.all([
      prisma.account.findMany({ where: { userId, type: { in: types } }, select: { id: true, type: true } }),
      AccountsModel.typeTotals(userId, types, range),
    ]);

    const typeById = new Map(accounts.map((a) => [a.id, a.type]));
    let total = toDecimal(0);

    for (const row of grouped) {
      const type = typeById.get(row.accountId);
      if (!type) continue;
      total = total.plus(
        this.signedBalance(type, toNumber(row._sum.debit), toNumber(row._sum.credit)),
      );
    }

    return round2(total).toNumber();
  },
};

export default LedgerService;
