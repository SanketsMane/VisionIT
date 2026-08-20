import { amountToWords, formatCurrency } from '@utils/money.util';
import { formatDate } from '@utils/date.util';
import type { TaxBreakdownRow } from './invoices.calculator';

export type TemplateKey = 'modern' | 'classic' | 'minimal' | 'corporate' | 'creative';

export interface RenderableParty {
  name: string;
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  addressLines: string[];
  taxLabel?: string | null;
  taxNumber?: string | null;
  logoUrl?: string | null;
}

export interface RenderableItem {
  title: string;
  description?: string | null;
  hsnSac?: string | null;
  quantity: number;
  unit: string;
  unitPrice: number;
  discountPercent: number;
  taxRate: number;
  lineTotal: number;
}

export interface RenderableInvoice {
  number: string;
  documentType: string;
  status: string;
  currency: string;
  issueDate: Date | string;
  dueDate: Date | string;
  poNumber?: string | null;

  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  shippingAmount: number;
  roundOff: number;
  total: number;
  amountPaid: number;
  balanceDue: number;

  notes?: string | null;
  terms?: string | null;
  templateKey: TemplateKey;
  accentColor: string;

  seller: RenderableParty;
  buyer: RenderableParty;
  items: RenderableItem[];
  taxBreakdown: TaxBreakdownRow[];

  bank?: {
    bankName?: string | null;
    accountName?: string | null;
    accountNumber?: string | null;
    ifsc?: string | null;
    swift?: string | null;
    upiId?: string | null;
  } | null;

  signatureUrl?: string | null;
  footerNote?: string | null;
  publicUrl?: string | null;
}

/** Escapes untrusted user text before it is interpolated into the document. */
const esc = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** Preserves author line breaks in notes/terms without allowing raw HTML. */
const escMultiline = (value: unknown): string => esc(value).replace(/\n/g, '<br/>');

const hexToRgb = (hex: string): [number, number, number] => {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
};

const tint = (hex: string, alpha: number): string => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/** Picks black or white body text for a filled accent block, per WCAG luminance. */
const readableOn = (hex: string): string => {
  const [r, g, b] = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#0f172a' : '#ffffff';
};

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  DRAFT: { bg: '#e2e8f0', fg: '#475569' },
  SENT: { bg: '#dbeafe', fg: '#1d4ed8' },
  VIEWED: { bg: '#e0e7ff', fg: '#4338ca' },
  PARTIALLY_PAID: { bg: '#fef3c7', fg: '#b45309' },
  PAID: { bg: '#dcfce7', fg: '#15803d' },
  OVERDUE: { bg: '#fee2e2', fg: '#b91c1c' },
  CANCELLED: { bg: '#f1f5f9', fg: '#64748b' },
  WRITTEN_OFF: { bg: '#f1f5f9', fg: '#64748b' },
};

const DOC_TITLES: Record<string, string> = {
  INVOICE: 'Invoice',
  QUOTATION: 'Quotation',
  PROFORMA: 'Proforma Invoice',
  CREDIT_NOTE: 'Credit Note',
};

/**
 * Per-template design tokens. All five share one HTML skeleton so the layout
 * logic exists once; only typography, rhythm and ornamentation change.
 */
interface Theme {
  fontStack: string;
  headingWeight: number;
  headerLayout: 'band' | 'split' | 'stacked' | 'sidebar';
  tableHeadFill: string;
  tableHeadColor: string;
  radius: string;
  uppercaseLabels: boolean;
  letterSpacing: string;
  showAccentBar: boolean;
  bodyColor: string;
  mutedColor: string;
  borderColor: string;
  pageBackground: string;
  cardBackground: string;
}

