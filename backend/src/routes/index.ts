import { Router } from 'express';
import { StatusCodes } from 'http-status-codes';
import { env } from '@config/env';
import { prisma } from '@config/database';
import authRoutes from '@modules/auth/auth.routes';
import clientRoutes from '@modules/clients/clients.routes';
import projectRoutes from '@modules/projects/projects.routes';
import invoiceRoutes from '@modules/invoices/invoices.routes';
import paymentRoutes from '@modules/payments/payments.routes';
import expenseRoutes from '@modules/expenses/expenses.routes';
import accountRoutes from '@modules/accounts/accounts.routes';
import ledgerRoutes from '@modules/ledger/ledger.routes';
import reportRoutes from '@modules/reports/reports.routes';
import emailRoutes from '@modules/email/email.routes';
import aiRoutes from '@modules/ai/ai.routes';
import dashboardRoutes from '@modules/dashboard/dashboard.routes';
import settingsRoutes from '@modules/settings/settings.routes';
import uploadRoutes from '@modules/uploads/uploads.routes';
import portalRoutes from '@modules/portal/portal.routes';
import notificationRoutes from '@modules/notifications/notification.routes';
import supportRoutes from '@modules/support/support.routes';

const router = Router();

/**
 * Liveness + readiness in one probe. The database round-trip is what makes
 * this a *readiness* check — a process that cannot reach Postgres should not
 * receive traffic even though it is technically alive.
 */
router.get('/health', async (_req, res) => {
  const startedAt = Date.now();
  let database: 'up' | 'down' = 'down';

  try {
    await prisma.$queryRaw`SELECT 1`;
    database = 'up';
  } catch {
    database = 'down';
  }

  const healthy = database === 'up';

  res.status(healthy ? StatusCodes.OK : StatusCodes.SERVICE_UNAVAILABLE).json({
    success: healthy,
    status: healthy ? 'healthy' : 'degraded',
    service: env.APP_NAME,
    version: process.env.npm_package_version ?? '1.0.0',
    environment: env.NODE_ENV,
    uptimeSeconds: Math.round(process.uptime()),
    checks: {
      database,
      openai: env.hasOpenAi ? 'configured' : 'not configured',
      smtp: env.hasGlobalSmtp ? 'configured' : 'not configured',
      resend: env.hasGlobalResend ? 'configured' : 'not configured',
    },
    responseTimeMs: Date.now() - startedAt,
    timestamp: new Date().toISOString(),
  });
});

// Auth is shared: both studio and portal users sign in through it.
router.use('/auth', authRoutes);

/*
 * Studio-only modules. Each router applies `authenticate` then `requireInternal`
 * immediately after, so a client-portal user — who holds a perfectly valid
 * token — cannot reach the studio's CRM, books or AI endpoints. The guard sits
 * inside each router rather than here because projects/ and invoices/ expose
 * genuinely public routes before their auth line.
 */
router.use('/clients', clientRoutes);
router.use('/projects', projectRoutes);
router.use('/invoices', invoiceRoutes);
router.use('/payments', paymentRoutes);
router.use('/expenses', expenseRoutes);
router.use('/accounts', accountRoutes);
router.use('/ledger', ledgerRoutes);
router.use('/reports', reportRoutes);
router.use('/email', emailRoutes);
router.use('/ai', aiRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/settings', settingsRoutes);
router.use('/uploads', uploadRoutes);

// ---- Client portal ---------------------------------------------------------
// Project workspaces, client invitations, QA, documents and delivery.
router.use('/portal', portalRoutes);
router.use('/notifications', notificationRoutes);
router.use('/support', supportRoutes);

export default router;
