import { PaymentRequestStatus, type PaymentMethod, type Prisma } from '@prisma/client';
import { prisma } from '@config/database';
import { logger } from '@config/logger';
import { ApiError } from '@utils/api-error';
import { formatCurrency, toNumber } from '@utils/money.util';
import { resolvePagination } from '@utils/pagination.util';
import { removePrivateFile, storageKeyFor } from '@utils/private-storage';
import { InvoicesService } from '@modules/invoices/invoices.service';
import { NotificationService } from '@modules/notifications/notification.service';
import { recordActivity } from '@modules/portal/portal.activity';

/** Never selects `proofKey` — proofs are streamed through an authorised route. */
const requestSelect = {
  id: true,
  projectId: true,
  invoiceId: true,
  amount: true,
  currency: true,
  paidAt: true,
  method: true,
  reference: true,
  reason: true,
  notes: true,
  proofFilename: true,
  proofMimeType: true,
  status: true,
  reviewedAt: true,
  rejectionReason: true,
  paymentId: true,
  createdAt: true,
  submittedBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
  reviewedBy: { select: { id: true, name: true } },
  invoice: { select: { id: true, number: true, total: true, balanceDue: true, currency: true } },
  project: { select: { id: true, title: true, code: true } },
} satisfies Prisma.PaymentRequestSelect;

export interface SubmitPaymentInput {
  invoiceId?: string | null;
  amount: number;
  paidAt: Date;
  method: PaymentMethod;
  reference?: string | null;
  reason: string;
  notes?: string | null;
  proof?: Express.Multer.File;
}

