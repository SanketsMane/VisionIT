/**
 * The catalogue of things the platform can tell someone about.
 *
 * The spec is explicit that emails must not be hard-coded throughout the
 * application. So every notification in the system is declared here as an
 * event with a template, and features only ever `emit(...)` — they never build
 * a subject line or decide who to email.
 */

export type NotificationEvent =
  // ---- Project ------------------------------------------------------------
  | 'project.client_invited'
  | 'project.client_registered'
  | 'project.member_invited'
  | 'project.member_joined'
  | 'project.status_changed'
  | 'project.announcement'
  // ---- Finance ------------------------------------------------------------
  | 'invoice.created'
  | 'invoice.due'
  | 'invoice.overdue'
  | 'payment.submitted'
  | 'payment.approved'
  | 'payment.rejected'
  // ---- Testing ------------------------------------------------------------
  | 'bug.submitted'
  | 'bug.acknowledged'
  | 'bug.assigned'
  | 'bug.status_changed'
  | 'bug.fixed'
  | 'bug.retest_requested'
  | 'bug.closed'
  | 'bug.rejected'
  | 'bug.commented'
  // ---- Delivery -----------------------------------------------------------
  | 'delivery.started'
  | 'delivery.ready'
  | 'delivery.documents_uploaded'
  | 'delivery.source_requested'
  | 'delivery.ownership_initiated'
  | 'delivery.ownership_completed'
  | 'delivery.completed'
  // ---- Technical support ---------------------------------------------------
  | 'support.started'
  | 'support.renewed'
  | 'support.expiring'
  | 'support.expired';

/** Where a notification can go. In-app is always on; email is opt-in per event. */
export type Channel = 'IN_APP' | 'EMAIL';

export interface EventContext {
  projectName?: string;
  projectCode?: string;
  recipientName?: string;
  actorName?: string;
  amount?: string;
  invoiceNumber?: string;
  bugKey?: string;
  bugTitle?: string;
  status?: string;
  reason?: string;
  version?: string;
  role?: string;
  title?: string;
  body?: string;
  dueDate?: string;
  link?: string;
  inviteUrl?: string;
  count?: string;

  // Richer detail used by the email templates. In-app notifications ignore
  // these, but an email that says "₹45,000 due 12 Mar against INV-0007" is a
  // far better email than one that says "you have a new invoice".
  issueDate?: string;
  balanceDue?: string;
  daysOverdue?: string;
  method?: string;
  reference?: string;
  priority?: string;
  assigneeName?: string;
  repoUrl?: string;
  expiresAt?: string;
  /** Absolute URL for the email's primary button. Falls back to `link`. */
  actionUrl?: string;
  actionLabel?: string;
  /** Studio identity, so a workspace can put its own name on the mail. */
  brandName?: string;
  logoUrl?: string;
}

export interface EventTemplate {
  /** Short line for the in-app notification list. */
  title: (ctx: EventContext) => string;
  /** Supporting sentence, shown under the title. */
  body: (ctx: EventContext) => string;
  /** Email subject. Absent means this event is in-app only. */
  subject?: (ctx: EventContext) => string;
  channels: Channel[];
}

const n = (value?: string) => value ?? '';

/**
 * Templates. Deliberately plain language — these are read by clients, not by
 * the team, so they avoid internal jargon and never expose ids.
 */
