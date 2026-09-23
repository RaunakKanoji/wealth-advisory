# Security controls

## Secrets

- `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `CLERK_SECRET_KEY`, and provider keys are server-only.
- `EXPO_PUBLIC_*` values are public and may be embedded in the bundle.
- `apps/api/.env.local` is ignored; do not commit it or paste its contents into logs, screenshots, or tickets.

## Authentication and authorization

- Clerk bearer tokens are verified by the API when configured.
- External auth subjects are mapped to internal user rows server-side.
- Repositories scope reads and writes to that internal user ID.
- Demo auth headers are accepted only when `DEMO_MODE=true` and are not a substitute for production authentication.
- A client-supplied internal user ID is never used for authorization.

## Sensitive data

- Cards store and return masked numbers only; PAN/CVV are out of scope.
- Beneficiary account numbers are not returned by API DTOs.
- API DTOs omit internal ownership fields and normalize timestamps to ISO strings.
- Error responses expose stable safe codes/messages, not SQL, connection strings, or stack traces.

## Banking prototype limits

- Transfers are explicitly demo transactions.
- No real settlement, payment rail, OTP, or irreversible external side effect is implemented.
- Transfer state changes, balance simulation, notifications, and audit events are transactional.
- Seed data must be used only on a development/demo Neon branch.

## Operational checklist

- Use HTTPS for preview/production API origins.
- Set a restricted Neon role for the API and rotate credentials through the deployment secret manager.
- Keep `DEMO_MODE=false` outside local/demo environments.
- Review generated migrations before applying them.
- Monitor `/api/health/database` and audit events without logging financial payloads unnecessarily.
