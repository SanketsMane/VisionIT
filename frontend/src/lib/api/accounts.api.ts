import { del, get, getList, patch, post } from './client';
import { cleanParams } from '@/lib/utils';
import type { Account, AccountType, JournalEntry, JournalSource, TrialBalance } from '@/types';

export interface AccountLedgerRow {
  id: string;
  date: string;
  entryNumber: string;
  narration: string | null;
  reference: string | null;
  source: JournalSource;
  invoiceId: string | null;
  paymentId: string | null;
  expenseId: string | null;
  debit: number;
  credit: number;
  runningBalance: number;
}

export const accountsApi = {
  list: (params: { type?: AccountType; search?: string; isActive?: boolean; includeBalances?: boolean } = {}) =>
    getList<Account>('/accounts', { params: cleanParams(params) }),

  byId: (id: string) => get<Account>(`/accounts/${id}`),

  cashPosition: () =>
    get<{ accounts: (Account & { balance: number })[]; totalCash: number }>('/accounts/cash-position'),

  ledger: (id: string, params: { from?: string; to?: string; page?: number; limit?: number } = {}) =>
    get<{
      account: Pick<Account, 'id' | 'code' | 'name' | 'type' | 'currency'>;
      openingBalance: number;
      closingBalance: number;
      lines: AccountLedgerRow[];
    }>(`/accounts/${id}/ledger`, { params: cleanParams(params) }),

  create: (payload: Partial<Account>) => post<Account>('/accounts', payload),
  update: (id: string, payload: Partial<Account>) => patch<Account>(`/accounts/${id}`, payload),
  remove: (id: string) => del<null>(`/accounts/${id}`),

  transfer: (payload: {
    fromAccountId: string; toAccountId: string; amount: number;
    date?: string; narration?: string; reference?: string;
  }) => post<JournalEntry>('/accounts/transfer', payload),
};

export const ledgerApi = {
  list: (params: {
    page?: number; limit?: number; from?: string; to?: string;
    source?: JournalSource; accountId?: string; search?: string;
  } = {}) => getList<JournalEntry>('/ledger', { params: cleanParams(params) }),

  byId: (id: string) => get<JournalEntry>(`/ledger/${id}`),
  trialBalance: (asOf?: string) => get<TrialBalance>('/ledger/trial-balance', { params: cleanParams({ asOf }) }),

  create: (payload: {
    date?: string; narration?: string | null; reference?: string | null;
    lines: { accountId: string; debit: number; credit: number; description?: string | null }[];
  }) => post<JournalEntry>('/ledger', payload),

  void: (id: string) => post<JournalEntry>(`/ledger/${id}/void`),
};