export const EVENT_TEMPLATES: Record<NotificationEvent, EventTemplate> = {
  // ---- Project ------------------------------------------------------------
  'project.client_invited': {
    title: (c) => `You've been invited to ${n(c.projectName)}`,
    body: (c) => `${n(c.actorName)} invited you to collaborate on ${n(c.projectName)}.`,
    subject: (c) => `You've been invited to ${n(c.projectName)}`,
    channels: ['EMAIL'],
  },
  'project.client_registered': {
    title: (c) => `${n(c.actorName)} joined ${n(c.projectName)}`,
    body: (c) => `${n(c.actorName)} accepted the invitation and now has access.`,
    subject: (c) => `${n(c.actorName)} accepted your invitation to ${n(c.projectName)}`,
    channels: ['IN_APP', 'EMAIL'],
  },
  'project.member_invited': {
    title: (c) => `You've been invited to ${n(c.projectName)}`,
    body: (c) => `${n(c.actorName)} added you as ${n(c.role)}.`,
    subject: (c) => `${n(c.actorName)} invited you to ${n(c.projectName)}`,
    channels: ['EMAIL'],
  },
  'project.member_joined': {
    title: (c) => `${n(c.actorName)} joined the team`,
    body: (c) => `${n(c.actorName)} joined ${n(c.projectName)} as ${n(c.role)}.`,
    channels: ['IN_APP'],
  },
  'project.status_changed': {
    title: (c) => `${n(c.projectName)} is now ${n(c.status)}`,
    body: (c) => `The project status changed to ${n(c.status)}.`,
    subject: (c) => `${n(c.projectName)} status update: ${n(c.status)}`,
    channels: ['IN_APP', 'EMAIL'],
  },
  'project.announcement': {
    title: (c) => n(c.title),
    body: (c) => n(c.body),
    subject: (c) => `${n(c.projectName)}: ${n(c.title)}`,
    channels: ['IN_APP', 'EMAIL'],
  },

  // ---- Finance ------------------------------------------------------------
  'invoice.created': {
    title: (c) => `Invoice ${n(c.invoiceNumber)}`,
    body: (c) => `A new invoice for ${n(c.amount)} is available, due ${n(c.dueDate)}.`,
    subject: (c) => `Invoice ${n(c.invoiceNumber)} from ${n(c.projectName)}`,
    channels: ['IN_APP', 'EMAIL'],
  },
  'invoice.due': {
    title: (c) => `Invoice ${n(c.invoiceNumber)} is due`,
    body: (c) => `${n(c.amount)} is due on ${n(c.dueDate)}.`,
    subject: (c) => `Reminder: invoice ${n(c.invoiceNumber)} is due`,
    channels: ['IN_APP', 'EMAIL'],
  },
  'invoice.overdue': {
    title: (c) => `Invoice ${n(c.invoiceNumber)} is overdue`,
    body: (c) => `${n(c.amount)} was due on ${n(c.dueDate)} and is still outstanding.`,
    subject: (c) => `Overdue: invoice ${n(c.invoiceNumber)}`,
    channels: ['IN_APP', 'EMAIL'],
  },
  'payment.submitted': {
    title: (c) => `Payment submitted — ${n(c.amount)}`,
    body: (c) => `${n(c.actorName)} submitted a payment of ${n(c.amount)} for ${n(c.reason)}.`,
    subject: (c) => `New payment request: ${n(c.amount)} for ${n(c.projectName)}`,
    channels: ['IN_APP', 'EMAIL'],
  },
  'payment.approved': {
    title: (c) => `Payment of ${n(c.amount)} approved`,
    body: (c) => `Your payment for ${n(c.reason)} has been verified and recorded.`,
    subject: (c) => `Payment approved — ${n(c.amount)}`,
    channels: ['IN_APP', 'EMAIL'],
  },
  'payment.rejected': {
    title: (c) => `Payment of ${n(c.amount)} needs attention`,
    body: (c) => `Your payment could not be verified. Reason: ${n(c.reason)}`,
    subject: (c) => `Payment could not be verified — ${n(c.amount)}`,
    channels: ['IN_APP', 'EMAIL'],
  },

  // ---- Testing ------------------------------------------------------------
  'bug.submitted': {
    title: (c) => `${n(c.bugKey)} reported`,
    body: (c) => `${n(c.actorName)} reported "${n(c.bugTitle)}".`,
    subject: (c) => `New issue ${n(c.bugKey)}: ${n(c.bugTitle)}`,
    channels: ['IN_APP', 'EMAIL'],
  },
  'bug.acknowledged': {
    title: (c) => `${n(c.bugKey)} acknowledged`,
    body: (c) => `Your issue "${n(c.bugTitle)}" has been acknowledged and is being looked at.`,
    subject: (c) => `${n(c.bugKey)} has been acknowledged`,
    channels: ['IN_APP', 'EMAIL'],
  },
  'bug.assigned': {
    title: (c) => `${n(c.bugKey)} assigned to you`,
    body: (c) => `You've been assigned "${n(c.bugTitle)}".`,
    subject: (c) => `You've been assigned ${n(c.bugKey)}`,
    channels: ['IN_APP', 'EMAIL'],
  },
  'bug.status_changed': {
    title: (c) => `${n(c.bugKey)} is now ${n(c.status)}`,
    body: (c) => `"${n(c.bugTitle)}" moved to ${n(c.status)}.`,
    subject: (c) => `${n(c.bugKey)} updated: ${n(c.status)}`,
    channels: ['IN_APP', 'EMAIL'],
  },
  'bug.fixed': {
    title: (c) => `${n(c.bugKey)} marked as fixed`,
    body: (c) => `"${n(c.bugTitle)}" has been fixed and is ready for your retest.`,
    subject: (c) => `${n(c.bugKey)} is fixed — ready for retest`,
    channels: ['IN_APP', 'EMAIL'],
  },
  'bug.retest_requested': {
    title: (c) => `${n(c.bugKey)} needs a retest`,
    body: (c) => `${n(c.actorName)} asked for a retest of "${n(c.bugTitle)}".`,
    subject: (c) => `Retest requested for ${n(c.bugKey)}`,
    channels: ['IN_APP', 'EMAIL'],
  },
  'bug.closed': {
    title: (c) => `${n(c.bugKey)} closed`,
    body: (c) => `"${n(c.bugTitle)}" has been closed.`,
    subject: (c) => `${n(c.bugKey)} closed`,
    channels: ['IN_APP', 'EMAIL'],
  },
  'bug.rejected': {
    title: (c) => `${n(c.bugKey)} was not accepted`,
    body: (c) => `"${n(c.bugTitle)}" was closed as ${n(c.status)}. ${n(c.reason)}`,
    subject: (c) => `${n(c.bugKey)}: ${n(c.status)}`,
    channels: ['IN_APP', 'EMAIL'],
  },
  'bug.commented': {
    title: (c) => `New comment on ${n(c.bugKey)}`,
    body: (c) => `${n(c.actorName)} commented on "${n(c.bugTitle)}".`,
    channels: ['IN_APP'],
  },

  // ---- Delivery -----------------------------------------------------------
  'delivery.started': {
    title: (c) => `Delivery started for ${n(c.projectName)}`,
    body: () => 'Your project is being prepared for handover.',
    subject: (c) => `${n(c.projectName)} — delivery has started`,
    channels: ['IN_APP', 'EMAIL'],
  },
  'delivery.ready': {
    title: (c) => `${n(c.projectName)} is ready for you`,
    body: (c) => `Version ${n(c.version)} is ready for your review.`,
    subject: (c) => `${n(c.projectName)} is ready for review`,
    channels: ['IN_APP', 'EMAIL'],
  },
  'delivery.documents_uploaded': {
    title: () => 'New delivery documents',
    body: (c) => `${n(c.count)} document(s) were added to your delivery package.`,
    subject: (c) => `New documents for ${n(c.projectName)}`,
    channels: ['IN_APP', 'EMAIL'],
  },
  'delivery.source_requested': {
    title: () => 'Source code details needed',
    body: () => 'Please tell us how you would like to receive the source code.',
    subject: (c) => `Action needed: source code delivery for ${n(c.projectName)}`,
    channels: ['IN_APP', 'EMAIL'],
  },
  'delivery.ownership_initiated': {
    title: (c) => `Ownership transfer started for ${n(c.projectName)}`,
    body: () => 'Please review the handover and confirm you have received everything.',
    subject: (c) => `Please confirm handover of ${n(c.projectName)}`,
    channels: ['IN_APP', 'EMAIL'],
  },
  'delivery.ownership_completed': {
    title: (c) => `${n(c.actorName)} confirmed the handover`,
    body: (c) => `Ownership of ${n(c.projectName)} has been confirmed by the client.`,
    subject: (c) => `${n(c.projectName)} handover confirmed`,
    channels: ['IN_APP', 'EMAIL'],
  },
  'delivery.completed': {
    title: (c) => `${n(c.projectName)} delivered`,
    body: (c) => `Version ${n(c.version)} has been delivered and the handover is complete.`,
    subject: (c) => `${n(c.projectName)} has been delivered`,
    channels: ['IN_APP', 'EMAIL'],
  },

  // ---- Technical support ---------------------------------------------------
  'support.started': {
    title: (c) => `${n(c.title)} is active on ${n(c.projectName)}`,
    body: (c) => `Your technical support cover runs until ${n(c.dueDate)}.`,
    subject: (c) => `Your technical support for ${n(c.projectName)} is active`,
    channels: ['IN_APP', 'EMAIL'],
  },
  'support.renewed': {
    title: (c) => `Support renewed on ${n(c.projectName)}`,
    body: (c) => `Your cover now runs until ${n(c.dueDate)}.`,
    subject: (c) => `Your support for ${n(c.projectName)} has been renewed`,
    channels: ['IN_APP', 'EMAIL'],
  },
  'support.expiring': {
    title: (c) => `Support ends in ${n(c.count)} days`,
    body: (c) => `Technical support for ${n(c.projectName)} ends on ${n(c.dueDate)}.`,
    subject: (c) => `Your support for ${n(c.projectName)} ends in ${n(c.count)} days`,
    channels: ['IN_APP', 'EMAIL'],
  },
  'support.expired': {
    title: (c) => `Support has ended on ${n(c.projectName)}`,
    body: (c) => `Your technical support cover ended on ${n(c.dueDate)}.`,
    subject: (c) => `Your technical support for ${n(c.projectName)} has ended`,
    channels: ['IN_APP', 'EMAIL'],
  },
};
