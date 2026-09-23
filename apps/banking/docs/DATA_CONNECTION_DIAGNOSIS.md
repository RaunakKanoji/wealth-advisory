# IDBI data connection diagnosis

Verified on 21 September 2026 against the local development configuration.

## Root cause

The development configuration used port `8081` for both Expo Metro and the
backend. The mobile client rewrites a loopback API hostname to the Metro host
for physical-device development; with the API also on `8081`, requests could
land on Metro instead of Hono. The Coach server was additionally bound to
`127.0.0.1`, which is not reachable from a physical phone. The standard API
is now isolated on `8080` and binds to `0.0.0.0`.

This was not a Neon connectivity or schema failure. Independent checks now
prove each backend layer:

- `GET /api/health` proves API reachability without touching Neon.
- `GET /api/health/database` executes `SELECT 1` and returned HTTP 200.
- `GET /api/health/data` authenticates the demo user and verifies account,
  transaction, and goal queries.
- `GET /api/v1/accounts/overview` returned 4 owner-scoped accounts.
- Transactions, wealth summary, insights, and goals returned database-backed
  rows for the same authenticated user.
- The deterministic Coach calculation for “Where did I spend the most this
  month?” returned `food ₹19,550.00` before any Gemini call.
- `GET /api/health/ai` returned the configured Gemini model as healthy.

## Verified request chain

```text
Expo app
  -> EXPO_PUBLIC_API_BASE_URL
  -> Hono API on :8080 (Expo Metro remains on :8081)
  -> demo/Clerk auth middleware
  -> accounts service
  -> Drizzle repository
  -> shared Neon serverless pool
  -> PostgreSQL schema and seeded rows
```

The mobile app contains no PostgreSQL client or database credentials. A
repository search found no client-side `DATABASE_URL`, `postgres://`, `pg`,
Prisma, or Drizzle usage.

## Fix implemented

- Added the canonical `GET /api/v1/accounts/overview` route. The existing
  `/api/v1/accounts` route remains as a backwards-compatible alias.
- Home, Accounts, Coach, and transaction resource loading now use the shared
  accounts overview request and query key.
- The overview response includes `meta.source`, `meta.lastUpdated`,
  `meta.stale`, and `meta.accountCount`.
- Deposit accounts now return `availableBalance: null` instead of presenting
  an artificial available balance of `0.00`; their current value remains the
  ledger balance.
- Added an API-level `db:check` command and an explicit `demo:reset` command.
- Added explicit client `EXPO_PUBLIC_DEMO_MODE=true` support. It is opt-in and
  rejected in production; it does not silently replace a failed live request.
- Separated API port `8080` from Expo Metro `8081`, and bound the local API to
  `0.0.0.0` for physical-device access.
- Added independent liveness, database, and authenticated representative-data
  health endpoints.
- Coach retries reuse the durable request ID and failed run record, preventing
  duplicate user messages while allowing a failed run to be retried.
- Existing client lifecycle handling keeps cached content during refresh and
  gives first-load requests a retryable timeout state.

## Local verification

From the repository root:

```sh
pnpm dev
```

Or start the processes separately:

```sh
cd apps/api && npm run dev
cd apps/banking && npm run start
```

Then run:

```sh
cd apps/api
npm run db:check
curl -i http://127.0.0.1:8080/api/health
curl -i http://127.0.0.1:8080/api/health/database
curl -i http://127.0.0.1:8080/api/health/data \
  -H 'x-demo-auth-id: demo-customer-a'
curl -i http://127.0.0.1:8080/api/health/ai
```

The mobile variable is named `EXPO_PUBLIC_API_BASE_URL` in this repository,
not `EXPO_PUBLIC_API_URL`. It must point to the API, never to Neon.

For a physical device, use a host LAN address reachable from the phone, or
the existing development host rewrite in `lib/api/client.ts`. `127.0.0.1`
means the device itself outside a simulator.

## Production and demo verification

Production requires a public HTTPS `EXPO_PUBLIC_API_BASE_URL`,
`EXPO_PUBLIC_DEMO_MODE=false`, `EXPO_PUBLIC_USE_MOCK_DATA=false`, and a
non-demo API configuration. Keep `DATABASE_URL`, Clerk secret keys, and AA
credentials only in the API deployment secret store.

For a deterministic local presentation, set
`EXPO_PUBLIC_DEMO_MODE=true` and clearly treat the build as demo data. For a
backend-backed demo, keep the client in remote mode and use the API's explicit
`DEMO_MODE=true` plus the seeded demo identity.
