import { EmailLogStatus } from '@prisma/client';
import { prisma } from '@config/database';
import { env } from '@config/env';
import { logger } from '@config/logger';
import { createTransport, getFallbackSmtp } from '@config/mailer';
import { sendViaResend, type ResendAttachment } from '@config/resend';
import { renderEmail, renderPlainText } from './email-layout';
import { buildTemplate, type AuthEmail, type TemplateContext } from './email-templates';
import type { NotificationEvent } from './notification.events';

/**
 * The single place a system email leaves this application.
 *
 * Before this existed the codebase had three hand-rolled HTML shells and three
 * transport branches; a change to the footer meant three edits and a change to
 * the provider meant hunting for `sendMail` calls. Everything now funnels here,
 * so the design lives in `email-layout.ts`, the words live in
 * `email-templates.ts`, and provider choice lives in exactly one function.
 *
 * Note this is for *system* mail — notifications, invitations, auth. Mail a
 * user composes and sends from their own connected mailbox is a different
 * thing, and stays in the email module where it can use their credentials.
 */

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  /** Plain-text alternative. Its absence hurts deliverability, so always pass one. */
  text?: string;
  replyTo?: string | null;
  attachments?: ResendAttachment[];
  /** Recorded on the EmailLog row so delivery can be traced back to a cause. */
  event: string;
  userId?: string | null;
  projectId?: string | null;
}

export interface SendEmailResult {
  ok: boolean;
  messageId?: string;
  error?: string;
  /** Which transport actually handled it — useful when both are configured. */
  provider?: 'resend' | 'smtp';
}

const senderAddress = (): string => {
  // Without a verified domain Resend only accepts its own sandbox sender, and
  // will only deliver to the account owner. Falling back to it keeps local and
  // pre-domain environments working instead of failing every send outright.
  const address = env.MAIL_FROM_EMAIL ?? (env.RESEND_API_KEY ? 'onboarding@resend.dev' : undefined);
  return address ? `${env.MAIL_FROM_NAME} <${address}>` : env.MAIL_FROM_NAME;
};

const toList = (to: string | string[]): string[] => (Array.isArray(to) ? to : [to]);

/**
 * Sends one email and records the outcome, win or lose.
 *
 * Never throws. Email is a side effect of a business action — a bounced
 * notification must not roll back the invoice that triggered it. Callers that
 * genuinely care about delivery inspect the returned result.
 */
export const sendSystemEmail = async (input: SendEmailInput): Promise<SendEmailResult> => {
  const recipients = toList(input.to).filter(Boolean);
  if (!recipients.length) return { ok: false, error: 'No recipient address' };

  const log = await prisma.emailLog
    .create({
      data: {
        userId: input.userId ?? null,
        projectId: input.projectId ?? null,
        event: input.event,
        toAddress: recipients.join(', '),
        subject: input.subject,
        status: EmailLogStatus.QUEUED,
      },
    })
    .catch(() => null);

  const succeed = async (messageId: string, provider: 'resend' | 'smtp'): Promise<SendEmailResult> => {
    if (log) {
      await prisma.emailLog
        .update({
          where: { id: log.id },
          data: { status: EmailLogStatus.SENT, providerMessageId: messageId, sentAt: new Date() },
        })
        .catch(() => undefined);
    }
    return { ok: true, messageId, provider };
  };

  const fail = async (error: string): Promise<SendEmailResult> => {
    logger.warn('System email failed', { event: input.event, to: recipients, error });
    if (log) {
      await prisma.emailLog
        .update({
          where: { id: log.id },
          data: { status: EmailLogStatus.FAILED, errorMessage: error.slice(0, 500) },
        })
        .catch(() => undefined);
    }
    return { ok: false, error };
  };

  const replyTo = input.replyTo ?? env.MAIL_REPLY_TO ?? null;

  // Resend first, by design: it is the platform's chosen provider, needs no
  // long-lived connection, and reports a real reason when it refuses.
  if (env.RESEND_API_KEY) {
    try {
      const result = await sendViaResend(env.RESEND_API_KEY, {
        from: senderAddress(),
        to: recipients,
        subject: input.subject,
        html: input.html,
        text: input.text,
        replyTo,
        attachments: input.attachments,
      });
      return await succeed(result.id, 'resend');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Only fall through to SMTP if there is an SMTP to fall through to;
      // otherwise report Resend's reason, which is the actionable one.
      if (!env.hasGlobalSmtp) return fail(message);
      logger.warn('Resend send failed, trying SMTP', { event: input.event, error: message });
    }
  }

  const smtp = getFallbackSmtp();
  if (smtp) {
    try {
      const info = await createTransport(smtp).sendMail({
        from: `"${env.MAIL_FROM_NAME}" <${env.MAIL_FROM_EMAIL ?? smtp.user}>`,
        to: recipients,
        subject: input.subject,
        html: input.html,
        text: input.text,
        ...(replyTo ? { replyTo } : {}),
        ...(input.attachments?.length
          ? {
              attachments: input.attachments.map((a) => ({
                filename: a.filename,
                content: Buffer.from(a.content, 'base64'),
              })),
            }
          : {}),
      });
      return await succeed(info.messageId ?? 'smtp', 'smtp');
    } catch (error) {
      return fail(error instanceof Error ? error.message : String(error));
    }
  }

  return fail('No email transport configured — set RESEND_API_KEY or SMTP credentials');
};

export interface TemplatedEmailInput {
  to: string | string[];
  event: NotificationEvent | AuthEmail;
  context: TemplateContext;
  userId?: string | null;
  projectId?: string | null;
  attachments?: ResendAttachment[];
  replyTo?: string | null;
  /** Overrides the template's own subject, for one-off cases. */
  subject?: string;
}

/**
 * Renders a template and sends it. This is what almost every caller wants.
 */
export const sendTemplatedEmail = async (
  input: TemplatedEmailInput,
): Promise<SendEmailResult> => {
  const { subject, document } = buildTemplate(input.event, input.context);

  return sendSystemEmail({
    to: input.to,
    subject: input.subject ?? subject,
    html: renderEmail(document),
    text: renderPlainText(document),
    attachments: input.attachments,
    replyTo: input.replyTo,
    event: input.event,
    userId: input.userId,
    projectId: input.projectId,
  });
};

/** Turns a relative portal path into something an inbox can click. */
export const absoluteLink = (link?: string | null): string | undefined => {
  if (!link) return undefined;
  if (/^https?:\/\//i.test(link)) return link;
  return `${env.CLIENT_URL.replace(/\/+$/, '')}${link.startsWith('/') ? '' : '/'}${link}`;
};

export default { sendSystemEmail, sendTemplatedEmail, absoluteLink };
