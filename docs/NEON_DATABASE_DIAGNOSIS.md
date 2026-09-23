# Neon database diagnosis

Last verified: 2026-09-15 (Asia/Kolkata)

## Discovered architecture

| Item | Current implementation |
| --- | --- |
| Backend runtime | Node server using Hono and `@hono/node-server` |
| Database library | Drizzle ORM with one `@neondatabase/serverless` Pool |
| `DATABASE_URL` loaded from | `apps/api/.env.local`, loaded by `apps/api/src/env.ts` |
| Schema location | `apps/api/src/db/schema/index.ts` |
| Migration command | `cd apps/api && ./node_modules/.bin/tsx src/db/migrate.ts` |
| Seed command | `cd apps/api && ./node_modules/.bin/tsx src/db/seed.ts` |
| Database check | `cd apps/api && ./node_modules/.bin/tsx src/db/verify.ts` or `db:check` |
| Accounts API route | `GET /api/v1/accounts` |
| Frontend API base URL | `http://10.20.84.184:8080` in local development only |
| Authentication | Clerk bearer tokens in production; explicit `x-demo-auth-id` / configured demo user in `DEMO_MODE` |
| AA ingestion | Server-only provider adapter, verified webhooks, ReBIT normalizer, additive Neon ingestion tables |
| Workspace development command | `pnpm dev` starts both `@idbi/api` and `@idbi/banking`; `pnpm dev:banking` starts only Expo |

The Expo application does not import the Neon driver and does not contain a
database URL. It calls the backend through `apps/banking/lib/api/client.ts`.

## Verification results

All checks below were executed against the backend's configured Neon
connection, whose local branch marker is `production`:

| Check | Result |
| --- | --- |
| `DATABASE_URL` present at backend runtime | YES |
| `SELECT 1 AS ok` | YES (`ok = 1`) |
| `users` table exists | YES |
| `profiles` table exists | YES |
| `accounts` table exists | YES |
| `account_balances` table exists | YES |
| `transactions` table exists | YES |
| Users row count | 2 |
| Accounts row count | 4 |
| Account balances row count | 4 |
| Resolved demo user | `usr_demo_a` |
| Accounts for resolved demo user | 4 |
| `GET /api/v1/accounts` | HTTP 200 |
| API response summary | `345678.00 / 225000.00 / 120678.00` |
| Phone client account request | HTTP 200; `accountCount: 4` |
| Development status endpoint | all checks true; current user account count 4 |
| AA migration | applied to Neon `production`; all AA tables present; current AA row counts 0 until consent approval |

The seeded mapping is:

```text
demo-customer-a -> users.id usr_demo_a -> 4 owned accounts
```

The repository now fetches user-scoped accounts first and then selects only
the newest balance snapshot for each account. The service maps database column
names and PostgreSQL numeric strings into an explicit JSON DTO, derives
`holds`, and calculates the summary using integer minor-unit arithmetic.

The raw checks are also available as `apps/api/scripts/test-db.ts` and
`apps/api/scripts/test-accounts.ts`; `apps/api/scripts/setup-db.ts` runs the
migration, deterministic seed, and check sequence.

## Failure identified and corrected

The Neon connection and seeded data were present, but a non-production Expo
build could still send a stale Clerk bearer token while the API had no Clerk
secret configured. That request stopped in authentication with
`AUTH_NOT_CONFIGURED`, before the accounts query ran. The client now sends the
explicit seeded demo identity only when the local-only
`EXPO_PUBLIC_ALLOW_DEMO_AUTH=true` flag is enabled, and the API prefers that
header only while `DEMO_MODE=true`. Production continues to use Clerk bearer
verification.

The AA migration has now been applied additively. Live AA rows are intentionally
still absent until a provider consent is approved and the provider returns a
decrypted FI payload; the explicit mock adapter is available only for disposable
test data.

The app also now distinguishes network, authentication/API, and empty-data
states instead of treating every failure as a connection failure. Home and
Accounts use the same TanStack Query account key and retry the existing query.

## Current incident check

On 2026-09-15, Neon and seed verification passed, but no local process was
listening on API port `8080`. The configured LAN URL therefore returned a network
failure to the phone. Starting the API on `0.0.0.0:8080` restored HTTP 200 for
both `/api/health` and `/api/v1/accounts`; the latter returned the 4 seeded
accounts. The root `pnpm dev` command now starts the API and Expo together.

## Phone-facing verification

The backend is bound to `0.0.0.0:8080`, Metro is on port `8081`, and the
phone-facing API URL returns the same health and account response from the Mac.
After the development build was relaunched on the connected iPhone, Metro
reported `/api/v1/accounts` HTTP 200 followed by
`[CLIENT] accounts query success { accountCount: 4 }`. This verifies the
Neon-backed response reached the mobile query layer on-device.
