# Database connection and data-loading runbook

## Findings

The Expo app does not contain a PostgreSQL client, Neon connection string, or
database driver. A repository-wide search found no client-side use of
`DATABASE_URL`, `POSTGRES_URL`, `NEON_DATABASE_URL`, `postgres://`,
`postgresql://`, `pg`, Prisma, or Drizzle. Database access is therefore kept
behind the adjacent `apps/api` service:

```text
Expo / React Native
        -> HTTPS / LAN HTTP in development
apps/api (Hono + Clerk auth)
        -> Drizzle repositories and services
Neon PostgreSQL
```

The API uses one module-scoped `@neondatabase/serverless` pool in
`apps/api/src/db/client.ts`. Normal application traffic is configured with the
pooled Neon endpoint (`-pooler`). Migrations use the separate unpooled URL.
The inspected local API configuration uses a pooled `ep-…-pooler…neon.tech`
host and binds the development server to `0.0.0.0`, which is reachable from a
physical device on the same LAN.

The existing Drizzle schema and migrations cover the project’s current domain:
users/profiles, accounts and balances, transactions and categories, wealth
goals and insights, coach conversations/messages, and the Account Aggregator
consent/session/ingestion pipeline. AA records are normalized into the same
account and transaction tables; screens do not call an AA provider directly.
Seeded rows are explicitly tagged with `source_provider = 'seed'` and are
shown as demo data by the client.

## Why intermittent loading occurred

The app already had React Query, but React Native lifecycle and connectivity
events were not connected to TanStack Query. Browser focus/reconnect behavior
cannot reliably observe a phone returning from background or regaining a Wi-Fi
connection. That left stale or failed queries on-screen until a manual refresh.

The client now installs one lifecycle bridge in `app/_layout.tsx`:

- `AppState` marks the query cache focused when the app becomes active, which
  refetches active stale queries without clearing cached data.
- `expo-network` updates TanStack Query’s online manager.
- paused mutations resume after returning to the foreground.
- a request fails fast with `OFFLINE` while known offline; it is not retried as
  though the database were unavailable.

Screens continue to distinguish first load from background refresh. Existing
content remains visible while `isFetching` is true, and a refresh failure does
not turn cached accounts into an empty state.

## Environment contract

### Mobile (`apps/banking/.env.local` or EAS environment)

```text
EXPO_PUBLIC_APP_ENV=development|preview|production
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8080
EXPO_PUBLIC_USE_MOCK_DATA=false
EXPO_PUBLIC_ALLOW_DEMO_AUTH=true       # development only
EXPO_PUBLIC_DEMO_AUTH_ID=demo-customer-a # development only
```

`EXPO_PUBLIC_*` values are public and are inlined into the client bundle. Do
not place `DATABASE_URL`, Neon credentials, Clerk secret keys, AA credentials,
or signing secrets in the mobile environment.

For local development, the client rewrites a loopback API hostname to the
Expo/Metro host on native development builds. Use the host machine’s LAN IP
directly when needed. The API must bind to `0.0.0.0` for a physical phone;
`127.0.0.1` only accepts connections from the host itself. Android emulators
typically use `10.0.2.2` to reach the host; iOS simulators can use loopback.

Production builds must use a public HTTPS API URL. The client environment
validation rejects mock mode, missing API configuration, non-HTTPS URLs, and
localhost/private IPv4 API hosts in production.

### API (`apps/api/.env.local`, deployment secret store)

```text
DATABASE_URL=<pooled Neon URL for application queries>
DATABASE_URL_UNPOOLED=<direct Neon URL for migrations>
DB_POOL_MAX=10
DB_CONNECTION_TIMEOUT_MS=10000
DB_QUERY_TIMEOUT_MS=15000
API_HOST=0.0.0.0       # local phone testing; use platform binding in deploys
PORT=8080
DEMO_MODE=false        # required in production
CLERK_SECRET_KEY=<server secret>
```

Never log either database URL. Safe diagnostics may log that a URL is
configured, its hostname, a request ID, route, latency, and a categorized
failure.

## Verification commands

Run these from `apps/api` with the API environment loaded:

```sh
npm run db:migrate
npm run db:verify
npm run typecheck
npm test
```

From `apps/banking`, the equivalent convenience commands are:

```sh
npm run dev:api       # keep this running while using the Expo app
npm run db:verify
npm run db:migrate
```

The Expo app and the API are separate processes. Starting Metro/Expo alone
does not start the API or create a database connection.

`db:verify` executes `SELECT 1`, checks the required public tables, reports
non-sensitive row counts, and verifies the seeded demo ownership path. It does
not seed or mutate production data. `npm run db:seed` is an explicit
development-only operation.

For a running API, check:

```sh
curl -i http://127.0.0.1:8080/api/health
curl -i http://127.0.0.1:8080/api/health/database
curl -i http://127.0.0.1:8080/api/health/data \
  -H 'x-demo-auth-id: demo-customer-a'
```

The API’s request correlation header is `x-request-id`. Include it when
reporting a failed request so backend logs can be joined to the mobile log.

## Troubleshooting order

1. Confirm the mobile build has the intended `EXPO_PUBLIC_API_BASE_URL` and
   that production is not using mock mode.
2. Confirm the API is listening on the expected interface and port. A physical
   phone cannot reach an API bound only to `127.0.0.1`.
3. From the phone’s network, open the API health endpoint or use a temporary
   health screen; do not infer database failure from an unreachable API.
4. Run `npm run db:verify` on the API host. Separate `DATABASE_TIMEOUT`,
   authentication/DNS, and missing-schema failures before changing UI code.
5. Check that the Neon application URL is pooled and the migration URL is
   direct. Do not run Drizzle migrations through the pooled endpoint.
6. Use the request ID, route, HTTP status, and latency to correlate the mobile
   failure with API/database logs. Never include financial payloads or secrets
   in bug reports.

## Known state distinctions

These states are intentionally separate:

- database/API healthy + zero rows: show a true empty state;
- API or database unavailable + cached rows: retain rows and show a refresh
  notice;
- device offline + cached rows: show an offline notice and retain rows;
- authentication failure: ask the user to sign in again;
- AA consent/sync pending or failed: show source/sync status, not a database
  disconnected message.
