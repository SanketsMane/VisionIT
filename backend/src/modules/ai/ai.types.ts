import type { AiTone, EmailPurpose } from '@prisma/client';

export interface EmailDraftContext {
  clientName?: string;
  clientCompany?: string;
  senderName: string;
  companyName?: string;
  projectTitle?: string;
  projectSummary?: string;
  invoiceNumber?: string;
  invoiceTotal?: string;
  balanceDue?: string;
  dueDate?: string;
  daysOverdue?: number;
  previousMessage?: string;
}

export interface GenerateEmailInput {
  purpose: EmailPurpose;
  tone: AiTone;
  instructions?: string;
  language?: string;
  lengthHint?: 'short' | 'medium' | 'detailed';
  clientId?: string;
  invoiceId?: string;
  projectId?: string;
  includeSignature?: boolean;
}

export interface GeneratedEmail {
  subject: string;
  bodyHtml: string;
  bodyText: string;
  /** Short alternatives the user can pick from without regenerating. */
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

export interface GenerateEmailResult {
  email: GeneratedEmail;
  usage: AiUsage;
  generationId: string;
}
