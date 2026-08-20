import { EmailPurpose } from '@prisma/client';

export interface SeedEmailTemplate {
  name: string;
  subject: string;
  bodyHtml: string;
  purpose: EmailPurpose;
  variables: string[];
}

/**
 * Handlebars-style `{{token}}` placeholders are resolved by
 * `email.service.ts#renderTemplate` against a merge context built from the
 * client, invoice, project and company profile.
 */
const wrap = (inner: string): string => `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#0f172a;">
${inner}
</div>`.trim();

export const DEFAULT_EMAIL_TEMPLATES: SeedEmailTemplate[] = [
  {
    name: 'Invoice Delivery',
    purpose: EmailPurpose.INVOICE_DELIVERY,
    subject: 'Invoice {{invoiceNumber}} from {{companyName}}',
    variables: ['clientName', 'invoiceNumber', 'invoiceTotal', 'dueDate', 'companyName', 'senderName'],
    bodyHtml: wrap(`
<p>Hi {{clientName}},</p>
<p>Please find attached invoice <strong>{{invoiceNumber}}</strong> for <strong>{{invoiceTotal}}</strong>, due on <strong>{{dueDate}}</strong>.</p>
<p>You can review the full breakdown in the attached PDF. If anything looks off, just reply to this email and I'll sort it out right away.</p>
<p>Thanks for your business.</p>
<p>Best regards,<br/>{{senderName}}<br/>{{companyName}}</p>`),
  },
  {
    name: 'Payment Reminder',
    purpose: EmailPurpose.PAYMENT_REMINDER,
    subject: 'Gentle reminder: invoice {{invoiceNumber}} is due',
    variables: ['clientName', 'invoiceNumber', 'invoiceTotal', 'dueDate', 'daysOverdue', 'senderName'],
    bodyHtml: wrap(`
<p>Hi {{clientName}},</p>
<p>Just a quick note that invoice <strong>{{invoiceNumber}}</strong> for <strong>{{invoiceTotal}}</strong> was due on <strong>{{dueDate}}</strong>.</p>
<p>If the payment is already on its way, please ignore this message. Otherwise, I'd appreciate it if you could process it at your earliest convenience.</p>
<p>Happy to resend the invoice or share alternative payment details if that helps.</p>
<p>Best regards,<br/>{{senderName}}</p>`),
  },
  {
    name: 'Project Proposal',
    purpose: EmailPurpose.PROJECT_PROPOSAL,
    subject: 'Proposal: {{projectTitle}}',
    variables: ['clientName', 'projectTitle', 'projectSummary', 'senderName', 'companyName'],
    bodyHtml: wrap(`
<p>Hi {{clientName}},</p>
<p>Thanks for taking the time to walk me through your requirements. Based on our conversation, here's what I'm proposing for <strong>{{projectTitle}}</strong>:</p>
<p>{{projectSummary}}</p>
<p>I've attached the detailed scope, timeline and commercials. I'm happy to jump on a call this week to walk through it together.</p>
<p>Looking forward to working with you.</p>
<p>Best regards,<br/>{{senderName}}<br/>{{companyName}}</p>`),
  },
  {
    name: 'Project Status Update',
    purpose: EmailPurpose.PROJECT_UPDATE,
    subject: '{{projectTitle}} — progress update',
    variables: ['clientName', 'projectTitle', 'progressSummary', 'nextSteps', 'senderName'],
    bodyHtml: wrap(`
<p>Hi {{clientName}},</p>
<p>Here's where things stand on <strong>{{projectTitle}}</strong>:</p>
<p>{{progressSummary}}</p>
<p><strong>Coming up next:</strong><br/>{{nextSteps}}</p>
<p>Let me know if you'd like to reprioritise anything.</p>
<p>Best regards,<br/>{{senderName}}</p>`),
  },
  {
    name: 'New Client Onboarding',
    purpose: EmailPurpose.ONBOARDING,
    subject: 'Welcome aboard, {{clientName}}',
    variables: ['clientName', 'projectTitle', 'senderName', 'companyName'],
    bodyHtml: wrap(`
<p>Hi {{clientName}},</p>
<p>Delighted to have you on board. I'm kicking off <strong>{{projectTitle}}</strong> and wanted to share how we'll work together.</p>
<p>You'll get a written progress update from me every week, and you can reach me directly on this thread for anything urgent.</p>
<p>To get started, could you share access to the assets and accounts listed in the onboarding document?</p>
<p>Best regards,<br/>{{senderName}}<br/>{{companyName}}</p>`),
  },
  {
    name: 'Follow Up',
    purpose: EmailPurpose.FOLLOW_UP,
    subject: 'Following up on {{subjectLine}}',
    variables: ['clientName', 'subjectLine', 'senderName'],
    bodyHtml: wrap(`
<p>Hi {{clientName}},</p>
<p>Just floating this back to the top of your inbox in case it slipped through.</p>
<p>No rush at all — let me know if you need anything from my side to move it forward.</p>
<p>Best regards,<br/>{{senderName}}</p>`),
  },
  {
    name: 'Payment Received — Thank You',
    purpose: EmailPurpose.THANK_YOU,
    subject: 'Payment received — thank you!',
    variables: ['clientName', 'invoiceNumber', 'amountPaid', 'senderName'],
    bodyHtml: wrap(`
<p>Hi {{clientName}},</p>
<p>Confirming that I've received <strong>{{amountPaid}}</strong> against invoice <strong>{{invoiceNumber}}</strong>. Thank you!</p>
<p>It's a pleasure working with you — looking forward to what's next.</p>
<p>Best regards,<br/>{{senderName}}</p>`),
  },
  {
    name: 'Quotation',
    purpose: EmailPurpose.QUOTATION,
    subject: 'Quotation {{invoiceNumber}} for {{projectTitle}}',
    variables: ['clientName', 'invoiceNumber', 'projectTitle', 'invoiceTotal', 'validUntil', 'senderName'],
    bodyHtml: wrap(`
<p>Hi {{clientName}},</p>
<p>As discussed, here's my quotation for <strong>{{projectTitle}}</strong>, coming to <strong>{{invoiceTotal}}</strong>.</p>
<p>The quote is valid until <strong>{{validUntil}}</strong>. Full line-item detail is in the attached PDF.</p>
<p>Happy to adjust the scope if you'd like to phase the work differently.</p>
<p>Best regards,<br/>{{senderName}}</p>`),
  },
];

/** Merge fields the AI writer and template renderer both understand. */
export const MERGE_FIELDS = [
  'clientName',
  'clientCompany',
  'senderName',
  'companyName',
  'invoiceNumber',
  'invoiceTotal',
  'amountPaid',
  'balanceDue',
  'dueDate',
  'issueDate',
  'daysOverdue',
  'projectTitle',
  'projectSummary',
  'progressSummary',
  'nextSteps',
  'subjectLine',
  'validUntil',
] as const;

export type MergeField = (typeof MERGE_FIELDS)[number];

export const MAX_RECIPIENTS_PER_MESSAGE = 25;
export const MAX_SEND_ATTEMPTS = 3;