const buildTheme = (key: TemplateKey, accent: string): Theme => {
  const base: Theme = {
    fontStack: `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`,
    headingWeight: 700,
    headerLayout: 'split',
    tableHeadFill: tint(accent, 0.08),
    tableHeadColor: '#0f172a',
    radius: '10px',
    uppercaseLabels: true,
    letterSpacing: '0.06em',
    showAccentBar: true,
    bodyColor: '#0f172a',
    mutedColor: '#64748b',
    borderColor: '#e2e8f0',
    pageBackground: '#ffffff',
    cardBackground: '#f8fafc',
  };

  switch (key) {
    case 'classic':
      return {
        ...base,
        fontStack: `Georgia, 'Times New Roman', 'Noto Serif', serif`,
        headerLayout: 'stacked',
        tableHeadFill: '#0f172a',
        tableHeadColor: '#ffffff',
        radius: '0px',
        showAccentBar: false,
        letterSpacing: '0.08em',
      };
    case 'minimal':
      return {
        ...base,
        headingWeight: 600,
        tableHeadFill: 'transparent',
        radius: '0px',
        showAccentBar: false,
        uppercaseLabels: false,
        letterSpacing: '0',
        cardBackground: '#ffffff',
        borderColor: '#e5e7eb',
      };
    case 'corporate':
      return {
        ...base,
        headerLayout: 'band',
        tableHeadFill: accent,
        tableHeadColor: readableOn(accent),
        radius: '4px',
      };
    case 'creative':
      return {
        ...base,
        headerLayout: 'sidebar',
        headingWeight: 800,
        radius: '18px',
        tableHeadFill: tint(accent, 0.12),
        cardBackground: tint(accent, 0.05),
      };
    default:
      return base;
  }
};

const partyBlock = (party: RenderableParty, theme: Theme): string => `
  <div class="party">
    <div class="party-name">${esc(party.companyName || party.name)}</div>
    ${party.companyName && party.name !== party.companyName ? `<div class="party-line">${esc(party.name)}</div>` : ''}
    ${party.addressLines.filter(Boolean).map((line) => `<div class="party-line">${esc(line)}</div>`).join('')}
    ${party.phone ? `<div class="party-line">${esc(party.phone)}</div>` : ''}
    ${party.email ? `<div class="party-line">${esc(party.email)}</div>` : ''}
    ${party.website ? `<div class="party-line">${esc(party.website)}</div>` : ''}
    ${party.taxNumber ? `<div class="party-line strong">${esc(party.taxLabel || 'Tax ID')}: ${esc(party.taxNumber)}</div>` : ''}
  </div>
`.trim();

const headerBlock = (invoice: RenderableInvoice, theme: Theme): string => {
  const title = DOC_TITLES[invoice.documentType] ?? 'Invoice';
  const status = STATUS_COLORS[invoice.status] ?? STATUS_COLORS.DRAFT;

  const brand = `
    <div class="brand">
      ${invoice.seller.logoUrl ? `<img class="logo" src="${esc(invoice.seller.logoUrl)}" alt="" />` : `<div class="logo-fallback">${esc((invoice.seller.companyName || invoice.seller.name).slice(0, 2).toUpperCase())}</div>`}
      <div>
        <div class="brand-name">${esc(invoice.seller.companyName || invoice.seller.name)}</div>
        ${invoice.seller.website ? `<div class="brand-sub">${esc(invoice.seller.website)}</div>` : ''}
      </div>
    </div>`;

  const meta = `
    <div class="doc-meta">
      <div class="doc-title">${esc(title)}</div>
      <div class="doc-number">${esc(invoice.number)}</div>
      <span class="status-pill" style="background:${status.bg};color:${status.fg};">${esc(invoice.status.replace(/_/g, ' '))}</span>
    </div>`;

  return `<header class="doc-header layout-${theme.headerLayout}">${brand}${meta}</header>`;
};