export const PaymentRequestsService = {
  async listForProject(
    projectId: string,
    query: { page?: number; limit?: number; status?: PaymentRequestStatus },
  ) {
    const pagination = resolvePagination(query, { defaultLimit: 20 });
    const where: Prisma.PaymentRequestWhereInput = {
      projectId,
      ...(query.status ? { status: query.status } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.paymentRequest.findMany({
        where,
        select: requestSelect,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.paymentRequest.count({ where }),
    ]);

    return { items, total, page: pagination.page, limit: pagination.limit };
  },

  /** Workspace-wide queue for the admin approvals screen. */
  async listForWorkspace(
    ownerId: string,
    query: { page?: number; limit?: number; status?: PaymentRequestStatus },
  ) {
    const pagination = resolvePagination(query, { defaultLimit: 20 });
    const where: Prisma.PaymentRequestWhereInput = {
      project: { userId: ownerId },
      ...(query.status ? { status: query.status } : {}),
    };

    const [items, total, pendingCount, pendingValue] = await Promise.all([
      prisma.paymentRequest.findMany({
        where,
        select: requestSelect,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.paymentRequest.count({ where }),
      prisma.paymentRequest.count({
        where: { project: { userId: ownerId }, status: PaymentRequestStatus.PENDING },
      }),
      prisma.paymentRequest.aggregate({
        where: { project: { userId: ownerId }, status: PaymentRequestStatus.PENDING },
        _sum: { amount: true },
      }),
    ]);

    return {
      items,
      total,
      page: pagination.page,
      limit: pagination.limit,
      summary: {
        pendingCount,
        pendingValue: toNumber(pendingValue._sum.amount),
      },
    };
  },

  async getById(projectId: string, requestId: string) {
    const request = await prisma.paymentRequest.findFirst({
      where: { id: requestId, projectId },
      select: requestSelect,
    });
    if (!request) throw ApiError.notFound('Payment request');
    return request;
  },

  /** Internal use only — resolves the private proof key for the download route. */
  async loadProof(projectId: string, requestId: string) {
    const request = await prisma.paymentRequest.findFirst({
      where: { id: requestId, projectId },
      select: { proofKey: true, proofFilename: true, proofMimeType: true },
    });
    if (!request?.proofKey) throw ApiError.notFound('Payment proof');
    return request;
  },

  /**
   * Records a client's claim that money was paid.
   *
   * This is deliberately NOT money in the books. Nothing posts to the ledger
   * until an admin verifies the proof — a client should never be able to move
   * their own balance.
   */
  async submit(
    projectId: string,
    submittedByUserId: string,
    submitterName: string,
    input: SubmitPaymentInput,
  ) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, title: true, currency: true },
    });
    if (!project) throw ApiError.notFound('Project');

    if (input.invoiceId) {
      const invoice = await prisma.invoice.findFirst({
        where: { id: input.invoiceId, projectId, deletedAt: null },
        select: { id: true, balanceDue: true, status: true },
      });
      if (!invoice) throw ApiError.badRequest('That invoice does not belong to this project');
      if (invoice.status === 'DRAFT') {
        throw ApiError.badRequest('That invoice has not been issued yet');
      }
    }

    const proofKey = input.proof
      ? storageKeyFor('payment-proofs', projectId, input.proof.filename)
      : null;

    const request = await prisma.paymentRequest.create({
      data: {
        projectId,
        invoiceId: input.invoiceId ?? null,
        submittedByUserId,
        amount: input.amount,
        currency: project.currency,
        paidAt: input.paidAt,
        method: input.method,
        reference: input.reference ?? null,
        reason: input.reason,
        notes: input.notes ?? null,
        proofKey,
        proofFilename: input.proof?.originalname ?? null,
        proofMimeType: input.proof?.mimetype ?? null,
      },
      select: requestSelect,
    });

    const amountLabel = formatCurrency(input.amount, project.currency);

    await recordActivity({
      projectId,
      actorId: submittedByUserId,
      action: 'payment.requested',
      entityType: 'PaymentRequest',
      entityId: request.id,
      summary: `${submitterName} submitted a payment of ${amountLabel} for ${input.reason}`,
    });

    NotificationService.emitAsync({
      event: 'payment.submitted',
      audience: { projectId, include: ['internal'] },
      context: {
        projectName: project.title,
        actorName: submitterName,
        amount: amountLabel,
        reason: input.reason,
      },
      projectId,
      link: `/payments/requests`,
    });

    logger.info('Payment request submitted', { projectId, requestId: request.id });
    return request;
  },

  /**
   * Approves a claim and turns it into real money.
   *
   * The actual recording goes through `InvoicesService.recordPayment`, which is
   * the same path the admin uses manually — so an approved request posts the
   * identical double entry (Dr Bank / Cr Accounts Receivable) and updates the
   * invoice status. Approval never invents its own accounting.
   */
  async approve(
    projectId: string,
    requestId: string,
    reviewer: { id: string; name: string; workspaceOwnerId: string },
    options: { accountId: string; invoiceId?: string | null },
  ) {
    const request = await prisma.paymentRequest.findFirst({
      where: { id: requestId, projectId },
      include: {
        submittedBy: { select: { id: true, name: true } },
        project: { select: { title: true } },
      },
    });
    if (!request) throw ApiError.notFound('Payment request');
    if (request.status !== PaymentRequestStatus.PENDING) {
      throw ApiError.badRequest(`This request has already been ${request.status.toLowerCase()}`);
    }

    const invoiceId = options.invoiceId ?? request.invoiceId;
    if (!invoiceId) {
      throw ApiError.badRequest(
        'Choose which invoice this payment settles before approving it.',
      );
    }

    const amount = toNumber(request.amount);

    const { payment } = await InvoicesService.recordPayment(reviewer.workspaceOwnerId, invoiceId, {
      amount,
      paidAt: request.paidAt,
      method: request.method,
      accountId: options.accountId,
      reference: request.reference ?? null,
      notes: `Client payment request approved — ${request.reason}`,
      feeAmount: 0,
    });

    const updated = await prisma.paymentRequest.update({
      where: { id: requestId },
      data: {
        status: PaymentRequestStatus.APPROVED,
        reviewedByUserId: reviewer.id,
        reviewedAt: new Date(),
        invoiceId,
        paymentId: payment.id,
        rejectionReason: null,
      },
      select: requestSelect,
    });

    const amountLabel = formatCurrency(amount, request.currency);

    await recordActivity({
      projectId,
      actorId: reviewer.id,
      action: 'payment.approved',
      entityType: 'PaymentRequest',
      entityId: requestId,
      summary: `${reviewer.name} approved the payment of ${amountLabel}`,
      field: 'status',
      oldValue: PaymentRequestStatus.PENDING,
      newValue: PaymentRequestStatus.APPROVED,
    });

    NotificationService.emitAsync({
      event: 'payment.approved',
      userIds: [request.submittedByUserId],
      context: {
        projectName: request.project.title,
        amount: amountLabel,
        reason: request.reason,
      },
      projectId,
      link: `/portal/projects/${projectId}/payments`,
    });

    logger.info('Payment request approved', { projectId, requestId, paymentId: payment.id });
    return updated;
  },

  async reject(
    projectId: string,
    requestId: string,
    reviewer: { id: string; name: string },
    rejectionReason: string,
  ) {
    const request = await prisma.paymentRequest.findFirst({
      where: { id: requestId, projectId },
      include: { project: { select: { title: true } } },
    });
    if (!request) throw ApiError.notFound('Payment request');
    if (request.status !== PaymentRequestStatus.PENDING) {
      throw ApiError.badRequest(`This request has already been ${request.status.toLowerCase()}`);
    }

    const updated = await prisma.paymentRequest.update({
      where: { id: requestId },
      data: {
        status: PaymentRequestStatus.REJECTED,
        reviewedByUserId: reviewer.id,
        reviewedAt: new Date(),
        rejectionReason,
      },
      select: requestSelect,
    });

    const amountLabel = formatCurrency(toNumber(request.amount), request.currency);

    await recordActivity({
      projectId,
      actorId: reviewer.id,
      action: 'payment.rejected',
      entityType: 'PaymentRequest',
      entityId: requestId,
      summary: `${reviewer.name} could not verify the payment of ${amountLabel}`,
      field: 'status',
      oldValue: PaymentRequestStatus.PENDING,
      newValue: PaymentRequestStatus.REJECTED,
    });

    NotificationService.emitAsync({
      event: 'payment.rejected',
      userIds: [request.submittedByUserId],
      context: {
        projectName: request.project.title,
        amount: amountLabel,
        reason: rejectionReason,
      },
      projectId,
      link: `/portal/projects/${projectId}/payments`,
    });

    return updated;
  },

  /** A client withdrawing their own pending submission. */
  async cancel(projectId: string, requestId: string, userId: string) {
    const request = await prisma.paymentRequest.findFirst({
      where: { id: requestId, projectId },
    });
    if (!request) throw ApiError.notFound('Payment request');
    if (request.submittedByUserId !== userId) {
      throw ApiError.forbidden('You can only withdraw a request you submitted');
    }
    if (request.status !== PaymentRequestStatus.PENDING) {
      throw ApiError.badRequest('Only a pending request can be withdrawn');
    }

    const updated = await prisma.paymentRequest.update({
      where: { id: requestId },
      data: { status: PaymentRequestStatus.CANCELLED },
      select: requestSelect,
    });

    // The proof was only ever needed to verify a live claim.
    if (request.proofKey) {
      try {
        removePrivateFile(request.proofKey);
        await prisma.paymentRequest.update({
          where: { id: requestId },
          data: { proofKey: null },
        });
      } catch {
        // A leftover file is harmless; the row no longer references it.
      }
    }

    return updated;
  },
};

export default PaymentRequestsService;
