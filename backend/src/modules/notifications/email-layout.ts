import { env } from '@config/env';

/**
 * The email design system.
 *
 * Email is not the web. Outlook renders with the Word engine (no flexbox, no
 * grid, unreliable `max-width` on divs), Gmail can strip a `<style>` block when
 * a message is forwarded or clipped, and both Gmail and Outlook will invert
 * colours in dark mode unless you fight them. So everything here is:
 *
 *   - table-based, because that is the only layout primitive Outlook honours
 *   - inline-styled, so the mail survives having its `<style>` block removed
 *   - explicitly coloured, so dark-mode auto-inversion can't repaint the card
 *   - capped at 600px, the width that fits every desktop reading pane
 *
 * The `<style>` block carries media queries only — they are a progressive
 * enhancement for clients that support them, never load-bearing.
 */

// ── Design tokens ───────────────────────────────────────────────────────────

export const BRAND = {
  primary: '#0076FF',
  primaryDark: '#0059C1',
  ink: '#0F172A',
  body: '#475569',
  muted: '#94A3B8',
  border: '#E5E9F0',
  surface: '#FFFFFF',
  subtle: '#F7F9FC',
  success: '#15803D',
  successBg: '#F0FDF4',
  successBorder: '#BBF7D0',
  warning: '#B45309',
  warningBg: '#FFFBEB',
  warningBorder: '#FDE68A',
  danger: '#B91C1C',
  dangerBg: '#FEF2F2',
  dangerBorder: '#FECACA',
  info: '#0369A1',
  infoBg: '#F0F9FF',
  infoBorder: '#BAE6FD',
} as const;

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

export type ToneName = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const TONES: Record<ToneName, { text: string; bg: string; border: string }> = {
  neutral: { text: BRAND.body, bg: BRAND.subtle, border: BRAND.border },
  success: { text: BRAND.success, bg: BRAND.successBg, border: BRAND.successBorder },
  warning: { text: BRAND.warning, bg: BRAND.warningBg, border: BRAND.warningBorder },
  danger: { text: BRAND.danger, bg: BRAND.dangerBg, border: BRAND.dangerBorder },
  info: { text: BRAND.info, bg: BRAND.infoBg, border: BRAND.infoBorder },
};

// ── Escaping ────────────────────────────────────────────────────────────────

/**
 * Everything interpolated into an email is escaped by default. Client names,
 * bug titles and rejection reasons are user-supplied and end up in someone
 * else's inbox — an unescaped `<` there is a real problem, not a cosmetic one.
 */
export const esc = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** Preserves author line breaks without allowing raw HTML through. */
export const escMultiline = (value: unknown): string =>
  esc(value).replace(/\r?\n/g, '<br />');

/** Only http(s) links are allowed to become hrefs. */
const safeUrl = (url: string): string => {
  const trimmed = url.trim();
  return /^https?:\/\//i.test(trimmed) ? esc(trimmed) : '#';
};

// ── Blocks ──────────────────────────────────────────────────────────────────

export type ListItem = string | { term: string; description: string };

export type EmailBlock =
  | { type: 'text'; content: string; size?: 'normal' | 'small'; align?: 'left' | 'center' }
  | { type: 'heading'; content: string; level?: 2 | 3 }
  | { type: 'button'; label: string; url: string; variant?: 'primary' | 'secondary' }
  | { type: 'facts'; rows: { label: string; value: string; strong?: boolean }[] }
  | { type: 'callout'; tone: ToneName; title?: string; body: string }
  | { type: 'amount'; label: string; value: string; caption?: string; tone?: ToneName }
  /**
   * A bullet or numbered list. An item may be a plain string, or a
   * `{ term, description }` pair rendered as **Term** — description. The pair
   * form exists so a template can emphasise a word without smuggling HTML
   * through a field that is escaped by design.
   */
  | { type: 'list'; items: ListItem[]; ordered?: boolean }
  | { type: 'quote'; body: string; attribution?: string }
  | { type: 'code'; label?: string; value: string }
  | { type: 'divider' }
  | { type: 'spacer'; size?: number }
  /** Pre-sanitised HTML. Only for content the caller has already cleaned. */
  | { type: 'rawHtml'; html: string };

