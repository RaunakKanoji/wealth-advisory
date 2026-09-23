# Neon setup

## Provision or link a Neon project

The repository was initialized with Neon Command as requested:

```bash
npx neon@latest init
```

If the command is running in a non-interactive environment, use the CLI’s non-interactive option and authenticate with the Neon account that owns the development project. Link the repository to the intended project before applying migrations.

## Server environment

Copy `apps/api/.env.example` to an ignored server-only environment file. The API reads `.env.local` and `.env` from its own working directory. Set:

- `DATABASE_URL` — pooled Neon connection string.
- `DATABASE_URL_UNPOOLED` — optional direct connection for administrative tooling.
- `CLERK_SECRET_KEY` — server-only Clerk secret.
- `DEMO_MODE=true` for the prototype transfer simulator.
- `DEMO_USER_ID=usr_demo_a` — backend-only fallback user when demo mode has no auth header.
- `API_HOST=127.0.0.1` for local development; use the deployment platform’s private bind configuration in production.
- `PORT` and `API_ORIGIN` as needed.

Never copy these values into the Expo app or any `EXPO_PUBLIC_*` variable.

## Apply schema and seed

```bash
cd apps/api
./node_modules/.bin/drizzle-kit generate --config drizzle.config.ts
./node_modules/.bin/tsx src/db/migrate.ts
./node_modules/.bin/tsx src/db/seed.ts
./node_modules/.bin/tsx src/db/verify.ts
```

For a single repeatable bootstrap, use `./node_modules/.bin/tsx scripts/setup-db.ts`.
It tests the connection, applies migrations, seeds an empty database, and
skips the destructive seed step when the stable demo dataset is already
present. The standalone seed command uses stable IDs and deterministically
replaces the demo dataset, so restrict it to a demo/development branch.

For the individual checks:

```bash
./node_modules/.bin/tsx scripts/test-db.ts
./node_modules/.bin/tsx scripts/test-accounts.ts
```

`db:generate` is for schema changes. Review the generated SQL before committing it. `db:migrate` applies checked-in migrations. `db:seed` is destructive for the demo-owned rows and should be restricted to a development branch.

## Run the API

```bash
pnpm --filter @idbi/api dev
```

Check `GET /api/health` and `GET /api/health/database` before starting the Expo client.

## Configure Expo

Set only the public API origin and Clerk publishable key in `apps/banking/.env.local`:

```text
EXPO_PUBLIC_API_BASE_URL=https://your-api.example.com
EXPO_PUBLIC_USE_MOCK_DATA=false
```

The mobile bundle must contain neither a Neon URL nor a Clerk secret key.