const itemsTable = (invoice: RenderableInvoice): string => {
  const showHsn = invoice.items.some((i) => i.hsnSac);
  const showDiscount = invoice.items.some((i) => i.discountPercent > 0);
  const showTax = invoice.items.some((i) => i.taxRate > 0);

  const head = `
    <tr>
      <th class="col-idx">#</th>
      <th class="col-desc">Description</th>
      ${showHsn ? '<th class="col-hsn">HSN/SAC</th>' : ''}
      <th class="num col-qty">Qty</th>
      <th class="num col-rate">Rate</th>
      ${showDiscount ? '<th class="num col-disc">Disc %</th>' : ''}
      ${showTax ? '<th class="num col-tax">Tax %</th>' : ''}
      <th class="num col-amt">Amount</th>
    </tr>`;

  const rows = invoice.items
    .map(
      (item, index) => `
    <tr>
      <td class="col-idx">${index + 1}</td>
      <td class="col-desc">
        <div class="item-title">${esc(item.title)}</div>
        ${item.description ? `<div class="item-desc">${escMultiline(item.description)}</div>` : ''}
      </td>
      ${showHsn ? `<td class="col-hsn">${esc(item.hsnSac || '—')}</td>` : ''}
      <td class="num">${item.quantity % 1 === 0 ? item.quantity : item.quantity.toFixed(2)} ${esc(item.unit)}</td>
      <td class="num">${formatCurrency(item.unitPrice, invoice.currency)}</td>
      ${showDiscount ? `<td class="num">${item.discountPercent > 0 ? `${item.discountPercent}%` : '—'}</td>` : ''}
      ${showTax ? `<td class="num">${item.taxRate > 0 ? `${item.taxRate}%` : '—'}</td>` : ''}
      <td class="num strong">${formatCurrency(item.lineTotal, invoice.currency)}</td>
    </tr>`,
    )
    .join('');

  return `<table class="items"><thead>${head}</thead><tbody>${rows}</tbody></table>`;
};

const totalsBlock = (invoice: RenderableInvoice): string => {
  const row = (label: string, value: number, options: { strong?: boolean; muted?: boolean } = {}) => `
    <div class="total-row${options.strong ? ' strong' : ''}${options.muted ? ' muted' : ''}">
      <span>${esc(label)}</span>
      <span>${formatCurrency(value, invoice.currency)}</span>
    </div>`;

  return `
    <div class="totals">
      ${row('Subtotal', invoice.subtotal)}
      ${invoice.discountAmount > 0 ? row('Discount', -invoice.discountAmount, { muted: true }) : ''}
      ${invoice.taxAmount > 0 ? row('Tax', invoice.taxAmount) : ''}
      ${invoice.shippingAmount > 0 ? row('Shipping', invoice.shippingAmount) : ''}
      ${invoice.roundOff !== 0 ? row('Round off', invoice.roundOff, { muted: true }) : ''}
      <div class="total-row grand"><span>Total</span><span>${formatCurrency(invoice.total, invoice.currency)}</span></div>
      ${invoice.amountPaid > 0 ? row('Amount paid', -invoice.amountPaid, { muted: true }) : ''}
      ${invoice.amountPaid > 0 ? `<div class="total-row due"><span>Balance due</span><span>${formatCurrency(invoice.balanceDue, invoice.currency)}</span></div>` : ''}
    </div>`;
};

const taxSummary = (invoice: RenderableInvoice): string => {
  if (!invoice.taxBreakdown.length) return '';
  const isIgst = invoice.taxBreakdown.some((t) => t.igst > 0);

  return `
    <div class="tax-summary">
      <div class="section-label">Tax summary</div>
      <table class="tax-table">
        <thead>
          <tr>
            <th>Rate</th><th class="num">Taxable value</th>
            ${isIgst ? '<th class="num">IGST</th>' : '<th class="num">CGST</th><th class="num">SGST</th>'}
            <th class="num">Total tax</th>
          </tr>
        </thead>
        <tbody>
          ${invoice.taxBreakdown
            .map(
              (row) => `
            <tr>
              <td>${row.rate}%</td>
              <td class="num">${formatCurrency(row.taxableAmount, invoice.currency)}</td>
              ${isIgst
                ? `<td class="num">${formatCurrency(row.igst, invoice.currency)}</td>`
                : `<td class="num">${formatCurrency(row.cgst, invoice.currency)}</td><td class="num">${formatCurrency(row.sgst, invoice.currency)}</td>`}
              <td class="num strong">${formatCurrency(row.total, invoice.currency)}</td>
            </tr>`,
            )
            .join('')}
        </tbody>
      </table>
    </div>`;
};

