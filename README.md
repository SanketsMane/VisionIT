# Vision IT Infra

Portfolio catalog · Invoicing · AI client email · Double-entry accounting · Client project portal

A full-stack platform for an independent software studio: catalog the projects you've shipped,
bill for them with production-grade invoices, let OpenAI draft the client emails, and get real
financial statements out the other end — because every invoice, payment and expense posts to a
proper double-entry ledger.

---

## Stack

| Layer     | Choice |
|-----------|--------|
| Frontend  | Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS v4, TanStack Query v5, Radix UI, Recharts |
| Backend   | Node.js 22, Express 5, TypeScript, Prisma 7 (driver adapters), Zod 4 |
| Database  | PostgreSQL 17 |
| AI        | OpenAI (`gpt-4o` by default) |
| Email     | Nodemailer (SMTP/Gmail) or Resend |
| PDF       | Handlebars-free HTML templates rendered by Puppeteer |

---

## Quick start

```bash
# 1. Install everything
npm run install:all

# 2. Create the database (PostgreSQL must be running)
createdb vision_it_infra
createdb vision_it_infra_shadow

# 3. Configure the backend
cp backend/.env.example backend/.env
#    → set DATABASE_URL, and generate the three secrets:
#      openssl rand -base64 48   # JWT_ACCESS_SECRET
#      openssl rand -base64 48   # JWT_REFRESH_SECRET
#      openssl rand -hex 32      # ENCRYPTION_KEY

# 4. Configure the frontend
cp frontend/.env.example frontend/.env.local

# 5. Migrate + seed
npm run db:migrate
npm run db:seed

# 6. Run both apps
npm run dev
```

| Service | URL |
|---------|-----|
| Web app | http://localhost:3000 |
| API | http://localhost:5055/api/v1 |
| API docs (Swagger) | http://localhost:5055/api-docs |
| Prisma Studio | `npm run db:studio` |

> **Port note** — the API runs on **5055**, not 5000. macOS AirPlay Receiver squats on 5000 and
> silently answers requests with a 403, which looks exactly like a broken CORS config.

### Root scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Runs API + web together with colour-coded logs |
| `npm run build` | Production build of both |
| `npm run typecheck` | Typechecks both projects |
| `npm run db:migrate` / `db:deploy` | Prisma migrations (dev / production) |
| `npm run db:seed` | Provisions a **clean** workspace (no business data) — idempotent |
| `npm run setup` | install + migrate + seed in one go |

---

## Project layout

Both apps follow the same rule: **one folder per feature, the same five files inside it.**
When something breaks, the module folder is the only place you need to look.

```
vision-it-infra/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma            # 40 models, 32 enums
│   │   └── migrations/
│   ├── prisma.config.ts             # Prisma 7 moved the datasource URL here
│   └── src/
│       ├── config/                  # env, database, logger, openai, mailer, resend
│       ├── middlewares/             # auth, validate, error, rate-limit, upload, audit
│       ├── modules/                 # ← the MVC layers live here
│       │   ├── auth/
│       │   ├── clients/
│       │   ├── projects/
│       │   ├── invoices/
│       │   ├── payments/
│       │   ├── expenses/
│       │   ├── accounts/
│       │   ├── ledger/
│       │   ├── reports/
│       │   ├── email/
│       │   ├── ai/
│       │   ├── dashboard/
│       │   ├── settings/
│       │   ├── uploads/
│       │   ├── notifications/       # the one event/email engine
│       │   └── portal/              # ← client portal
│       │       ├── portal.permissions.ts   # role → permission matrix
│       │       ├── portal.activity.ts      # per-project audit trail
│       │       ├── invitations/
│       │       ├── members/
│       │       ├── payment-requests/
│       │       ├── bugs/
│       │       ├── documents/
│       │       ├── delivery/
│       │       ├── announcements/
│       │       └── workspace/
│       ├── routes/index.ts          # mounts every module + /health
│       ├── jobs/                    # overdue sweep, token purge, scheduled email
│       ├── db/seed/                 # owner account + workspace scaffolding
│       ├── docs/swagger.ts
│       ├── app.ts                   # Express wiring
│       └── server.ts                # bootstrap + graceful shutdown
│
└── frontend/
    ├── public/                      # logo assets
    └── src/
        ├── app/
        │   ├── (auth)/              # login, register — split marketing layout
        │   ├── (portal)/            # client portal — its own chrome
        │   │   └── portal/projects/[projectId]/
        │   ├── invite/[token]/      # public invitation landing page
        │   ├── (app)/               # everything behind the auth gate
        │   │   ├── dashboard/  projects/  clients/  invoices/
        │   │   ├── expenses/   accounts/  ledger/   reports/
        │   │   └── email/      settings/
        │   ├── invoice/[token]/     # public client-facing invoice link
        │   └── layout.tsx
        ├── components/
        │   ├── ui/                  # button, input, dialog, select, table, …
        │   ├── layout/              # sidebar, topbar, app shell
        │   ├── shared/              # money, stat-card, status-badge, pagination, …
        │   └── modules/             # per-feature: invoice builder, AI composer, charts
        ├── lib/
        │   ├── api/                 # one file per backend module + axios client
        │   ├── hooks/               # query keys, mutation handlers
        │   ├── format.ts            # currency, dates, humanize
        │   └── utils.ts
        ├── store/                   # auth + UI (zustand)
        ├── providers/               # query, theme, auth, toasts
        └── types/                   # mirrors the Prisma schema
```

