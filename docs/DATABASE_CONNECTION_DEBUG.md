# Database connection debug path

This document records the account-data path used by the Expo prototype. The
mobile bundle must never contain `DATABASE_URL`; only `apps/api` reads it.

## Runtime path

```text
Home / Accounts screen
  -> useAccounts()
  -> TanStack Query key: accounts.all
  -> apiRequest("/api/v1/accounts")
  -> HTTPS to EXPO_PUBLIC_API_BASE_URL
  -> Hono /api/v1/accounts route
  -> requireAuth middleware
  -> external auth id -> users.external_auth_id -> users.id
  -> accounts service
  -> accounts repository
  -> shared Drizzle/Neon Pool client
  -> accounts LEFT JOIN account_balances, ordered by balance timestamp
  -> service keeps the latest balance row per account
  -> safe account DTO + summary
  -> apiAccountToBankAccount()
  -> rendered account cards
```

The Home and Accounts screens use the same `accounts.all` query key. A retry
therefore refetches the shared remote account query rather than using a
screen-local hard-coded object.

## Backend configuration

`apps/api/src/env.ts` loads `apps/api/.env.local` and requires a non-empty
server-only `DATABASE_URL`. The Neon project is linked through Neon Command
(`.neon`), with the development branch recorded as `production` in the local
setup. `apps/api/src/db/client.ts` creates the single shared
`@neondatabase/serverless` Pool and Drizzle client. Development diagnostics log
only whether the connection is configured, the hostname, and the branch; the
connection string is never logged.

Run the following from the repository root when schema or seed state needs to
be checked:

```bash
./node_modules/.bin/tsx apps/api/src/db/migrate.ts
./node_modules/.bin/tsx apps/api/src/db/seed.ts
./node_modules/.bin/tsx apps/api/src/db/verify.ts
```

`db:check`/`db:verify` runs safe server-side checks only. It reports the account row
count, whether `demo-customer-a` maps to `usr_demo_a`, and the number of
accounts owned by that seeded user. It does not expose those diagnostics as a
mobile endpoint.

The real Neon-backed service and API path can be exercised with:

```bash
cd apps/api
./node_modules/.bin/vitest run --config vitest.integration.config.ts
```

Those integration assertions verify four accounts, the summary totals, DTO
serialization, and `GET /api/v1/accounts` returning HTTP 200.

The database health endpoint runs `SELECT 1 AS ok`:

```text
GET /api/health/database
200 {"status":"ok","database":"connected"}
503 {"status":"error","database":"unavailable"}
```

Raw database errors are logged on the API process only and are not returned to
the client.

## Demo authentication

The seeded demo mapping is explicit:

```text
external auth id: demo-customer-a
internal user id: usr_demo_a
```

For non-production Expo builds, `EXPO_PUBLIC_DEMO_AUTH_ID=demo-customer-a`
causes the API client to send `x-demo-auth-id` and omit an unrelated Clerk
bearer token. The API accepts that header only while `DEMO_MODE=true`. In a
production build, the client sends the Clerk bearer token and the API requires
`CLERK_SECRET_KEY` to verify it. No code selects the first database user.

## Mobile connectivity

For a physical iPhone, `EXPO_PUBLIC_API_BASE_URL` must use the Mac's LAN IP,
not `localhost`; the API must bind to `API_HOST=0.0.0.0`. Metro and the phone
must be on the same reachable network. The current local development values
are intentionally ignored from git and contain no database credential in the
Expo environment.

The client logs method, path, status, and duration in development only. It
never logs authorization tokens or request bodies. Network failures become a
typed `NETWORK_ERROR`; HTTP failures preserve the safe API error code/status.

## Verification checklist

1. Run `GET /api/health/database` and confirm `database: connected`.
2. Run `db:verify` and confirm the seeded user has 4 accounts.
3. Request `/api/v1/accounts` with `x-demo-auth-id: demo-customer-a`.
4. Confirm the response includes the four seeded accounts and summary values:
   total `345678.00`, available to spend `225000.00`, deposits `120678.00`.
5. Open Home and Accounts in the Expo app with `EXPO_PUBLIC_USE_MOCK_DATA=false`.
6. If the phone cannot reach the endpoint, check LAN IP/API bind/port before
   changing database configuration; a healthy local database does not imply a
   reachable phone-side API.
