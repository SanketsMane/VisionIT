import type { Application } from 'express';
import swaggerUi from 'swagger-ui-express';
import { env } from '@config/env';

/**
 * Hand-written OpenAPI description of the shared envelope plus a route index.
 * Per-endpoint schemas live with their zod validators, which are the actual
 * source of truth — this document describes the contract, not a duplicate of it.
 */
const spec = {
  openapi: '3.0.3',
  info: {
    title: `${env.APP_NAME} API`,
    version: '1.0.0',
    description: `
Portfolio catalog, invoicing, AI email and double-entry accounting for an independent software studio.

**Authentication** — Every route outside \`/auth/*\` and the public share links requires
\`Authorization: Bearer <accessToken>\`. Access tokens are short-lived; the refresh token is
delivered as an httpOnly cookie and rotated on every \`POST /auth/refresh\`.

**Response envelope** — Successful responses are always
\`{ success: true, message, data, meta?, timestamp }\`.
Failures are always \`{ success: false, message, code, issues?, timestamp }\`.

**Money** — All monetary values are decimal-precise on the server and serialised as JSON numbers
with 2 decimal places. Never do arithmetic on them in floating point on the client for anything
that will be stored.
    `.trim(),
  },
  servers: [{ url: `http://localhost:${env.PORT}${env.API_PREFIX}`, description: 'Local' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      SuccessEnvelope: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string' },
          data: {},
          meta: { type: 'object', nullable: true },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
      ErrorEnvelope: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string' },
          code: { type: 'string', example: 'VALIDATION_ERROR' },
          issues: {
            type: 'array',
            items: {
              type: 'object',
              properties: { field: { type: 'string' }, message: { type: 'string' } },
            },
          },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  tags: [
    { name: 'Auth', description: 'Registration, login, refresh rotation, sessions, password reset' },
    { name: 'Dashboard', description: 'Aggregated KPIs, receivables and trends' },
    { name: 'Clients', description: 'CRM records and contacts' },
    { name: 'Projects', description: 'Portfolio catalog, milestones and technologies' },
    { name: 'Invoices', description: 'Invoices, quotes, payments, PDF rendering and share links' },
    { name: 'Payments', description: 'Receipt history and collection analytics' },
    { name: 'Expenses', description: 'Costs, receipts and categories' },
    { name: 'Accounts', description: 'Chart of accounts, balances and transfers' },
    { name: 'Ledger', description: 'Double-entry journal and trial balance' },
    { name: 'Reports', description: 'P&L, balance sheet, cash flow, monthly statements, tax' },
    { name: 'Email', description: 'Mailboxes, templates, drafts and delivery' },
    { name: 'AI', description: 'OpenAI-backed email drafting, rewriting and subject lines' },
    { name: 'Settings', description: 'Company profile, preferences, activity and notifications' },
    { name: 'Uploads', description: 'Image and document storage' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Dashboard'],
        summary: 'Liveness and readiness probe',
        security: [],
        responses: {
          200: { description: 'Service healthy' },
          503: { description: 'Database unreachable' },
        },
      },
    },
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Create an account and provision a workspace',
        description:
          'Creates the user, company profile, full chart of accounts, expense categories, invoice number sequences and starter email templates in a single transaction.',
        security: [],
        responses: { 201: { description: 'Account created' }, 409: { description: 'Email already registered' } },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Sign in',
        security: [],
        responses: { 200: { description: 'Signed in' }, 401: { description: 'Invalid credentials' } },
      },
    },
    '/invoices/{id}/send': {
      post: {
        tags: ['Invoices'],
        summary: 'Issue an invoice and post it to the ledger',
        description:
          'Moves the invoice out of DRAFT and posts the accrual entry: Dr Accounts Receivable / Cr Income + Tax Payable. Quotations and proformas are issued without posting.',
        responses: { 200: { description: 'Issued' }, 400: { description: 'Already issued' } },
      },
    },
    '/invoices/{id}/payments': {
      post: {
        tags: ['Invoices'],
        summary: 'Record a payment against an invoice',
        description:
          'Creates the receipt, posts Dr Bank + Bank Charges / Cr Accounts Receivable, and moves the invoice to PARTIALLY_PAID or PAID.',
        responses: { 201: { description: 'Payment recorded' }, 400: { description: 'Exceeds balance due' } },
      },
    },
    '/reports/monthly-pack': {
      get: {
        tags: ['Reports'],
        summary: 'Full month-end financial pack',
        description: 'Monthly statement, P&L, balance sheet, cash flow and tax summary in one response.',
        responses: { 200: { description: 'Generated' } },
      },
    },
    '/ai/email/generate': {
      post: {
        tags: ['AI'],
        summary: 'Draft a client email with OpenAI',
        description:
          'Builds a factual context from the linked client, invoice and project, then drafts subject and body. The model is constrained never to invent figures, dates or commitments.',
        responses: {
          200: { description: 'Draft generated' },
          503: { description: 'OPENAI_API_KEY not configured' },
        },
      },
    },
  },
};

export const mountSwagger = (app: Application): void => {
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(spec, {
      customSiteTitle: `${env.APP_NAME} API Reference`,
      swaggerOptions: { persistAuthorization: true, displayRequestDuration: true },
    }),
  );

  app.get('/api-docs.json', (_req, res) => res.json(spec));
};

export default mountSwagger;