const renderText = (block: Extract<EmailBlock, { type: 'text' }>): string => {
  const size = block.size === 'small' ? '13px' : '15px';
  const color = block.size === 'small' ? BRAND.muted : BRAND.body;
  return `
<tr>
  <td style="padding:0 0 16px 0;font-family:${FONT};font-size:${size};line-height:1.65;color:${color};text-align:${block.align ?? 'left'};">
    ${escMultiline(block.content)}
  </td>
</tr>`;
};

const renderHeading = (block: Extract<EmailBlock, { type: 'heading' }>): string => {
  const isSub = block.level === 3;
  return `
<tr>
  <td style="padding:${isSub ? '8px' : '4px'} 0 12px 0;font-family:${FONT};font-size:${isSub ? '15px' : '20px'};line-height:1.35;font-weight:700;color:${BRAND.ink};">
    ${esc(block.content)}
  </td>
</tr>`;
};

/**
 * Bulletproof button.
 *
 * The VML block is what makes it render as a real button in Outlook 2007–2019,
 * which ignores padding and border-radius on anchors. Every other client skips
 * the conditional comment and uses the styled anchor.
 */
const renderButton = (block: Extract<EmailBlock, { type: 'button' }>): string => {
  const isSecondary = block.variant === 'secondary';
  const bg = isSecondary ? BRAND.surface : BRAND.primary;
  const fg = isSecondary ? BRAND.ink : '#FFFFFF';
  const border = isSecondary ? BRAND.border : BRAND.primary;
  const url = safeUrl(block.url);

  return `
<tr>
  <td style="padding:4px 0 20px 0;">
    <!--[if mso]>
    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
      href="${url}" style="height:44px;v-text-anchor:middle;width:260px;" arcsize="18%"
      stroke="f" fillcolor="${bg}">
      <w:anchorlock/>
      <center style="color:${fg};font-family:${FONT};font-size:15px;font-weight:600;">${esc(block.label)}</center>
    </v:roundrect>
    <![endif]-->
    <!--[if !mso]><!-- -->
    <a href="${url}"
       style="display:inline-block;background-color:${bg};border:1px solid ${border};border-radius:8px;
              color:${fg};font-family:${FONT};font-size:15px;font-weight:600;line-height:1;
              padding:14px 28px;text-decoration:none;mso-hide:all;">
      ${esc(block.label)}
    </a>
    <!--<![endif]-->
  </td>
</tr>`;
};

/** Label/value rows — invoice numbers, dates, references. */
const renderFacts = (block: Extract<EmailBlock, { type: 'facts' }>): string => {
  const rows = block.rows
    .map(
      (row, index) => `
      <tr>
        <td class="fact-label" style="padding:${index === 0 ? '0' : '10px'} 12px 0 0;font-family:${FONT};font-size:13px;line-height:1.5;color:${BRAND.muted};white-space:nowrap;vertical-align:top;">
          ${esc(row.label)}
        </td>
        <td class="fact-value" style="padding:${index === 0 ? '0' : '10px'} 0 0 0;font-family:${FONT};font-size:14px;line-height:1.5;color:${BRAND.ink};font-weight:${row.strong ? '700' : '500'};text-align:right;vertical-align:top;">
          ${esc(row.value)}
        </td>
      </tr>`,
    )
    .join('');

  return `
<tr>
  <td style="padding:0 0 20px 0;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
           style="background-color:${BRAND.subtle};border:1px solid ${BRAND.border};border-radius:10px;">
      <tr>
        <td style="padding:16px 18px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            ${rows}
          </table>
        </td>
      </tr>
    </table>
  </td>
</tr>`;
};

const renderCallout = (block: Extract<EmailBlock, { type: 'callout' }>): string => {
  const tone = TONES[block.tone];
  return `
<tr>
  <td style="padding:0 0 20px 0;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
           style="background-color:${tone.bg};border:1px solid ${tone.border};border-radius:10px;">
      <tr>
        <td style="padding:14px 18px;font-family:${FONT};">
          ${
            block.title
              ? `<div style="font-size:14px;font-weight:700;color:${tone.text};margin:0 0 4px 0;">${esc(block.title)}</div>`
              : ''
          }
          <div style="font-size:13px;line-height:1.6;color:${BRAND.body};">${escMultiline(block.body)}</div>
        </td>
      </tr>
    </table>
  </td>
</tr>`;
};

