# Account Aggregator to Neon integration

Status: implemented in the backend and mobile client; live provider onboarding remains environment-specific.

## Runtime path

```text
Expo SDK 54 mobile app
        │ Clerk bearer token
        ▼
Hono API (apps/api)
        │ owner-scoped consent and ingestion service
        ▼
AA gateway adapter ── Finvu (default) / Setu / OneMoney / explicit mock
        │ verified webhook or sync response
        ▼
ReBIT normalizer ──► Neon/Postgres
                         ├─ financial_connections
                         ├─ aa_consents / aa_data_sessions
                         ├─ aa_consent_accounts / aa_session_accounts
                         ├─ ingestion_batches / ingestion_jobs
                         ├─ record_provenance / aa_webhook_events
                         ├─ accounts / account_balances
                         └─ transactions
```

The mobile bundle never receives `DATABASE_URL`, AA credentials, private keys, raw
provider account numbers, or encrypted FI payloads. Every read and write is scoped
to the authenticated user in the API.

## Selected contract and consent policy

- Expo SDK `54.0.x` / React Native `0.81.x`.
- ReBIT-compatible AA adapter version recorded by the normalizer:
  `aa-rebit-v2.0.0-1`.
- Default provider adapter: `finvu`; the configured environment is derived from
  the server-only AA base URL (`sandbox` or `production`).
- Purpose code `101`, deposit FI type, `PROFILE` + `SUMMARY` + `TRANSACTIONS`,
  `ONETIME` fetch, 365-day consent expiry, and 30-day raw ingestion retention.
- Provider callbacks require a verified detached JWS or configured HMAC signature,
  are deduplicated by provider event ID, and enqueue idempotent ingestion.
- Account identity is stable per owner/provider/connection/source account reference;
  transactions are upserted by `(account_id, source_transaction_id)`.
- Monetary values remain PostgreSQL numeric strings at the API boundary and are
  converted to integer minor units only at the mobile presentation boundary.

## Server configuration

Required in `apps/api/.env.local` or the deployment secret store:

```text
DATABASE_URL=postgresql://...
CLERK_SECRET_KEY=...
AA_ENABLED=true
AA_PROVIDER=finvu
AA_API_BASE_URL=https://<provider-endpoint>
AA_FIU_ID=<fiu-id>
AA_CLIENT_API_KEY=<server-only-key>
AA_JWS_PRIVATE_KEY=<server-only-rsa-private-key>
AA_JWS_PUBLIC_KEY=<matching-public-key>
AA_JWS_KEY_ID=<key-id>
AA_WEBHOOK_SECRET=<server-only-webhook-secret>
```

For deterministic local testing, set `AA_ENABLED=true` and `AA_PROVIDER=mock`.
The mock gateway is never selected as a fallback and is rejected in production.

The mobile development app only needs:

```text
EXPO_PUBLIC_API_BASE_URL=http://<LAN-IP>:8080
EXPO_PUBLIC_USE_MOCK_DATA=false
EXPO_PUBLIC_ALLOW_DEMO_AUTH=false
```

`EXPO_PUBLIC_ALLOW_DEMO_AUTH=true` is an explicit local-only escape hatch for the
seeded demo user when the backend has `DEMO_MODE=true`; it must remain false for a
Clerk-backed environment.

## Setup and verification

```bash
cd apps/api
./node_modules/.bin/tsx src/db/migrate.ts
TMPDIR=/tmp ./node_modules/.bin/tsx src/db/verify.ts
./node_modules/.bin/tsc --noEmit -p tsconfig.json

cd ../banking
./node_modules/.bin/tsc --noEmit
```

The migration is additive. Do not run the seed script against a production Neon
branch; it intentionally replaces demo rows.

## External onboarding blocker

The code includes the provider adapter, consent lifecycle, webhook verification,
normalization, persistence, and explicit mock path. A live connection still needs
FIU onboarding values from the selected AA provider: FIU registration, client API
key, registered JWS keys, webhook registration, and the provider’s FI/JWE
decryption contract. The current adapter deliberately fails closed with
`AA_DATA_DECRYPTION_REQUIRED` when a provider returns encrypted FI data rather
than silently storing or inventing records. Implement the provider-specific
decryption adapter after those credentials and contract details are supplied.

Reference material: [Sahamati AA key resources](https://sahamati.org.in/account-aggregator-key-resources/),
[Finvu sandbox documentation](https://finvu.github.io/sandbox/), and the
[Sahamati AA API specification](https://developer.sahamati.org.in/sahamatinet-poc/integration-steps/integration-with-router/router-apis-specifications/aa-api-specification).
