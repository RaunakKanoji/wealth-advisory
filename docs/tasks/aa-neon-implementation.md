# AA and Neon implementation record

Date: 2026-09-15

## Completed

- Added additive Neon schema and migration for connections, consents, data
  sessions, per-account delivery, ingestion batches/jobs, webhook idempotency,
  and record provenance.
- Added owner-scoped consent creation/list/detail/sync routes and the public,
  signature-verified AA webhook route.
- Added a ReBIT-shaped normalizer with exact two-decimal money validation,
  masked account numbers, stable source identifiers, and source timestamps.
- Added explicit Finvu/Setu/OneMoney-compatible gateway configuration and an
  explicit deterministic mock provider for local acceptance tests.
- Connected AA-derived accounts, balances, and transactions to the existing
  account, transaction, wealth-summary, Coach, and transaction-explorer reads.
- Added mobile AA consent launch, post-browser sync, user-scoped query keys,
  sign-out/user-switch cache clearing, and source/provenance labels.
- Added request IDs to API errors and kept database/provider secrets server-only.

## Failure investigated

The Accounts screen was already calling the Neon-backed `/api/v1/accounts` route,
but the visible failure conflated several different states. The local path could
also be affected by a stale `localhost` phone URL or an implicit demo identity
being sent alongside an unusable Clerk token. The client now uses the configured
LAN URL, sends demo auth only when `EXPO_PUBLIC_ALLOW_DEMO_AUTH=true`, requires a
loaded signed-in Clerk session for remote queries, and presents network/auth/API
errors separately from an empty account set.

The API had no AA consent or ingestion path before this work, so it could only
serve seeded rows. The new path persists approved AA data into the same canonical
tables consumed by Accounts, Home, Wealth Coach, and Transactions.

## Remaining external work

Live data requires the chosen provider’s FIU onboarding, registered keys and
webhook, plus a provider-specific decrypted FI envelope. Until those are present,
the safe states are `pending`, `needs_reauth`, or an explicit configuration error;
the application must not manufacture “live” balances.

## Change boundary

No production seed/reset was run. The database migration only adds AA structures
and nullable source/provenance columns to existing account and transaction rows.