### The module pattern (backend)

Every module is the same five files, so any feature is navigable without a map:

```
modules/invoices/
├── invoices.model.ts        # Data access. All Prisma queries. Always scoped by userId.
├── invoices.service.ts      # Business rules. Transactions. Ledger posting.
├── invoices.controller.ts   # HTTP only — unwrap request, call service, send envelope.
├── invoices.routes.ts       # Route table + which middleware guards each one.
├── invoices.validation.ts   # Zod schemas. The single source of truth for input shape.
└── (extras)                 # invoices.calculator.ts, invoices.template.ts, invoices.pdf.ts
```

**Why the model layer exists:** every query is scoped by `userId` *inside* the model. Nothing
above it is trusted to remember the tenant filter, which turns a cross-account data leak from a
review-discipline problem into a structural one.

---

## What's built

### Two applications, one platform

| | Studio app (`/dashboard`) | Client portal (`/portal`) |
|---|---|---|
| Who | You and your team (`INTERNAL`) | Invited clients (`CLIENT`) |
| Sees | Everything in the workspace | Only projects they're a member of |
| Access | Owns the workspace | `ProjectMember` row + role |

Both share one auth system. Which app you land in is decided by `userType`, and
a user of one type is redirected out of the other.

### Portfolio catalog
Projects across Web / Android / iOS / Cross-platform / AI-ML and more, with a technology
dictionary (shared and normalised, so `Next.js`, `next js` and `NextJS` collapse to one entry),
milestones, case-study fields, testimonials, logged hours and a public share route.

### Invoicing
- Invoices, quotations, proforma and credit notes, each with its own numbering sequence
- **Five templates** — modern, classic, minimal, corporate, creative — all sharing one HTML
  skeleton, so layout logic exists once and only the design tokens change
- GST-aware: HSN/SAC codes, CGST/SGST vs IGST splitting, tax-inclusive pricing, round-off,
  amount-in-words in the lakh/crore scale
- Server-calculated totals — the builder preview, the saved invoice and the PDF cannot disagree,
  because all three call the same endpoint
- PDF export, a public share link, and per-invoice accent colours

### Accounting (the real thing)
- Full chart of accounts (38 accounts) provisioned on signup
- **Genuine double entry.** Unbalanced entries are rejected before they reach the database
- Automatic posting:
  - Issue an invoice → `Dr Accounts Receivable / Cr Income + Tax Payable`
  - Record a payment → `Dr Bank + Bank Charges / Cr Accounts Receivable`
  - Record an expense → `Dr Expense + Input Tax / Cr Bank`
- Editing an expense **reverses and re-posts** rather than mutating a posted entry
- Account statements with running balances, transfers, manual journal entries

### Financial statements
Profit & loss, balance sheet, cash flow (direct method), trial balance, tax summary, and a
month-end statement pack — all derived from posted ledger movement, never from invoice totals,
so manual adjustments show up exactly as an accountant expects.

### Client Project Portal
A second application on the same data: clients get their own login, scoped to
the projects they were invited to.

- **Secure invitations** — random token, only its SHA-256 is stored, with
  expiry, revoke and regenerate. Revoking or resending kills the old link.
- **Four client roles** — Client Owner, Client Manager, Tester, Viewer.
  Permissions are derived from the role at request time, never stored per user.
- **QA workspace** — full bug lifecycle enforced by a transition table
  (Submitted → Acknowledged → Assigned → In Progress → Fixed → Ready for retest
  → Retested → Closed, plus Rejected / Duplicate / Cannot reproduce / Deferred),
  priority *and* severity kept separate, attachments, and an activity timeline.
- **Internal vs client comments** — internal notes are filtered out in the
  service layer, not hidden in the UI, and a client-side author cannot create
  one even by crafting the request.
- **Payment submission and approval** — a client submits a payment with proof;
  it is *not* money until an admin approves it, at which point it posts through
  the same ledger path as a manual payment.
- **Documents** — admin-only vs client-visible, versioned, stored outside the
  public route and streamed only after membership is checked.
- **Delivery & ownership transfer** — a real workflow, not a "mark as delivered"
  button: a 12-item checklist, GitHub or ZIP handover, published versions with
  SHA-256 checksums, and two-sided confirmation. Delivery is gated on live
  readiness checks (open critical bugs, unpaid invoices, shared documents,
  checklist), so a project cannot be closed early by accident.
