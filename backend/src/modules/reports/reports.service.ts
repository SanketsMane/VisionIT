import { AccountType, DocumentType } from '@prisma/client';
import { prisma } from '@config/database';
import { add, divide, multiply, round2, subtract, toNumber } from '@utils/money.util';
import { dayjs, fiscalYearRange, monthRange, monthsBetween } from '@utils/date.util';
import { AccountsModel } from '@modules/accounts/accounts.model';
import { LedgerService } from '@modules/ledger/ledger.service';
import { InvoicesModel } from '@modules/invoices/invoices.model';
import { PaymentsModel } from '@modules/payments/payments.model';
import { ExpensesModel } from '@modules/expenses/expenses.model';
import type {
  BalanceSheet,
  CashFlowStatement,
  MonthlyStatement,
  ProfitAndLoss,
  StatementLine,
  StatementSection,
} from './reports.types';

/** Cost-of-delivery buckets, kept separate from overheads for gross margin. */
const COST_SUBTYPES = ['COST_OF_SERVICES'];
const OPEX_SUBTYPES = ['OPERATING_EXPENSE', 'PAYROLL_EXPENSE', 'OTHER_EXPENSE'];
const TAX_EXPENSE_SUBTYPES = ['TAX_EXPENSE'];
const OTHER_INCOME_SUBTYPES = ['OTHER_INCOME'];

const CURRENT_ASSET_SUBTYPES = ['CASH', 'BANK', 'ACCOUNTS_RECEIVABLE', 'OTHER_CURRENT_ASSET'];
const FIXED_ASSET_SUBTYPES = ['FIXED_ASSET'];
const CURRENT_LIABILITY_SUBTYPES = ['ACCOUNTS_PAYABLE', 'CREDIT_CARD', 'TAX_PAYABLE', 'OTHER_CURRENT_LIABILITY'];
const LONG_TERM_LIABILITY_SUBTYPES = ['LONG_TERM_LIABILITY'];

const section = (title: string, lines: StatementLine[]): StatementSection => ({
  title,
  lines: lines.filter((l) => l.amount !== 0).sort((a, b) => a.code.localeCompare(b.code)),
  total: round2(add(...lines.map((l) => l.amount))).toNumber(),
});

const percent = (part: number, whole: number): number =>
  whole === 0 ? 0 : round2(multiply(divide(part, whole), 100)).toNumber();

/**
 * Loads every account with its signed balance for a window. This is the shared
 * primitive behind the P&L and balance sheet, so both always agree on the
 * numbers even though they slice them differently.
 */
const balancedAccounts = async (
  userId: string,
  range: { from?: Date; to?: Date },
  options: { includeOpening?: boolean } = {},
): Promise<(StatementLine & { type: AccountType })[]> => {
  const [accounts, grouped] = await Promise.all([
    prisma.account.findMany({
      where: { userId },
      select: { id: true, code: true, name: true, type: true, subtype: true, openingBalance: true },
      orderBy: { code: 'asc' },
    }),
    AccountsModel.balancesByAccount(userId, range),
  ]);

  const movement = new Map(grouped.map((g) => [g.accountId, g._sum]));

  return accounts.map((account) => {
    const sums = movement.get(account.id);
    const debit = toNumber(sums?.debit);
    const credit = toNumber(sums?.credit);

    // Opening balances belong on the balance sheet but must never leak into a
    // period P&L, where they would double-count prior-year activity.
    const opening = options.includeOpening ? toNumber(account.openingBalance) : 0;

    return {
      accountId: account.id,
      code: account.code,
      name: account.name,
      subtype: account.subtype,
      type: account.type,
      amount: round2(
        add(LedgerService.signedBalance(account.type, debit, credit), opening),
      ).toNumber(),
    };
  });
};

