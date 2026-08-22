# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

نظام عدالة (Adala System) — a law firm management system (cases, clients, sessions, tasks, documents, finance) for Arabic-speaking law offices. Backend is Node.js/Express with a vanilla HTML/CSS/JS frontend (RTL, Arabic UI/strings throughout — keep new UI text and error messages in Arabic to match the existing app).

## Commands

```bash
npm install          # install dependencies
npm run init-db       # initialize the SQLite schema (backend/scripts/init-database.js)
npm run dev            # run with nodemon (development)
npm start               # run with node (production)
npm test                 # jest --runInBand --forceExit
npx jest backend/tests/auth.test.js   # run a single test file
```

There is no lint or typecheck script configured.

## Architecture

### Two data layers coexist — know which one is live

The **running application uses raw `sqlite3`**, not Prisma. `backend/db/database.js` is a hand-written singleton wrapping `sqlite3` (`run`/`get`/`all`/transactions) against `database/adala.db`. Every controller, service, and the `auth` middleware imports `backend/db/database.js` and writes hand-crafted SQL. Multi-tenancy in this live layer is done via an `office_id` column on each table (offices/users/clients/cases/etc.), scoped manually per-query and enforced by `req.session.officeId`.

`prisma/schema.prisma` and `backend/db/prisma.js` describe a **separate, not-yet-wired-in PostgreSQL data layer** built around a `Tenant` model and `tenantId` (UUID) columns, with a Prisma client extension that auto-injects `tenantId` from `backend/utils/tenantStorage.js` (an `AsyncLocalStorage` populated by `backend/middleware/tenantContext.js`). As of now `tenantContext` middleware is **not mounted** in `server.js`, and only `backend/services/AuditService.js` uses `db/prisma.js`. Treat the Prisma/Postgres layer as in-progress migration scaffolding, not the source of truth — when fixing bugs or adding features to existing routes, follow the sqlite3 + `office_id` pattern used everywhere else unless you are deliberately continuing the Postgres migration (confirm with the user before assuming that's in scope).

`frontend/src/` is empty/unused — the real frontend is `frontend/public/`.

### Multi-tenancy Security

Every controller and service query touching office-owned data (clients, cases, sessions, tasks, documents, financial records, etc.) was fully audited for `office_id` isolation on 2026-08-18. Any new or modified SQL query that reads or writes office-owned data **must** include an `office_id` (or equivalent join-scoped) condition matching `req.session.officeId` — never trust an `office_id`/`officeId` value from `req.body` or `req.query` for scoping, only from the session. This applies to every layer: raw `db.get`/`db.all`/`db.run` calls in controllers, service methods, and dynamically built `WHERE` clauses (including the `whereConditions`/`params` array pattern used across `caseController.js`, `clientController.js`, `sessionController.js`, `documentController.js`, `taskController.js`, etc.). A handful of shared, non-office-scoped tables are intentional exceptions: `users.username`/`users.email` uniqueness checks (global by design, used pre-login during registration) and system-wide background jobs (`NotificationService`, `ReminderService`, `cronService`) that iterate all offices but stamp each row's own `office_id` when writing. Any new API route serving office-owned data must also be mounted behind `authMiddleware.requireAuth` (or `requireRole`) — do not add unauthenticated routes under `/api/<resource>` for tenant data.

### Request flow

`server.js` wires: `helmet` → CORS (origin allow-list from `ALLOWED_ORIGINS` env var) → JSON/urlencoded body parsing → static `frontend/public` + `/uploads` → `express-session` (backed by `connect-sqlite3`, storing `database/sessions.db`) → request logger → `apiLimiter` rate limiter on `/api` → one router per resource mounted under `/api/<resource>` → SPA page routes (serves the matching `.html` from `frontend/public` for known paths, falling back to `login.html`) → `errorHandler` middleware.

Each API resource follows the same three-layer pattern:
- **Route** (`backend/routes/*.js`): wires `express-validator` chains from `backend/middleware/validation.js`, auth/role middleware from `backend/middleware/auth.js`, and rate limiters, then delegates to a controller.
- **Controller** (`backend/controllers/*.js`): extends `backend/utils/BaseController.js` (gives `asyncWrapper`, `sendSuccess`, `sendCreated`, `sendError` for a consistent JSON envelope `{ success, message, data }`). Controllers read `req.session.userId` / `req.session.officeId`, and either call a service or run SQL directly (both patterns exist in the same file, e.g. `clientController.js`).
- **Service** (`backend/services/*.js`): business logic and SQL against `backend/db/database.js`; most write actions also call `ActivityService.logActivity(...)` for the audit/activity trail and `NotificationService` for user notifications.

Auth is session-based (`express-session` + SQLite store), not JWT. `backend/middleware/auth.js` provides `requireAuth`, `requireRole(roles)`, `checkOwnership(entityType)`, and `getCurrentUser`.

### Scheduled/background work

`backend/services/cronService.js` (via `node-cron`) and `backend/services/ReminderService.js` are started from `server.js` after DB connectivity is confirmed — they handle upcoming-session reminders (7d/3d/24h/2h before) and overdue-task alerts, sent through `EmailService.js` (nodemailer). `BackupService.js` performs scheduled SQLite backups into `database/backups/` with a retention policy.

### Tests

Jest + Supertest integration tests live in `backend/tests/`. Each test file sets `process.env.DB_PATH` to a fresh temp file, builds the schema via `backend/tests/setup/testDb.js`, then boots the real `server.js` app with `supertest`.

`backend/db/schema.js` is the single source of truth for the table definitions: it exports `CREATE_TABLES`/`DROP_TABLES` as side-effect-free SQL strings, and both `backend/scripts/init-database.js` (real database, plus sample data and the `--force` data-loss guard) and `backend/tests/setup/testDb.js` (tables only, no data) import from it. **Add or change tables and columns only in `backend/db/schema.js`** — the test database is not a trimmed subset any more, so both sides stay in step automatically. Test files build their own fixtures; the sample rows seeded by `init-database.js` are deliberately not part of the test database.

### Frontend

`frontend/public/*.html` are static, server-rendered-by-route pages (one per feature area: cases, clients, sessions, documents, financial, reports, tasks, calendar, settings, team, portal). Each page loads its matching `frontend/public/js/<page>.js` plus shared `utils.js` (toast/loading helpers) for API calls and DOM wiring — there is no bundler or frontend framework.
