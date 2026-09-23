# Screen migration plan

## Completed shared work

1. Database foundation — complete.
2. Drizzle schema and generated migration — complete.
3. Deterministic Neon seed — complete.
4. Server database client, auth, validation, services, repositories, and audit events — complete.
5. Versioned API contracts and health checks — complete.
6. TanStack Query client, centralized keys, and reusable typed hooks — complete.
7. Service directory remote catalog adapter — complete.
8. Home, Accounts, Cards overview, Notifications, Coach dashboard, and Transfer landing reads — complete behind the remote flag.

## Feature migration order

1. Transfer Money flow: replace the new-transfer form’s local draft/quote/execute adapter with the API draft/review/submit lifecycle for demo writes.
2. Beneficiary management: use API create/archive/nickname mutations and invalidate the beneficiary query.
3. Account detail/activity views: use the account and transaction hooks for detail, filtering, annotation, and export reads.
4. Card detail/control views: use card detail, control, block, and card-transaction hooks for mutations and reads.
5. Coach conversation/new/chat views: use the persisted conversation/message API and mutation hooks.
6. All Services: finish authenticated preference persistence and remove the local fallback once validated.

## Per-screen acceptance criteria

- No screen imports a database package or reads a server secret.
- Data comes from a query hook or a feature service backed by the API client.
- Query loading, error, empty, and retry states are visible.
- Mutations invalidate the relevant query keys and show a safe failure message.
- Resource IDs are passed to the API; customer/user IDs are never trusted from route params.
- Existing demo presentation remains available while remote mode is tested.

## Cutover

Keep `EXPO_PUBLIC_USE_MOCK_DATA=true` during UI work. Enable remote mode in a development build only after each feature’s loading/error/empty states and mutation flows are verified. Remove local adapter fallbacks only after the corresponding feature passes the remote smoke test.
