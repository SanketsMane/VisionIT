import { env } from '@config/env';
import type { EmailBlock, EmailDocument } from './email-layout';
import type { NotificationEvent } from './notification.events';

/**
 * Every email the platform sends, in one place.
 *
 * A template turns context into a subject, an inbox preview line, and a set of
 * layout blocks. It never builds HTML — `email-layout.ts` owns rendering, so a
 * change to the design applies to all thirty-odd emails at once.
 *
 * Wording rules followed throughout:
 *   - lead with what happened, not with "Hi there"
 *   - name the amount, the invoice or the issue in the first sentence
 *   - one primary action per email
 *   - never scold a client about money; state the fact and offer help
 */

export interface TemplateContext {
  recipientName?: string;
  actorName?: string;
  projectName?: string;
  projectCode?: string;

  amount?: string;
  balanceDue?: string;
  invoiceNumber?: string;
  dueDate?: string;
  issueDate?: string;
  daysOverdue?: string;
  reason?: string;
  method?: string;
  reference?: string;

  bugKey?: string;
  bugTitle?: string;
  status?: string;
  priority?: string;
  assigneeName?: string;

  version?: string;
  count?: string;
  role?: string;
  title?: string;
  body?: string;
  repoUrl?: string;

  /** Absolute link for the primary button. */
  actionUrl?: string;
  /** Overrides the default button label. */
  actionLabel?: string;
  /** Studio identity, for white-labelling per workspace. */
  brandName?: string;
  logoUrl?: string;
  expiresAt?: string;
}

export interface RenderedTemplate {
  subject: string;
  document: EmailDocument;
}

type TemplateFn = (ctx: TemplateContext) => {
  subject: string;
  preheader: string;
  heading: string;
  subheading?: string;
  blocks: EmailBlock[];
  footerNote?: string;
};

const n = (value?: string, fallback = ''): string => value ?? fallback;

/** "Hi Rohan," — or a neutral opener when we don't know the name. */
const greeting = (ctx: TemplateContext): string =>
  ctx.recipientName ? `Hi ${ctx.recipientName.split(' ')[0]},` : 'Hi there,';

/** Adds the primary action button when a link is available. */
const action = (ctx: TemplateContext, label: string): EmailBlock[] =>
  ctx.actionUrl ? [{ type: 'button', label: ctx.actionLabel ?? label, url: ctx.actionUrl }] : [];

const projectLine = (ctx: TemplateContext): string =>
  ctx.projectCode ? `${n(ctx.projectName)} (${ctx.projectCode})` : n(ctx.projectName);

// ── Templates ───────────────────────────────────────────────────────────────

