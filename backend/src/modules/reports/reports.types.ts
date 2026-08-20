export interface StatementLine {
  accountId: string;
  code: string;
  name: string;
  subtype: string;
  amount: number;
}

export interface StatementSection {
  title: string;
  lines: StatementLine[];
  total: number;
}

export interface ProfitAndLoss {
  period: { from: string; to: string; label: string };
  currency: string;
  income: StatementSection;
  costOfServices: StatementSection;
  grossProfit: number;
  grossMargin: number;
  operatingExpenses: StatementSection;
  operatingProfit: number;
  otherIncome: StatementSection;
  taxExpense: StatementSection;
  netProfit: number;
  netMargin: number;
}

export interface BalanceSheet {
  asOf: string;
  currency: string;
  assets: { current: StatementSection; fixed: StatementSection; total: number };
  liabilities: { current: StatementSection; longTerm: StatementSection; total: number };
  equity: StatementSection & {
    /** Prior-year retained earnings plus any unclosed prior-period profit. */
    retainedEarnings: number;
    currentPeriodProfit: number;
    priorPeriodProfit: number;
    /** All profit ever earned and not yet distributed — the equity roll-up. */
    accumulatedProfit: number;
  };
  totalLiabilitiesAndEquity: number;
  isBalanced: boolean;
}

export interface CashFlowStatement {
  period: { from: string; to: string; label: string };
  currency: string;
  opening: number;
  operating: { inflows: number; outflows: number; net: number };
  investing: { net: number };
  financing: { net: number };
  netChange: number;
  closing: number;
}

export interface MonthlyStatement {
  year: number;
  month: number;
  label: string;
  currency: string;
  revenue: { invoiced: number; collected: number; invoiceCount: number };
  expenses: { total: number; tax: number; count: number };
  profit: { gross: number; net: number; margin: number };
  receivables: { opening: number; closing: number; overdue: number };
  cash: { opening: number; closing: number; net: number };
  tax: { collected: number; paid: number; net: number };
  topClients: { id: string; name: string; amount: number }[];
  topExpenseCategories: { name: string; amount: number; color: string | null }[];
  comparison: { previousMonthNetProfit: number; changePercent: number | null };
}
