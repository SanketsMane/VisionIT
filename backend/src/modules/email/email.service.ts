import { EmailProvider, EmailStatus, type Prisma } from '@prisma/client';
import Handlebars from 'handlebars';
import { prisma } from '@config/database';
import { env } from '@config/env';
import { logger } from '@config/logger';
import {
  createTransport,
  getFallbackSmtp,
  invalidateTransport,
  verifyTransport,
  type SmtpConfig,
} from '@config/mailer';
import { sendViaResend, verifyResendKey } from '@config/resend';
import { renderEmail, type EmailBlock } from '@modules/notifications/email-layout';
import { ApiError } from '@utils/api-error';
import { decryptOptional, encryptOptional } from '@utils/crypto.util';
import { formatCurrency, toNumber } from '@utils/money.util';
import { daysBetween, formatDate } from '@utils/date.util';
import { resolvePagination } from '@utils/pagination.util';
import { InvoicesModel } from '@modules/invoices/invoices.model';
import { buildInvoicePdf } from '@modules/invoices/invoices.pdf';
import { EmailModel } from './email.model';
import { MAX_SEND_ATTEMPTS } from './email.constants';
import type {
  ComposeEmailDto,
  EmailAccountDto,
  ListEmailsDto,
  TemplateDto,
} from './email.validation';

/** Handlebars in strict-ish mode: unresolved tokens render empty, never "undefined". */
const handlebars = Handlebars.create();
handlebars.registerHelper('helperMissing', () => '');

