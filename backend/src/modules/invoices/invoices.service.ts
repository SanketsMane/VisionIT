import { DocumentType, InvoiceStatus, JournalSource, type Prisma } from '@prisma/client';
import { prisma } from '@config/database';
import { env } from '@config/env';
import { logger } from '@config/logger';
import { ApiError } from '@utils/api-error';
import { add, formatCurrency, round2, subtract, toDecimal, toNumber } from '@utils/money.util';
import { addDays, dayjs, daysBetween, formatDate } from '@utils/date.util';
import { resolvePagination } from '@utils/pagination.util';
import { generateToken } from '@utils/crypto.util';
import { LedgerService } from '@modules/ledger/ledger.service';
import type { JournalLineInput } from '@modules/ledger/ledger.types';
import { AccountsModel } from '@modules/accounts/accounts.model';
import { sendTemplatedEmail } from '@modules/notifications/email-sender';
import { InvoicesModel, OPEN_STATUSES } from './invoices.model';
import { calculateTotals, settlementState, type LineInput } from './invoices.calculator';
import type { CreateInvoiceDto, ListInvoicesDto, RecordPaymentDto, UpdateInvoiceDto } from './invoices.validation';

const SORTABLE = ['issueDate', 'dueDate', 'createdAt', 'total', 'number', 'balanceDue'];

/**
 * Only drafts are freely editable. Once a document has been sent it has been
 * seen by a client and, for invoices, posted to the ledger — editing it in
 * place would silently rewrite history.
 */
const EDITABLE_STATUSES: InvoiceStatus[] = [InvoiceStatus.DRAFT];

const RECURRENCE_STEP: Record<string, { amount: number; unit: 'week' | 'month' | 'year' }> = {
  WEEKLY: { amount: 1, unit: 'week' },
  MONTHLY: { amount: 1, unit: 'month' },
  QUARTERLY: { amount: 3, unit: 'month' },
  HALF_YEARLY: { amount: 6, unit: 'month' },
  YEARLY: { amount: 1, unit: 'year' },
};

const nextRunFrom = (date: Date, rule?: string | null): Date | null => {
  const step = rule ? RECURRENCE_STEP[rule] : undefined;
  return step ? dayjs.utc(date).add(step.amount, step.unit).toDate() : null;
};

