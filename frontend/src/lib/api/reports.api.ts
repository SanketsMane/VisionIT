import { get } from './client';
import { cleanParams } from '@/lib/utils';
import type {
  BalanceSheet, CashFlowStatement, DashboardOverview, MonthlyStatement,
  ProfitAndLoss, TrendPoint, TrialBalance,
} from '@/types';

export interface TaxSummary {
  period: { from: string; to: string };
  currency: string;
  taxableRevenue: number;
  outputTax: number;
  inputTax: number;
  netTaxPayable: number;
  invoiceCount: number;
  expenseCount: number;
}

export interface MonthlyPack {
  statement: MonthlyStatement;
  profitAndLoss: ProfitAndLoss;
  balanceSheet: BalanceSheet;
  cashFlow: CashFlowStatement;
  tax: TaxSummary;
}

export const reportsApi = {
  profitAndLoss: (params: { from?: string; to?: string } = {}) =>
    get<ProfitAndLoss>('/reports/profit-loss', { params: cleanParams(params) }),

  balanceSheet: (asOf?: string) =>
    get<BalanceSheet>('/reports/balance-sheet', { params: cleanParams({ asOf }) }),

  cashFlow: (params: { from?: string; to?: string } = {}) =>
    get<CashFlowStatement>('/reports/cash-flow', { params: cleanParams(params) }),

  trialBalance: (asOf?: string) =>
    get<TrialBalance>('/reports/trial-balance', { params: cleanParams({ asOf }) }),

  taxSummary: (params: { from?: string; to?: string } = {}) =>
    get<TaxSummary>('/reports/tax-summary', { params: cleanParams(params) }),

  monthly: (year: number, month: number) =>
    get<MonthlyStatement>('/reports/monthly', { params: { year, month } }),

  monthlyPack: (year: number, month: number) =>
    get<MonthlyPack>('/reports/monthly-pack', { params: { year, month } }),

  trend: (months = 12) => get<TrendPoint[]>('/reports/trend', { params: { months } }),
};

export const dashboardApi = {
  overview: () => get<DashboardOverview>('/dashboard'),
  receivables: () =>
    get<{ total: number; count: number; invoices: unknown[] }>('/dashboard/receivables'),
  trend: (months = 12) => get<TrendPoint[]>('/dashboard/trend', { params: { months } }),
};
