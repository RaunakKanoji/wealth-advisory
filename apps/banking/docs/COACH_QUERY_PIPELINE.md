# Wealth Coach query pipeline

The live app uses the authenticated Hono API in `apps/api`; it does not use client-side Coach fixtures. Existing Expo screens and design tokens are retained. The redundant `index.web.tsx` Home wrapper was removed because its `./index` import resolved back to itself.

## Request flow

1. Clerk authentication resolves the internal application user. Explicit development demo authentication remains available; it is disabled by default and forbidden in production.
2. A request UUID claims a database-backed Coach run. Duplicate requests replay their existing answer. Active runs serialize per conversation and have a recovery lease.
3. Gemini produces a Zod-validated, read-only query plan. Plans cannot contain SQL or arbitrary tool names. Unsupported plans fail before retrieval.
4. Personal requests require persisted Coach consent. Education does not load personal records or send personal conversation history to the model without consent.
5. Server tools validate ownership and retrieve normalized accounts, goals and transactions. AA-backed account queries require active, unexpired account consent. Account/card duplicate records are counted once.
6. Calculations use integer paise. Relative periods use India-local calendar dates. The backend constructs verified totals, breakdowns, comparisons, goal simulations, transaction references and warnings.
7. Gemini explains the verified context. Output validation rejects unsupplied numeric values; failure retains the deterministic explanation and evidence. This numeric guard is not a proof of semantic correctness; live model evaluation remains required.
8. Messages, plans, verified results, context and runs persist in Neon. The UI renders server-controlled metrics, charts, transaction links, sources and per-answer follow-ups. Source inspection paginates immutable transaction snapshots from the run, including both comparison periods. Saved summaries reference persisted messages.

The Activity page uses `/api/v1/activity/search` for filtering, sorting, summaries and pagination. It shares normalized retrieval with Coach. Transaction detail routes resolve account/card IDs directly rather than scanning recent pages. Home/Coach current cash-flow summaries use the same normalized ledger.

## Configuration

Client: `EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`.
Server: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `CLERK_SECRET_KEY`, `CLERK_AUTHORIZED_PARTIES`, optional `CLERK_AUDIENCE`, `GEMINI_API_KEY`, `GEMINI_MODEL`.

Set the Gemini model explicitly to a model available to the configured project. Missing configuration is reported honestly. No database, Gemini, AA or bank secret belongs in an Expo public environment variable.

Fixtures require `EXPO_PUBLIC_USE_MOCK_DATA=true`; they are not an error fallback. Backend demo authentication separately requires `DEMO_MODE=true`. Client use of the seeded API identity separately requires `EXPO_PUBLIC_ALLOW_DEMO_AUTH=true` in development. Never enable these in production.

Run `pnpm dev:coach` from `apps/api` to use the git-ignored `.env.coach.local` configuration for the isolated development branch on port 8080. The API binds to `0.0.0.0` so a physical device can reach it; Expo keeps its default Metro port 8081 and points to `http://127.0.0.1:8080` locally. Run the backend from `apps/api` so its server environment is loaded. Run `pnpm db:migrate:coach` there using a development branch and a direct database URL. Migrations `0003_coach_query_pipeline.sql` and `0004_coach_source_snapshots.sql` add Coach consent, context, runs, reports, immutable evidence and query indexes; no tables are created at application startup. Existing text entity keys and table names are retained for compatibility. New run/report IDs are UUID columns and newly created entities use UUID strings; this is not a conversion of every legacy table to UUID columns.

## Validation and deployment status

Validated on Neon branches `dev-coach-query-pipeline-20260921` and `production`; both contain the required application and Coach tables.

- Client lint/typecheck and 150 passing regression tests.
- Backend typecheck and 38 passing unit tests with mocked providers, plus 8 Neon-backed integration tests.
- Expo export compiled iOS, Android and web bundles and 115 static routes. This is compilation, not a device walkthrough.
- Read-only development database checks for scope, filters, balances, goals and Activity pagination.
- Database persistence integration test with a disposable synthetic user and mocked Gemini: messages, context, runs, reports, idempotency and cross-user denial.

Opt-in database checks (from `apps/api`):

```sh
node --import tsx src/coach/database-check.ts
node node_modules/vitest/vitest.mjs run --config vitest.coach-db.config.ts
```

The first check expects the existing development fixture identity. The second creates and removes its own synthetic user. Neither contacts Gemini or a bank.

## Remaining release gates and limits

Live personal-data Gemini testing awaits explicit approval after automatic approval review rejected granting consent and transferring database-derived financial context to Gemini. No such test has been executed. Browser discovery returned no available browser, so visual, signed-in, iOS and Android walkthroughs remain unverified.

AA/bank provider onboarding and Clerk production credentials are deployment prerequisites. Card control operations retain the existing simulation and are marked `writeMode: simulated` internally. This work does not claim production bank writes.

Queries currently bound server-side analysis to 20,000 normalized records, report truncation and ask for a narrower period. They do not send thousands of records to the mobile client. Large deployments should replace this bound with database-level aggregate/pagination queries and explicit provider coverage proofs. Standalone card records without linked ledger categories remain `other`; merchant/category inference never silently rewrites records through Gemini.

The existing schema's provider/institution, AA sync and audit structures are reused; not every proposed table name in the specification has been introduced. Provider-specific readiness, and full natural-language scenario evaluation still need a release review. This implementation is not a claim that all production acceptance criteria are complete.

References: [Expo SDK 54](https://docs.expo.dev/versions/v54.0.0/), [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output), [Neon migrations with Drizzle](https://neon.com/docs/guides/drizzle), [Clerk backend verification](https://clerk.com/docs/reference/backend/overview).
