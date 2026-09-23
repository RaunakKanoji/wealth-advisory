# Demo data

The seed is deterministic and lives in `apps/api/src/db/seed.ts`. It is intended for product demos and API integration tests, not production banking.

## Seeded scope

- Two users: `demo-customer-a` and `demo-customer-b`.
- Four accounts for the primary demo customer.
- ₹3,45,678 total ledger balance and ₹2,25,000 available to spend for the primary demo customer.
- 133 account transactions.
- Beneficiaries, transfers, cards, card controls, notifications, wealth goals, insights, monthly snapshots, Coach conversations/messages, and favorites.
- 32 service catalog entries.

The visible prototype data is labeled as demo data in transfer metadata and seeded transaction metadata. Seed timestamps use a fixed scenario date so screenshots and tests stay stable.

## Reset and reseed

The seed intentionally clears the demo-owned tables before inserting deterministic rows. Run it only against a development/demo Neon branch:

```bash
pnpm --filter @idbi/api db:seed
```

Do not run the seed command against a production branch containing real data.

## Client behavior

Mock mode remains the default for local UI work. To exercise the remote seed, set the public API origin and use `EXPO_PUBLIC_USE_MOCK_DATA=false` in the Expo environment. The client still sends a Clerk token when available; the server’s demo mode is an explicit development fallback.
