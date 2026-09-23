# API contracts

Base path: `/api/v1`. All customer routes require a Clerk bearer token. In server demo mode, `x-demo-auth-id` can select one seeded demo customer; it is not a production authentication mechanism.

## Health

- `GET /api/health` → `{ status, service, demoMode }`
- `GET /api/health/database` → `{ status: "ok", database: "reachable" }` or HTTP 503

## Accounts and activity

- `GET /accounts` → `{ accounts, summary }`
- `GET /accounts/:id` → one safe account DTO
- `GET /accounts/:id/transactions` → `{ items, nextCursor }`
- `GET /transactions` → `{ items, nextCursor }`

Account amounts are strings with two decimal places. Dates are ISO strings.

## Account Aggregator

- `POST /aa/consents` → creates an owner-scoped consent request and returns `{ consent, redirectUrl }`
- `GET /aa/consents` → lists the signed-in customer’s consent records
- `GET /aa/consents/:id` → returns one owner-scoped consent record
- `POST /aa/consents/:id/sync` → checks the provider, requests a data session, and processes ready data
- `POST /api/webhooks/aa/:provider` → verified provider callback; idempotent by provider event ID

Consent requests default to purpose code `101`, deposit accounts, profile/summary/transactions,
one-time fetch, and a 365-day consent expiry. AA payloads are normalized before they are
written to Neon. Account and transaction DTOs expose source metadata; raw provider account
numbers and encrypted provider payloads are never returned to the mobile client.

## Transfers and beneficiaries

- `GET /beneficiaries`
- `POST /beneficiaries`
- `GET /beneficiaries/:id`
- `POST /transfers/draft`
- `POST /transfers/:id/review`
- `POST /transfers/:id/submit`
- `GET /transfers`
- `GET /transfers/:id`

The accepted transfer lifecycle is `draft → reviewing → completed` or `failed` in demo mode. Real settlement is intentionally not implemented. Submit writes a demo ledger transaction and notification only when the server’s `DEMO_MODE` is enabled.

## Cards and notifications

- `GET /cards`, `GET /cards/:id`
- `PATCH /cards/:id/controls`, `POST /cards/:id/block`
- `GET /cards/:id/transactions`
- `GET /notifications?type=all`, `PATCH /notifications/:id/read`, `POST /notifications/read-all`
- `GET /notification-preferences`, `PATCH /notification-preferences`

Card PAN/CVV, beneficiary account numbers, and internal database identifiers are never returned unless they are the safe public resource ID needed for a subsequent scoped API call. Card numbers are masked at seed and DTO boundaries.

## Wealth and Coach

- `GET /wealth/summary`, `/wealth/insights`, `/wealth/goals`, `/wealth/goals/:id`
- `GET /coach/conversations`
- `POST /coach/conversations` with optional `title` and `firstMessage`
- `GET /coach/conversations/:id/messages`
- `POST /coach/conversations/:id/messages`

Coach requests are limited to 1,000 characters. The service builds a controlled context from balances, recent debits, categories, goals, insights, and snapshots. No route accepts SQL or table names from the client.

## Services

- `GET /services?category=...`
- `GET /services/favorites`
- `POST /services/:id/favorite`
- `DELETE /services/:id/favorite`

All validation failures use HTTP 422 with a stable `error.code`; missing resources use 404; invalid state transitions use 409.
