import { AccountType, JournalSource } from '@prisma/client';
import { prisma } from '@config/database';
import { ApiError } from '@utils/api-error';
import { add, round2, toDecimal, toNumber } from '@utils/money.util';
import { resolvePagination } from '@utils/pagination.util';
import { LedgerService } from '@modules/ledger/ledger.service';
import { AccountsModel } from './accounts.model';
import { NORMAL_BALANCE } from './accounts.constants';
import type { CreateAccountDto, ListAccountsDto, TransferDto, UpdateAccountDto } from './accounts.validation';

export interface AccountWithBalance {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  subtype: string;
  isActive: boolean;
  isSystem: boolean;
  currency: string;
  balance: number;
  debitTotal: number;
  creditTotal: number;
}

export const AccountsService = {
  async list(userId: string, query: ListAccountsDto) {
    const where = AccountsModel.buildWhere(userId, query);
    const accounts = await AccountsModel.findMany(where);

    if (!query.includeBalances) return { accounts, totals: null };

    const grouped = await AccountsModel.balancesByAccount(userId, { to: query.asOf });
    const movement = new Map(grouped.map((g) => [g.accountId, g._sum]));

    const withBalances = accounts.map((account) => {
      const sums = movement.get(account.id);
      const normalSide = NORMAL_BALANCE[account.type];
      const opening = toDecimal(account.openingBalance);

      const debitTotal = round2(add(sums?.debit ?? 0, normalSide === 'debit' ? opening : 0)).toNumber();
      const creditTotal = round2(add(sums?.credit ?? 0, normalSide === 'credit' ? opening : 0)).toNumber();

      return {
        ...account,
        debitTotal,
        creditTotal,
        balance: LedgerService.signedBalance(account.type, debitTotal, creditTotal),
      };
    });

    // Section subtotals drive the chart-of-accounts summary strip in the UI.
    const totals = Object.values(AccountType).reduce<Record<string, number>>((acc, type) => {
      acc[type] = round2(
        add(...withBalances.filter((a) => a.type === type).map((a) => a.balance)),
      ).toNumber();
      return acc;
    }, {});

    return { accounts: withBalances, totals };
  },

  async getById(userId: string, id: string) {
    const account = await AccountsModel.findById(userId, id);
    if (!account) throw ApiError.notFound('Account');

    const grouped = await AccountsModel.balancesByAccount(userId);
    const sums = grouped.find((g) => g.accountId === id)?._sum;
    const normalSide = NORMAL_BALANCE[account.type];
    const opening = toDecimal(account.openingBalance);

    const debitTotal = round2(add(sums?.debit ?? 0, normalSide === 'debit' ? opening : 0)).toNumber();
    const creditTotal = round2(add(sums?.credit ?? 0, normalSide === 'credit' ? opening : 0)).toNumber();

    return {
      ...account,
      debitTotal,
      creditTotal,
      balance: LedgerService.signedBalance(account.type, debitTotal, creditTotal),
    };
  },

  async create(userId: string, dto: CreateAccountDto) {
    const existing = await AccountsModel.findByCode(userId, dto.code);
    if (existing) throw ApiError.conflict(`Account code ${dto.code} is already in use`);

    if (dto.parentId) {
      const parent = await AccountsModel.findById(userId, dto.parentId);
      if (!parent) throw ApiError.badRequest('The selected parent account does not exist');
      if (parent.type !== dto.type) {
        throw ApiError.badRequest('A sub-account must share its parent\'s account type');
      }
    }

    const { parentId, openingBalance, ...rest } = dto;

    const account = await AccountsModel.create(userId, {
      ...rest,
      openingBalance,
      ...(parentId ? { parent: { connect: { id: parentId } } } : {}),
    });

    // An opening balance must be double-entered, otherwise the trial balance
    // would not tie. The contra side lands in Opening Balance Equity.
    if (openingBalance !== 0) {
      const { OPENING_BALANCE_EQUITY } = await LedgerService.resolveSystemAccounts(userId, [
        'OPENING_BALANCE_EQUITY',
      ]);
      const isDebitNormal = NORMAL_BALANCE[account.type] === 'debit';
      const amount = Math.abs(openingBalance);

      await LedgerService.createEntry(userId, {
        date: new Date(),
        source: JournalSource.OPENING_BALANCE,
        narration: `Opening balance for ${account.code} — ${account.name}`,
        lines: isDebitNormal
          ? [
              { accountId: account.id, debit: amount },
              { accountId: OPENING_BALANCE_EQUITY, credit: amount },
            ]
          : [
              { accountId: OPENING_BALANCE_EQUITY, debit: amount },
              { accountId: account.id, credit: amount },
            ],
      });
    }

    return account;
  },

  async update(userId: string, id: string, dto: UpdateAccountDto) {
    const account = await AccountsModel.findById(userId, id);
    if (!account) throw ApiError.notFound('Account');

    // Changing the type of an account that already has postings would silently
    // flip the sign of historical balances across every past statement.
    if (dto.type && dto.type !== account.type && (await AccountsModel.hasTransactions(id))) {
      throw ApiError.badRequest(
        'This account already has transactions, so its type can no longer be changed',
      );
    }

    if (dto.code && dto.code !== account.code) {
      if (account.isSystem) {
        throw ApiError.badRequest('System account codes are referenced by automatic postings and cannot be changed');
      }
      const clash = await AccountsModel.findByCode(userId, dto.code);
      if (clash) throw ApiError.conflict(`Account code ${dto.code} is already in use`);
    }

    const { parentId, ...rest } = dto;
    return AccountsModel.update(userId, id, {
      ...rest,
      ...(parentId === null ? { parent: { disconnect: true } } : parentId ? { parent: { connect: { id: parentId } } } : {}),
    });
  },

  async remove(userId: string, id: string) {
    const account = await AccountsModel.findById(userId, id);
    if (!account) throw ApiError.notFound('Account');
    if (account.isSystem) throw ApiError.badRequest('System accounts cannot be deleted');
    if (account.children.length) {
      throw ApiError.badRequest('Move or delete the sub-accounts before deleting this account');
    }
    if (await AccountsModel.hasTransactions(id)) {
      throw ApiError.badRequest(
        'This account has posted transactions. Deactivate it instead of deleting it.',
      );
    }
    await AccountsModel.delete(userId, id);
  },

  /**
   * Account statement with a running balance. The opening figure is the net
   * movement strictly before `from`, so each page reads like a bank statement.
   */
  async ledger(userId: string, id: string, query: { from?: Date; to?: Date; page?: number; limit?: number }) {
    const account = await AccountsModel.findById(userId, id);
    if (!account) throw ApiError.notFound('Account');

    const pagination = resolvePagination(query, { defaultLimit: 50 });
    const normalSide = NORMAL_BALANCE[account.type];

    const [lines, total, openingAgg] = await Promise.all([
      AccountsModel.ledgerLines(userId, id, {
        from: query.from,
        to: query.to,
        skip: pagination.skip,
        take: pagination.take,
      }),
      AccountsModel.ledgerLineCount(userId, id, { from: query.from, to: query.to }),
      query.from
        ? AccountsModel.openingMovement(userId, id, query.from)
        : Promise.resolve({ _sum: { debit: null, credit: null } }),
    ]);

    const openingFromMovement = LedgerService.signedBalance(
      account.type,
      toNumber(openingAgg._sum.debit),
      toNumber(openingAgg._sum.credit),
    );
    const opening = round2(add(openingFromMovement, account.openingBalance)).toNumber();

    // Lines arrive newest-first for display; the running balance has to be
    // computed oldest-first, so walk a reversed copy and flip it back.
    let running = opening;
    const chronological = [...lines].reverse().map((line) => {
      const delta =
        normalSide === 'debit'
          ? toNumber(line.debit) - toNumber(line.credit)
          : toNumber(line.credit) - toNumber(line.debit);
      running = round2(add(running, delta)).toNumber();
      return {
        id: line.id,
        date: line.entry.date,
        entryNumber: line.entry.entryNumber,
        narration: line.description ?? line.entry.narration,
        reference: line.entry.reference,
        source: line.entry.source,
        invoiceId: line.entry.invoiceId,
        paymentId: line.entry.paymentId,
        expenseId: line.entry.expenseId,
        debit: toNumber(line.debit),
        credit: toNumber(line.credit),
        runningBalance: running,
      };
    });

    return {
      account: { id: account.id, code: account.code, name: account.name, type: account.type, currency: account.currency },
      openingBalance: opening,
      closingBalance: running,
      lines: chronological.reverse(),
      total,
      page: pagination.page,
      limit: pagination.limit,
    };
  },

  /** Moves money between two of the user's own accounts (e.g. bank → cash). */
  async transfer(userId: string, dto: TransferDto) {
    const [from, to] = await Promise.all([
      AccountsModel.findById(userId, dto.fromAccountId),
      AccountsModel.findById(userId, dto.toAccountId),
    ]);

    if (!from) throw ApiError.badRequest('Source account not found');
    if (!to) throw ApiError.badRequest('Destination account not found');

    return LedgerService.createEntry(userId, {
      date: dto.date,
      source: JournalSource.TRANSFER,
      narration: dto.narration ?? `Transfer from ${from.name} to ${to.name}`,
      reference: dto.reference ?? null,
      lines: [
        { accountId: to.id, debit: dto.amount, description: `Transfer in from ${from.name}` },
        { accountId: from.id, credit: dto.amount, description: `Transfer out to ${to.name}` },
      ],
    });
  },

  /** Cash-position strip: every bank/cash account with its current balance. */
  async cashPosition(userId: string) {
    const accounts = await prisma.account.findMany({
      where: { userId, isActive: true, subtype: { in: ['CASH', 'BANK'] } },
      orderBy: { code: 'asc' },
    });

    const grouped = await AccountsModel.balancesByAccount(userId);
    const movement = new Map(grouped.map((g) => [g.accountId, g._sum]));

    const items = accounts.map((account) => {
      const sums = movement.get(account.id);
      const debitTotal = round2(add(sums?.debit ?? 0, account.openingBalance)).toNumber();
      const creditTotal = toNumber(sums?.credit);
      return {
        id: account.id,
        code: account.code,
        name: account.name,
        subtype: account.subtype,
        bankName: account.bankName,
        currency: account.currency,
        balance: round2(debitTotal - creditTotal).toNumber(),
      };
    });

    return {
      accounts: items,
      totalCash: round2(add(...items.map((i) => i.balance))).toNumber(),
    };
  },
};

export default AccountsService;