/** The one number the reader actually opened the email for. */
const renderAmount = (block: Extract<EmailBlock, { type: 'amount' }>): string => {
  const tone = TONES[block.tone ?? 'neutral'];
  const color = block.tone && block.tone !== 'neutral' ? tone.text : BRAND.ink;

  return `
<tr>
  <td style="padding:0 0 20px 0;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
           style="background-color:${tone.bg};border:1px solid ${tone.border};border-radius:10px;">
      <tr>
        <td align="center" style="padding:22px 18px;font-family:${FONT};">
          <div style="font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${BRAND.muted};margin:0 0 6px 0;">
            ${esc(block.label)}
          </div>
          <div class="amount-value" style="font-size:30px;line-height:1.15;font-weight:700;color:${color};">
            ${esc(block.value)}
          </div>
          ${
            block.caption
              ? `<div style="font-size:13px;line-height:1.5;color:${BRAND.body};margin:6px 0 0 0;">${esc(block.caption)}</div>`
              : ''
          }
        </td>
      </tr>
    </table>
  </td>
</tr>`;
};

const renderList = (block: Extract<EmailBlock, { type: 'list' }>): string => {
  const tag = block.ordered ? 'ol' : 'ul';
  const items = block.items
    .map((item) => {
      const content =
        typeof item === 'string'
          ? escMultiline(item)
          : `<strong style="color:${BRAND.ink};">${esc(item.term)}</strong> — ${escMultiline(item.description)}`;
      return `<li style="margin:0 0 8px 0;">${content}</li>`;
    })
    .join('');

  return `
<tr>
  <td style="padding:0 0 18px 0;font-family:${FONT};font-size:15px;line-height:1.65;color:${BRAND.body};">
    <${tag} style="margin:0;padding:0 0 0 20px;">${items}</${tag}>
  </td>
</tr>`;
};

const renderQuote = (block: Extract<EmailBlock, { type: 'quote' }>): string => `
<tr>
  <td style="padding:0 0 20px 0;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td style="border-left:3px solid ${BRAND.primary};padding:2px 0 2px 16px;font-family:${FONT};">
          <div style="font-size:15px;line-height:1.65;color:${BRAND.body};font-style:italic;">${escMultiline(block.body)}</div>
          ${
            block.attribution
              ? `<div style="font-size:13px;color:${BRAND.muted};margin:8px 0 0 0;">— ${esc(block.attribution)}</div>`
              : ''
          }
        </td>
      </tr>
    </table>
  </td>
</tr>`;

/** Reference numbers, transaction ids, checksums. */
const renderCode = (block: Extract<EmailBlock, { type: 'code' }>): string => `
<tr>
  <td style="padding:0 0 20px 0;">
    ${
      block.label
        ? `<div style="font-family:${FONT};font-size:12px;font-weight:600;color:${BRAND.muted};margin:0 0 6px 0;">${esc(block.label)}</div>`
        : ''
    }
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
           style="background-color:${BRAND.subtle};border:1px solid ${BRAND.border};border-radius:8px;">
      <tr>
        <td style="padding:12px 14px;font-family:ui-monospace,'SF Mono',Menlo,Consolas,monospace;font-size:13px;line-height:1.5;color:${BRAND.ink};word-break:break-all;">
          ${esc(block.value)}
        </td>
      </tr>
    </table>
  </td>
</tr>`;

const renderDivider = (): string => `
<tr>
  <td style="padding:4px 0 20px 0;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr><td style="border-top:1px solid ${BRAND.border};font-size:0;line-height:0;">&nbsp;</td></tr>
    </table>
  </td>
</tr>`;

const renderSpacer = (block: Extract<EmailBlock, { type: 'spacer' }>): string =>
  `<tr><td style="font-size:0;line-height:0;height:${block.size ?? 8}px;">&nbsp;</td></tr>`;

const renderBlock = (block: EmailBlock): string => {
  switch (block.type) {
    case 'text': return renderText(block);
    case 'heading': return renderHeading(block);
    case 'button': return renderButton(block);
    case 'facts': return renderFacts(block);
    case 'callout': return renderCallout(block);
    case 'amount': return renderAmount(block);
    case 'list': return renderList(block);
    case 'quote': return renderQuote(block);
    case 'code': return renderCode(block);
    case 'divider': return renderDivider();
    case 'spacer': return renderSpacer(block);
    case 'rawHtml': return `<tr><td style="padding:0 0 16px 0;font-family:${FONT};font-size:15px;line-height:1.65;color:${BRAND.body};">${block.html}</td></tr>`;
  }
};

