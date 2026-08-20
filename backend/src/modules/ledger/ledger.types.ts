import type { Prisma } from '@prisma/client';

type Decimal = Prisma.Decimal;
import type { JournalSource } from '@prisma/client';

export interface JournalLineInput {
  accountId: string;
  debit?: number | string | Decimal;
  credit?: number | string | Decimal;
  description?: string | null;
}

export interface CreateEntryInput {
  date: Date;
  narration?: string | null;
  reference?: string | null;
  source?: JournalSource;
  lines: JournalLineInput[];
  invoiceId?: string | null;
  paymentId?: string | null;
  expenseId?: string | null;
}

export interface AccountBalance {
  accountId: string;
  code: string;
  name: string;
  type: string;
  subtype: string;
  debitTotal: number;
  creditTotal: number;
  /** Signed against the account's normal balance side. */
  balance: number;
}

export interface TrialBalanceRow extends AccountBalance {
  debitBalance: number;
  creditBalance: number;
}

export interface TrialBalance {
  asOf: string;
  rows: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
}