export const TEMPLATES: Record<NotificationEvent, TemplateFn> = {
  // ═══ Project & access ════════════════════════════════════════════════════

  'project.client_invited': (ctx) => ({
    subject: `You've been invited to ${n(ctx.projectName)}`,
    preheader: `${n(ctx.actorName)} has invited you to track ${n(ctx.projectName)} — set up your access.`,
    heading: `You've been invited to ${n(ctx.projectName)}`,
    subheading: `${n(ctx.actorName)} would like you to join the project workspace.`,
    blocks: [
      { type: 'text', content: greeting(ctx) },
      {
        type: 'text',
        content: `${n(ctx.actorName)} has invited you to collaborate on ${projectLine(ctx)} as ${n(ctx.role, 'a collaborator')}. Setting up your account takes about a minute.`,
      },
      { type: 'heading', level: 3, content: 'What you can do there' },
      {
        type: 'list',
        items: [
          'Follow progress, milestones and delivery status',
          'View and download invoices, and submit payments you have made',
          'Report issues with screenshots and follow them through to a fix',
          'Get project documents and the final source-code handover',
        ],
      },
      ...action(ctx, 'Accept invitation'),
      ...(ctx.expiresAt
        ? ([{
            type: 'text',
            size: 'small',
            content: `This invitation link expires on ${ctx.expiresAt}. If it lapses, just ask ${n(ctx.actorName, 'the team')} for a fresh one.`,
          }] as EmailBlock[])
        : []),
    ],
    footerNote: "You received this because someone invited you to a project. If you weren't expecting it, you can safely ignore this email.",
  }),

  'project.member_invited': (ctx) => ({
    subject: `${n(ctx.actorName)} invited you to ${n(ctx.projectName)}`,
    preheader: `Join ${n(ctx.projectName)} as ${n(ctx.role, 'a team member')}.`,
    heading: `Join ${n(ctx.projectName)}`,
    subheading: `${n(ctx.actorName)} has added you to the project team.`,
    blocks: [
      { type: 'text', content: greeting(ctx) },
      {
        type: 'text',
        content: `${n(ctx.actorName)} has invited you to ${projectLine(ctx)} as ${n(ctx.role, 'a team member')}. Create your account to get access.`,
      },
      ...action(ctx, 'Accept invitation'),
      ...(ctx.expiresAt
        ? ([{ type: 'text', size: 'small', content: `This link expires on ${ctx.expiresAt}.` }] as EmailBlock[])
        : []),
    ],
    footerNote: "You received this because a project team member invited you. If you weren't expecting it, you can ignore this email.",
  }),

  'project.client_registered': (ctx) => ({
    subject: `${n(ctx.actorName)} accepted your invitation to ${n(ctx.projectName)}`,
    preheader: `${n(ctx.actorName)} now has access to ${n(ctx.projectName)}.`,
    heading: `${n(ctx.actorName)} has joined ${n(ctx.projectName)}`,
    blocks: [
      {
        type: 'text',
        content: `${n(ctx.actorName)} accepted the invitation and now has access to ${projectLine(ctx)}. They can see progress, invoices and documents you've shared, and can report issues.`,
      },
      ...action(ctx, 'Open the project'),
    ],
  }),

  'project.member_joined': (ctx) => ({
    subject: `${n(ctx.actorName)} joined ${n(ctx.projectName)}`,
    preheader: `${n(ctx.actorName)} joined as ${n(ctx.role, 'a team member')}.`,
    heading: `${n(ctx.actorName)} joined the team`,
    blocks: [
      {
        type: 'text',
        content: `${n(ctx.actorName)} has joined ${projectLine(ctx)} as ${n(ctx.role, 'a team member')}.`,
      },
      ...action(ctx, 'View the team'),
    ],
  }),

  'project.status_changed': (ctx) => ({
    subject: `${n(ctx.projectName)} — status update`,
    preheader: `The status of ${n(ctx.projectName)} is now ${n(ctx.status)}.`,
    // A status is a label, not a phrase, so it goes in a field rather than
    // mid-sentence — "is now On hold" reads like a typo.
    heading: `${n(ctx.projectName)} — status update`,
    subheading: ctx.projectCode ?? undefined,
    blocks: [
      { type: 'text', content: greeting(ctx) },
      { type: 'text', content: 'A quick update on where your project stands.' },
      { type: 'facts', rows: [{ label: 'Current status', value: n(ctx.status), strong: true }] },
      ...action(ctx, 'View the project'),
    ],
  }),

  'project.announcement': (ctx) => ({
    subject: `${n(ctx.projectName)}: ${n(ctx.title)}`,
    preheader: n(ctx.body).slice(0, 140),
    heading: n(ctx.title),
    subheading: `An update on ${n(ctx.projectName)}`,
    blocks: [
      { type: 'text', content: greeting(ctx) },
      { type: 'text', content: n(ctx.body) },
      ...action(ctx, 'Open the project'),
    ],
  }),

  // ═══ Invoicing ═══════════════════════════════════════════════════════════

  'invoice.created': (ctx) => ({
    subject: `Invoice ${n(ctx.invoiceNumber)} from ${n(ctx.brandName, env.APP_NAME)}`,
    preheader: `${n(ctx.amount)} due ${n(ctx.dueDate)}. The PDF is attached.`,
    heading: `Invoice ${n(ctx.invoiceNumber)}`,
    subheading: ctx.projectName ? `For ${ctx.projectName}` : undefined,
    blocks: [
      { type: 'text', content: greeting(ctx) },
      {
        type: 'text',
        content: 'Please find your invoice below. The full breakdown is in the attached PDF.',
      },
      { type: 'amount', label: 'Amount due', value: n(ctx.amount), caption: `Due ${n(ctx.dueDate)}` },
      {
        type: 'facts',
        rows: [
          { label: 'Invoice number', value: n(ctx.invoiceNumber) },
          ...(ctx.issueDate ? [{ label: 'Issued', value: ctx.issueDate }] : []),
          { label: 'Due date', value: n(ctx.dueDate) },
          ...(ctx.projectName ? [{ label: 'Project', value: ctx.projectName }] : []),
        ],
      },
      ...action(ctx, 'View invoice'),
      {
        type: 'text',
        size: 'small',
        content: "If anything looks wrong, reply to this email and we'll sort it out straight away.",
      },
    ],
  }),

  'invoice.due': (ctx) => ({
    subject: `Reminder: invoice ${n(ctx.invoiceNumber)} is due ${n(ctx.dueDate)}`,
    preheader: `${n(ctx.amount)} is due on ${n(ctx.dueDate)}.`,
    heading: `Invoice ${n(ctx.invoiceNumber)} is due soon`,
    blocks: [
      { type: 'text', content: greeting(ctx) },
      {
        type: 'text',
        content: `A gentle reminder that invoice ${n(ctx.invoiceNumber)} is due on ${n(ctx.dueDate)}. If it's already on its way, please ignore this note.`,
      },
      { type: 'amount', label: 'Amount due', value: n(ctx.balanceDue, ctx.amount), caption: `Due ${n(ctx.dueDate)}` },
      ...action(ctx, 'View invoice'),
      {
        type: 'text',
        size: 'small',
        content: 'Need different payment details or more time? Just reply — we can usually work something out.',
      },
    ],
  }),

  'invoice.overdue': (ctx) => ({
    subject: `Invoice ${n(ctx.invoiceNumber)} is overdue`,
    preheader: `${n(ctx.amount)} was due on ${n(ctx.dueDate)}.`,
    heading: `Invoice ${n(ctx.invoiceNumber)} is past its due date`,
    blocks: [
      { type: 'text', content: greeting(ctx) },
      {
        type: 'text',
        content: `Invoice ${n(ctx.invoiceNumber)} was due on ${n(ctx.dueDate)}${ctx.daysOverdue ? ` — ${ctx.daysOverdue} days ago — ` : ' '}and is still showing as outstanding on our side.`,
      },
      {
        type: 'amount',
        tone: 'warning',
        label: 'Outstanding',
        value: n(ctx.balanceDue, ctx.amount),
        caption: ctx.daysOverdue ? `${ctx.daysOverdue} days past due` : undefined,
      },
      {
        type: 'callout',
        tone: 'info',
        title: 'Already paid?',
        body: "Submit the payment in the portal with your reference number and we'll verify it — the invoice updates as soon as we do.",
      },
      ...action(ctx, 'Submit a payment'),
    ],
  }),

  // ═══ Payments ════════════════════════════════════════════════════════════

  'payment.submitted': (ctx) => ({
    subject: `New payment to verify: ${n(ctx.amount)} for ${n(ctx.projectName)}`,
    preheader: `${n(ctx.actorName)} submitted ${n(ctx.amount)} — ${n(ctx.reason)}.`,
    heading: 'A client has submitted a payment',
    subheading: 'It needs verifying before it lands in your books.',
    blocks: [
      {
        type: 'text',
        content: `${n(ctx.actorName)} submitted a payment on ${projectLine(ctx)}. Nothing has been recorded yet — approving it posts the entry to your ledger.`,
      },
      { type: 'amount', label: 'Amount submitted', value: n(ctx.amount), caption: n(ctx.reason) },
      {
        type: 'facts',
        rows: [
          { label: 'Reason', value: n(ctx.reason) },
          ...(ctx.invoiceNumber ? [{ label: 'Against invoice', value: ctx.invoiceNumber }] : []),
          ...(ctx.method ? [{ label: 'Method', value: ctx.method }] : []),
          ...(ctx.reference ? [{ label: 'Reference', value: ctx.reference }] : []),
        ],
      },
      ...action(ctx, 'Review payment'),
    ],
  }),

  'payment.approved': (ctx) => ({
    subject: `Payment received — ${n(ctx.amount)}`,
    preheader: `We've verified your payment of ${n(ctx.amount)}. Thank you.`,
    heading: 'Payment received — thank you',
    blocks: [
      { type: 'text', content: greeting(ctx) },
      {
        type: 'text',
        content: `We've verified your payment and recorded it against your account. Thank you.`,
      },
      { type: 'amount', tone: 'success', label: 'Payment confirmed', value: n(ctx.amount), caption: n(ctx.reason) },
      {
        type: 'facts',
        rows: [
          ...(ctx.invoiceNumber ? [{ label: 'Invoice', value: ctx.invoiceNumber }] : []),
          ...(ctx.reference ? [{ label: 'Reference', value: ctx.reference }] : []),
          ...(ctx.balanceDue ? [{ label: 'Remaining balance', value: ctx.balanceDue, strong: true }] : []),
        ],
      },
      ...action(ctx, 'View payment history'),
    ],
  }),

  'payment.rejected': (ctx) => ({
    subject: `We couldn't verify your payment of ${n(ctx.amount)}`,
    preheader: `We need a little more detail on your ${n(ctx.amount)} payment.`,
    heading: "We couldn't verify this payment yet",
    blocks: [
      { type: 'text', content: greeting(ctx) },
      {
        type: 'text',
        content: `We weren't able to match your payment of ${n(ctx.amount)} against our records. Nothing is wrong on your side necessarily — it usually just needs a corrected reference or a clearer receipt.`,
      },
      { type: 'callout', tone: 'warning', title: 'What we found', body: n(ctx.reason) },
      {
        type: 'text',
        content: 'You can submit it again with the updated details, and it will go straight back into our queue.',
      },
      ...action(ctx, 'Resubmit payment'),
      {
        type: 'text',
        size: 'small',
        content: "If you think this is our mistake, reply to this email and we'll take another look.",
      },
    ],
  }),

  // ═══ Testing / QA ════════════════════════════════════════════════════════

  'bug.submitted': (ctx) => ({
    subject: `New issue ${n(ctx.bugKey)}: ${n(ctx.bugTitle)}`,
    preheader: `${n(ctx.actorName)} reported an issue on ${n(ctx.projectName)}.`,
    heading: `${n(ctx.bugKey)} reported`,
    subheading: n(ctx.bugTitle),
    blocks: [
      {
        type: 'text',
        content: `${n(ctx.actorName)} reported a new issue on ${projectLine(ctx)}.`,
      },
      {
        type: 'facts',
        rows: [
          { label: 'Issue', value: n(ctx.bugKey) },
          ...(ctx.priority ? [{ label: 'Priority', value: ctx.priority, strong: true }] : []),
          { label: 'Reported by', value: n(ctx.actorName) },
        ],
      },
      ...action(ctx, 'Open the issue'),
    ],
  }),

  'bug.acknowledged': (ctx) => ({
    subject: `${n(ctx.bugKey)} has been acknowledged`,
    preheader: `We've seen your report and are looking into it.`,
    heading: `We're on it — ${n(ctx.bugKey)}`,
    subheading: n(ctx.bugTitle),
    blocks: [
      { type: 'text', content: greeting(ctx) },
      {
        type: 'text',
        content: `Thanks for reporting this. We've reproduced the issue and it's now in our queue. You'll get an update when there's a fix ready to retest.`,
      },
      ...action(ctx, 'View the issue'),
    ],
  }),

  'bug.assigned': (ctx) => ({
    subject: `You've been assigned ${n(ctx.bugKey)}`,
    preheader: `${n(ctx.bugTitle)} is now yours.`,
    heading: `${n(ctx.bugKey)} assigned to you`,
    subheading: n(ctx.bugTitle),
    blocks: [
      {
        type: 'text',
        content: `${n(ctx.actorName)} assigned this issue to you on ${projectLine(ctx)}.`,
      },
      {
        type: 'facts',
        rows: [
          { label: 'Issue', value: n(ctx.bugKey) },
          ...(ctx.priority ? [{ label: 'Priority', value: ctx.priority, strong: true }] : []),
          ...(ctx.dueDate ? [{ label: 'Target date', value: ctx.dueDate }] : []),
        ],
      },
      ...action(ctx, 'Open the issue'),
    ],
  }),

  'bug.status_changed': (ctx) => ({
    subject: `${n(ctx.bugKey)} is now ${n(ctx.status)}`,
    preheader: `${n(ctx.bugTitle)} moved to ${n(ctx.status)}.`,
    heading: `${n(ctx.bugKey)} — ${n(ctx.status)}`,
    subheading: n(ctx.bugTitle),
    blocks: [
      {
        type: 'text',
        content: `${n(ctx.actorName)} moved this issue to ${n(ctx.status)} on ${projectLine(ctx)}.`,
      },
      ...(ctx.reason ? ([{ type: 'quote', body: ctx.reason, attribution: ctx.actorName }] as EmailBlock[]) : []),
      ...action(ctx, 'View the issue'),
    ],
  }),

  'bug.fixed': (ctx) => ({
    subject: `${n(ctx.bugKey)} is fixed — ready for your retest`,
    preheader: `${n(ctx.bugTitle)} has been fixed. Please confirm it works for you.`,
    heading: `Fixed — please retest ${n(ctx.bugKey)}`,
    subheading: n(ctx.bugTitle),
    blocks: [
      { type: 'text', content: greeting(ctx) },
      {
        type: 'text',
        content: `We've fixed this one. When you have a moment, please check it on your side and mark it retested — or reopen it if you're still seeing the problem.`,
      },
      { type: 'callout', tone: 'success', title: 'Ready for retest', body: n(ctx.bugTitle) },
      ...action(ctx, 'Retest the issue'),
    ],
  }),

  'bug.retest_requested': (ctx) => ({
    subject: `Retest requested for ${n(ctx.bugKey)}`,
    preheader: `${n(ctx.actorName)} has asked for a retest.`,
    heading: `${n(ctx.bugKey)} needs a retest`,
    subheading: n(ctx.bugTitle),
    blocks: [
      { type: 'text', content: `${n(ctx.actorName)} has asked for a retest on ${projectLine(ctx)}.` },
      ...action(ctx, 'Open the issue'),
    ],
  }),

  'bug.closed': (ctx) => ({
    subject: `${n(ctx.bugKey)} closed`,
    preheader: `${n(ctx.bugTitle)} has been closed.`,
    heading: `${n(ctx.bugKey)} is closed`,
    subheading: n(ctx.bugTitle),
    blocks: [
      { type: 'text', content: greeting(ctx) },
      {
        type: 'text',
        content: `This issue has been closed. Thanks for reporting it — if it comes back, reply here or reopen it in the portal and we'll pick it straight up.`,
      },
      ...action(ctx, 'View the issue'),
    ],
  }),

  'bug.rejected': (ctx) => ({
    subject: `${n(ctx.bugKey)}: ${n(ctx.status)}`,
    preheader: `An update on the issue you reported.`,
    heading: `Update on ${n(ctx.bugKey)}`,
    subheading: n(ctx.bugTitle),
    blocks: [
      { type: 'text', content: greeting(ctx) },
      {
        type: 'text',
        content: `We've looked into this one and marked it as ${n(ctx.status)}. Here's why:`,
      },
      { type: 'callout', tone: 'neutral', body: n(ctx.reason, 'No further detail was provided.') },
      {
        type: 'text',
        content: "If you think we've got this wrong, reply and we'll happily take another look.",
      },
      ...action(ctx, 'View the issue'),
    ],
  }),

  'bug.commented': (ctx) => ({
    subject: `New comment on ${n(ctx.bugKey)}`,
    preheader: `${n(ctx.actorName)} commented on ${n(ctx.bugTitle)}.`,
    heading: `New comment on ${n(ctx.bugKey)}`,
    subheading: n(ctx.bugTitle),
    blocks: [
      { type: 'text', content: `${n(ctx.actorName)} added a comment:` },
      ...(ctx.body ? ([{ type: 'quote', body: ctx.body, attribution: ctx.actorName }] as EmailBlock[]) : []),
      ...action(ctx, 'Reply in the portal'),
    ],
  }),

  // ═══ Delivery & handover ═════════════════════════════════════════════════

  'delivery.started': (ctx) => ({
    subject: `${n(ctx.projectName)} — we've started preparing your delivery`,
    preheader: `Your project is being packaged for handover.`,
    heading: 'We\'ve started preparing your delivery',
    subheading: projectLine(ctx),
    blocks: [
      { type: 'text', content: greeting(ctx) },
      {
        type: 'text',
        content: `We've begun putting together the final handover for ${n(ctx.projectName)}. That means the source code, documentation and final build.`,
      },
      { type: 'heading', level: 3, content: 'What happens next' },
      {
        type: 'list',
        ordered: true,
        items: [
          'We prepare the delivery package and documents',
          'You tell us how you want the source code — GitHub transfer or a downloadable archive',
          'You review everything and confirm you have received it',
        ],
      },
      ...action(ctx, 'Open delivery'),
    ],
  }),

  'delivery.ready': (ctx) => ({
    subject: `${n(ctx.projectName)} is ready for your review`,
    preheader: `Version ${n(ctx.version)} is ready — please take a look.`,
    heading: 'Your delivery is ready to review',
    subheading: projectLine(ctx),
    blocks: [
      { type: 'text', content: greeting(ctx) },
      {
        type: 'text',
        content: `${n(ctx.version) ? `Version ${ctx.version} of ` : ''}${n(ctx.projectName)} is ready for you. Please review the package and let us know if anything is missing.`,
      },
      ...(ctx.version
        ? ([{ type: 'facts', rows: [{ label: 'Version', value: ctx.version, strong: true }] }] as EmailBlock[])
        : []),
      ...action(ctx, 'Review the delivery'),
    ],
  }),

  'delivery.documents_uploaded': (ctx) => ({
    subject: `New documents for ${n(ctx.projectName)}`,
    preheader: `${n(ctx.count, 'New')} document(s) were added to your project.`,
    heading: 'New documents are available',
    subheading: projectLine(ctx),
    blocks: [
      { type: 'text', content: greeting(ctx) },
      {
        type: 'text',
        content: `${n(ctx.count, 'Some new')} document(s) have been added to ${n(ctx.projectName)} and are ready for you to view or download.`,
      },
      ...action(ctx, 'View documents'),
    ],
  }),

  'delivery.source_requested': (ctx) => ({
    subject: `Action needed: how would you like the source code for ${n(ctx.projectName)}?`,
    preheader: 'Choose GitHub transfer or a downloadable archive.',
    heading: 'How would you like the source code?',
    subheading: projectLine(ctx),
    blocks: [
      { type: 'text', content: greeting(ctx) },
      {
        type: 'text',
        content: 'Before we complete the handover we need to know how you would like to receive the source code. There are two options:',
      },
      {
        type: 'list',
        items: [
          { term: 'GitHub', description: 'we transfer the repository to your GitHub account or organisation' },
          { term: 'Archive', description: 'we publish a versioned ZIP for you to download' },
        ],
      },
      ...action(ctx, 'Choose an option'),
    ],
  }),

  'delivery.ownership_initiated': (ctx) => ({
    subject: `Please confirm the handover of ${n(ctx.projectName)}`,
    preheader: 'Everything is ready — we just need your confirmation.',
    heading: 'Please confirm you have everything',
    subheading: projectLine(ctx),
    blocks: [
      { type: 'text', content: greeting(ctx) },
      {
        type: 'text',
        content: `We've confirmed on our side that the deliverables and source code for ${n(ctx.projectName)} have been handed over. The last step is your confirmation.`,
      },
      {
        type: 'callout',
        tone: 'info',
        title: 'Before you confirm',
        body: 'Please check that you can access the source code, that the documents you need are there, and that the final build is what you expected.',
      },
      ...action(ctx, 'Confirm the handover'),
      {
        type: 'text',
        size: 'small',
        content: "If something is missing, don't confirm yet — just reply and tell us what you need.",
      },
    ],
  }),

  'delivery.ownership_completed': (ctx) => ({
    subject: `${n(ctx.actorName)} confirmed the handover of ${n(ctx.projectName)}`,
    preheader: `The client has confirmed receipt of ${n(ctx.projectName)}.`,
    heading: 'The client confirmed the handover',
    blocks: [
      {
        type: 'text',
        content: `${n(ctx.actorName)} has confirmed receipt of the deliverables for ${projectLine(ctx)}. The handover record is complete and the project can be marked delivered.`,
      },
      ...action(ctx, 'View the handover'),
    ],
  }),

  'delivery.completed': (ctx) => ({
    subject: `${n(ctx.projectName)} has been delivered`,
    preheader: 'The handover is complete. Thank you for working with us.',
    heading: 'Project delivered',
    subheading: projectLine(ctx),
    blocks: [
      { type: 'text', content: greeting(ctx) },
      {
        type: 'text',
        content: `${n(ctx.projectName)} has been delivered and the handover is complete. It's been a pleasure building this with you.`,
      },
      ...(ctx.version
        ? ([{
            type: 'facts',
            rows: [{ label: 'Delivered version', value: ctx.version, strong: true }],
          }] as EmailBlock[])
        : []),
      {
        type: 'text',
        content: 'Your project workspace stays available, so you can always come back for documents, invoices and the source-code handover record.',
      },
      ...action(ctx, 'Open the project'),
      {
        type: 'text',
        size: 'small',
        content: "If you need support or want to plan the next phase, just reply — we'd love to keep working together.",
      },
    ],
  }),

  // ═══ Technical support ═══════════════════════════════════════════════════

  'support.started': (ctx) => ({
    subject: `Your technical support for ${n(ctx.projectName)} is active`,
    preheader: `Cover runs until ${n(ctx.dueDate)}. Here's how to reach us.`,
    heading: 'Your support cover is active',
    subheading: projectLine(ctx),
    blocks: [
      { type: 'text', content: greeting(ctx) },
      {
        type: 'text',
        content: `${n(ctx.title, 'Technical support')} is now active on ${n(ctx.projectName)}. If something breaks or you need a hand, this is what you're covered for.`,
      },
      {
        type: 'facts',
        rows: [
          { label: 'Plan', value: n(ctx.title, 'Technical support') },
          { label: 'Covered until', value: n(ctx.dueDate), strong: true },
          ...(ctx.reason ? [{ label: 'Response time', value: ctx.reason }] : []),
        ],
      },
      ...(ctx.body
        ? ([{ type: 'heading', level: 3, content: "What's included" },
            { type: 'list', items: ctx.body.split('\n').filter(Boolean) }] as EmailBlock[])
        : []),
      ...action(ctx, 'View your support status'),
      {
        type: 'text',
        size: 'small',
        content: 'You can see exactly how much cover is left at any time in your project portal.',
      },
    ],
  }),

  'support.renewed': (ctx) => ({
    subject: `Your support for ${n(ctx.projectName)} has been renewed`,
    preheader: `Cover now runs until ${n(ctx.dueDate)}.`,
    heading: 'Your support has been renewed',
    subheading: projectLine(ctx),
    blocks: [
      { type: 'text', content: greeting(ctx) },
      {
        type: 'text',
        content: `Good news — your technical support has been extended${ctx.count ? ` by ${ctx.count} month(s)` : ''}. Nothing changes on your side.`,
      },
      {
        type: 'callout',
        tone: 'success',
        title: 'Covered until',
        body: n(ctx.dueDate),
      },
      ...action(ctx, 'View your support status'),
    ],
  }),

  'support.expiring': (ctx) => ({
    subject: `Your support for ${n(ctx.projectName)} ends in ${n(ctx.count)} days`,
    preheader: `Cover ends on ${n(ctx.dueDate)}. Renew to stay covered.`,
    heading: `Your support ends in ${n(ctx.count)} days`,
    subheading: projectLine(ctx),
    blocks: [
      { type: 'text', content: greeting(ctx) },
      {
        type: 'text',
        content: `A heads-up: technical support for ${n(ctx.projectName)} ends on ${n(ctx.dueDate)}. After that we can still help, but it would be quoted as new work rather than covered.`,
      },
      {
        type: 'amount',
        tone: 'warning',
        label: 'Cover remaining',
        value: `${n(ctx.count)} days`,
        caption: `Ends ${n(ctx.dueDate)}`,
      },
      {
        type: 'text',
        content: 'If you would like to extend it, just reply to this email and we will sort it out.',
      },
      ...action(ctx, 'View your support status'),
    ],
  }),

  'support.expired': (ctx) => ({
    subject: `Your technical support for ${n(ctx.projectName)} has ended`,
    preheader: `Cover ended on ${n(ctx.dueDate)}. We can still help.`,
    heading: 'Your support cover has ended',
    subheading: projectLine(ctx),
    blocks: [
      { type: 'text', content: greeting(ctx) },
      {
        type: 'text',
        content: `Technical support for ${n(ctx.projectName)} ended on ${n(ctx.dueDate)}. Thank you for the last term — it's been good working with you.`,
      },
      {
        type: 'callout',
        tone: 'info',
        title: 'Still need us?',
        body: "Reply to this email and we'll put together a renewal, or quote any one-off work you need. Your project portal, documents and invoices stay available either way.",
      },
      ...action(ctx, 'Open your project'),
    ],
  }),

  // ═══ Services ════════════════════════════════════════════════════════════

  'quote.received': (ctx) => ({
    subject: `New enquiry: ${n(ctx.title)} — ${n(ctx.actorName)}`,
    preheader: `${n(ctx.actorName)} asked about ${n(ctx.title)}.`,
    heading: 'New enquiry',
    subheading: n(ctx.title),
    blocks: [
      {
        type: 'text',
        content: `${n(ctx.actorName)} has asked for a quote through your services page.`,
      },
      {
        type: 'facts',
        rows: [
          { label: 'From', value: n(ctx.actorName), strong: true },
          { label: 'Interested in', value: n(ctx.title) },
          ...(ctx.reason ? [{ label: 'Details', value: ctx.reason }] : []),
        ],
      },
      // Their own words, so the email is worth acting on without opening it.
      ...(ctx.body
        ? ([{ type: 'quote', body: ctx.body, attribution: ctx.actorName }] as EmailBlock[])
        : []),
      ...action(ctx, 'Open the enquiry'),
      {
        type: 'text',
        size: 'small',
        content: 'Replying quickly is most of what wins this kind of work.',
      },
    ],
    footerNote: 'You received this because an enquiry was submitted on your services page.',
  }),

  // ═══ Orders ══════════════════════════════════════════════════════════════

  'order.placed': (ctx) => ({
    subject: `New order ${n(ctx.invoiceNumber)} — ${n(ctx.title)}`,
    preheader: `${n(ctx.actorName)} ordered ${n(ctx.title)} for ${n(ctx.amount)}.`,
    heading: 'New order',
    subheading: n(ctx.title),
    blocks: [
      { type: 'text', content: `${n(ctx.actorName)} has placed an order and will pay shortly.` },
      { type: 'amount', label: 'Order total', value: n(ctx.amount), caption: n(ctx.invoiceNumber) },
      ...(ctx.body ? ([{ type: 'quote', body: ctx.body, attribution: ctx.actorName }] as EmailBlock[]) : []),
      ...action(ctx, 'Open the order'),
    ],
  }),

  'order.quote_requested': (ctx) => ({
    subject: `Quote requested: ${n(ctx.title)} — ${n(ctx.actorName)}`,
    preheader: `${n(ctx.actorName)} needs a price for ${n(ctx.title)}.`,
    heading: 'Someone needs a price',
    subheading: n(ctx.title),
    blocks: [
      {
        type: 'text',
        content: `${n(ctx.actorName)} asked what ${n(ctx.title)} would cost. Setting a price sends it straight back to them, ready to pay.`,
      },
      ...(ctx.body
        ? ([
            { type: 'heading', level: 3, content: 'What they need' },
            { type: 'quote', body: ctx.body, attribution: ctx.actorName },
          ] as EmailBlock[])
        : []),
      ...action(ctx, 'Set a price'),
    ],
  }),

  'order.quoted': (ctx) => ({
    subject: `Your quote for ${n(ctx.title)} — ${n(ctx.amount)}`,
    preheader: `${n(ctx.title)} comes to ${n(ctx.amount)}.`,
    heading: 'Your quote is ready',
    subheading: n(ctx.title),
    blocks: [
      { type: 'text', content: greeting(ctx) },
      { type: 'text', content: 'We have put a price together for you. Nothing is committed until you pay.' },
      { type: 'amount', tone: 'success', label: 'Your price', value: n(ctx.amount), caption: n(ctx.invoiceNumber) },
      ...(ctx.body ? ([{ type: 'callout', tone: 'info', body: ctx.body }] as EmailBlock[]) : []),
      ...action(ctx, 'View and pay'),
      {
        type: 'text',
        size: 'small',
        content: 'This price is for you specifically. Reply if anything about the scope has changed.',
      },
    ],
  }),

  'order.payment_submitted': (ctx) => ({
    subject: `Payment to verify: ${n(ctx.invoiceNumber)} — ${n(ctx.amount)}`,
    preheader: `${n(ctx.actorName)} says they have paid ${n(ctx.amount)}.`,
    heading: 'A payment needs verifying',
    subheading: n(ctx.title),
    blocks: [
      {
        type: 'text',
        content: `${n(ctx.actorName)} has submitted proof of payment. Nothing is activated until you confirm it.`,
      },
      { type: 'amount', label: 'Amount', value: n(ctx.amount), caption: n(ctx.invoiceNumber) },
      {
        type: 'facts',
        rows: [
          ...(ctx.method ? [{ label: 'Method', value: ctx.method }] : []),
          ...(ctx.reference ? [{ label: 'Reference', value: ctx.reference }] : []),
        ],
      },
      ...action(ctx, 'Verify the payment'),
    ],
  }),

  'order.approved': (ctx) => ({
    subject: `Your ${n(ctx.title)} is ready`,
    preheader: 'Payment verified — your service is live.',
    heading: 'You are all set',
    subheading: n(ctx.title),
    blocks: [
      { type: 'text', content: greeting(ctx) },
      {
        type: 'text',
        content: `We have verified your payment and ${n(ctx.title)} is now active. Thank you.`,
      },
      {
        type: 'facts',
        rows: [
          { label: 'Order', value: n(ctx.invoiceNumber) },
          ...(ctx.amount ? [{ label: 'Paid', value: ctx.amount, strong: true }] : []),
        ],
      },
      ...(ctx.reason === 'credentials'
        ? ([{
            type: 'callout',
            tone: 'info',
            title: 'Your credentials are on their way',
            body: 'They are in a separate email to the address you gave us, so they are easy to find and easy to keep private.',
          }] as EmailBlock[])
        : []),
      ...(ctx.body ? ([{ type: 'text', content: ctx.body }] as EmailBlock[]) : []),
      ...action(ctx, 'View your order'),
    ],
  }),

  'order.rejected': (ctx) => ({
    subject: `We need another look at your payment — ${n(ctx.invoiceNumber)}`,
    preheader: `We could not match your payment for ${n(ctx.title)}.`,
    heading: "We couldn't verify that payment",
    subheading: n(ctx.title),
    blocks: [
      { type: 'text', content: greeting(ctx) },
      {
        type: 'text',
        content: `We were not able to match your payment for ${n(ctx.title)} against our records. This is usually a reference number or a screenshot we cannot read, rather than anything wrong on your side.`,
      },
      { type: 'callout', tone: 'warning', title: 'What we found', body: n(ctx.reason) },
      { type: 'text', content: 'Submit it again with the corrected details and it goes straight back into our queue.' },
      ...action(ctx, 'Submit again'),
    ],
  }),

  'order.message': (ctx) => ({
    subject: `New message on ${n(ctx.title)}`,
    preheader: `${n(ctx.actorName)}: ${n(ctx.body).slice(0, 110)}`,
    heading: `${n(ctx.actorName)} replied`,
    subheading: n(ctx.title),
    blocks: [
      ...(ctx.body ? ([{ type: 'quote', body: ctx.body, attribution: ctx.actorName }] as EmailBlock[]) : []),
      ...action(ctx, 'Open the order'),
    ],
  }),

  // ═══ Chat ════════════════════════════════════════════════════════════════

  'chat.unread': (ctx) => ({
    subject:
      ctx.count === '1'
        ? `New message from ${n(ctx.actorName)}`
        : `${n(ctx.count)} unread messages from ${n(ctx.actorName)}`,
    preheader: `${n(ctx.actorName)}: ${n(ctx.body).slice(0, 110)}`,
    heading:
      ctx.count === '1'
        ? `${n(ctx.actorName)} sent you a message`
        : `You have ${n(ctx.count)} unread messages`,
    subheading: ctx.title ? `In ${ctx.title}` : projectLine(ctx),
    blocks: [
      { type: 'text', content: greeting(ctx) },
      {
        type: 'text',
        content:
          ctx.count === '1'
            ? `${n(ctx.actorName)} messaged you about ${n(ctx.projectName)} and it's still unread.`
            : `There ${ctx.count === '1' ? 'is' : 'are'} ${n(ctx.count)} message(s) waiting for you on ${n(ctx.projectName)}.`,
      },
      // The message itself, so the email is useful even unopened.
      ...(ctx.body
        ? ([{ type: 'quote', body: ctx.body, attribution: ctx.actorName }] as EmailBlock[])
        : []),
      ...action(ctx, 'Open the conversation'),
      {
        type: 'text',
        size: 'small',
        content: "You'll only get this once per conversation until you read it — we won't email you for every message.",
      },
    ],
    footerNote: 'You received this because you have unread messages in a project you are part of.',
  }),
};