// ── Document ────────────────────────────────────────────────────────────────

export interface EmailDocument {
  /** Inbox preview line. Without it clients show the first body words. */
  preheader: string;
  /** The one-line answer to "what is this about?". */
  heading: string;
  /** Optional line under the heading. */
  subheading?: string;
  blocks: EmailBlock[];
  /** Sender identity for the footer. */
  brandName?: string;
  logoUrl?: string;
  /** Why this person is receiving it — expected on transactional mail. */
  footerNote?: string;
  /** Extra footer lines, e.g. postal address. */
  footerLines?: string[];
  /**
   * Whether to print the "don't reply" notice. False for mail a person
   * actually wrote — telling a client not to reply to a personal message is
   * both rude and, in this product, wrong: replies go to a real mailbox.
   */
  automated?: boolean;
}

const logoBlock = (brandName: string, logoUrl?: string): string => {
  if (logoUrl && /^https?:\/\//i.test(logoUrl)) {
    return `<img src="${esc(logoUrl)}" width="150" alt="${esc(brandName)}"
        style="display:block;border:0;outline:none;text-decoration:none;height:auto;max-width:150px;" />`;
  }

  // No reachable image — a styled wordmark still reads as branded, and never
  // shows a broken-image icon in the client's inbox.
  return `<div style="font-family:${FONT};font-size:19px;font-weight:700;color:${BRAND.ink};letter-spacing:-0.01em;">
      ${esc(brandName)}
    </div>`;
};

/**
 * Renders a complete, standalone email document.
 *
 * The result is self-contained HTML with no external CSS and one optional
 * image, so it renders identically whether the client loads remote content or
 * not.
 */
