// ── Enums (mirrors of the Prisma schema) ─────────────────────────────────────

export type UserRole = 'OWNER' | 'ADMIN' | 'ACCOUNTANT' | 'MEMBER';

export type ProjectCategory =
  | 'WEB_DEVELOPMENT' | 'ANDROID_APP' | 'IOS_APP' | 'CROSS_PLATFORM_APP'
  | 'AI_ML' | 'DATA_ENGINEERING' | 'DEVOPS_CLOUD' | 'UI_UX_DESIGN'
  | 'BLOCKCHAIN' | 'DESKTOP_APP' | 'OTHER';

export type ProjectStatus =
  | 'LEAD' | 'PLANNING' | 'IN_PROGRESS' | 'ON_HOLD'
  | 'COMPLETED' | 'MAINTENANCE' | 'CANCELLED';

export type ProjectVisibility = 'PUBLIC' | 'PRIVATE' | 'UNLISTED';
export type EngagementModel = 'FIXED_PRICE' | 'HOURLY' | 'RETAINER' | 'MILESTONE';
export type ClientStatus = 'ACTIVE' | 'INACTIVE' | 'PROSPECT' | 'ARCHIVED';
export type DocumentType = 'INVOICE' | 'QUOTATION' | 'PROFORMA' | 'CREDIT_NOTE';

export type InvoiceStatus =
  | 'DRAFT' | 'SENT' | 'VIEWED' | 'PARTIALLY_PAID'
  | 'PAID' | 'OVERDUE' | 'CANCELLED' | 'WRITTEN_OFF';

export type DiscountType = 'NONE' | 'PERCENTAGE' | 'FIXED';

export type PaymentMethod =
  | 'BANK_TRANSFER' | 'UPI' | 'CASH' | 'CHEQUE' | 'CREDIT_CARD' | 'DEBIT_CARD'
  | 'PAYPAL' | 'STRIPE' | 'RAZORPAY' | 'WIRE' | 'CRYPTO' | 'OTHER';

export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
export type JournalSource =
  | 'MANUAL' | 'INVOICE' | 'PAYMENT' | 'EXPENSE'
  | 'OPENING_BALANCE' | 'ADJUSTMENT' | 'TRANSFER';

export type EmailStatus = 'DRAFT' | 'QUEUED' | 'SENDING' | 'SENT' | 'FAILED' | 'BOUNCED';
export type EmailProvider = 'SMTP' | 'GMAIL' | 'RESEND' | 'SENDGRID' | 'POSTMARK';

export type EmailPurpose =
  | 'PROJECT_PROPOSAL' | 'INVOICE_DELIVERY' | 'PAYMENT_REMINDER' | 'PROJECT_UPDATE'
  | 'FOLLOW_UP' | 'ONBOARDING' | 'THANK_YOU' | 'APOLOGY_DELAY'
  | 'QUOTATION' | 'COLD_OUTREACH' | 'CUSTOM';

export type AiTone =
  | 'PROFESSIONAL' | 'FRIENDLY' | 'FORMAL' | 'CONCISE'
  | 'PERSUASIVE' | 'APOLOGETIC' | 'ENTHUSIASTIC' | 'ASSERTIVE';

export type TemplateKey = 'modern' | 'classic' | 'minimal' | 'corporate' | 'creative';

// ── Domain models ────────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  /** INTERNAL users see the studio app; CLIENT users see the portal. */
  userType: 'INTERNAL' | 'CLIENT' | 'LEAD';
  ownerId: string | null;
  avatarUrl: string | null;
  phone: string | null;
  designation: string | null;
  timezone: string;
  locale: string;
  emailVerified: boolean;
  createdAt: string;
  company?: CompanyProfile | null;
}

export interface CompanyProfile {
  id: string;
  legalName: string;
  tradeName: string | null;
  logoUrl: string | null;
  signatureUrl: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string;
  taxLabel: string | null;
  taxNumber: string | null;
  panNumber: string | null;
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankIfsc: string | null;
  bankSwift: string | null;
  upiId: string | null;
  baseCurrency: string;
  fiscalYearStartMonth: number;
  defaultTaxRate: number;
  defaultPaymentTerms: number;
  invoiceFooterNote: string | null;
  defaultTerms: string | null;
}

export interface ClientContact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  isPrimary: boolean;
}

