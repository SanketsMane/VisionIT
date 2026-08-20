import { AccountType, DocumentType } from '@prisma/client';
import { prisma } from '@config/database';
import { add, round2, subtract, toNumber } from '@utils/money.util';
import { dayjs, monthRange } from '@utils/date.util';
import { LedgerService } from '@modules/ledger/ledger.service';
import { AccountsService } from '@modules/accounts/accounts.service';
import { InvoicesService } from '@modules/invoices/invoices.service';
import { ReportsService } from '@modules/reports/reports.service';
import { ProjectsService } from '@modules/projects/projects.service';

/**
 * One aggregated payload for the landing screen. Everything is fetched
 * concurrently — the dashboard is the most-hit endpoint and sequential
 * round-trips would dominate its latency.
 */
export const DashboardService = {
  async overview(userId: string) {
    const now = dayjs.utc();
    const thisMonth = monthRange(now.year(), now.month() + 1);
    const lastMonth = monthRange(
      now.subtract(1, 'month').year(),
      now.subtract(1, 'month').month() + 1,
    );

    const [
      currency,
      invoiceStats,
      projectStats,
      cash,
      revenueThisMonth,
      revenueLastMonth,
      expensesThisMonth,
      expensesLastMonth,
      collectedThisMonth,
      clientCount,
      recentInvoices,
      recentPayments,
      upcomingDeadlines,
      recentActivity,
    ] = await Promise.all([
      ReportsService.baseCurrency(userId),
      InvoicesService.stats(userId),
      ProjectsService.stats(userId),
      AccountsService.cashPosition(userId),
      LedgerService.totalsForTypes(userId, [AccountType.INCOME], { from: thisMonth.start, to: thisMonth.end }),
      LedgerService.totalsForTypes(userId, [AccountType.INCOME], { from: lastMonth.start, to: lastMonth.end }),
      LedgerService.totalsForTypes(userId, [AccountType.EXPENSE], { from: thisMonth.start, to: thisMonth.end }),
      LedgerService.totalsForTypes(userId, [AccountType.EXPENSE], { from: lastMonth.start, to: lastMonth.end }),
      prisma.payment.aggregate({
        where: { userId, paidAt: { gte: thisMonth.start, lte: thisMonth.end } },
        _sum: { amount: true },
      }),
      prisma.client.count({ where: { userId, deletedAt: null, status: 'ACTIVE' } }),
      prisma.invoice.findMany({
        where: { userId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true, number: true, status: true, total: true, balanceDue: true,
          currency: true, dueDate: true, issueDate: true,
          client: { select: { id: true, name: true, companyName: true } },
        },
      }),
      prisma.payment.findMany({
        where: { userId },
        orderBy: { paidAt: 'desc' },
        take: 5,
        select: {
          id: true, amount: true, currency: true, paidAt: true, method: true,
          invoice: { select: { number: true, client: { select: { name: true } } } },
        },
      }),
      prisma.projectMilestone.findMany({
        where: {
          project: { userId, deletedAt: null },
          completedAt: null,
          dueDate: { gte: now.startOf('day').toDate(), lte: now.add(30, 'day').toDate() },
        },
        orderBy: { dueDate: 'asc' },
        take: 6,
        select: {
          id: true, title: true, dueDate: true, amount: true,
          project: { select: { id: true, title: true, slug: true } },
        },
      }),
      prisma.activityLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, action: true, entityType: true, entityId: true, createdAt: true },
      }),
    ]);

    const profitThisMonth = round2(subtract(revenueThisMonth, expensesThisMonth)).toNumber();
    const profitLastMonth = round2(subtract(revenueLastMonth, expensesLastMonth)).toNumber();

    /** Percentage change vs the prior month; null when there's no baseline. */
    const delta = (current: number, previous: number): number | null =>
      previous === 0 ? null : round2(((current - previous) / Math.abs(previous)) * 100).toNumber();

    return {
      currency,
      kpis: {
        revenueThisMonth,
        revenueChange: delta(revenueThisMonth, revenueLastMonth),
        expensesThisMonth,
        expensesChange: delta(expensesThisMonth, expensesLastMonth),
        profitThisMonth,
        profitChange: delta(profitThisMonth, profitLastMonth),
        collectedThisMonth: toNumber(collectedThisMonth._sum.amount),
        cashOnHand: cash.totalCash,
        outstanding: invoiceStats.totalOutstanding,
        overdueCount: invoiceStats.overdueCount,
        activeClients: clientCount,
        activeProjects: projectStats.byStatus.find((s) => s.status === 'IN_PROGRESS')?.count ?? 0,
      },
      invoices: invoiceStats,
      projects: projectStats,
      cashAccounts: cash.accounts,
      recentInvoices,
      recentPayments,
      upcomingDeadlines,
      recentActivity,
    };
  },

  /** Aging + upcoming due list for the receivables widget. */
  async receivables(userId: string) {
    const invoices = await prisma.invoice.findMany({
      where: {
        userId,
        deletedAt: null,
        documentType: DocumentType.INVOICE,
        status: { in: ['SENT', 'VIEWED', 'PARTIALLY_PAID', 'OVERDUE'] },
      },
      orderBy: { dueDate: 'asc' },
      select: {
        id: true, number: true, dueDate: true, total: true, amountPaid: true,
        balanceDue: true, currency: true, status: true,
        client: { select: { id: true, name: true, companyName: true, email: true } },
      },
    });

    const today = dayjs.utc().startOf('day');

    return {
      total: round2(add(...invoices.map((i) => toNumber(i.balanceDue)))).toNumber(),
      count: invoices.length,
      invoices: invoices.map((invoice) => ({
        ...invoice,
        daysOverdue: Math.max(0, today.diff(dayjs.utc(invoice.dueDate).startOf('day'), 'day')),
      })),
    };
  },
};

export default DashboardService;
