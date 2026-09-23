# Database architecture

```text
Expo / React Native
        │ HTTPS + Clerk bearer token
        ▼
apps/api (Hono)
  auth → validation → service → repository → Drizzle
        │
        ▼
Neon PostgreSQL
```

## Repository layout

```text
apps/api/
  src/api/              authentication and versioned routes
  src/services/         business rules and safe response DTOs
  src/db/repositories/  user-scoped database queries
  src/db/schema/        Drizzle schema and inferred types
  src/db/migrate.ts     migration runner
  src/db/seed.ts        deterministic demo seed
  src/lib/              IDs, exact money arithmetic, errors
  drizzle/              generated SQL migrations
```

The API is the only process allowed to load `DATABASE_URL`. The Expo app receives only `EXPO_PUBLIC_API_BASE_URL`, which is a public HTTPS origin and never a database connection string.

## Request flow

1. The client calls a typed API hook.
2. The API middleware verifies the Clerk token or, in server demo mode, resolves the explicitly supplied demo auth ID.
3. The external auth subject is mapped to an internal `users` row.
4. The route validates query/body input with Zod.
5. The service applies banking rules and builds a safe DTO.
6. The repository executes a user-scoped Drizzle query.
7. Mutations write audit events in the same database transaction where consistency matters.

## Data consistency

- Monetary values are PostgreSQL `numeric(18,2)` and are added as integer minor units in server code.
- Balance history is append-only at the application layer; the latest row is selected by `as_of`.
- Transfer lifecycle changes and demo ledger effects are written inside a single transaction.
- Foreign keys use restrictive or cascading behavior appropriate to the owning domain.
- User-facing list queries have indexes for user, status, date, and common lookup keys.

## Deployment shape

Run the API as a separately deployable Node service or server-function bundle. Configure the Neon connection and Clerk secret in the server environment only. Configure the Expo build with the public API origin and Clerk publishable key.
