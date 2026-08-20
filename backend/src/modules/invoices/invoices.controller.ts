import type { Request, Response } from 'express';
import { asyncHandler } from '@utils/async-handler';
import { sendCreated, sendPaginated, sendSuccess } from '@utils/api-response';
import { ApiError } from '@utils/api-error';
import type { AuthedRequest } from '@/types/common.types';
import { InvoicesService } from './invoices.service';
import { InvoicesModel } from './invoices.model';
import { buildInvoiceHtml, buildInvoicePdf } from './invoices.pdf';
import { TEMPLATE_CATALOG } from './invoices.template';
import { calculateTotals, type LineInput } from './invoices.calculator';

/** Loads the full relation graph the renderer needs, or 404s. */
const loadForRender = async (userId: string, id: string) => {
  const invoice = await InvoicesModel.findById(userId, id);
  if (!invoice) throw ApiError.notFound('Invoice');
  return invoice;
};

const pdfFilename = (number: string) => `${number.replace(/[^A-Za-z0-9._-]/g, '_')}.pdf`;

export const InvoicesController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    const { items, total, page, limit } = await InvoicesService.list(user.id, req.query as never);
    return sendPaginated(res, items, { page, limit, total }, 'Invoices fetched');
  }),

  stats: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    return sendSuccess(res, await InvoicesService.stats(user.id), 'Invoice stats fetched');
  }),

  templates: asyncHandler(async (_req: Request, res: Response) =>
    sendSuccess(res, TEMPLATE_CATALOG, 'Invoice templates fetched'),
  ),

  /** Live totals for the invoice builder — no persistence, no side effects. */
  preview: asyncHandler(async (req: Request, res: Response) => {
    // The request speaks in `items`; the calculator speaks in `lines`.
    const { items, ...rest } = req.body as { items: LineInput[] } & Record<string, unknown>;
    const totals = calculateTotals({ ...rest, lines: items });
    return sendSuccess(
      res,
      {
        ...totals,
        lines: totals.lines.map((line) => ({
          ...line,
          quantity: line.quantity.toNumber(),
          unitPrice: line.unitPrice.toNumber(),
          discountPercent: line.discountPercent.toNumber(),
          taxRate: line.taxRate.toNumber(),
          netAmount: line.netAmount.toNumber(),
          taxAmount: line.taxAmount.toNumber(),
          lineTotal: line.lineTotal.toNumber(),
        })),
        subtotal: totals.subtotal.toNumber(),
        discountAmount: totals.discountAmount.toNumber(),
        taxAmount: totals.taxAmount.toNumber(),
        shippingAmount: totals.shippingAmount.toNumber(),
        roundOff: totals.roundOff.toNumber(),
        total: totals.total.toNumber(),
      },
      'Totals calculated',
    );
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    return sendSuccess(res, await InvoicesService.getById(user.id, params.id), 'Invoice fetched');
  }),

  getPublic: asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.params as { token: string };
    return sendSuccess(res, await InvoicesService.getByPublicToken(token), 'Invoice fetched');
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    return sendCreated(res, await InvoicesService.create(user.id, req.body), 'Invoice created as draft');
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    return sendSuccess(res, await InvoicesService.update(user.id, params.id, req.body), 'Invoice updated');
  }),

  send: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    return sendSuccess(res, await InvoicesService.send(user.id, params.id), 'Invoice issued and posted to your ledger');
  }),

  emailToClient: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    const result = await InvoicesService.emailToClient(user.id, params.id, {
      to: req.body?.to,
      event: req.body?.event,
    });
    return sendSuccess(res, result, `Sent to ${result.sentTo}`);
  }),

  changeStatus: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    const data = await InvoicesService.changeStatus(user.id, params.id, req.body.status);
    return sendSuccess(res, data, 'Invoice status updated');
  }),

  duplicate: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    const data = await InvoicesService.duplicate(user.id, params.id, req.body?.issueDate);
    return sendCreated(res, data, 'Invoice duplicated as a new draft');
  }),

  cancel: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    return sendSuccess(res, await InvoicesService.cancel(user.id, params.id), 'Invoice cancelled');
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    await InvoicesService.remove(user.id, params.id);
    return sendSuccess(res, null, 'Invoice deleted');
  }),

  recordPayment: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    const data = await InvoicesService.recordPayment(user.id, params.id, req.body);
    return sendCreated(res, data, 'Payment recorded');
  }),

  deletePayment: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    const data = await InvoicesService.deletePayment(user.id, params.id, params.paymentId);
    return sendSuccess(res, data, 'Payment removed and ledger entry reversed');
  }),

  // ---- Rendering ----------------------------------------------------------

  previewHtml: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    const invoice = await loadForRender(user.id, params.id);
    const template = (req.query as { template?: string }).template;
    res.type('html').send(
      buildInvoiceHtml(template ? { ...invoice, templateKey: template } : invoice),
    );
  }),

  downloadPdf: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    const invoice = await loadForRender(user.id, params.id);
    const pdf = await buildInvoicePdf(invoice);
    res
      .type('application/pdf')
      .setHeader('Content-Disposition', `attachment; filename="${pdfFilename(invoice.number)}"`);
    res.send(pdf);
  }),

  /** Styled HTML for the client-facing share page — token is the credential. */
  publicPreview: asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.params as { token: string };
    const invoice = await InvoicesModel.findByPublicToken(token);
    if (!invoice) throw ApiError.notFound('Invoice');
    res.type('html').send(buildInvoiceHtml(invoice));
  }),

  publicPdf: asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.params as { token: string };
    const invoice = await InvoicesModel.findByPublicToken(token);
    if (!invoice) throw ApiError.notFound('Invoice');
    const pdf = await buildInvoicePdf(invoice);
    res
      .type('application/pdf')
      .setHeader('Content-Disposition', `inline; filename="${pdfFilename(invoice.number)}"`);
    res.send(pdf);
  }),

  // ---- Numbering ----------------------------------------------------------

  sequences: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    return sendSuccess(res, await InvoicesService.listSequences(user.id), 'Number sequences fetched');
  }),

  updateSequence: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    const { documentType, ...data } = req.body;
    return sendSuccess(
      res,
      await InvoicesService.updateSequence(user.id, documentType, data),
      'Number sequence updated',
    );
  }),
};

export default InvoicesController;