/** Auth emails, which sit outside the project notification system. */
export type AuthEmail =
  | 'auth.password_reset'
  | 'auth.password_changed'
  | 'auth.welcome'
  /** Service credentials. Sent to whatever address the client nominated. */
  | 'order.credentials';

export const AUTH_TEMPLATES: Record<AuthEmail, TemplateFn> = {
  'auth.password_reset': (ctx) => ({
    subject: 'Reset your password',
    preheader: 'Use the link inside to choose a new password. It expires in one hour.',
    heading: 'Reset your password',
    blocks: [
      { type: 'text', content: greeting(ctx) },
      {
        type: 'text',
        content: 'We received a request to reset the password on your account. Choose a new one using the button below.',
      },
      ...action(ctx, 'Choose a new password'),
      {
        type: 'callout',
        tone: 'warning',
        title: 'This link expires in one hour',
        body: "If you didn't ask to reset your password, you can ignore this email — your password stays as it is and nobody has been given access.",
      },
    ],
    footerNote: 'You received this because a password reset was requested for your account.',
  }),

  'auth.password_changed': (ctx) => ({
    subject: 'Your password was changed',
    preheader: 'Your account password was updated just now.',
    heading: 'Your password was changed',
    blocks: [
      { type: 'text', content: greeting(ctx) },
      {
        type: 'text',
        content: 'Your account password was updated, and every other signed-in device has been signed out.',
      },
      {
        type: 'callout',
        tone: 'danger',
        title: "Didn't do this?",
        body: 'Reset your password immediately and contact us so we can secure your account.',
      },
    ],
    footerNote: 'You received this because your account password changed.',
  }),

  'order.credentials': (ctx) => ({
    subject: `Your ${n(ctx.title)} access details`,
    preheader: 'Your login details are inside. Keep this email safe.',
    heading: 'Your access details',
    subheading: n(ctx.title),
    blocks: [
      { type: 'text', content: greeting(ctx) },
      {
        type: 'text',
        content: `Your ${n(ctx.title)} is live. Here is everything you need to get in.`,
      },
      // Monospaced and unwrapped: a password broken across lines by an email
      // client is a support ticket waiting to happen.
      { type: 'code', label: 'Access details', value: n(ctx.body) },
      ...(ctx.reason ? ([{ type: 'text', content: ctx.reason }] as EmailBlock[]) : []),
      {
        type: 'callout',
        tone: 'warning',
        title: 'Change the password on first login',
        body: 'These details were sent by email, which is not a secure channel. Set your own password as soon as you sign in, and do not forward this message.',
      },
      ...action(ctx, 'View your order'),
    ],
    footerNote: 'You received this because you ordered a service from us.',
  }),

  'auth.welcome': (ctx) => ({
    subject: `Welcome to ${n(ctx.brandName, env.APP_NAME)}`,
    preheader: 'Your workspace is ready — here is how to get started.',
    heading: 'Your workspace is ready',
    blocks: [
      { type: 'text', content: greeting(ctx) },
      {
        type: 'text',
        content: "Your account is set up and your workspace has been provisioned with a full chart of accounts, invoice numbering and starter email templates.",
      },
      { type: 'heading', level: 3, content: 'A good first hour' },
      {
        type: 'list',
        ordered: true,
        items: [
          'Add your business details, tax number and bank information in Settings',
          'Add your first client and catalog a project',
          'Raise an invoice — the ledger entry is posted for you',
        ],
      },
      ...action(ctx, 'Open your dashboard'),
    ],
    footerNote: 'You received this because you created an account.',
  }),
};

/**
 * Builds a complete, renderable document for any event.
 * Callers hand in context; they never touch layout.
 */
export const buildTemplate = (
  event: NotificationEvent | AuthEmail,
  ctx: TemplateContext,
): RenderedTemplate => {
  const template =
    (TEMPLATES as Record<string, TemplateFn | undefined>)[event] ??
    (AUTH_TEMPLATES as Record<string, TemplateFn | undefined>)[event];

  if (!template) {
    // An unknown event must still produce a sane email rather than throwing
    // inside a notification side-effect.
    return {
      subject: env.APP_NAME,
      document: {
        preheader: 'You have a new notification.',
        heading: 'You have a new notification',
        blocks: [{ type: 'text', content: 'Open your workspace to see what changed.' }],
        brandName: ctx.brandName,
        logoUrl: ctx.logoUrl,
      },
    };
  }

  const result = template(ctx);

  return {
    subject: result.subject,
    document: {
      preheader: result.preheader,
      heading: result.heading,
      subheading: result.subheading,
      blocks: result.blocks,
      brandName: ctx.brandName,
      logoUrl: ctx.logoUrl,
      footerNote: result.footerNote,
    },
  };
};