const bankBlock = (invoice: RenderableInvoice): string => {
  const bank = invoice.bank;
  if (!bank || !(bank.bankName || bank.accountNumber || bank.upiId)) return '';

  const line = (label: string, value?: string | null) =>
    value ? `<div class="kv"><span>${esc(label)}</span><span>${esc(value)}</span></div>` : '';

  return `
    <div class="panel">
      <div class="section-label">Payment details</div>
      ${line('Bank', bank.bankName)}
      ${line('Account name', bank.accountName)}
      ${line('Account no.', bank.accountNumber)}
      ${line('IFSC', bank.ifsc)}
      ${line('SWIFT', bank.swift)}
      ${line('UPI', bank.upiId)}
    </div>`;
};

const styles = (theme: Theme, accent: string): string => `
  @page { size: A4; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: ${theme.fontStack};
    font-size: 11px;
    line-height: 1.55;
    color: ${theme.bodyColor};
    background: ${theme.pageBackground};
    -webkit-font-smoothing: antialiased;
  }
  .sheet { max-width: 820px; margin: 0 auto; padding: 8px 0 0; }
  .accent-bar { height: 5px; background: ${accent}; border-radius: 99px; margin-bottom: 22px; }

  .doc-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; margin-bottom: 26px; }
  .doc-header.layout-stacked { flex-direction: column; align-items: flex-start; gap: 14px; border-bottom: 2px solid ${theme.bodyColor}; padding-bottom: 16px; }
  .doc-header.layout-band { background: ${accent}; color: ${readableOn(accent)}; padding: 20px 22px; border-radius: ${theme.radius}; }
  .doc-header.layout-band .brand-sub, .doc-header.layout-band .doc-number { color: ${tint(readableOn(accent) === '#ffffff' ? '#ffffff' : '#0f172a', 0.75)}; }
  .doc-header.layout-band .doc-title { color: ${readableOn(accent)}; }
  .doc-header.layout-sidebar { border-left: 6px solid ${accent}; padding-left: 18px; }

  .brand { display: flex; align-items: center; gap: 12px; }
  .logo { height: 46px; width: auto; max-width: 170px; object-fit: contain; }
  .logo-fallback {
    height: 46px; width: 46px; border-radius: ${theme.radius};
    background: ${accent}; color: ${readableOn(accent)};
    display: flex; align-items: center; justify-content: center;
    font-weight: 800; font-size: 16px; letter-spacing: 0.02em;
  }
  .brand-name { font-size: 16px; font-weight: ${theme.headingWeight}; letter-spacing: -0.01em; }
  .brand-sub { font-size: 10.5px; color: ${theme.mutedColor}; }

  .doc-meta { text-align: right; }
  .doc-header.layout-stacked .doc-meta, .doc-header.layout-sidebar .doc-meta { text-align: left; }
  .doc-title {
    font-size: 26px; font-weight: ${theme.headingWeight}; letter-spacing: -0.02em;
    color: ${theme.headerLayout === 'band' ? 'inherit' : accent};
    line-height: 1.1;
  }
  .doc-number { font-size: 12px; color: ${theme.mutedColor}; font-variant-numeric: tabular-nums; margin-top: 2px; }
  .status-pill {
    display: inline-block; margin-top: 8px; padding: 3px 10px; border-radius: 99px;
    font-size: 9px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
  }

  .meta-grid { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
  .meta-card {
    flex: 1 1 150px; background: ${theme.cardBackground};
    border: 1px solid ${theme.borderColor}; border-radius: ${theme.radius}; padding: 10px 12px;
  }
  .meta-card .label { font-size: 8.5px; color: ${theme.mutedColor}; ${theme.uppercaseLabels ? 'text-transform: uppercase;' : ''} letter-spacing: ${theme.letterSpacing}; font-weight: 700; }
  .meta-card .value { font-size: 12px; font-weight: 600; margin-top: 3px; font-variant-numeric: tabular-nums; }

  .parties { display: flex; gap: 28px; margin-bottom: 22px; }
  .parties > div { flex: 1; }
  .section-label {
    font-size: 8.5px; font-weight: 700; color: ${theme.mutedColor};
    ${theme.uppercaseLabels ? 'text-transform: uppercase;' : ''} letter-spacing: ${theme.letterSpacing};
    margin-bottom: 6px;
  }
  .party-name { font-size: 13px; font-weight: ${theme.headingWeight}; margin-bottom: 2px; }
  .party-line { font-size: 10.5px; color: #475569; }
  .party-line.strong { color: ${theme.bodyColor}; font-weight: 600; margin-top: 3px; }

  table { width: 100%; border-collapse: collapse; }
  .items { margin-bottom: 18px; }
  .items thead th {
    background: ${theme.tableHeadFill}; color: ${theme.tableHeadColor};
    font-size: 8.5px; font-weight: 700; ${theme.uppercaseLabels ? 'text-transform: uppercase;' : ''}
    letter-spacing: ${theme.letterSpacing}; text-align: left;
    padding: 9px 8px; border-bottom: 1.5px solid ${theme.headerLayout === 'band' ? accent : theme.borderColor};
  }
  .items tbody td { padding: 10px 8px; border-bottom: 1px solid ${theme.borderColor}; vertical-align: top; }
  .items tbody tr:last-child td { border-bottom: 1.5px solid ${theme.borderColor}; }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .strong { font-weight: 700; }
  .col-idx { width: 26px; color: ${theme.mutedColor}; }
  .col-desc { width: 40%; }
  .item-title { font-weight: 600; }
  .item-desc { font-size: 10px; color: ${theme.mutedColor}; margin-top: 2px; }

  .summary-row { display: flex; gap: 24px; align-items: flex-start; margin-bottom: 18px; }
  .summary-left { flex: 1.15; }
  .totals { flex: 0 0 250px; }
  .total-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 11px; font-variant-numeric: tabular-nums; }
  .total-row.muted { color: ${theme.mutedColor}; }
  .total-row.grand {
    margin-top: 6px; padding: 10px 12px; font-size: 14px; font-weight: 800;
    background: ${theme.headerLayout === 'band' || theme.headerLayout === 'sidebar' ? tint(accent, 0.1) : theme.cardBackground};
    border-top: 2px solid ${accent}; border-radius: ${theme.radius};
  }
  .total-row.due { margin-top: 4px; padding: 8px 12px; font-weight: 800; color: ${accent}; background: ${tint(accent, 0.08)}; border-radius: ${theme.radius}; }

  .amount-words { font-size: 10.5px; margin-bottom: 16px; padding: 9px 12px; background: ${theme.cardBackground}; border-left: 3px solid ${accent}; border-radius: ${theme.radius}; }
  .amount-words .section-label { margin-bottom: 2px; }

  .tax-summary { margin-bottom: 16px; }
  .tax-table th { font-size: 8.5px; color: ${theme.mutedColor}; text-align: left; padding: 6px 8px; border-bottom: 1px solid ${theme.borderColor}; ${theme.uppercaseLabels ? 'text-transform: uppercase;' : ''} letter-spacing: ${theme.letterSpacing}; }
  .tax-table td { padding: 6px 8px; border-bottom: 1px solid ${theme.borderColor}; font-size: 10.5px; }

  .panels { display: flex; gap: 16px; margin-bottom: 18px; }
  .panel { flex: 1; background: ${theme.cardBackground}; border: 1px solid ${theme.borderColor}; border-radius: ${theme.radius}; padding: 12px 14px; }
  .kv { display: flex; justify-content: space-between; gap: 12px; font-size: 10.5px; padding: 2px 0; }
  .kv span:first-child { color: ${theme.mutedColor}; }
  .kv span:last-child { font-weight: 600; text-align: right; }
  .panel p { margin: 0; font-size: 10.5px; color: #475569; }

  .signature { text-align: right; margin-top: 26px; }
  .signature img { height: 48px; object-fit: contain; }
  .signature .line { margin-top: 6px; border-top: 1px solid ${theme.borderColor}; padding-top: 5px; display: inline-block; min-width: 170px; font-size: 10px; color: ${theme.mutedColor}; }

  .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid ${theme.borderColor}; text-align: center; font-size: 9.5px; color: ${theme.mutedColor}; }
  .footer a { color: ${accent}; text-decoration: none; }

  /* Keep a line item and its totals from being split across a page break. */
  tr, .panel, .totals, .amount-words { page-break-inside: avoid; }
  thead { display: table-header-group; }
`;

