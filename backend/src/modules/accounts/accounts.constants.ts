import { AccountSubtype, AccountType } from '@prisma/client';

export interface SeedAccount {
  code: string;
  name: string;
  type: AccountType;
  subtype: AccountSubtype;
  isSystem: boolean;
  description?: string;
}

/**
 * Default chart of accounts provisioned on signup.
 *
 * Codes follow the conventional 1000/2000/3000/4000/5000 blocks
 * (asset / liability / equity / income / expense). The `isSystem` accounts are
 * referenced by name from the automatic posting rules in `ledger.service.ts`
 * and cannot be deleted — everything else is the user's to reshape.
 */
export const DEFAULT_CHART_OF_ACCOUNTS: SeedAccount[] = [
  // ---- Assets (1000) ------------------------------------------------------
  { code: '1000', name: 'Cash in Hand', type: AccountType.ASSET, subtype: AccountSubtype.CASH, isSystem: true, description: 'Physical cash received from clients' },
  { code: '1010', name: 'Primary Bank Account', type: AccountType.ASSET, subtype: AccountSubtype.BANK, isSystem: true, description: 'Main current account for business receipts' },
  { code: '1020', name: 'Savings Account', type: AccountType.ASSET, subtype: AccountSubtype.BANK, isSystem: false },
  { code: '1030', name: 'Payment Gateway Wallet', type: AccountType.ASSET, subtype: AccountSubtype.BANK, isSystem: false, description: 'Stripe / Razorpay / PayPal balances awaiting settlement' },
  { code: '1100', name: 'Accounts Receivable', type: AccountType.ASSET, subtype: AccountSubtype.ACCOUNTS_RECEIVABLE, isSystem: true, description: 'Invoiced amounts not yet collected' },
  { code: '1200', name: 'Prepaid Expenses', type: AccountType.ASSET, subtype: AccountSubtype.OTHER_CURRENT_ASSET, isSystem: false },
  { code: '1300', name: 'Input Tax Credit (GST)', type: AccountType.ASSET, subtype: AccountSubtype.OTHER_CURRENT_ASSET, isSystem: false, description: 'Recoverable tax paid on business purchases' },
  { code: '1500', name: 'Computer & Equipment', type: AccountType.ASSET, subtype: AccountSubtype.FIXED_ASSET, isSystem: false },

  // ---- Liabilities (2000) -------------------------------------------------
  { code: '2000', name: 'Accounts Payable', type: AccountType.LIABILITY, subtype: AccountSubtype.ACCOUNTS_PAYABLE, isSystem: true, description: 'Unpaid vendor and contractor bills' },
  { code: '2100', name: 'Tax Payable', type: AccountType.LIABILITY, subtype: AccountSubtype.TAX_PAYABLE, isSystem: true, description: 'Output tax collected on invoices, owed to the government' },
  { code: '2200', name: 'Credit Card', type: AccountType.LIABILITY, subtype: AccountSubtype.CREDIT_CARD, isSystem: false },
  { code: '2300', name: 'Client Advances', type: AccountType.LIABILITY, subtype: AccountSubtype.OTHER_CURRENT_LIABILITY, isSystem: false, description: 'Retainers received before work is delivered' },

  // ---- Equity (3000) ------------------------------------------------------
  { code: '3000', name: "Owner's Capital", type: AccountType.EQUITY, subtype: AccountSubtype.OWNER_EQUITY, isSystem: true },
  { code: '3100', name: "Owner's Drawings", type: AccountType.EQUITY, subtype: AccountSubtype.OWNER_EQUITY, isSystem: false, description: 'Money withdrawn from the business for personal use' },
  { code: '3200', name: 'Retained Earnings', type: AccountType.EQUITY, subtype: AccountSubtype.RETAINED_EARNINGS, isSystem: true },
  { code: '3900', name: 'Opening Balance Equity', type: AccountType.EQUITY, subtype: AccountSubtype.OWNER_EQUITY, isSystem: true, description: 'Balancing account for opening balances' },

  // ---- Income (4000) ------------------------------------------------------
  { code: '4000', name: 'Web Development Income', type: AccountType.INCOME, subtype: AccountSubtype.SERVICE_INCOME, isSystem: true },
  { code: '4010', name: 'Mobile App Development Income', type: AccountType.INCOME, subtype: AccountSubtype.SERVICE_INCOME, isSystem: false },
  { code: '4020', name: 'AI & ML Services Income', type: AccountType.INCOME, subtype: AccountSubtype.SERVICE_INCOME, isSystem: false },
  { code: '4030', name: 'Maintenance & Support Income', type: AccountType.INCOME, subtype: AccountSubtype.SERVICE_INCOME, isSystem: false },
  { code: '4040', name: 'Consulting Income', type: AccountType.INCOME, subtype: AccountSubtype.SERVICE_INCOME, isSystem: false },
  { code: '4900', name: 'Other Income', type: AccountType.INCOME, subtype: AccountSubtype.OTHER_INCOME, isSystem: false },
  { code: '4950', name: 'Discounts Given', type: AccountType.INCOME, subtype: AccountSubtype.OTHER_INCOME, isSystem: true, description: 'Contra-income account for invoice discounts' },

  // ---- Expenses (5000) ----------------------------------------------------
  { code: '5000', name: 'Subcontractor & Freelancer Costs', type: AccountType.EXPENSE, subtype: AccountSubtype.COST_OF_SERVICES, isSystem: false },
  { code: '5010', name: 'Software & SaaS Subscriptions', type: AccountType.EXPENSE, subtype: AccountSubtype.COST_OF_SERVICES, isSystem: false },
  { code: '5020', name: 'Cloud Hosting & Infrastructure', type: AccountType.EXPENSE, subtype: AccountSubtype.COST_OF_SERVICES, isSystem: false },
  { code: '5030', name: 'API & AI Usage Costs', type: AccountType.EXPENSE, subtype: AccountSubtype.COST_OF_SERVICES, isSystem: false, description: 'OpenAI, third-party API and model inference spend' },
  { code: '5040', name: 'Domain & SSL', type: AccountType.EXPENSE, subtype: AccountSubtype.COST_OF_SERVICES, isSystem: false },
  { code: '5100', name: 'Salaries & Wages', type: AccountType.EXPENSE, subtype: AccountSubtype.PAYROLL_EXPENSE, isSystem: false },
  { code: '5200', name: 'Rent & Utilities', type: AccountType.EXPENSE, subtype: AccountSubtype.OPERATING_EXPENSE, isSystem: false },
  { code: '5210', name: 'Internet & Telephone', type: AccountType.EXPENSE, subtype: AccountSubtype.OPERATING_EXPENSE, isSystem: false },
  { code: '5220', name: 'Marketing & Advertising', type: AccountType.EXPENSE, subtype: AccountSubtype.OPERATING_EXPENSE, isSystem: false },
  { code: '5230', name: 'Travel & Client Meetings', type: AccountType.EXPENSE, subtype: AccountSubtype.OPERATING_EXPENSE, isSystem: false },
  { code: '5240', name: 'Professional & Legal Fees', type: AccountType.EXPENSE, subtype: AccountSubtype.OPERATING_EXPENSE, isSystem: false },
  { code: '5250', name: 'Equipment & Hardware', type: AccountType.EXPENSE, subtype: AccountSubtype.OPERATING_EXPENSE, isSystem: false },
  { code: '5260', name: 'Bank & Payment Gateway Charges', type: AccountType.EXPENSE, subtype: AccountSubtype.OPERATING_EXPENSE, isSystem: true },
  { code: '5300', name: 'Taxes & Government Fees', type: AccountType.EXPENSE, subtype: AccountSubtype.TAX_EXPENSE, isSystem: false },
  { code: '5900', name: 'Miscellaneous Expenses', type: AccountType.EXPENSE, subtype: AccountSubtype.OTHER_EXPENSE, isSystem: false },
];