export interface Client {
  id: string;
  name: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  status: ClientStatus;
  currency: string;
  taxNumber: string | null;
  billingAddressLine1: string | null;
  billingAddressLine2: string | null;
  billingCity: string | null;
  billingState: string | null;
  billingPostalCode: string | null;
  billingCountry: string | null;
  paymentTermsDays: number;
  notes: string | null;
  avatarUrl: string | null;
  tags: string[];
  createdAt: string;
  contacts?: ClientContact[];
  projects?: Pick<Project, 'id' | 'title' | 'slug' | 'status' | 'category'>[];
  _count?: { projects: number; invoices: number };
  summary?: {
    totalRevenue: number;
    paymentsCount: number;
    outstandingAmount: number;
    openInvoicesCount: number;
  };
}

export interface Technology {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  iconUrl: string | null;
  _count?: { projects: number };
}

export interface ProjectMilestone {
  id: string;
  title: string;
  description: string | null;
  amount: number | null;
  dueDate: string | null;
  completedAt: string | null;
  status: ProjectStatus;
  sortOrder: number;
  invoiced: boolean;
}

export interface Project {
  id: string;
  title: string;
  slug: string;
  /** Human-facing reference used on handover records, e.g. ECH-2026-001. */
  code: string | null;
  logoUrl: string | null;
  summary: string | null;
  description: string | null;
  category: ProjectCategory;
  status: ProjectStatus;
  visibility: ProjectVisibility;
  engagement: EngagementModel;
  startDate: string | null;
  endDate: string | null;
  deliveryDate: string | null;
  contractValue: number | null;
  hourlyRate: number | null;
  estimatedHours: number | null;
  loggedHours: number;
  currency: string;
  coverImageUrl: string | null;
  galleryUrls: string[];
  liveUrl: string | null;
  repoUrl: string | null;
  caseStudyUrl: string | null;
  playStoreUrl: string | null;
  appStoreUrl: string | null;
  featured: boolean;
  sortOrder: number;
  tags: string[];
  challenges: string | null;
  solution: string | null;
  outcome: string | null;
  testimonial: string | null;
  testimonialAuthor: string | null;
  createdAt: string;
  client?: Pick<Client, 'id' | 'name' | 'companyName' | 'avatarUrl'> | null;
  technologies: Technology[];
  milestones?: ProjectMilestone[];
  invoices?: Invoice[];
  _count?: { milestones: number; invoices: number };
  /** Derived on read by the API — never stored. */
  metrics?: {
    totalInvoiced: number;
    totalCollected: number;
    outstanding: number;
    contractValue: number;
    loggedHours: number;
    milestonesTotal: number;
    milestonesCompleted: number;
  };
}

export interface InvoiceItem {
  id?: string;
  title: string;
  description: string | null;
  hsnSac: string | null;
  quantity: number;
  unit: string;
  unitPrice: number;
  discountPercent: number;
  taxRate: number;
  taxAmount: number;
  lineTotal: number;
  sortOrder: number;
}

export interface Payment {
  id: string;
  amount: number;
  currency: string;
  paidAt: string;
  method: PaymentMethod;
  reference: string | null;
  notes: string | null;
  feeAmount: number;
  account?: { id: string; name: string; code: string } | null;
  invoice?: {
    id: string;
    number: string;
    total: number;
    balanceDue: number;
    currency: string;
    status: InvoiceStatus;
    client: { id: string; name: string; companyName: string | null };
  } | null;
}

export interface Invoice {
  id: string;
  number: string;
  documentType: DocumentType;
  status: InvoiceStatus;
  currency: string;
  exchangeRate: number;
  issueDate: string;
  dueDate: string;
  poNumber: string | null;
  subtotal: number;
  discountType: DiscountType;
  discountValue: number;
  discountAmount: number;
  taxAmount: number;
  shippingAmount: number;
  roundOff: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  taxInclusive: boolean;
  isInterState: boolean;
  notes: string | null;
  terms: string | null;
  templateKey: TemplateKey;
  accentColor: string;
  publicToken: string | null;
  sentAt: string | null;
  viewedAt: string | null;
  paidAt: string | null;
  isRecurring: boolean;
  recurrenceRule: string | null;
  createdAt: string;
  clientId: string;
  projectId: string | null;
  client: Client;
  project?: Pick<Project, 'id' | 'title' | 'slug'> | null;
  items: InvoiceItem[];
  payments?: Payment[];
  user?: { id: string; name: string; email: string; company: CompanyProfile | null };
  daysUntilDue?: number;
  daysOverdue?: number;
  isOverdue?: boolean;
  isEditable?: boolean;
  _count?: { items: number; payments: number };
}

export interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  subtype: string;
  parentId: string | null;
  currency: string;
  openingBalance: number;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankIfsc: string | null;
  balance?: number;
  debitTotal?: number;
  creditTotal?: number;
  _count?: { lines: number; children: number };
}

export interface JournalLine {
  id: string;
  accountId: string;
  debit: number;
  credit: number;
  description: string | null;
  sortOrder: number;
  account: { id: string; code: string; name: string; type: AccountType; subtype: string };
}

export interface JournalEntry {
  id: string;
  entryNumber: string;
  date: string;
  narration: string | null;
  reference: string | null;
  source: JournalSource;
  status: 'DRAFT' | 'POSTED' | 'VOID';
  invoiceId: string | null;
  paymentId: string | null;
  expenseId: string | null;
  createdAt: string;
  lines: JournalLine[];
}

export interface ExpenseCategory {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  isActive: boolean;
  _count?: { expenses: number };
}

export interface Expense {
  id: string;
  vendor: string;
  description: string | null;
  date: string;
  amount: number;
  taxAmount: number;
  total: number;
  currency: string;
  method: PaymentMethod;
  reference: string | null;
  receiptUrl: string | null;
  billable: boolean;
  reimbursed: boolean;
  notes: string | null;
  category?: { id: string; name: string; color: string | null } | null;
  project?: { id: string; title: string; slug: string } | null;
  paidFrom?: { id: string; code: string; name: string } | null;
}

export interface EmailMessage {
  id: string;
  toAddresses: string[];
  ccAddresses: string[];
  bccAddresses: string[];
  subject: string;
  bodyHtml: string;
  bodyText: string | null;
  status: EmailStatus;
  purpose: EmailPurpose;
  providerMessageId: string | null;
  errorMessage: string | null;
  attempts: number;
  aiGenerated: boolean;
  scheduledAt: string | null;
  sentAt: string | null;
  createdAt: string;
  client?: Pick<Client, 'id' | 'name' | 'companyName' | 'avatarUrl'> | null;
  invoice?: Pick<Invoice, 'id' | 'number' | 'total' | 'currency' | 'status'> | null;
  emailAccount?: { id: string; label: string; fromName: string; fromEmail: string } | null;
}

export interface EmailAccount {
  id: string;
  label: string;
  provider: EmailProvider;
  fromName: string;
  fromEmail: string;
  replyTo: string | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean;
  smtpUser: string | null;
  signatureHtml: string | null;
  isDefault: boolean;
  isVerified: boolean;
  lastError: string | null;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  bodyHtml: string;
  purpose: EmailPurpose;
  variables: string[];
  isSystem: boolean;
}

export interface GeneratedEmail {
  subject: string;
  bodyHtml: string;
  bodyText: string;
  subjectAlternatives: string[];
  suggestedFollowUpDays: number | null;
}

export interface AiUsage {
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
  latencyMs: number;
}

// ── Reports ──────────────────────────────────────────────────────────────────

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
    retainedEarnings: number;
    currentPeriodProfit: number;
    priorPeriodProfit: number;
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

export interface TrialBalanceRow extends StatementLine {
  type: string;
  debitTotal: number;
  creditTotal: number;
  balance: number;
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

export interface TrendPoint {
  year: number;
  month: number;
  label: string;
  revenue: number;
  expenses: number;
  profit: number;
  collected: number;
}

export interface DashboardOverview {
  currency: string;
  kpis: {
    revenueThisMonth: number;
    revenueChange: number | null;
    expensesThisMonth: number;
    expensesChange: number | null;
    profitThisMonth: number;
    profitChange: number | null;
    collectedThisMonth: number;
    cashOnHand: number;
    outstanding: number;
    overdueCount: number;
    activeClients: number;
    activeProjects: number;
  };
  invoices: {
    byStatus: Record<string, { count: number; total: number; balanceDue: number }>;
    aging: Record<string, number>;
    totalOutstanding: number;
    overdueCount: number;
  };
  projects: {
    total: number;
    totalContractValue: number;
    totalLoggedHours: number;
    byCategory: { category: ProjectCategory; count: number }[];
    byStatus: { status: ProjectStatus; count: number }[];
  };
  cashAccounts: {
    id: string; code: string; name: string; subtype: string;
    bankName: string | null; currency: string; balance: number;
  }[];
  recentInvoices: Invoice[];
  recentPayments: Payment[];
  upcomingDeadlines: {
    id: string; title: string; dueDate: string; amount: number | null;
    project: { id: string; title: string; slug: string };
  }[];
  recentActivity: {
    id: string; action: string; entityType: string; entityId: string | null; createdAt: string;
  }[];
}