- **Notification engine** — one `emit()` call site; 30 events with templates,
  routed to in-app and email by audience, with a delivery log so an admin can
  answer "did the client actually get told?"
- **Per-project audit trail** — every action, with old/new values, filtered for
  the client-facing timeline.

### AI email
OpenAI drafts client emails from *real* data — the linked client, invoice and project. The model
is constrained never to invent a figure, date or commitment: anything not resolved from your
database is simply absent from the prompt. Output is HTML-sanitised server-side before it is
stored or sent. Every call is logged with its token count and rupee cost.

Also: rewrite-with-instruction, subject-line suggestions, 8 seeded templates with merge fields,
and per-user sending mailboxes over SMTP or Resend.

---

## Security

| Concern | Approach |
|---------|----------|
| Passwords | bcrypt, 12 rounds |
| Sessions | Short-lived JWT access token in memory + rotating refresh token in an httpOnly cookie. Only the **hash** of the refresh token is stored, so a database dump is not a session leak. |
| Token refresh | Rotation with replay rejection; concurrent 401s share one refresh promise |
| Third-party credentials | SMTP passwords and API keys are AES-256-GCM encrypted at rest and never returned by the API |
| Input | Zod on every route; parsed output *replaces* the request segment so handlers only see validated data |
| Rate limiting | Global, plus tighter buckets for auth, AI (costs money per call) and email sending |
| Errors | Non-operational failures never leak internals in production; every response carries a request id |
| Audit | Activity log on all mutating routes, plus a per-project trail |
| Project access | Every project route resolves **User → Membership → Project → Permission**. Knowing an id grants nothing; a non-member gets 404, not 403, so ids can't be probed. |
| Studio isolation | Client users are rejected from every studio module at the router, not per-endpoint |
| Invitations | Only the token hash is stored, with expiry, revoke and single use |
| Private files | Payment proofs, documents and source archives live outside the static route and stream only after membership is verified; path traversal is rejected |
| Internal notes | Filtered in the service layer — a client-side author cannot create an internal comment at all |

---

## Notable engineering decisions

**Totals are computed server-side, always.** The invoice builder debounces and asks the API. It
would have been faster to duplicate the arithmetic in the browser — and then the preview, the
stored invoice and the PDF would drift apart the first time a rounding rule changed.

**Money is `Decimal`, never `number`.** Postgres `DECIMAL(18,2)` end to end, with half-up
rounding. Floats are only produced at the JSON boundary.

**Statements read the ledger, not the documents.** A P&L built from invoice totals silently
ignores manual journal adjustments. This one reads posted movement, so the trial balance and the
balance sheet always tie.

**Accumulated profit all flows to equity.** There's no year-end closing entry in this system, so
the balance sheet folds *all* undistributed profit into equity — split into prior-period and
current-period lines for presentation. Only counting the current fiscal year would drop every
rupee earned before the year boundary and fail to balance by exactly that amount.

**A client submitting a payment does not move money.** It creates a claim.
Approval is what posts to the ledger — through the same code path as a manual
payment, so an approved request and a hand-entered one produce identical
accounting.

**Delivery is gated on live data, not checkboxes.** Open critical bugs, unpaid
invoices, shared documents and the handover checklist are all evaluated at the
moment of delivery. An admin cannot mark a project delivered while any of them
fails, and cannot complete it before the client has confirmed receipt.

**Soft deletes where history matters.** Clients, projects, invoices and expenses are soft-deleted;
cancelling an invoice voids its ledger entry rather than erasing it.

---

## Environment

### `backend/.env`

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | ✅ | 32+ chars — `openssl rand -base64 48` |
| `JWT_REFRESH_SECRET` | ✅ | Must differ from the access secret |
| `ENCRYPTION_KEY` | ✅ | Exactly 64 hex chars — `openssl rand -hex 32`. **Rotating this makes every stored mailbox credential unreadable.** |
| `PORT` | | Defaults to 5055 |
| `CLIENT_URL` / `CORS_ORIGINS` | | Frontend origin |
| `OPENAI_API_KEY` | | Without it, AI endpoints return a clear 503 and everything else keeps working |
| `SMTP_*` | | Optional process-wide fallback mailbox |
| `RESEND_API_KEY` | | Alternative to SMTP |

### `frontend/.env.local`

| Variable | Notes |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | Defaults to `http://localhost:5055/api/v1` |

---

## Deployment notes

- **PDF rendering needs Chromium.** On a fresh server run `npx puppeteer browsers install chrome`.
  Without it, PDF endpoints return a descriptive 503 while the rest of the API is unaffected.
- **Uploads are local-disk** under `backend/uploads/`. Put them behind object storage + a CDN
  before you scale past one instance.
- **Migrations:** use `npm run db:deploy` (`prisma migrate deploy`) in production, never `dev`.
- **Background jobs** run in-process on timers (overdue sweep, token purge, scheduled email).
  Set `ENABLE_CRON=false` on replicas so only one instance runs them.
