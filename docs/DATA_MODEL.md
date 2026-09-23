# Data model

The canonical schema is `apps/api/src/db/schema/index.ts`; the checked-in SQL migration is under `apps/api/drizzle/`.

## Identity and accounts

- `users` — external auth subject, email, status, audit timestamps.
- `profiles` — customer profile and display preferences.
- `accounts` — savings, current, fixed-deposit, and recurring-deposit accounts.
- `account_balances` — point-in-time ledger and available balances.

## Money movement

- `transaction_categories` — controlled transaction categories.
- `transactions` — account ledger activity with direction, status, category, reference, and metadata.
- `beneficiaries` — user-owned bank or UPI recipients, including cooling-off state.
- `transfers` — user-owned transfer intent and lifecycle state.
- `transfer_events` — append-only transfer timeline.

## Cards

- `cards` — user-owned card metadata with masked PAN only.
- `card_controls` — channel switches and daily limits.
- `card_transactions` — card merchant activity, optionally linked to an account transaction.

## Notifications

- `notifications` — user-owned in-app notifications and safe destination metadata.
- `notification_preferences` — user notification channel/category settings.

## Wealth and Coach

- `wealth_goals` — target, current value, contribution, target date, and status.
- `financial_insights` — generated or curated insight cards with source metadata.
- `monthly_financial_snapshots` — monthly income, expenses, savings, and goal progress.
- `coach_conversations` — user-owned Coach threads.
- `coach_messages` — ordered user/assistant messages and optional structured UI payload.

## Services and audit

- `service_catalog` — active banking service definitions and search metadata.
- `service_favorites` — user-to-service favorites with a unique pair constraint.
- `audit_events` — append-only record of sensitive or state-changing actions.

## Ownership rules

Every customer-owned table contains or is reachable through `user_id`. Repositories always receive the authenticated internal user ID and include it in their query predicate. Route parameters are never treated as authorization. The API never accepts an internal user ID from the mobile client.
