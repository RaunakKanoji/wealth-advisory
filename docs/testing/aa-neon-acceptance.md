# AA and Neon acceptance checklist

## Static and database checks

Run from the indicated directories:

```bash
cd apps/api
TMPDIR=/tmp ./node_modules/.bin/tsc --noEmit -p tsconfig.json
TMPDIR=/tmp ./node_modules/.bin/tsx src/db/verify.ts

cd ../banking
./node_modules/.bin/tsc --noEmit
```

`src/db/verify.ts` is read-only. It checks `SELECT 1`, the required banking and
AA tables, and row counts for the configured Neon branch. Do not use `db:seed` for
this acceptance check because it replaces demo rows.

## Focused normalizer tests

```bash
cd apps/api
TMPDIR=/tmp ./node_modules/.bin/vitest run src/aa/normalizer.test.ts --config vitest.config.ts
```

These tests must cover exact money parsing, account-number masking, stable source
identifiers, timestamps, malformed payload rejection, and transaction/account
reference validation.

## Explicit mock AA flow

The mock path is opt-in and writes test records to the configured database. Use a
disposable Neon branch or a disposable local database, never the production
branch:

```bash
cd apps/api
AA_ENABLED=true AA_PROVIDER=mock AA_WEBHOOK_SECRET=local-test-secret \
  TMPDIR=/tmp ./node_modules/.bin/tsx scripts/test-aa.ts
```

The flow should create a consent, return the mock redirect URL, sync an active
consent, fetch a ready session, process one ingestion batch, and prove that a
second fetch does not duplicate rows. The script should also assert that the
created records belong to the authenticated demo user.

## Manual mobile acceptance

1. Set `EXPO_PUBLIC_API_BASE_URL` to the Mac’s LAN IP and keep
   `EXPO_PUBLIC_USE_MOCK_DATA=false`.
2. Sign in with Clerk, open Accounts, and verify the request returns only that
   user’s accounts.
3. Start AA linking, complete or cancel the provider consent, and verify the
   resulting consent status is visible through the API. After approval, sync and
   confirm account balances and transactions carry the AA source label.
4. Open Home, Wealth Coach, and Transactions. Confirm their values are derived
   from the same Neon-backed canonical rows and no screen falls back to fixtures.
5. Sign out, sign in as another user, and verify the previous user’s cached
   accounts, transactions, wealth data, and consent list are gone.
6. Try an invalid or unsigned webhook and verify it is rejected without creating
   an ingestion job. Replay a valid event ID and verify it is acknowledged as a
   duplicate without duplicating data.

## Observed in this implementation pass

- Additive migration: applied successfully to the configured Neon `production`
  branch.
- Read-only database verification: passed. All required banking and AA tables
  are present; existing counts remain 4 accounts and 141 transactions; AA
  tables are empty until a consent is approved and fetched.
- API TypeScript check: passed.
- Mobile TypeScript check: passed.
- Focused normalizer tests: 3 tests passed.
- Live AA acceptance: not claimed; provider credentials and FIU onboarding are
  not available in this workspace.
- Production seed/reset: not run.
