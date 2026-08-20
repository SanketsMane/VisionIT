import { del, get, getList, patch, post } from './client';
import { cleanParams } from '@/lib/utils';
import type { Expense, ExpenseCategory, PaymentMethod } from '@/types';

export interface ExpenseListParams {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  projectId?: string;
  billable?: boolean;
  from?: string;
  to?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ExpenseInput {
  vendor: string;
  description?: string | null;
  date?: string;
  amount: number;
  taxAmount?: number;
  currency?: string;
  method?: PaymentMethod;
  categoryId?: string | null;
  projectId?: string | null;
  paidFromAccountId: string;
  /** Which expense account in the chart of accounts the cost is booked to. */
  expenseAccountId: string;
  reference?: string | null;
  receiptUrl?: string | null;
  billable?: boolean;
  notes?: string | null;
}

export const expensesApi = {
  list: (params: ExpenseListParams = {}) =>
    getList<Expense>('/expenses', { params: cleanParams(params) }),

  stats: (params: { from?: string; to?: string } = {}) =>
    get<{
      byCategory: { categoryId: string | null; name: string; color: string | null; total: number; count: number }[];
      totalSpend: number;
    }>('/expenses/stats', { params: cleanParams(params) }),

  byId: (id: string) => get<Expense>(`/expenses/${id}`),
  create: (payload: ExpenseInput) => post<Expense>('/expenses', payload),
  update: (id: string, payload: Partial<ExpenseInput>) => patch<Expense>(`/expenses/${id}`, payload),
  remove: (id: string) => del<null>(`/expenses/${id}`),

  categories: () => get<ExpenseCategory[]>('/expenses/categories'),
  createCategory: (payload: { name: string; color?: string | null }) =>
    post<ExpenseCategory>('/expenses/categories', payload),
  updateCategory: (id: string, payload: Partial<ExpenseCategory>) =>
    patch<ExpenseCategory>(`/expenses/categories/${id}`, payload),
  removeCategory: (id: string) => del<null>(`/expenses/categories/${id}`),
};

export const paymentsApi = {
  list: (params: {
    page?: number; limit?: number; search?: string;
    method?: PaymentMethod; accountId?: string; clientId?: string;
    from?: string; to?: string;
  } = {}) => getList('/payments', { params: cleanParams(params) }),

  stats: (params: { from?: string; to?: string } = {}) =>
    get<{ byMethod: { method: PaymentMethod; total: number; count: number }[] }>(
      '/payments/stats',
      { params: cleanParams(params) },
    ),
};