export const InvoicesService = {
  async list(userId: string, query: ListInvoicesDto) {
    const pagination = resolvePagination(query, {
      allowedSortFields: SORTABLE,
      defaultSortBy: 'issueDate',
    });
    const where = InvoicesModel.buildWhere(userId, query);

    const [items, total] = await Promise.all([
      InvoicesModel.findMany(where, {
        skip: pagination.skip,
        take: pagination.take,
        orderBy: pagination.orderBy,
      }),
      InvoicesModel.count(where),
    ]);

    return { items, total, page: pagination.page, limit: pagination.limit };
  },

  async getById(userId: string, id: string) {
    const invoice = await InvoicesModel.findById(userId, id);
    if (!invoice) throw ApiError.notFound('Invoice');
    return this.decorate(invoice);
  },

  /** Client-facing view via the share link — marks the document as viewed. */
  async getByPublicToken(token: string) {
    const invoice = await InvoicesModel.findByPublicToken(token);
    if (!invoice) throw ApiError.notFound('Invoice');
    await InvoicesModel.markViewed(invoice.id);
    return this.decorate(invoice);
  },

  /** Adds derived fields the UI and PDF both need but which aren't stored. */
  decorate<T extends { dueDate: Date; status: InvoiceStatus; balanceDue: unknown }>(invoice: T) {
    const isOpen = (OPEN_STATUSES as readonly string[]).includes(invoice.status);
    const daysUntilDue = daysBetween(new Date(), invoice.dueDate);
    return {
      ...invoice,
      daysUntilDue,
      daysOverdue: isOpen && daysUntilDue < 0 ? Math.abs(daysUntilDue) : 0,
      isOverdue: isOpen && daysUntilDue < 0,
      isEditable: EDITABLE_STATUSES.includes(invoice.status),
    };
  },

  async create(userId: string, dto: CreateInvoiceDto) {
    const client = await prisma.client.findFirst({
      where: { id: dto.clientId, userId, deletedAt: null },
      select: { id: true, currency: true, paymentTermsDays: true },
    });
    if (!client) throw ApiError.badRequest('The selected client does not exist');

    if (dto.projectId) {
      const projectExists = await prisma.project.count({
        where: { id: dto.projectId, userId, deletedAt: null },
      });
      if (!projectExists) throw ApiError.badRequest('The selected project does not exist');
    }

    const totals = calculateTotals({
      lines: dto.items,
      discountType: dto.discountType,
      discountValue: dto.discountValue,
      shippingAmount: dto.shippingAmount,
      taxInclusive: dto.taxInclusive,
      isInterState: dto.isInterState,
      roundOffTotal: dto.roundOffTotal,
    });
    const dueDate = dto.dueDate ?? addDays(dto.issueDate, client.paymentTermsDays);

    const invoice = await prisma.$transaction(async (tx) => {
      const number = await InvoicesModel.reserveNumber(userId, dto.documentType, tx);

      return InvoicesModel.create(
        {
          number,
          documentType: dto.documentType,
          status: InvoiceStatus.DRAFT,
          currency: dto.currency,
          exchangeRate: dto.exchangeRate,
          issueDate: dto.issueDate,
          dueDate,
          poNumber: dto.poNumber ?? null,

          subtotal: totals.subtotal,
          discountType: dto.discountType,
          discountValue: dto.discountValue,
          discountAmount: totals.discountAmount,
          taxAmount: totals.taxAmount,
          shippingAmount: totals.shippingAmount,
          roundOff: totals.roundOff,
          total: totals.total,
          amountPaid: 0,
          balanceDue: totals.total,

          taxInclusive: dto.taxInclusive,
          isInterState: dto.isInterState,

          notes: dto.notes ?? null,
          terms: dto.terms ?? null,
          templateKey: dto.templateKey,
          accentColor: dto.accentColor,
          publicToken: generateToken(24),

          isRecurring: dto.isRecurring,
          recurrenceRule: dto.recurrenceRule ?? null,
          nextRunAt: dto.isRecurring ? nextRunFrom(dto.issueDate, dto.recurrenceRule) : null,

          user: { connect: { id: userId } },
          client: { connect: { id: dto.clientId } },
          ...(dto.projectId ? { project: { connect: { id: dto.projectId } } } : {}),

          items: {
            create: totals.lines.map((line) => ({
              title: line.title,
              description: line.description ?? null,
              hsnSac: line.hsnSac ?? null,
              quantity: line.quantity,
              unit: line.unit ?? 'nos',
              unitPrice: line.unitPrice,
              discountPercent: line.discountPercent,
              taxRate: line.taxRate,
              taxAmount: line.taxAmount,
              lineTotal: line.lineTotal,
              sortOrder: line.sortOrder,
            })),
          },
        },
        tx,
      );
    });

    logger.info('Invoice created', { userId, invoiceId: invoice.id, number: invoice.number });
    return this.decorate(invoice);
  },

  async update(userId: string, id: string, dto: UpdateInvoiceDto) {
    const existing = await InvoicesModel.findById(userId, id);
    if (!existing) throw ApiError.notFound('Invoice');

    if (!EDITABLE_STATUSES.includes(existing.status)) {
      throw ApiError.badRequest(
        `A ${existing.status.toLowerCase().replace('_', ' ')} document can no longer be edited. Duplicate it or issue a credit note instead.`,
      );
    }

    const lines: LineInput[] =
      dto.items ?? existing.items.map((item) => ({
        title: item.title,
        description: item.description,
        hsnSac: item.hsnSac,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        discountPercent: item.discountPercent,
        taxRate: item.taxRate,
        sortOrder: item.sortOrder,
      }));

    const totals = calculateTotals({
      lines,
      discountType: dto.discountType ?? existing.discountType,
      discountValue: dto.discountValue ?? existing.discountValue,
      shippingAmount: dto.shippingAmount ?? existing.shippingAmount,
      taxInclusive: dto.taxInclusive ?? existing.taxInclusive,
      isInterState: dto.isInterState ?? existing.isInterState,
      roundOffTotal: dto.roundOffTotal ?? !toDecimal(existing.roundOff).isZero(),
    });

    const updated = await prisma.$transaction(async (tx) => {
      if (dto.items) {
        await InvoicesModel.replaceItems(
          id,
          totals.lines.map((line) => ({
            invoiceId: id,
            title: line.title,
            description: line.description ?? null,
            hsnSac: line.hsnSac ?? null,
            quantity: line.quantity,
            unit: line.unit ?? 'nos',
            unitPrice: line.unitPrice,
            discountPercent: line.discountPercent,
            taxRate: line.taxRate,
            taxAmount: line.taxAmount,
            lineTotal: line.lineTotal,
            sortOrder: line.sortOrder,
          })),
          tx,
        );
      }

      const { items: _items, ...scalars } = dto;

      return InvoicesModel.update(
        userId,
        id,
        {
          ...scalars,
          ...(dto.clientId ? { clientId: undefined, client: { connect: { id: dto.clientId } } } : {}),
          ...(dto.projectId === null
            ? { projectId: undefined, project: { disconnect: true } }
            : dto.projectId
              ? { projectId: undefined, project: { connect: { id: dto.projectId } } }
              : {}),
          subtotal: totals.subtotal,
          discountAmount: totals.discountAmount,
          taxAmount: totals.taxAmount,
          shippingAmount: totals.shippingAmount,
          roundOff: totals.roundOff,
          total: totals.total,
          balanceDue: round2(subtract(totals.total, existing.amountPaid)),
          ...(dto.isRecurring !== undefined
            ? {
                nextRunAt: dto.isRecurring
                  ? nextRunFrom(dto.issueDate ?? existing.issueDate, dto.recurrenceRule ?? existing.recurrenceRule)
                  : null,
              }
            : {}),
        },
        tx,
      );
    });

    return this.decorate(updated);
  },

  /**
   * Issues the document. For invoices this is the moment revenue is
   * recognised, so the accrual entry is posted here:
   *
   *   Dr Accounts Receivable   total
   *     Cr Income              subtotal − discount
   *     Cr Tax Payable         tax
   *
   * Quotations and proformas are not accounting documents and post nothing.
   */
  async send(userId: string, id: string) {
    const invoice = await InvoicesModel.findById(userId, id);
    if (!invoice) throw ApiError.notFound('Invoice');
    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw ApiError.badRequest('This document has already been issued');
    }

    const shouldPost = invoice.documentType === DocumentType.INVOICE;

    const updated = await prisma.$transaction(async (tx) => {
      if (shouldPost) {
        const accounts = await LedgerService.resolveSystemAccounts(userId, [
          'ACCOUNTS_RECEIVABLE',
          'DEFAULT_INCOME',
          'TAX_PAYABLE',
          'DISCOUNTS_GIVEN',
        ]);

        const netIncome = round2(subtract(invoice.subtotal, invoice.discountAmount));
        const lines: JournalLineInput[] = [
          {
            accountId: accounts.ACCOUNTS_RECEIVABLE,
            debit: toNumber(invoice.total),
            description: `Invoice ${invoice.number} — ${invoice.client.name}`,
          },
          {
            accountId: accounts.DEFAULT_INCOME,
            credit: netIncome.toNumber(),
            description: `Revenue — ${invoice.number}`,
          },
        ];

        if (toDecimal(invoice.taxAmount).greaterThan(0)) {
          lines.push({
            accountId: accounts.TAX_PAYABLE,
            credit: toNumber(invoice.taxAmount),
            description: `Output tax — ${invoice.number}`,
          });
        }

        // Shipping recovered from the client is additional revenue.
        if (toDecimal(invoice.shippingAmount).greaterThan(0)) {
          lines.push({
            accountId: accounts.DEFAULT_INCOME,
            credit: toNumber(invoice.shippingAmount),
            description: `Shipping — ${invoice.number}`,
          });
        }

        if (!toDecimal(invoice.roundOff).isZero()) {
          const roundOff = toDecimal(invoice.roundOff);
          lines.push(
            roundOff.greaterThan(0)
              ? { accountId: accounts.DEFAULT_INCOME, credit: roundOff.toNumber(), description: 'Round off' }
              : { accountId: accounts.DISCOUNTS_GIVEN, debit: roundOff.abs().toNumber(), description: 'Round off' },
          );
        }

        await LedgerService.createEntry(
          userId,
          {
            date: invoice.issueDate,
            source: JournalSource.INVOICE,
            narration: `Invoice ${invoice.number} issued to ${invoice.client.name}`,
            reference: invoice.number,
            invoiceId: invoice.id,
            lines,
          },
          tx,
        );
      }

      return InvoicesModel.update(
        userId,
        id,
        {
          status: InvoiceStatus.SENT,
          sentAt: new Date(),
          publicToken: invoice.publicToken ?? generateToken(24),
        },
        tx,
      );
    });

    logger.info('Invoice issued', { userId, invoiceId: id, posted: shouldPost });
    return this.decorate(updated);
  },

  /**
   * Emails a document to the client with the PDF attached.
   *
   * Separate from `send()` on purpose: issuing a document is an accounting
   * event that posts to the ledger and must not be undone by a mail server
   * being unreachable. Delivery is a second, retryable step, so a bounced
   * email never leaves the books in a half-posted state.
   */
  async emailToClient(
    userId: string,
    id: string,
    options: { to?: string; event?: 'invoice.created' | 'invoice.due' | 'invoice.overdue' } = {},
  ) {
    const invoice = await InvoicesModel.findById(userId, id);
    if (!invoice) throw ApiError.notFound('Invoice');
    if (invoice.status === InvoiceStatus.DRAFT) {
      throw ApiError.badRequest('Issue this document before emailing it');
    }

    const recipient =
      options.to ?? invoice.client.contacts[0]?.email ?? invoice.client.email ?? null;
    if (!recipient) {
      throw ApiError.badRequest(
        `${invoice.client.name} has no email address — add one on the client record first`,
      );
    }

    const { buildInvoicePdf } = await import('./invoices.pdf');
    const pdf = await buildInvoicePdf(invoice);

    const label = invoice.documentType === DocumentType.INVOICE ? 'Invoice' : 'Document';
    const overdueBy = -daysBetween(new Date(), invoice.dueDate);
    const event =
      options.event ??
      (invoice.status === InvoiceStatus.OVERDUE || overdueBy > 0 ? 'invoice.overdue' : 'invoice.created');

    const result = await sendTemplatedEmail({
      to: recipient,
      event,
      userId,
      context: {
        recipientName: invoice.client.contacts[0]?.name ?? invoice.client.name,
        invoiceNumber: invoice.number,
        amount: formatCurrency(invoice.total, invoice.currency),
        balanceDue: formatCurrency(invoice.balanceDue, invoice.currency),
        issueDate: formatDate(invoice.issueDate),
        dueDate: formatDate(invoice.dueDate),
        daysOverdue: overdueBy > 0 ? String(overdueBy) : undefined,
        projectName: invoice.project?.title,
        brandName:
          invoice.user.company?.tradeName ?? invoice.user.company?.legalName ?? undefined,
        logoUrl: invoice.user.company?.logoUrl ?? undefined,
        actionUrl: invoice.publicToken ? `${env.CLIENT_URL}/i/${invoice.publicToken}` : undefined,
        actionLabel: `View ${label.toLowerCase()}`,
      },
      attachments: [{ filename: `${invoice.number}.pdf`, content: pdf.toString('base64') }],
    });

    if (!result.ok) throw ApiError.badRequest(`Could not send the email: ${result.error}`);

    logger.info('Invoice emailed', { userId, invoiceId: id, to: recipient, event });

    return { sentTo: recipient, messageId: result.messageId };
  },

  /**
   * Records a receipt against an invoice and posts the settlement:
   *
   *   Dr Bank/Cash          amount − fee
   *   Dr Bank Charges       fee
   *     Cr Accounts Receivable   amount
   */
  async recordPayment(userId: string, invoiceId: string, dto: RecordPaymentDto) {
    const invoice = await InvoicesModel.findById(userId, invoiceId);
    if (!invoice) throw ApiError.notFound('Invoice');

    if (invoice.documentType !== DocumentType.INVOICE) {
      throw ApiError.badRequest('Payments can only be recorded against invoices');
    }
    if (invoice.status === InvoiceStatus.DRAFT) {
      throw ApiError.badRequest('Issue the invoice before recording a payment against it');
    }
    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw ApiError.badRequest('This invoice has been cancelled');
    }

    const balanceDue = toDecimal(invoice.balanceDue);
    if (toDecimal(dto.amount).greaterThan(balanceDue.plus(0.01))) {
      throw ApiError.badRequest(
        `Payment of ${dto.amount} exceeds the outstanding balance of ${balanceDue.toFixed(2)}`,
      );
    }

    const depositAccount = await AccountsModel.findById(userId, dto.accountId);
    if (!depositAccount) throw ApiError.badRequest('The selected deposit account does not exist');

    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          userId,
          invoiceId,
          accountId: dto.accountId,
          amount: dto.amount,
          currency: invoice.currency,
          paidAt: dto.paidAt,
          method: dto.method,
          reference: dto.reference ?? null,
          notes: dto.notes ?? null,
          feeAmount: dto.feeAmount,
        },
      });

      const amountPaid = round2(add(invoice.amountPaid, dto.amount));
      const { balanceDue: newBalance, isFullySettled } = settlementState(invoice.total, amountPaid);

      const accounts = await LedgerService.resolveSystemAccounts(userId, [
        'ACCOUNTS_RECEIVABLE',
        'BANK_CHARGES',
      ]);

      const netReceived = round2(subtract(dto.amount, dto.feeAmount));
      const lines: JournalLineInput[] = [
        {
          accountId: dto.accountId,
          debit: netReceived.toNumber(),
          description: `Payment for ${invoice.number}`,
        },
      ];

      if (toDecimal(dto.feeAmount).greaterThan(0)) {
        lines.push({
          accountId: accounts.BANK_CHARGES,
          debit: toNumber(dto.feeAmount),
          description: `Transaction fee on ${invoice.number}`,
        });
      }

      lines.push({
        accountId: accounts.ACCOUNTS_RECEIVABLE,
        credit: dto.amount,
        description: `Settlement of ${invoice.number}`,
      });

      await LedgerService.createEntry(
        userId,
        {
          date: dto.paidAt,
          source: JournalSource.PAYMENT,
          narration: `Payment received for ${invoice.number} from ${invoice.client.name}`,
          reference: dto.reference ?? invoice.number,
          invoiceId,
          paymentId: payment.id,
          lines,
        },
        tx,
      );

      const updated = await InvoicesModel.update(
        userId,
        invoiceId,
        {
          amountPaid,
          balanceDue: newBalance,
          status: isFullySettled ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID,
          ...(isFullySettled ? { paidAt: dto.paidAt } : {}),
        },
        tx,
      );

      return { payment, invoice: updated };
    });

    logger.info('Payment recorded', { userId, invoiceId, amount: dto.amount });
    return { payment: result.payment, invoice: this.decorate(result.invoice) };
  },

  /** Removes a receipt and reverses its posting, restoring the open balance. */
  async deletePayment(userId: string, invoiceId: string, paymentId: string) {
    const payment = await prisma.payment.findFirst({ where: { id: paymentId, userId, invoiceId } });
    if (!payment) throw ApiError.notFound('Payment');

    const invoice = await InvoicesModel.findById(userId, invoiceId);
    if (!invoice) throw ApiError.notFound('Invoice');

    return prisma.$transaction(async (tx) => {
      await LedgerService.voidEntriesForSource(userId, 'paymentId', paymentId, tx);
      await tx.payment.delete({ where: { id: paymentId } });

      const amountPaid = round2(subtract(invoice.amountPaid, payment.amount));
      const { balanceDue, isFullySettled, isPartiallySettled } = settlementState(invoice.total, amountPaid);

      const status = isFullySettled
        ? InvoiceStatus.PAID
        : isPartiallySettled
          ? InvoiceStatus.PARTIALLY_PAID
          : dayjs.utc().isAfter(dayjs.utc(invoice.dueDate))
            ? InvoiceStatus.OVERDUE
            : InvoiceStatus.SENT;

      const updated = await InvoicesModel.update(
        userId,
        invoiceId,
        { amountPaid, balanceDue, status, ...(isFullySettled ? {} : { paidAt: null }) },
        tx,
      );

      return this.decorate(updated);
    });
  },

  async cancel(userId: string, id: string) {
    const invoice = await InvoicesModel.findById(userId, id);
    if (!invoice) throw ApiError.notFound('Invoice');
    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw ApiError.badRequest('This document is already cancelled');
    }
    if (invoice.payments.length) {
      throw ApiError.badRequest(
        'Remove the recorded payments before cancelling, or issue a credit note instead.',
      );
    }

    return prisma.$transaction(async (tx) => {
      await LedgerService.voidEntriesForSource(userId, 'invoiceId', id, tx);
      const updated = await InvoicesModel.update(
        userId,
        id,
        { status: InvoiceStatus.CANCELLED, isRecurring: false, nextRunAt: null },
        tx,
      );
      return this.decorate(updated);
    });
  },

  async remove(userId: string, id: string) {
    const invoice = await InvoicesModel.findById(userId, id);
    if (!invoice) throw ApiError.notFound('Invoice');
    if (invoice.status !== InvoiceStatus.DRAFT && invoice.payments.length) {
      throw ApiError.badRequest('Invoices with recorded payments cannot be deleted. Cancel it instead.');
    }

    await prisma.$transaction(async (tx) => {
      await LedgerService.voidEntriesForSource(userId, 'invoiceId', id, tx);
      await InvoicesModel.softDelete(userId, id, tx);
    });
  },

  /** Copies an issued document back into a fresh editable draft. */
  async duplicate(userId: string, id: string, issueDate?: Date) {
    const source = await InvoicesModel.findById(userId, id);
    if (!source) throw ApiError.notFound('Invoice');

    return this.create(userId, {
      clientId: source.clientId,
      projectId: source.projectId,
      documentType: source.documentType,
      currency: source.currency,
      exchangeRate: toNumber(source.exchangeRate),
      issueDate: issueDate ?? new Date(),
      poNumber: source.poNumber,
      items: source.items.map((item, index) => ({
        title: item.title,
        description: item.description,
        hsnSac: item.hsnSac,
        quantity: toNumber(item.quantity),
        unit: item.unit,
        unitPrice: toNumber(item.unitPrice),
        discountPercent: toNumber(item.discountPercent),
        taxRate: toNumber(item.taxRate),
        sortOrder: item.sortOrder ?? index,
      })),
      discountType: source.discountType,
      discountValue: toNumber(source.discountValue),
      shippingAmount: toNumber(source.shippingAmount),
      taxInclusive: source.taxInclusive,
      isInterState: source.isInterState,
      roundOffTotal: !toDecimal(source.roundOff).isZero(),
      notes: source.notes,
      terms: source.terms,
      templateKey: source.templateKey as CreateInvoiceDto['templateKey'],
      accentColor: source.accentColor,
      isRecurring: false,
      recurrenceRule: null,
    });
  },

  async changeStatus(userId: string, id: string, status: InvoiceStatus) {
    const invoice = await InvoicesModel.findById(userId, id);
    if (!invoice) throw ApiError.notFound('Invoice');

    // Money-moving transitions have dedicated endpoints that also post to the
    // ledger; allowing them here would let the books drift out of sync.
    const guarded: InvoiceStatus[] = [InvoiceStatus.PAID, InvoiceStatus.PARTIALLY_PAID];
    if (guarded.includes(status)) {
      throw ApiError.badRequest('Record a payment to move this invoice into a paid state');
    }
    if (status === InvoiceStatus.SENT && invoice.status === InvoiceStatus.DRAFT) {
      return this.send(userId, id);
    }
    if (status === InvoiceStatus.CANCELLED) return this.cancel(userId, id);

    const updated = await InvoicesModel.update(userId, id, { status });
    return this.decorate(updated);
  },

  // ---- Reporting helpers --------------------------------------------------

  async stats(userId: string) {
    const [byStatus, aging] = await Promise.all([
      InvoicesModel.statusTotals(userId),
      InvoicesModel.outstandingAging(userId),
    ]);

    const buckets = { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, over90: 0 };

    for (const invoice of aging) {
      const overdueBy = -daysBetween(new Date(), invoice.dueDate);
      const amount = toNumber(invoice.balanceDue);
      if (overdueBy <= 0) buckets.current += amount;
      else if (overdueBy <= 30) buckets.days1to30 += amount;
      else if (overdueBy <= 60) buckets.days31to60 += amount;
      else if (overdueBy <= 90) buckets.days61to90 += amount;
      else buckets.over90 += amount;
    }

    const summary = byStatus.reduce<Record<string, { count: number; total: number; balanceDue: number }>>(
      (acc, row) => {
        acc[row.status] = {
          count: row._count._all,
          total: toNumber(row._sum.total),
          balanceDue: toNumber(row._sum.balanceDue),
        };
        return acc;
      },
      {},
    );

    const totalOutstanding = round2(
      add(...Object.values(buckets)),
    ).toNumber();

    return {
      byStatus: summary,
      aging: Object.fromEntries(
        Object.entries(buckets).map(([k, v]) => [k, round2(v).toNumber()]),
      ),
      totalOutstanding,
      overdueCount: aging.filter((i) => daysBetween(new Date(), i.dueDate) < 0).length,
    };
  },

  listSequences: (userId: string) => InvoicesModel.listSequences(userId),

  updateSequence: (userId: string, documentType: DocumentType, data: Prisma.NumberSequenceUpdateInput) =>
    InvoicesModel.updateSequence(userId, documentType, data),
};

export default InvoicesService;
