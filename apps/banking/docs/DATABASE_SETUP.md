# IDBI database and API setup

## Architecture

```text
Expo / React Native
  -> API base URL
  -> Hono backend
  -> services and repositories
  -> shared @neondatabase/serverless pool
  -> Neon PostgreSQL
```

The Expo bundle must never contain `DATABASE_URL`, a PostgreSQL connection
string, Clerk secret keys, or Account Aggregator credentials.

## API environment

Create `apps/api/.env.local` from `apps/api/.env.example` and configure:

```text
DATABASE_URL=<pooled Neon URL for runtime queries>
DATABASE_URL_UNPOOLED=<direct Neon URL for migrations>
API_HOST=0.0.0.0
PORT=8080
DEMO_MODE=true
DEMO_USER_ID=usr_demo_a
```

Use `DEMO_MODE=false` in production. The backend uses one shared pool in
`apps/api/src/db/client.ts`; migrations must use the unpooled URL when the
deployment workflow requires a direct connection.

## Mobile environment

Create `apps/banking/.env.local` with public-only values:

```text
EXPO_PUBLIC_APP_ENV=development
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8080
EXPO_PUBLIC_USE_MOCK_DATA=false
EXPO_PUBLIC_DEMO_MODE=false
EXPO_PUBLIC_ALLOW_DEMO_AUTH=true
EXPO_PUBLIC_DEMO_AUTH_ID=demo-customer-a
```

On a physical phone, replace the loopback host with the development
computer's LAN IP if the Expo host rewrite cannot be used. In production, use
an HTTPS API URL.

## Migrations, seed, and checks

Run from `apps/api` (use the Coach branch verifier for the same branch as `pnpm dev`):

```sh
npm run db:migrate:coach
npm run db:check
npm run db:verify:coach
npm run demo:reset       # development/demo data only; destructive reset
npm run typecheck
npm test
```

`db:check` performs `SELECT 1`, verifies the required schema, reports safe row
counts, and verifies ownership for the seeded demo user. It never prints the
database URL and does not mutate data.

## Health endpoints

```text
GET /api/health
GET /api/health/database
GET /api/health/data       # authenticated representative queries
GET /api/health/ai
```

Both endpoints return a safe status, latency, and request ID. Credentials,
tokens, and connection strings are never returned.

## Common failures

- API unreachable: start the API process and verify port `8080`.
- Physical-device failure: do not use a host-only loopback address; use a LAN
  address and bind the API to `0.0.0.0`.
- Database failure: run `npm run db:check` before changing client code.
- Empty account result: distinguish a healthy database with no owner rows from
  an unavailable API/database.
- Authentication failure: use the explicit demo identity only in development;
  production requires a valid Clerk session.
