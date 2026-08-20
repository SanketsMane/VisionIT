/**
 * Central key factory. Every query and every invalidation references these, so
 * a mutation can never miss a cache entry because two files spelled the key
 * differently.
 */
export const queryKeys = {
  dashboard: {
    overview: ['dashboard', 'overview'] as const,
    receivables: ['dashboard', 'receivables'] as const,
    trend: (months: number) => ['dashboard', 'trend', months] as const,
  },
  clients: {
    all: ['clients'] as const,
    list: (params: unknown) => ['clients', 'list', params] as const,
    detail: (id: string) => ['clients', 'detail', id] as const,
    stats: ['clients', 'stats'] as const,
  },
  projects: {
    all: ['projects'] as const,
    list: (params: unknown) => ['projects', 'list', params] as const,
    detail: (id: string) => ['projects', 'detail', id] as const,
    stats: ['projects', 'stats'] as const,
    technologies: ['projects', 'technologies'] as const,
  },
  invoices: {
    all: ['invoices'] as const,
    list: (params: unknown) => ['invoices', 'list', params] as const,
    detail: (id: string) => ['invoices', 'detail', id] as const,
    stats: ['invoices', 'stats'] as const,
    templates: ['invoices', 'templates'] as const,
    sequences: ['invoices', 'sequences'] as const,
    public: (token: string) => ['invoices', 'public', token] as const,
  },
  expenses: {
    all: ['expenses'] as const,
    list: (params: unknown) => ['expenses', 'list', params] as const,
    detail: (id: string) => ['expenses', 'detail', id] as const,
    stats: (params: unknown) => ['expenses', 'stats', params] as const,
    categories: ['expenses', 'categories'] as const,
  },
  accounts: {
    all: ['accounts'] as const,
    list: (params: unknown) => ['accounts', 'list', params] as const,
    detail: (id: string) => ['accounts', 'detail', id] as const,
    ledger: (id: string, params: unknown) => ['accounts', 'ledger', id, params] as const,
    cashPosition: ['accounts', 'cash-position'] as const,
  },
  ledger: {
    all: ['ledger'] as const,
    list: (params: unknown) => ['ledger', 'list', params] as const,
    detail: (id: string) => ['ledger', 'detail', id] as const,
    trialBalance: (asOf?: string) => ['ledger', 'trial-balance', asOf ?? 'now'] as const,
  },
  reports: {
    profitLoss: (params: unknown) => ['reports', 'profit-loss', params] as const,
    balanceSheet: (asOf?: string) => ['reports', 'balance-sheet', asOf ?? 'now'] as const,
    cashFlow: (params: unknown) => ['reports', 'cash-flow', params] as const,
    monthly: (year: number, month: number) => ['reports', 'monthly', year, month] as const,
    monthlyPack: (year: number, month: number) => ['reports', 'monthly-pack', year, month] as const,
    tax: (params: unknown) => ['reports', 'tax', params] as const,
    trend: (months: number) => ['reports', 'trend', months] as const,
  },
  email: {
    all: ['email'] as const,
    list: (params: unknown) => ['email', 'list', params] as const,
    detail: (id: string) => ['email', 'detail', id] as const,
    stats: ['email', 'stats'] as const,
    accounts: ['email', 'accounts'] as const,
    templates: ['email', 'templates'] as const,
  },
  ai: {
    options: ['ai', 'options'] as const,
    usage: (params: unknown) => ['ai', 'usage', params] as const,
    history: (params: unknown) => ['ai', 'history', params] as const,
  },
  settings: {
    company: ['settings', 'company'] as const,
    reference: ['settings', 'reference'] as const,
    activity: (params: unknown) => ['settings', 'activity', params] as const,
  },
  notifications: ['notifications'] as const,

  chat: {
    conversations: ['chat', 'conversations'] as const,
    conversation: (id: string) => ['chat', 'conversation', id] as const,
    messages: (id: string) => ['chat', 'messages', id] as const,
    people: (projectId: string) => ['chat', 'people', projectId] as const,
    unread: ['chat', 'unread'] as const,
  },

  portal: {
    workspace: (projectId: string) => ['portal', 'workspace', projectId] as const,
    invoices: (projectId: string) => ['portal', 'invoices', projectId] as const,
    activity: (projectId: string, params: unknown) => ['portal', 'activity', projectId, params] as const,
    myProjects: ['portal', 'my-projects'] as const,
    clients: ['portal', 'clients'] as const,
    deliveryBoard: ['portal', 'delivery-board'] as const,
    support: (projectId: string) => ['portal', 'support', projectId] as const,
    supportList: ['portal', 'support-list'] as const,

    members: (projectId: string) => ['portal', 'members', projectId] as const,
    roles: (projectId: string) => ['portal', 'roles', projectId] as const,
    invitations: (projectId: string) => ['portal', 'invitations', projectId] as const,

    paymentRequests: (projectId: string, params: unknown) =>
      ['portal', 'payment-requests', projectId, params] as const,
    paymentQueue: (params: unknown) => ['portal', 'payment-queue', params] as const,

    bugs: (projectId: string, params: unknown) => ['portal', 'bugs', projectId, params] as const,
    bug: (projectId: string, bugId: string) => ['portal', 'bug', projectId, bugId] as const,
    bugStats: (projectId: string) => ['portal', 'bug-stats', projectId] as const,
    bugOptions: (projectId: string) => ['portal', 'bug-options', projectId] as const,
    bugModules: (projectId: string) => ['portal', 'bug-modules', projectId] as const,

    documents: (projectId: string, params: unknown) =>
      ['portal', 'documents', projectId, params] as const,
    documentStats: (projectId: string) => ['portal', 'document-stats', projectId] as const,

    delivery: (projectId: string) => ['portal', 'delivery', projectId] as const,
    announcements: (projectId: string) => ['portal', 'announcements', projectId] as const,

    emailLog: (params: unknown) => ['portal', 'email-log', params] as const,
    invitePreview: (token: string) => ['portal', 'invite', token] as const,
  },
  payments: {
    list: (params: unknown) => ['payments', 'list', params] as const,
    stats: (params: unknown) => ['payments', 'stats', params] as const,
  },
} as const;