export const renderEmail = (doc: EmailDocument): string => {
  const brandName = doc.brandName ?? env.APP_NAME;
  const logoUrl = doc.logoUrl ?? env.mailLogoUrl;
  const body = doc.blocks.map(renderBlock).join('');

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no" />
  <!-- Declares a light-only design so Gmail and Outlook don't auto-invert the card. -->
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${esc(doc.heading)}</title>

  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings>
    <o:PixelsPerInch>96</o:PixelsPerInch>
  </o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->

  <style type="text/css">
    /* Progressive enhancement only — the inline styles above already work. */
    body { margin:0 !important; padding:0 !important; width:100% !important; }
    table { border-collapse:collapse !important; }
    img { -ms-interpolation-mode:bicubic; }

    /* Some clients underline and recolour anything that looks like a link. */
    a[x-apple-data-detectors] {
      color:inherit !important; text-decoration:none !important;
      font-size:inherit !important; font-family:inherit !important; font-weight:inherit !important;
    }

    @media only screen and (max-width:620px) {
      .container { width:100% !important; }
      .gutter { padding-left:20px !important; padding-right:20px !important; }
      .stack { display:block !important; width:100% !important; }
      .amount-value { font-size:26px !important; }
      /* Long values wrap under their label instead of squeezing on a phone. */
      .fact-label, .fact-value {
        display:block !important; width:100% !important;
        text-align:left !important; white-space:normal !important;
        padding-right:0 !important;
      }
      .fact-value { padding-top:2px !important; padding-bottom:6px !important; }
    }

    /* Keep the card white even where the client forces a dark palette. */
    @media (prefers-color-scheme: dark) {
      .force-light { background-color:${BRAND.surface} !important; }
      .force-light-page { background-color:${BRAND.surface} !important; }
    }
    [data-ogsc] .force-light { background-color:${BRAND.surface} !important; }
  </style>
</head>
<body class="force-light-page" style="margin:0;padding:0;background-color:${BRAND.surface};">
  <!-- Preview text: shown in the inbox list, hidden in the message body. -->
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">
    ${esc(doc.preheader)}
    <!-- Padding stops the client from pulling body copy into the preview. -->
    ${'&#847;&zwnj;&nbsp;'.repeat(60)}
  </div>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
         class="force-light-page" style="background-color:${BRAND.surface};">
    <tr>
      <td align="center" style="padding:32px 12px;">

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600"
               class="container force-light"
               style="width:600px;max-width:600px;background-color:${BRAND.surface};border:1px solid ${BRAND.border};border-radius:14px;">

          <!-- Logo -->
          <tr>
            <td class="gutter" style="padding:28px 32px 0 32px;">
              ${logoBlock(brandName, logoUrl)}
            </td>
          </tr>

          <!-- Heading. Omitted entirely when blank, so a message that is all
               body copy doesn't open with a band of empty space. -->
          ${
            doc.heading
              ? `<tr>
            <td class="gutter" style="padding:22px 32px 0 32px;">
              <h1 style="margin:0;font-family:${FONT};font-size:23px;line-height:1.3;font-weight:700;color:${BRAND.ink};letter-spacing:-0.01em;">
                ${esc(doc.heading)}
              </h1>
              ${
                doc.subheading
                  ? `<p style="margin:8px 0 0 0;font-family:${FONT};font-size:15px;line-height:1.6;color:${BRAND.muted};">${esc(doc.subheading)}</p>`
                  : ''
              }
            </td>
          </tr>`
              : ''
          }

          <!-- Body -->
          <tr>
            <td class="gutter" style="padding:${doc.heading ? '24px' : '22px'} 32px 4px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                ${body}
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td class="gutter" style="padding:8px 32px 28px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="border-top:1px solid ${BRAND.border};padding:18px 0 0 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${BRAND.muted};">
                    <strong style="color:${BRAND.body};">${esc(brandName)}</strong><br />
                    ${esc(doc.footerNote ?? 'You received this because you are part of this project.')}
                    ${
                      doc.footerLines?.length
                        ? `<br />${doc.footerLines.map((line) => esc(line)).join('<br />')}`
                        : ''
                    }
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        ${
          doc.automated === false
            ? ''
            : `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600"
               class="container" style="width:600px;max-width:600px;">
          <tr>
            <td align="center" style="padding:16px 20px 0 20px;font-family:${FONT};font-size:11px;line-height:1.6;color:${BRAND.muted};">
              This message was sent automatically. Replies go to our team.
            </td>
          </tr>
        </table>`
        }

      </td>
    </tr>
  </table>
</body>
</html>`;
};

/**
 * Plain-text alternative.
 *
 * Multipart mail with a real text part lands in the inbox more often than
 * HTML-only, and it is the only version some accessibility tools read.
 */
export const renderPlainText = (doc: EmailDocument): string => {
  const lines: string[] = doc.heading
    ? [doc.heading, '='.repeat(Math.min(doc.heading.length, 60)), '']
    : [];
  if (doc.subheading) lines.push(doc.subheading, '');

  for (const block of doc.blocks) {
    switch (block.type) {
      case 'text':
        lines.push(block.content, '');
        break;
      case 'heading':
        lines.push(block.content.toUpperCase(), '');
        break;
      case 'button':
        lines.push(`${block.label}: ${block.url}`, '');
        break;
      case 'facts':
        for (const row of block.rows) lines.push(`${row.label}: ${row.value}`);
        lines.push('');
        break;
      case 'callout':
        if (block.title) lines.push(block.title);
        lines.push(block.body, '');
        break;
      case 'amount':
        lines.push(`${block.label}: ${block.value}`);
        if (block.caption) lines.push(block.caption);
        lines.push('');
        break;
      case 'list':
        block.items.forEach((item, index) => {
          const text = typeof item === 'string' ? item : `${item.term} — ${item.description}`;
          lines.push(`${block.ordered ? `${index + 1}.` : '-'} ${text}`);
        });
        lines.push('');
        break;
      case 'quote':
        lines.push(`"${block.body}"`);
        if (block.attribution) lines.push(`  — ${block.attribution}`);
        lines.push('');
        break;
      case 'code':
        if (block.label) lines.push(block.label);
        lines.push(block.value, '');
        break;
      case 'divider':
        lines.push('---', '');
        break;
      case 'rawHtml':
        lines.push(
          block.html
            .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<[^>]*>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .trim(),
          '',
        );
        break;
      case 'spacer':
        break;
    }
  }

  lines.push('', '--', doc.brandName ?? env.APP_NAME);
  if (doc.footerNote) lines.push(doc.footerNote);

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
};
