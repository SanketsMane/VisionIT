import type { Browser } from 'puppeteer';
import { logger } from '@config/logger';
import { env } from '@config/env';
import { ApiError } from '@utils/api-error';
import { toNumber } from '@utils/money.util';
import { buildTaxBreakdown, calculateLines } from './invoices.calculator';
import { renderInvoiceHtml, type RenderableInvoice, type RenderableParty, type TemplateKey } from './invoices.template';

/**
 * Chromium is expensive to start, so one browser instance is shared and lazily
 * launched on first use. Importing puppeteer lazily also means the API boots
 * fine on hosts where Chromium was never downloaded — PDF endpoints fail with
 * a clear 503 instead of the whole process refusing to start.
 */
let browserPromise: Promise<Browser> | null = null;

const getBrowser = async (): Promise<Browser> => {
  if (!browserPromise) {
    browserPromise = (async () => {
      const puppeteer = await import('puppeteer');
      return puppeteer.default.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
      });
    })().catch((error: unknown) => {
      browserPromise = null;
      throw error;
    });
  }
  return browserPromise;
};

export const closePdfBrowser = async (): Promise<void> => {
  if (!browserPromise) return;
  try {
    const browser = await browserPromise;
    await browser.close();
  } catch (error) {
    logger.warn('Failed to close PDF browser cleanly', { error: String(error) });
  } finally {
    browserPromise = null;
  }
};

export const renderPdf = async (html: string): Promise<Buffer> => {
  let browser: Browser;
  try {
    browser = await getBrowser();
  } catch (error) {
    logger.error('Could not launch Chromium for PDF rendering', { error: String(error) });
    throw ApiError.serviceUnavailable(
      'PDF rendering is unavailable — Chromium could not be launched. Run `npx puppeteer browsers install chrome` on the server.',
    );
  }

  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'load', timeout: 30_000 });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '14mm', bottom: '14mm', left: '12mm', right: '12mm' },
    });
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
};

type InvoiceWithRelations = {
  number: string;
  documentType: string;
  status: string;
  currency: string;
  issueDate: Date;
  dueDate: Date;
  poNumber: string | null;
  subtotal: unknown;
  discountAmount: unknown;
  taxAmount: unknown;
  shippingAmount: unknown;
  roundOff: unknown;
  total: unknown;
  amountPaid: unknown;
  balanceDue: unknown;
  isInterState: boolean;
  notes: string | null;
  terms: string | null;
  templateKey: string;
  accentColor: string;
  publicToken: string | null;
  items: {
    title: string; description: string | null; hsnSac: string | null;
    quantity: unknown; unit: string; unitPrice: unknown;
    discountPercent: unknown; taxRate: unknown; lineTotal: unknown; sortOrder: number;
  }[];
  client: {
    name: string; companyName: string | null; email: string | null; phone: string | null;
    website: string | null; taxNumber: string | null;
    billingAddressLine1: string | null; billingAddressLine2: string | null;
    billingCity: string | null; billingState: string | null;
    billingPostalCode: string | null; billingCountry: string | null;
  };
  user: {
    name: string; email: string;
    company: {
      legalName: string; tradeName: string | null; logoUrl: string | null; signatureUrl: string | null;
      email: string | null; phone: string | null; website: string | null;
      addressLine1: string | null; addressLine2: string | null; city: string | null;
      state: string | null; postalCode: string | null; country: string;
      taxLabel: string | null; taxNumber: string | null;
      bankName: string | null; bankAccountName: string | null; bankAccountNumber: string | null;
      bankIfsc: string | null; bankSwift: string | null; upiId: string | null;
      invoiceFooterNote: string | null;
    } | null;
  };
};

const addressLines = (parts: (string | null | undefined)[]): string[] => {
  const [line1, line2, city, state, postal, country] = parts;
  const cityLine = [city, state, postal].filter(Boolean).join(', ');
  return [line1, line2, cityLine, country].filter((l): l is string => Boolean(l));
};

