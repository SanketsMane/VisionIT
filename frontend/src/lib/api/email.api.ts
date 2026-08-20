import { del, get, getList, patch, post } from './client';
import { cleanParams } from '@/lib/utils';
import type {
  AiTone, AiUsage, EmailAccount, EmailMessage, EmailPurpose,
  EmailStatus, EmailTemplate, GeneratedEmail,
} from '@/types';

export interface ComposeInput {
  toAddresses: string[];
  ccAddresses?: string[];
  bccAddresses?: string[];
  subject: string;
  bodyHtml: string;
  bodyText?: string | null;
  purpose?: EmailPurpose;
  clientId?: string | null;
  invoiceId?: string | null;
  emailAccountId?: string | null;
  aiGenerated?: boolean;
  attachInvoicePdf?: boolean;
  scheduledAt?: string | null;
}

export const emailApi = {
  list: (params: {
    page?: number; limit?: number; status?: EmailStatus;
    purpose?: EmailPurpose; clientId?: string; search?: string;
  } = {}) => getList<EmailMessage>('/email', { params: cleanParams(params) }),

  stats: () =>
    get<{ total: number; draft: number; queued: number; sent: number; failed: number }>('/email/stats'),

  mergeFields: () => get<string[]>('/email/merge-fields'),
  byId: (id: string) => get<EmailMessage>(`/email/${id}`),

  saveDraft: (payload: ComposeInput) => post<EmailMessage>('/email/drafts', payload),
  updateDraft: (id: string, payload: Partial<ComposeInput>) => patch<EmailMessage>(`/email/${id}`, payload),
  send: (id: string) => post<EmailMessage>(`/email/${id}/send`),
  composeAndSend: (payload: ComposeInput) => post<EmailMessage>('/email/send', payload),
  remove: (id: string) => del<null>(`/email/${id}`),

  accounts: () => get<EmailAccount[]>('/email/accounts'),
  createAccount: (payload: Partial<EmailAccount> & { smtpPassword?: string; apiKey?: string }) =>
    post<EmailAccount>('/email/accounts', payload),
  updateAccount: (id: string, payload: Partial<EmailAccount> & { smtpPassword?: string; apiKey?: string }) =>
    patch<EmailAccount>(`/email/accounts/${id}`, payload),
  removeAccount: (id: string) => del<null>(`/email/accounts/${id}`),
  verifyAccount: (id: string) => post<{ verified: boolean }>(`/email/accounts/${id}/verify`),

  templates: () => get<EmailTemplate[]>('/email/templates'),
  createTemplate: (payload: Partial<EmailTemplate>) => post<EmailTemplate>('/email/templates', payload),
  updateTemplate: (id: string, payload: Partial<EmailTemplate>) =>
    patch<EmailTemplate>(`/email/templates/${id}`, payload),
  removeTemplate: (id: string) => del<null>(`/email/templates/${id}`),

  renderTemplate: (id: string, context: { clientId?: string; invoiceId?: string; projectId?: string }) =>
    post<{
      subject: string; bodyHtml: string; bodyText: string;
      purpose: EmailPurpose; resolvedFields: Record<string, string>;
    }>(`/email/templates/${id}/render`, context),
};

export interface GenerateEmailInput {
  purpose: EmailPurpose;
  tone: AiTone;
  instructions?: string;
  language?: string;
  lengthHint?: 'short' | 'medium' | 'detailed';
  clientId?: string;
  invoiceId?: string;
  projectId?: string;
}

export interface AiOption {
  value: string;
  description: string;
}

export const aiApi = {
  options: () => get<{ tones: AiOption[]; purposes: AiOption[]; lengths: AiOption[] }>('/ai/options'),

  generateEmail: (payload: GenerateEmailInput) =>
    post<{ email: GeneratedEmail; usage: AiUsage; generationId: string }>('/ai/email/generate', payload),

  improveEmail: (payload: { subject: string; bodyHtml: string; instruction: string; tone?: AiTone }) =>
    post<{ email: GeneratedEmail; usage: AiUsage; generationId: string }>('/ai/email/improve', payload),

  suggestSubjects: (payload: { bodyHtml: string; purpose?: EmailPurpose }) =>
    post<{ subjects: string[]; usage: AiUsage }>('/ai/email/subjects', payload),

  usage: (params: { from?: string; to?: string } = {}) =>
    get<{
      totalRequests: number; totalTokens: number; totalCostUsd: number;
      averageLatencyMs: number; isConfigured: boolean; model: string;
      byFeature: { feature: string; requests: number; tokens: number; costUsd: number }[];
    }>('/ai/usage', { params: cleanParams(params) }),

  history: (params: { page?: number; limit?: number } = {}) =>
    getList('/ai/history', { params: cleanParams(params) }),
};
