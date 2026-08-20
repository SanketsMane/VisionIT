import { env } from '@config/env';
import { renderEmail } from './email-layout';
import { AUTH_TEMPLATES, TEMPLATES, buildTemplate, type TemplateContext } from './email-templates';
import type { NotificationEvent } from './notification.events';

/**
 * Sample data for the template gallery.
 *
 * Every field a template can read is populated, because the point of a preview
 * is to catch the layout problem that only appears when a value is long, or a
 * row is present, or an amount wraps — an email that looks fine with empty
 * context tells you nothing.
 *
 * This is preview-only. It is never written to the database and never sent
 * except to the signed-in user's own address from the test endpoint.
 */
const SAMPLE: TemplateContext = {
  recipientName: 'Rohan Mehta',
  actorName: 'Sanket Patil',
  projectName: 'Meridian Logistics Platform',
  projectCode: 'MLP-2026',

  amount: '₹4,72,000.00',
  balanceDue: '₹1,18,000.00',
  invoiceNumber: 'INV-2026-0042',
  issueDate: '12 Aug 2026',
  dueDate: '26 Aug 2026',
  daysOverdue: '9',
  method: 'Bank transfer (NEFT)',
  reference: 'NEFT/2026/8817204',
  reason: 'Milestone 2 — API integration and dashboard',

  bugKey: 'MLP-118',
  bugTitle: 'Shipment tracking map fails to load on Safari 17',
  status: 'In progress',
  priority: 'High',
  assigneeName: 'Sanket Patil',

  version: 'v1.4.0',
  count: '3',
  role: 'Project Owner',
  title: 'Scheduled maintenance this Saturday',
  body:
    'We will be deploying the new reporting module between 10:00 and 11:30 IST on Saturday. ' +
    'The portal stays available throughout; report exports may be briefly unavailable.',
  expiresAt: '03 Sep 2026',
  repoUrl: 'https://github.com/meridian/logistics-platform',

  actionUrl: `${env.CLIENT_URL}/portal/projects/sample`,

  // The preview points at the local asset on purpose. Real sends fall back to
  // a text wordmark when the base URL isn't publicly reachable — but that
  // fallback is exactly what you don't want to be reviewing in the gallery.
  logoUrl: `${env.PUBLIC_BASE_URL.replace(/\/+$/, '')}/uploads/brand/logo.png`,
};

export type PreviewableEvent = NotificationEvent | keyof typeof AUTH_TEMPLATES;

/** Every template that can be previewed, grouped for the gallery. */
export const previewCatalogue = (): { group: string; event: string; subject: string }[] => {
  const groupOf = (event: string): string => {
    const [domain] = event.split('.');
    return (
      {
        project: 'Project & access',
        invoice: 'Invoicing',
        payment: 'Payments',
        bug: 'Testing & QA',
        delivery: 'Delivery & handover',
        support: 'Technical support',
        auth: 'Account & security',
      }[domain ?? ''] ?? 'Other'
    );
  };

  return [...Object.keys(TEMPLATES), ...Object.keys(AUTH_TEMPLATES)].map((event) => ({
    group: groupOf(event),
    event,
    subject: buildTemplate(event as PreviewableEvent, { ...SAMPLE, ...OVERRIDES[event] }).subject,
  }));
};

/**
 * Per-event sample overrides.
 *
 * A few context fields — `title`, `body`, `reason` — mean different things to
 * different templates, so one shared sample makes some previews read like
 * nonsense. These pin the handful that need their own wording.
 */
const OVERRIDES: Partial<Record<string, Partial<TemplateContext>>> = {
  'support.started': {
    title: '1 Year Warranty & Technical Support',
    reason: 'Within 24 business hours',
    body: [
      'Bug fixes and stability patches',
      'Security and dependency updates',
      'Email support during business hours',
    ].join('\n'),
  },
  'support.renewed': { title: '1 Year Warranty & Technical Support', count: '12' },
  'support.expiring': { count: '7' },
  'support.expired': { dueDate: '12 Aug 2026' },
  'payment.rejected': { reason: 'The reference number did not match any deposit we received.' },
  'bug.rejected': {
    reason: 'This is working as designed — the export deliberately excludes cancelled shipments.',
  },
  'bug.status_changed': { reason: 'Reproduced on Safari 17.2. Fix is in progress.' },
  'bug.commented': { body: 'Could you confirm whether this happens on mobile Safari too?' },
  'delivery.documents_uploaded': { count: '3' },
};

/** Renders one template with sample data, ready to serve as `text/html`. */
export const previewEvent = (
  event: PreviewableEvent,
  overrides: Partial<TemplateContext> = {},
): { subject: string; html: string } => {
  const { subject, document } = buildTemplate(event, {
    ...SAMPLE,
    ...OVERRIDES[event],
    ...overrides,
  });
  return { subject, html: renderEmail(document) };
};

export const previewContext = (overrides: Partial<TemplateContext> = {}): TemplateContext => ({
  ...SAMPLE,
  ...overrides,
});

/**
 * An index page linking to every template, so the whole set can be reviewed in
 * a browser without a mail client in the loop.
 */
export const previewIndexHtml = (basePath: string): string => {
  const items = previewCatalogue();
  const groups = [...new Set(items.map((i) => i.group))];

  const section = (group: string): string => `
    <h2>${group}</h2>
    <ul>
      ${items
        .filter((i) => i.group === group)
        .map(
          (i) => `<li>
            <a href="${basePath}/${i.event}" target="preview">${i.event}</a>
            <span>${i.subject.replace(/</g, '&lt;')}</span>
          </li>`,
        )
        .join('')}
    </ul>`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><title>Email templates — ${env.APP_NAME}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin:0; display:flex; height:100vh; font:14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; color:#0F172A; }
  aside { width:340px; flex:none; overflow-y:auto; border-right:1px solid #E5E9F0; padding:20px 18px 40px; background:#F7F9FC; }
  h1 { font-size:15px; margin:0 0 4px; }
  aside > p { margin:0 0 18px; color:#94A3B8; font-size:12px; }
  h2 { font-size:11px; text-transform:uppercase; letter-spacing:.06em; color:#94A3B8; margin:20px 0 6px; }
  ul { list-style:none; margin:0; padding:0; }
  li { margin-bottom:2px; }
  li a { display:block; text-decoration:none; color:#0076FF; font-weight:600; font-size:12.5px; padding:6px 8px 2px; border-radius:6px 6px 0 0; }
  li span { display:block; color:#64748B; font-size:11.5px; padding:0 8px 6px; }
  li:hover { background:#EAF2FF; border-radius:6px; }
  iframe { flex:1; border:0; height:100vh; background:#fff; }
</style></head>
<body>
  <aside>
    <h1>Email templates</h1>
    <p>${items.length} templates, rendered with sample data.</p>
    ${groups.map(section).join('')}
  </aside>
  <iframe name="preview" src="${basePath}/${items[0]?.event ?? ''}"></iframe>
</body></html>`;
};