export const ReportsService = {
  async baseCurrency(userId: string): Promise<string> {
    const company = await prisma.companyProfile.findUnique({
      where: { userId },
      select: { baseCurrency: true },
    });
    return company?.baseCurrency ?? 'INR';
  },

  async fiscalStartMonth(userId: string): Promise<number> {
    const company = await prisma.companyProfile.findUnique({
      where: { userId },
      select: { fiscalYearStartMonth: true },
    });
    return company?.fiscalYearStartMonth ?? 4;
  },

  /**
   * Profit & Loss for a window.
   *
   * Built from ledger movement only (never from invoice totals), so manual
   * journal adjustments are reflected exactly as an accountant would expect.
   */
  async profitAndLoss(userId: string, from: Date, to: Date): Promise<ProfitAndLoss> {
    const [accounts, currency] = await Promise.all([
      balancedAccounts(userId, { from, to }),
      this.baseCurrency(userId),
    ]);

    const pick = (type: AccountType, subtypes: string[]) =>
      accounts.filter((a) => a.type === type && subtypes.includes(a.subtype));

    const income = section('Revenue', pick(AccountType.INCOME, ['SERVICE_INCOME']));
    const otherIncome = section('Other income', pick(AccountType.INCOME, OTHER_INCOME_SUBTYPES));
    const costOfServices = section('Cost of services', pick(AccountType.EXPENSE, COST_SUBTYPES));
    const operatingExpenses = section('Operating expenses', pick(AccountType.EXPENSE, OPEX_SUBTYPES));
    const taxExpense = section('Taxes', pick(AccountType.EXPENSE, TAX_EXPENSE_SUBTYPES));

    const grossProfit = round2(subtract(income.total, costOfServices.total)).toNumber();
    const operatingProfit = round2(subtract(grossProfit, operatingExpenses.total)).toNumber();
    const netProfit = round2(
      subtract(add(operatingProfit, otherIncome.total), taxExpense.total),
    ).toNumber();

    const totalRevenue = round2(add(income.total, otherIncome.total)).toNumber();

    return {
      period: {
        from: from.toISOString(),
        to: to.toISOString(),
        label: `${dayjs.utc(from).format('DD MMM YYYY')} – ${dayjs.utc(to).format('DD MMM YYYY')}`,
      },
      currency,
      income,
      costOfServices,
      grossProfit,
      grossMargin: percent(grossProfit, income.total),
      operatingExpenses,
      operatingProfit,
      otherIncome,
      taxExpense,
      netProfit,
      netMargin: percent(netProfit, totalRevenue),
    };
  },

  /**
   * Balance sheet as of a date.
   *
   * Income and expense accounts are nominal — they close into equity rather
   * than appearing directly — so current-period profit is added to equity to
   * make the statement balance.
   */
  async balanceSheet(userId: string, asOf: Date): Promise<BalanceSheet> {
    const [accounts, currency, fiscalStart] = await Promise.all([
      balancedAccounts(userId, { to: asOf }, { includeOpening: true }),
      this.baseCurrency(userId),
      this.fiscalStartMonth(userId),
    ]);

    const pick = (type: AccountType, subtypes: string[]) =>
      accounts.filter((a) => a.type === type && subtypes.includes(a.subtype));

    const currentAssets = section('Current assets', pick(AccountType.ASSET, CURRENT_ASSET_SUBTYPES));
    const fixedAssets = section('Fixed assets', pick(AccountType.ASSET, FIXED_ASSET_SUBTYPES));
    const currentLiabilities = section('Current liabilities', pick(AccountType.LIABILITY, CURRENT_LIABILITY_SUBTYPES));
    const longTermLiabilities = section('Long-term liabilities', pick(AccountType.LIABILITY, LONG_TERM_LIABILITY_SUBTYPES));
    const equityAccounts = accounts.filter((a) => a.type === AccountType.EQUITY);

    /*
     * Income and expense accounts are nominal: they close into equity. This
     * system has no year-end closing entry, so *all* accumulated profit has to
     * be folded into equity here, not just the current year's — otherwise every
     * rupee earned before the fiscal-year boundary silently vanishes and the
     * sheet fails to balance by exactly that amount.
     *
     * The total is split for presentation only:
     *   prior years   → shown with retained earnings
     *   current year  → shown as its own line
     */
    const fyYear =
      dayjs.utc(asOf).month() + 1 >= fiscalStart
        ? dayjs.utc(asOf).year()
        : dayjs.utc(asOf).year() - 1;
    const fy = fiscalYearRange(fyYear, fiscalStart);

    const [incomeToDate, expenseToDate, incomeThisYear, expenseThisYear] = await Promise.all([
      LedgerService.totalsForTypes(userId, [AccountType.INCOME], { to: asOf }),
      LedgerService.totalsForTypes(userId, [AccountType.EXPENSE], { to: asOf }),
      LedgerService.totalsForTypes(userId, [AccountType.INCOME], { from: fy.start, to: asOf }),
      LedgerService.totalsForTypes(userId, [AccountType.EXPENSE], { from: fy.start, to: asOf }),
    ]);

    const accumulatedProfit = round2(subtract(incomeToDate, expenseToDate)).toNumber();
    const currentPeriodProfit = round2(subtract(incomeThisYear, expenseThisYear)).toNumber();
    const priorPeriodProfit = round2(subtract(accumulatedProfit, currentPeriodProfit)).toNumber();

    const equityBase = section('Equity', equityAccounts);
    const retainedEarningsAccount =
      equityAccounts.find((a) => a.subtype === 'RETAINED_EARNINGS')?.amount ?? 0;
    // Unclosed prior-year profit is economically retained earnings, even though
    // no entry has moved it into that account yet.
    const retainedEarnings = round2(add(retainedEarningsAccount, priorPeriodProfit)).toNumber();

    const totalAssets = round2(add(currentAssets.total, fixedAssets.total)).toNumber();
    const totalLiabilities = round2(add(currentLiabilities.total, longTermLiabilities.total)).toNumber();
    const totalEquity = round2(add(equityBase.total, accumulatedProfit)).toNumber();
    const totalLiabilitiesAndEquity = round2(add(totalLiabilities, totalEquity)).toNumber();

    return {
      asOf: asOf.toISOString(),
      currency,
      assets: { current: currentAssets, fixed: fixedAssets, total: totalAssets },
      liabilities: { current: currentLiabilities, longTerm: longTermLiabilities, total: totalLiabilities },
      equity: {
        ...equityBase,
        total: totalEquity,
        retainedEarnings,
        currentPeriodProfit,
        priorPeriodProfit,
        accumulatedProfit,
      },
      totalLiabilitiesAndEquity,
      isBalanced: Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01,
    };
  },

  /**
   * Cash flow, derived directly from movement on cash and bank accounts.
   *
   * This is the direct method: every debit to a cash account is an inflow and
   * every credit an outflow, classified by what the contra account was.
   */
  async cashFlow(userId: string, from: Date, to: Date): Promise<CashFlowStatement> {
    const currency = await this.baseCurrency(userId);

    const cashAccounts = await prisma.account.findMany({
      where: { userId, subtype: { in: ['CASH', 'BANK'] } },
      select: { id: true, openingBalance: true },
    });
    const cashIds = cashAccounts.map((a) => a.id);

    if (!cashIds.length) {
      return {
        period: { from: from.toISOString(), to: to.toISOString(), label: dayjs.utc(from).format('MMM YYYY') },
        currency,
        opening: 0,
        operating: { inflows: 0, outflows: 0, net: 0 },
        investing: { net: 0 },
        financing: { net: 0 },
        netChange: 0,
        closing: 0,
      };
    }

    const openingSeed = round2(add(...cashAccounts.map((a) => toNumber(a.openingBalance)))).toNumber();

    const [priorMovement, periodLines] = await Promise.all([
      prisma.journalLine.aggregate({
        where: { accountId: { in: cashIds }, entry: { userId, status: 'POSTED', date: { lt: from } } },
        _sum: { debit: true, credit: true },
      }),
      prisma.journalLine.findMany({
        where: {
          accountId: { in: cashIds },
          entry: { userId, status: 'POSTED', date: { gte: from, lte: to } },
        },
        include: { entry: { select: { id: true, source: true } } },
      }),
    ]);

    const opening = round2(
      add(openingSeed, subtract(toNumber(priorMovement._sum.debit), toNumber(priorMovement._sum.credit))),
    ).toNumber();

    // Classify each cash movement by the other side of its journal entry.
    const entryIds = [...new Set(periodLines.map((l) => l.entry.id))];
    const contraLines = await prisma.journalLine.findMany({
      where: { entryId: { in: entryIds }, accountId: { notIn: cashIds } },
      include: { account: { select: { type: true, subtype: true } } },
    });

    const contraByEntry = new Map<string, { type: AccountType; subtype: string }[]>();
    for (const line of contraLines) {
      const list = contraByEntry.get(line.entryId) ?? [];
      list.push({ type: line.account.type, subtype: line.account.subtype });
      contraByEntry.set(line.entryId, list);
    }

    const buckets = { operating: 0, investing: 0, financing: 0 };
    let inflows = 0;
    let outflows = 0;

    for (const line of periodLines) {
      const delta = round2(subtract(toNumber(line.debit), toNumber(line.credit))).toNumber();
      if (delta === 0) continue;

      if (delta > 0) inflows = round2(add(inflows, delta)).toNumber();
      else outflows = round2(add(outflows, Math.abs(delta))).toNumber();

      const contras = contraByEntry.get(line.entryId) ?? [];
      const isInvesting = contras.some((c) => c.subtype === 'FIXED_ASSET');
      const isFinancing = contras.some(
        (c) => c.type === AccountType.EQUITY || c.subtype === 'LONG_TERM_LIABILITY',
      );

      const bucket = isInvesting ? 'investing' : isFinancing ? 'financing' : 'operating';
      buckets[bucket] = round2(add(buckets[bucket], delta)).toNumber();
    }

    const netChange = round2(add(buckets.operating, buckets.investing, buckets.financing)).toNumber();

    return {
      period: {
        from: from.toISOString(),
        to: to.toISOString(),
        label: `${dayjs.utc(from).format('DD MMM YYYY')} – ${dayjs.utc(to).format('DD MMM YYYY')}`,
      },
      currency,
      opening,
      operating: { inflows, outflows, net: buckets.operating },
      investing: { net: buckets.investing },
      financing: { net: buckets.financing },
      netChange,
      closing: round2(add(opening, netChange)).toNumber(),
    };
  },

  /**
   * The month-end pack: everything a freelancer needs to close a month in one
   * response — revenue, spend, margin, receivables, cash and tax position,
   * plus a comparison against the prior month.
   */
  async monthlyStatement(userId: string, year: number, month: number): Promise<MonthlyStatement> {
    const { start, end } = monthRange(year, month);
    const previous = dayjs.utc(start).subtract(1, 'month');
    const previousRange = monthRange(previous.year(), previous.month() + 1);

    const [
      currency,
      pnl,
      previousPnl,
      cash,
      invoiced,
      collected,
      expenseTotals,
      expenseStats,
      receivablesNow,
      receivablesOpening,
      overdue,
      topClientRows,
    ] = await Promise.all([
      this.baseCurrency(userId),
      this.profitAndLoss(userId, start, end),
      this.profitAndLoss(userId, previousRange.start, previousRange.end),
      this.cashFlow(userId, start, end),
      InvoicesModel.revenueBetween(userId, start, end),
      PaymentsModel.collectedBetween(userId, start, end),
      ExpensesModel.sum({ userId, deletedAt: null, date: { gte: start, lte: end } }),
      ExpensesModel.byCategory(userId, { from: start, to: end }),
      this.receivableBalance(userId, end),
      this.receivableBalance(userId, new Date(start.getTime() - 1)),
      prisma.invoice.aggregate({
        where: {
          userId,
          deletedAt: null,
          documentType: DocumentType.INVOICE,
          status: { in: ['SENT', 'VIEWED', 'PARTIALLY_PAID', 'OVERDUE'] },
          dueDate: { lt: end },
        },
        _sum: { balanceDue: true },
      }),
      prisma.payment.groupBy({
        by: ['invoiceId'],
        where: { userId, paidAt: { gte: start, lte: end }, invoiceId: { not: null } },
        _sum: { amount: true },
      }),
    ]);

    // Resolve client names for the top-earning clients this month.
    const invoiceIds = topClientRows.map((r) => r.invoiceId).filter((id): id is string => Boolean(id));
    const invoiceClients = invoiceIds.length
      ? await prisma.invoice.findMany({
          where: { id: { in: invoiceIds } },
          select: { id: true, client: { select: { id: true, name: true } } },
        })
      : [];
    const clientByInvoice = new Map(invoiceClients.map((i) => [i.id, i.client]));

    const clientTotals = new Map<string, { id: string; name: string; amount: number }>();
    for (const row of topClientRows) {
      const client = row.invoiceId ? clientByInvoice.get(row.invoiceId) : undefined;
      if (!client) continue;
      const current = clientTotals.get(client.id) ?? { id: client.id, name: client.name, amount: 0 };
      current.amount = round2(add(current.amount, toNumber(row._sum.amount))).toNumber();
      clientTotals.set(client.id, current);
    }

    const categories = await ExpensesModel.listCategories(userId);
    const categoryMeta = new Map(categories.map((c) => [c.id, { name: c.name, color: c.color }]));

    const taxCollected = toNumber(invoiced._sum.taxAmount);
    const taxPaid = toNumber(expenseTotals._sum.taxAmount);

    const previousNet = previousPnl.netProfit;
    const changePercent =
      previousNet === 0 ? null : percent(round2(subtract(pnl.netProfit, previousNet)).toNumber(), Math.abs(previousNet));

    return {
      year,
      month,
      label: dayjs.utc(start).format('MMMM YYYY'),
      currency,
      revenue: {
        invoiced: toNumber(invoiced._sum.total),
        collected: toNumber(collected._sum.amount),
        invoiceCount: invoiced._count._all,
      },
      expenses: {
        total: toNumber(expenseTotals._sum.total),
        tax: taxPaid,
        count: expenseTotals._count._all,
      },
      profit: {
        gross: pnl.grossProfit,
        net: pnl.netProfit,
        margin: pnl.netMargin,
      },
      receivables: {
        opening: receivablesOpening,
        closing: receivablesNow,
        overdue: toNumber(overdue._sum.balanceDue),
      },
      cash: { opening: cash.opening, closing: cash.closing, net: cash.netChange },
      tax: { collected: taxCollected, paid: taxPaid, net: round2(subtract(taxCollected, taxPaid)).toNumber() },
      topClients: [...clientTotals.values()].sort((a, b) => b.amount - a.amount).slice(0, 5),
      topExpenseCategories: expenseStats
        .map((row) => ({
          name: row.categoryId ? (categoryMeta.get(row.categoryId)?.name ?? 'Unknown') : 'Uncategorised',
          amount: toNumber(row._sum.total),
          color: row.categoryId ? (categoryMeta.get(row.categoryId)?.color ?? null) : '#94A3B8',
        }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5),
      comparison: { previousMonthNetProfit: previousNet, changePercent },
    };
  },

  /** Accounts-receivable balance as of a date, straight from the ledger. */
  async receivableBalance(userId: string, asOf: Date): Promise<number> {
    const account = await AccountsModel.findByCode(userId, '1100');
    if (!account) return 0;

    const movement = await prisma.journalLine.aggregate({
      where: { accountId: account.id, entry: { userId, status: 'POSTED', date: { lte: asOf } } },
      _sum: { debit: true, credit: true },
    });

    return round2(
      add(
        toNumber(account.openingBalance),
        subtract(toNumber(movement._sum.debit), toNumber(movement._sum.credit)),
      ),
    ).toNumber();
  },

  /** Month-by-month revenue vs expenses vs profit — the dashboard trend chart. */
  async trend(userId: string, from: Date, to: Date) {
    const buckets = monthsBetween(from, to);

    const results = await Promise.all(
      buckets.map(async (bucket) => {
        const { start, end } = monthRange(bucket.year, bucket.month);
        const [income, expense, collected] = await Promise.all([
          LedgerService.totalsForTypes(userId, [AccountType.INCOME], { from: start, to: end }),
          LedgerService.totalsForTypes(userId, [AccountType.EXPENSE], { from: start, to: end }),
          PaymentsModel.collectedBetween(userId, start, end),
        ]);

        return {
          year: bucket.year,
          month: bucket.month,
          label: bucket.label,
          revenue: income,
          expenses: expense,
          profit: round2(subtract(income, expense)).toNumber(),
          collected: toNumber(collected._sum.amount),
        };
      }),
    );

    return results;
  },

  /** Output vs input tax for a period — the GST/VAT filing summary. */
  async taxSummary(userId: string, from: Date, to: Date) {
    const [invoiced, expenses, currency] = await Promise.all([
      InvoicesModel.revenueBetween(userId, from, to),
      ExpensesModel.sum({ userId, deletedAt: null, date: { gte: from, lte: to } }),
      this.baseCurrency(userId),
    ]);

    const outputTax = toNumber(invoiced._sum.taxAmount);
    const inputTax = toNumber(expenses._sum.taxAmount);

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      currency,
      taxableRevenue: toNumber(invoiced._sum.subtotal),
      outputTax,
      inputTax,
      netTaxPayable: round2(subtract(outputTax, inputTax)).toNumber(),
      invoiceCount: invoiced._count._all,
      expenseCount: expenses._count._all,
    };
  },
};

export default ReportsService;