const stripToText = (html: string): string =>
  html
    .replace(/<\/(p|div|h[1-6]|li|tr|blockquote)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

/**
 * Wraps a composed body in the platform's email shell.
 *
 * Uses the same renderer as every system email, so an AI-written note to a
 * client carries the identical logo, card and footer as an invoice reminder —
 * and inherits the same Outlook and dark-mode handling for free. The body is
 * passed through as `rawHtml` because it has already been sanitised upstream.
 */
const wrapForDelivery = (
  subject: string,
  bodyHtml: string,
  signatureHtml?: string | null,
  brand?: { name?: string | null; logoUrl?: string | null },
): string =>
  renderEmail({
    // The inbox preview should be the opening of the message itself, not a
    // description of it — this is a personal email, not a notification.
    preheader: stripToText(bodyHtml).slice(0, 140),
    // Left blank deliberately: the writer's own opening line is the heading.
    heading: '',
    brandName: brand?.name ?? undefined,
    logoUrl: brand?.logoUrl ?? undefined,
    blocks: [
      { type: 'rawHtml', html: bodyHtml },
      ...(signatureHtml
        ? ([
            { type: 'divider' },
            { type: 'rawHtml', html: signatureHtml },
          ] as EmailBlock[])
        : []),
    ],
    // A real person wrote this and expects a reply.
    automated: false,
    footerNote: `Sent regarding: ${subject}`,
  });

/**
 * A resolved way to send. Exactly one of `smtp` or `resendApiKey` is set —
 * the send path branches on `provider` rather than sniffing which field exists.
 */
interface ResolvedSender {
  provider: 'SMTP' | 'RESEND';
  smtp?: SmtpConfig;
  resendApiKey?: string;
  fromName: string;
  fromEmail: string;
  replyTo: string | null;
  signatureHtml: string | null;
  accountId: string | null;
}

/**
 * Picks the mailbox to send from: the explicitly chosen account, the user's
 * default account, or the process-wide SMTP fallback. Credentials are decrypted
 * only here, at the moment of sending.
 */
const resolveSender = async (userId: string, accountId?: string | null): Promise<ResolvedSender> => {
  const account = accountId
    ? await EmailModel.findAccountWithSecrets(userId, accountId)
    : await EmailModel.findDefaultAccountWithSecrets(userId);

  if (account) {
    const common = {
      fromName: account.fromName,
      fromEmail: account.fromEmail,
      replyTo: account.replyTo,
      signatureHtml: account.signatureHtml,
      accountId: account.id,
    };

    if (account.provider === EmailProvider.RESEND) {
      const apiKey = decryptOptional(account.apiKeyEnc);
      if (!apiKey) throw ApiError.badRequest('This Resend mailbox is missing its API key.');
      return { provider: 'RESEND', resendApiKey: apiKey, ...common };
    }

    if (account.provider !== EmailProvider.SMTP && account.provider !== EmailProvider.GMAIL) {
      throw ApiError.badRequest(
        `Sending via ${account.provider} is not supported yet. Use SMTP or Resend.`,
      );
    }

    if (!account.smtpHost || !account.smtpUser || !account.smtpPasswordEnc) {
      throw ApiError.badRequest('This mailbox is missing its SMTP settings. Update it and try again.');
    }

    return {
      provider: 'SMTP',
      smtp: {
        host: account.smtpHost,
        port: account.smtpPort ?? (account.smtpSecure ? 465 : 587),
        secure: account.smtpSecure,
        user: account.smtpUser,
        password: decryptOptional(account.smtpPasswordEnc) as string,
      },
      ...common,
    };
  }

  // No per-user mailbox — fall back to whatever the process has configured.
  const fallbackSmtp = getFallbackSmtp();
  if (fallbackSmtp) {
    return {
      provider: 'SMTP',
      smtp: fallbackSmtp,
      fromName: env.MAIL_FROM_NAME,
      fromEmail: env.MAIL_FROM_EMAIL ?? fallbackSmtp.user,
      replyTo: null,
      signatureHtml: null,
      accountId: null,
    };
  }

  if (env.RESEND_API_KEY) {
    return {
      provider: 'RESEND',
      resendApiKey: env.RESEND_API_KEY,
      fromName: env.MAIL_FROM_NAME,
      // Resend's shared sender works without a verified domain, but only
      // delivers to the address that owns the Resend account.
      fromEmail: env.MAIL_FROM_EMAIL ?? 'onboarding@resend.dev',
      replyTo: null,
      signatureHtml: null,
      accountId: null,
    };
  }

  throw ApiError.badRequest(
    'No sending mailbox is configured. Add one under Settings → Email before sending.',
  );
};

export const EmailService = {
  async list(userId: string, query: ListEmailsDto) {
    const pagination = resolvePagination(query, { defaultLimit: 20 });
    const where = EmailModel.buildWhere(userId, query);

    const [items, total] = await Promise.all([
      EmailModel.findMany(where, { skip: pagination.skip, take: pagination.take }),
      EmailModel.count(where),
    ]);

    return { items, total, page: pagination.page, limit: pagination.limit };
  },

  async getById(userId: string, id: string) {
    const message = await EmailModel.findById(userId, id);
    if (!message) throw ApiError.notFound('Email');
    return message;
  },

  /** Saves a message without sending it. */
  async createDraft(userId: string, dto: ComposeEmailDto) {
    return EmailModel.create({
      user: { connect: { id: userId } },
      toAddresses: dto.toAddresses,
      ccAddresses: dto.ccAddresses,
      bccAddresses: dto.bccAddresses,
      subject: dto.subject,
      bodyHtml: dto.bodyHtml,
      bodyText: dto.bodyText ?? stripToText(dto.bodyHtml),
      purpose: dto.purpose,
      status: dto.scheduledAt ? EmailStatus.QUEUED : EmailStatus.DRAFT,
      aiGenerated: dto.aiGenerated,
      scheduledAt: dto.scheduledAt ?? null,
      attachments: dto.attachInvoicePdf && dto.invoiceId ? { invoicePdf: dto.invoiceId } : undefined,
      ...(dto.clientId ? { client: { connect: { id: dto.clientId } } } : {}),
      ...(dto.invoiceId ? { invoice: { connect: { id: dto.invoiceId } } } : {}),
      ...(dto.emailAccountId ? { emailAccount: { connect: { id: dto.emailAccountId } } } : {}),
    });
  },

  async updateDraft(userId: string, id: string, dto: Partial<ComposeEmailDto>) {
    const existing = await EmailModel.findById(userId, id);
    if (!existing) throw ApiError.notFound('Email');
    if (existing.status === EmailStatus.SENT) {
      throw ApiError.badRequest('A sent email can no longer be edited');
    }

    const { clientId, invoiceId, emailAccountId, attachInvoicePdf, ...scalars } = dto;

    return EmailModel.update(userId, id, {
      ...scalars,
      ...(dto.bodyHtml ? { bodyText: dto.bodyText ?? stripToText(dto.bodyHtml) } : {}),
      ...(clientId === null ? { client: { disconnect: true } } : clientId ? { client: { connect: { id: clientId } } } : {}),
      ...(invoiceId === null ? { invoice: { disconnect: true } } : invoiceId ? { invoice: { connect: { id: invoiceId } } } : {}),
      ...(emailAccountId === null
        ? { emailAccount: { disconnect: true } }
        : emailAccountId
          ? { emailAccount: { connect: { id: emailAccountId } } }
          : {}),
    });
  },

  async remove(userId: string, id: string) {
    const existing = await EmailModel.findById(userId, id);
    if (!existing) throw ApiError.notFound('Email');
    if (existing.status === EmailStatus.SENT) {
      throw ApiError.badRequest('Sent emails are kept as a record and cannot be deleted');
    }
    await EmailModel.delete(userId, id);
  },

  /**
   * Delivers a stored message.
   *
   * The row is flipped to SENDING first so a crash mid-send leaves an obvious
   * stuck record rather than silently re-sending on the next attempt.
   */
  async send(userId: string, id: string) {
    const message = await EmailModel.findById(userId, id);
    if (!message) throw ApiError.notFound('Email');
    if (message.status === EmailStatus.SENT) {
      throw ApiError.badRequest('This email has already been sent');
    }
    if (message.attempts >= MAX_SEND_ATTEMPTS) {
      throw ApiError.badRequest(
        `This email has already failed ${MAX_SEND_ATTEMPTS} times. Edit it before trying again.`,
      );
    }

    const sender = await resolveSender(userId, message.emailAccountId);

    await EmailModel.update(userId, id, {
      status: EmailStatus.SENDING,
      attempts: { increment: 1 },
    });

    try {
      const attachments: { filename: string; content: Buffer; contentType: string }[] = [];

      const attachmentSpec = message.attachments as { invoicePdf?: string } | null;
      if (attachmentSpec?.invoicePdf) {
        const invoice = await InvoicesModel.findById(userId, attachmentSpec.invoicePdf);
        if (invoice) {
          attachments.push({
            filename: `${invoice.number.replace(/[^A-Za-z0-9._-]/g, '_')}.pdf`,
            content: await buildInvoicePdf(invoice),
            contentType: 'application/pdf',
          });
        }
      }

      const company = await prisma.companyProfile.findUnique({
        where: { userId },
        select: { legalName: true, tradeName: true, logoUrl: true },
      });

      const html = wrapForDelivery(message.subject, message.bodyHtml, sender.signatureHtml, {
        name: company?.tradeName ?? company?.legalName,
        logoUrl: company?.logoUrl,
      });
      const text = message.bodyText ?? stripToText(message.bodyHtml);
      const from = `${sender.fromName} <${sender.fromEmail}>`;

      let providerMessageId: string | null = null;

      if (sender.provider === 'RESEND') {
        const result = await sendViaResend(sender.resendApiKey as string, {
          from,
          to: message.toAddresses,
          cc: message.ccAddresses,
          bcc: message.bccAddresses,
          replyTo: sender.replyTo,
          subject: message.subject,
          html,
          text,
          attachments: attachments.map((file) => ({
            filename: file.filename,
            content: file.content.toString('base64'),
          })),
        });
        providerMessageId = result.id;
      } else {
        const info = await createTransport(sender.smtp as SmtpConfig).sendMail({
          from: `"${sender.fromName}" <${sender.fromEmail}>`,
          to: message.toAddresses,
          cc: message.ccAddresses.length ? message.ccAddresses : undefined,
          bcc: message.bccAddresses.length ? message.bccAddresses : undefined,
          replyTo: sender.replyTo ?? undefined,
          subject: message.subject,
          html,
          text,
          attachments,
        });
        providerMessageId = info.messageId ?? null;
      }

      logger.info('Email sent', { userId, emailId: id, provider: sender.provider, providerMessageId });

      return EmailModel.update(userId, id, {
        status: EmailStatus.SENT,
        sentAt: new Date(),
        providerMessageId,
        errorMessage: null,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Email send failed', { userId, emailId: id, error: errorMessage });

      await EmailModel.update(userId, id, { status: EmailStatus.FAILED, errorMessage });

      // A stale pooled connection is a common SMTP failure; drop it so a retry
      // negotiates a fresh session rather than failing the same way. Resend is
      // stateless HTTP, so there is nothing to invalidate there.
      if (sender.provider === 'SMTP' && sender.smtp) invalidateTransport(sender.smtp);

      throw ApiError.badRequest(`Could not send the email: ${errorMessage}`);
    }
  },

  /** Compose and deliver in one step — what the "Send" button in the UI calls. */
  async composeAndSend(userId: string, dto: ComposeEmailDto) {
    const draft = await this.createDraft(userId, { ...dto, scheduledAt: null });
    return this.send(userId, draft.id);
  },

  async stats(userId: string) {
    const counts = await EmailModel.statusCounts(userId);
    const byStatus = Object.fromEntries(counts.map((c) => [c.status, c._count._all]));
    return {
      total: counts.reduce((sum, c) => sum + c._count._all, 0),
      draft: byStatus.DRAFT ?? 0,
      queued: byStatus.QUEUED ?? 0,
      sent: byStatus.SENT ?? 0,
      failed: byStatus.FAILED ?? 0,
    };
  },

  // ---- Sending accounts ---------------------------------------------------

  listAccounts: (userId: string) => EmailModel.listAccounts(userId),

  async createAccount(userId: string, dto: EmailAccountDto) {
    const { smtpPassword, apiKey, ...rest } = dto;

    const account = await EmailModel.createAccount({
      ...rest,
      user: { connect: { id: userId } },
      smtpPasswordEnc: encryptOptional(smtpPassword),
      apiKeyEnc: encryptOptional(apiKey),
    });

    if (dto.isDefault) await EmailModel.demoteOtherDefaults(userId, account.id);
    return account;
  },

  async updateAccount(userId: string, id: string, dto: Partial<EmailAccountDto>) {
    const existing = await EmailModel.findAccountWithSecrets(userId, id);
    if (!existing) throw ApiError.notFound('Email account');

    const { smtpPassword, apiKey, ...rest } = dto;

    const data: Prisma.EmailAccountUpdateInput = { ...rest };
    // Only overwrite a stored secret when a new one was actually supplied —
    // the UI sends the rest of the form back without the password.
    if (smtpPassword) data.smtpPasswordEnc = encryptOptional(smtpPassword);
    if (apiKey) data.apiKeyEnc = encryptOptional(apiKey);
    // Any credential or host change invalidates the previous verification.
    if (smtpPassword || apiKey || rest.smtpHost || rest.smtpUser || rest.smtpPort !== undefined) {
      data.isVerified = false;
    }

    const account = await EmailModel.updateAccount(userId, id, data);
    if (dto.isDefault) await EmailModel.demoteOtherDefaults(userId, id);
    return account;
  },

  async removeAccount(userId: string, id: string) {
    const existing = await EmailModel.findAccountWithSecrets(userId, id);
    if (!existing) throw ApiError.notFound('Email account');
    await EmailModel.deleteAccount(userId, id);
  },

  /** Round-trips a real SMTP handshake so misconfiguration surfaces early. */
  async verifyAccount(userId: string, id: string) {
    const account = await EmailModel.findAccountWithSecrets(userId, id);
    if (!account) throw ApiError.notFound('Email account');

    let result: { ok: boolean; error?: string };

    if (account.provider === EmailProvider.RESEND) {
      const apiKey = decryptOptional(account.apiKeyEnc);
      if (!apiKey) throw ApiError.badRequest('This Resend mailbox is missing its API key');
      result = await verifyResendKey(apiKey);
    } else {
      if (!account.smtpHost || !account.smtpUser || !account.smtpPasswordEnc) {
        throw ApiError.badRequest('This mailbox is missing its SMTP settings');
      }
      result = await verifyTransport({
        host: account.smtpHost,
        port: account.smtpPort ?? (account.smtpSecure ? 465 : 587),
        secure: account.smtpSecure,
        user: account.smtpUser,
        password: decryptOptional(account.smtpPasswordEnc) as string,
      });
    }

    await EmailModel.updateAccount(userId, id, {
      isVerified: result.ok,
      lastError: result.error ?? null,
    });

    if (!result.ok) throw ApiError.badRequest(`Verification failed: ${result.error}`);
    return { verified: true };
  },

  // ---- Templates ----------------------------------------------------------

  listTemplates: (userId: string) => EmailModel.listTemplates(userId),

  createTemplate: (userId: string, dto: TemplateDto) =>
    EmailModel.createTemplate({ ...dto, user: { connect: { id: userId } } }),

  async updateTemplate(userId: string, id: string, dto: Partial<TemplateDto>) {
    const existing = await EmailModel.findTemplate(userId, id);
    if (!existing) throw ApiError.notFound('Template');
    return EmailModel.updateTemplate(userId, id, dto);
  },

  async removeTemplate(userId: string, id: string) {
    const existing = await EmailModel.findTemplate(userId, id);
    if (!existing) throw ApiError.notFound('Template');
    await EmailModel.deleteTemplate(userId, id);
  },

  /**
   * Fills a template's merge fields from live client/invoice/project data.
   * Tokens with no matching data render empty rather than leaking "{{token}}"
   * into an email a client will read.
   */
  async renderTemplate(
    userId: string,
    templateId: string,
    context: { clientId?: string; invoiceId?: string; projectId?: string },
  ) {
    const template = await EmailModel.findTemplate(userId, templateId);
    if (!template) throw ApiError.notFound('Template');

    const [user, company] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
      prisma.companyProfile.findUnique({ where: { userId }, select: { legalName: true, tradeName: true } }),
    ]);

    const merge: Record<string, string> = {
      senderName: user?.name ?? '',
      companyName: company?.tradeName || company?.legalName || '',
      subjectLine: template.subject,
    };

    if (context.clientId) {
      const client = await prisma.client.findFirst({
        where: { id: context.clientId, userId, deletedAt: null },
        select: { name: true, companyName: true, contacts: { where: { isPrimary: true }, take: 1 } },
      });
      if (client) {
        merge.clientName = client.contacts[0]?.name || client.name;
        merge.clientCompany = client.companyName ?? '';
      }
    }

    if (context.invoiceId) {
      const invoice = await prisma.invoice.findFirst({
        where: { id: context.invoiceId, userId, deletedAt: null },
        select: {
          number: true, total: true, amountPaid: true, balanceDue: true,
          currency: true, dueDate: true, issueDate: true,
          client: { select: { name: true } },
        },
      });
      if (invoice) {
        merge.invoiceNumber = invoice.number;
        merge.invoiceTotal = formatCurrency(toNumber(invoice.total), invoice.currency);
        merge.amountPaid = formatCurrency(toNumber(invoice.amountPaid), invoice.currency);
        merge.balanceDue = formatCurrency(toNumber(invoice.balanceDue), invoice.currency);
        merge.dueDate = formatDate(invoice.dueDate);
        merge.issueDate = formatDate(invoice.issueDate);
        merge.validUntil = formatDate(invoice.dueDate);
        const overdue = -daysBetween(new Date(), invoice.dueDate);
        merge.daysOverdue = overdue > 0 ? String(overdue) : '0';
        merge.clientName ||= invoice.client.name;
      }
    }

    if (context.projectId) {
      const project = await prisma.project.findFirst({
        where: { id: context.projectId, userId, deletedAt: null },
        select: { title: true, summary: true },
      });
      if (project) {
        merge.projectTitle = project.title;
        merge.projectSummary = project.summary ?? '';
      }
    }

    const compile = (source: string): string => {
      try {
        return handlebars.compile(source, { noEscape: false })(merge);
      } catch {
        // A malformed template must not 500 the composer.
        return source;
      }
    };

    const bodyHtml = compile(template.bodyHtml);

    return {
      subject: compile(template.subject),
      bodyHtml,
      bodyText: stripToText(bodyHtml),
      purpose: template.purpose,
      resolvedFields: merge,
    };
  },
};

export default EmailService;