/**
 * Renders a complete, self-contained invoice document.
 *
 * The output is standalone HTML with inlined CSS and no external requests, so
 * the same string can be shown in the browser preview, emailed as an HTML
 * part, or handed to the PDF renderer with identical results.
 */
export const renderInvoiceHtml = (invoice: RenderableInvoice): string => {
  const accent = /^#[0-9A-Fa-f]{6}$/.test(invoice.accentColor) ? invoice.accentColor : '#0076FF';
  const theme = buildTheme(invoice.templateKey, accent);
  const title = DOC_TITLES[invoice.documentType] ?? 'Invoice';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)} ${esc(invoice.number)}</title>
<style>${styles(theme, accent)}</style>
</head>
<body>
<div class="sheet">
  ${theme.showAccentBar ? '<div class="accent-bar"></div>' : ''}
  ${headerBlock(invoice, theme)}

  <div class="meta-grid">
    <div class="meta-card"><div class="label">Issue date</div><div class="value">${esc(formatDate(invoice.issueDate))}</div></div>
    <div class="meta-card"><div class="label">${invoice.documentType === 'QUOTATION' ? 'Valid until' : 'Due date'}</div><div class="value">${esc(formatDate(invoice.dueDate))}</div></div>
    ${invoice.poNumber ? `<div class="meta-card"><div class="label">PO number</div><div class="value">${esc(invoice.poNumber)}</div></div>` : ''}
    <div class="meta-card"><div class="label">${invoice.amountPaid > 0 ? 'Balance due' : 'Amount due'}</div><div class="value">${formatCurrency(invoice.balanceDue, invoice.currency)}</div></div>
  </div>

  <div class="parties">
    <div><div class="section-label">From</div>${partyBlock(invoice.seller, theme)}</div>
    <div><div class="section-label">Bill to</div>${partyBlock(invoice.buyer, theme)}</div>
  </div>

  ${itemsTable(invoice)}

  <div class="summary-row">
    <div class="summary-left">
      <div class="amount-words">
        <div class="section-label">Amount in words</div>
        ${esc(amountToWords(invoice.total, invoice.currency))}
      </div>
      ${taxSummary(invoice)}
    </div>
    ${totalsBlock(invoice)}
  </div>

  <div class="panels">
    ${bankBlock(invoice)}
    ${invoice.notes || invoice.terms
      ? `<div class="panel">
          ${invoice.notes ? `<div class="section-label">Notes</div><p>${escMultiline(invoice.notes)}</p>` : ''}
          ${invoice.terms ? `<div class="section-label" style="margin-top:${invoice.notes ? '10px' : '0'}">Terms &amp; conditions</div><p>${escMultiline(invoice.terms)}</p>` : ''}
        </div>`
      : ''}
  </div>

  <div class="signature">
    ${invoice.signatureUrl ? `<img src="${esc(invoice.signatureUrl)}" alt="" /><br/>` : ''}
    <div class="line">For ${esc(invoice.seller.companyName || invoice.seller.name)}</div>
  </div>

  <div class="footer">
    ${invoice.footerNote ? `${escMultiline(invoice.footerNote)}<br/>` : ''}
    ${invoice.publicUrl ? `View this ${esc(title.toLowerCase())} online: <a href="${esc(invoice.publicUrl)}">${esc(invoice.publicUrl)}</a><br/>` : ''}
    This is a computer-generated document.
  </div>
</div>
</body>
</html>`;
};

export const TEMPLATE_CATALOG: { key: TemplateKey; name: string; description: string }[] = [
  { key: 'modern', name: 'Modern', description: 'Accent bar, rounded cards and a clean sans-serif — the safe default.' },
  { key: 'classic', name: 'Classic', description: 'Serif typography with a solid dark header row. Formal and traditional.' },
  { key: 'minimal', name: 'Minimal', description: 'No fills, hairline rules, generous whitespace. Understated and print-friendly.' },
  { key: 'corporate', name: 'Corporate', description: 'Full-width branded header band in your accent colour.' },
  { key: 'creative', name: 'Creative', description: 'Bold weights, soft tints and a side accent rail for studios and agencies.' },
];