/**
 * Maps a persisted invoice onto the shape the template understands, converting
 * Decimals to numbers and recomputing the tax breakdown (which is derived, not
 * stored, so it can never go stale against the line items).
 */
export const toRenderable = (invoice: InvoiceWithRelations): RenderableInvoice => {
  const company = invoice.user.company;

  const seller: RenderableParty = {
    name: invoice.user.name,
    companyName: company?.tradeName || company?.legalName || invoice.user.name,
    email: company?.email ?? invoice.user.email,
    phone: company?.phone ?? null,
    website: company?.website ?? null,
    addressLines: addressLines([
      company?.addressLine1, company?.addressLine2, company?.city,
      company?.state, company?.postalCode, company?.country,
    ]),
    taxLabel: company?.taxLabel ?? 'GSTIN',
    taxNumber: company?.taxNumber ?? null,
    logoUrl: company?.logoUrl ?? null,
  };

  const buyer: RenderableParty = {
    name: invoice.client.name,
    companyName: invoice.client.companyName,
    email: invoice.client.email,
    phone: invoice.client.phone,
    website: invoice.client.website,
    addressLines: addressLines([
      invoice.client.billingAddressLine1, invoice.client.billingAddressLine2,
      invoice.client.billingCity, invoice.client.billingState,
      invoice.client.billingPostalCode, invoice.client.billingCountry,
    ]),
    taxLabel: 'GSTIN',
    taxNumber: invoice.client.taxNumber,
  };

  const calculated = calculateLines(
    invoice.items.map((item) => ({
      title: item.title,
      description: item.description,
      hsnSac: item.hsnSac,
      quantity: item.quantity as number,
      unit: item.unit,
      unitPrice: item.unitPrice as number,
      discountPercent: item.discountPercent as number,
      taxRate: item.taxRate as number,
      sortOrder: item.sortOrder,
    })),
  );

  return {
    number: invoice.number,
    documentType: invoice.documentType,
    status: invoice.status,
    currency: invoice.currency,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    poNumber: invoice.poNumber,

    subtotal: toNumber(invoice.subtotal as number),
    discountAmount: toNumber(invoice.discountAmount as number),
    taxAmount: toNumber(invoice.taxAmount as number),
    shippingAmount: toNumber(invoice.shippingAmount as number),
    roundOff: toNumber(invoice.roundOff as number),
    total: toNumber(invoice.total as number),
    amountPaid: toNumber(invoice.amountPaid as number),
    balanceDue: toNumber(invoice.balanceDue as number),

    notes: invoice.notes,
    terms: invoice.terms,
    templateKey: (invoice.templateKey as TemplateKey) ?? 'modern',
    accentColor: invoice.accentColor,

    seller,
    buyer,
    items: invoice.items.map((item) => ({
      title: item.title,
      description: item.description,
      hsnSac: item.hsnSac,
      quantity: toNumber(item.quantity as number),
      unit: item.unit,
      unitPrice: toNumber(item.unitPrice as number),
      discountPercent: toNumber(item.discountPercent as number),
      taxRate: toNumber(item.taxRate as number),
      lineTotal: toNumber(item.lineTotal as number),
    })),
    taxBreakdown: buildTaxBreakdown(calculated, invoice.isInterState),

    bank: company
      ? {
          bankName: company.bankName,
          accountName: company.bankAccountName,
          accountNumber: company.bankAccountNumber,
          ifsc: company.bankIfsc,
          swift: company.bankSwift,
          upiId: company.upiId,
        }
      : null,

    signatureUrl: company?.signatureUrl ?? null,
    footerNote: company?.invoiceFooterNote ?? null,
    publicUrl: invoice.publicToken ? `${env.CLIENT_URL}/invoice/${invoice.publicToken}` : null,
  };
};

export const buildInvoiceHtml = (invoice: InvoiceWithRelations): string =>
  renderInvoiceHtml(toRenderable(invoice));

export const buildInvoicePdf = (invoice: InvoiceWithRelations): Promise<Buffer> =>
  renderPdf(buildInvoiceHtml(invoice));