/**
 * Stable handles for the accounts the automatic posting engine needs.
 * Looked up by code so renaming an account in the UI never breaks posting.
 */
export const SYSTEM_ACCOUNT_CODES = {
  CASH: '1000',
  BANK: '1010',
  ACCOUNTS_RECEIVABLE: '1100',
  ACCOUNTS_PAYABLE: '2000',
  TAX_PAYABLE: '2100',
  OWNER_CAPITAL: '3000',
  RETAINED_EARNINGS: '3200',
  OPENING_BALANCE_EQUITY: '3900',
  DEFAULT_INCOME: '4000',
  DISCOUNTS_GIVEN: '4950',
  BANK_CHARGES: '5260',
  MISC_EXPENSE: '5900',
} as const;

export type SystemAccountKey = keyof typeof SYSTEM_ACCOUNT_CODES;

/** Income and expense accounts close into retained earnings each period. */
export const NOMINAL_TYPES: AccountType[] = [AccountType.INCOME, AccountType.EXPENSE];

/** Balance-sheet accounts carry their balance forward indefinitely. */
export const REAL_TYPES: AccountType[] = [
  AccountType.ASSET,
  AccountType.LIABILITY,
  AccountType.EQUITY,
];

/**
 * Normal balance side per account type. Assets and expenses increase on debit;
 * liabilities, equity and income increase on credit. Used to turn raw
 * debit/credit sums into a signed, human-meaningful balance.
 */
export const NORMAL_BALANCE: Record<AccountType, 'debit' | 'credit'> = {
  [AccountType.ASSET]: 'debit',
  [AccountType.EXPENSE]: 'debit',
  [AccountType.LIABILITY]: 'credit',
  [AccountType.EQUITY]: 'credit',
  [AccountType.INCOME]: 'credit',
};

export const DEFAULT_EXPENSE_CATEGORIES = [
  { name: 'Software & Subscriptions', slug: 'software-subscriptions', color: '#6366F1' },
  { name: 'Cloud & Hosting', slug: 'cloud-hosting', color: '#0EA5E9' },
  { name: 'AI & API Usage', slug: 'ai-api-usage', color: '#8B5CF6' },
  { name: 'Subcontractors', slug: 'subcontractors', color: '#F59E0B' },
  { name: 'Marketing', slug: 'marketing', color: '#EC4899' },
  { name: 'Office & Utilities', slug: 'office-utilities', color: '#10B981' },
  { name: 'Travel', slug: 'travel', color: '#F97316' },
  { name: 'Equipment', slug: 'equipment', color: '#64748B' },
  { name: 'Professional Fees', slug: 'professional-fees', color: '#14B8A6' },
  { name: 'Bank Charges', slug: 'bank-charges', color: '#EF4444' },
  { name: 'Miscellaneous', slug: 'miscellaneous', color: '#94A3B8' },
];
