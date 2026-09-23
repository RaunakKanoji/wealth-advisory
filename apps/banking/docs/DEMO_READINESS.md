# IDBI demo readiness

## Start the complete stack

From the repository root:

```sh
pnpm dev
```

This starts both the API and the Expo app. If the app is started from
`apps/banking` alone, start the API separately with `npm run dev:api`.

The judge flow is backend-backed: with the development flags below enabled,
the app opens on the branded auth landing page. Tap **Explore Demo**. The
button calls `POST /api/auth/demo`, verifies representative seeded rows, and
then opens the protected app routes. It does not set a frontend-only
`isLoggedIn` flag.

Before presenting, verify:

```sh
pnpm db:check
curl -fsS http://127.0.0.1:8080/api/health
curl -fsS http://127.0.0.1:8080/api/health/database
curl -fsS http://127.0.0.1:8080/api/health/data \
  -H 'x-demo-auth-id: demo-customer-a'
curl -fsS http://127.0.0.1:8080/api/health/ai
curl -fsS http://127.0.0.1:8080/api/v1/accounts/overview \
  -H 'x-demo-auth-id: demo-customer-a'

# Full login, data, and Coach smoke check (requires the API to be running)
pnpm demo:smoke
```

The expected seeded overview is 4 accounts:

```text
Total balance       ₹3,45,678.00
Available to spend  ₹2,25,000.00
Deposits            ₹1,20,678.00
```

## Demo modes

Choose one explicitly:

1. Backend-backed demo: client remote mode, API `DEMO_MODE=true`, and the
   seeded `demo-customer-a` identity. This exercises the real API, auth
   middleware, repository layer, Neon connection, and seeded database.
2. Deterministic client demo: `EXPO_PUBLIC_DEMO_MODE=true`. This uses the
   clearly labeled local demo adapter and does not claim to be live banking
   data.

Never enable either demo mode in a production build.

## Reset demo data

From the repository root:

```sh
pnpm demo:reset
pnpm db:check
```

The reset endpoint and seed routine target only the synthetic demo users and
retain global catalog/category rows. Production deployments reject demo mode;
still use the command only against the configured development/demo database.

Inside the app, open the demo profile and choose **Reset demo data**. The
confirmation restores accounts, transactions, goals, notifications and Coach
history, then returns to the demo login screen.

## Recommended navigation flow

Home → Accounts → account filters → Savings Account → Statement → Coach →
“Where did I spend the most this month?” → Insights → Goals → Home → refresh.

The accounts overview is the shared financial source for Home, Accounts,
Coach, and transaction resource loading. Refresh keeps existing content
visible while the API request runs; first-load errors expose Retry instead of
an indefinite skeleton.

## Recovering from failure

- API or database temporarily unavailable: cached data remains visible and the
  screen shows a recoverable refresh notice.
- No cached data: use Retry after confirming `/api/health`.
- Phone cannot reach local API: use the host computer's LAN IP in
  `EXPO_PUBLIC_API_BASE_URL`, allow the API port through the local firewall,
  and keep `API_HOST=0.0.0.0`.
- Demo data changed unexpectedly: run `pnpm demo:reset` and restart only the
  affected request; do not clear the whole app cache as a retry strategy.
