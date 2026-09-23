# Neon integration audit

## Scope

This audit covers the Expo client, the new `apps/api` server boundary, and the Neon PostgreSQL data layer. The mobile app must never import Drizzle, `@neondatabase/serverless`, or a database connection string.

## Baseline findings

- The repository was an Expo Router mobile app with Clerk authentication and deterministic demo adapters.
- There was no backend process, repository layer, schema, migration workflow, or database client.
- Banking screens depended on feature-local demo data and browser/device persistence.
- No `DATABASE_URL` existed in the mobile app configuration.

## Implemented foundation

- `apps/api` is a standalone Hono + Node server.
- Drizzle ORM uses Neon’s serverless driver through one pooled server-side client.
- The schema and generated migration cover 22 banking tables, including account balances, transfers/events, cards/controls, notifications, wealth data, Coach data, service catalog/favorites, and audit events.
- Seed data is deterministic, explicitly marked demo data, and scoped to two demo users.
- Clerk bearer tokens are verified by the API. Demo mode uses a demo auth header only when explicitly enabled on the server.
- Every user-facing repository query is scoped to the authenticated internal user ID.
- API responses use safe DTOs and ISO timestamps; internal `userId` values and database-only fields are not returned.
- Transfer writes are transactionally simulated and blocked when `DEMO_MODE=false`.
- Coach responses use a controlled financial context builder. The Coach has no SQL access.
- The Expo app has a public API client, TanStack Query keys/hooks, and a root `QueryClientProvider`. It contains no database driver or database credential.
- `NSCameraUsageDescription` is present in `apps/banking/app.json` for Expo Camera video/QR flows.

## Migration status

The shared foundation, Neon migration, seed, health checks, API contracts, and reusable mobile query layer are complete. Home, Accounts, Cards overview, Notifications, Coach dashboard, Transfer landing reads, and the service directory are wired to the remote catalog/data behind `EXPO_PUBLIC_USE_MOCK_DATA=false`; the existing deterministic adapters remain the default for safe local development while detail/mutation views are migrated feature-by-feature.

That flag is deliberate: a developer can validate the API without silently replacing the current prototype data for every screen. The migration order and remaining adapters are tracked in [MIGRATION_PLAN.md](./MIGRATION_PLAN.md).

## Verification performed

- Neon migration applied successfully.
- Deterministic seed inserted 133 transactions and 32 catalog services.
- `/api/health` and `/api/health/database` returned healthy responses.
- Demo account, notification, services, and Coach endpoints returned scoped data.
- Expo TypeScript, targeted lint, Jest suites, and web export were run during implementation.
