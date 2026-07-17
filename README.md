# IDBI Wealth Advisory

IDBI Wealth Advisory is a mobile-first wealth advisory platform designed for
bank customers. The primary application is a universal Expo application that
supports Android, iOS, and responsive browser access from one codebase.

## Repository structure

- `apps/banking` — Universal Expo customer banking application (Expo Router)
- `packages` — Shared domain and technical packages (reserved; empty at baseline)
- `pnpm-workspace.yaml` — Workspace definition covering `apps/*` and `packages/*`
- `pnpm-lock.yaml` — Single lock file for the whole workspace

Inside `apps/banking`:

- `app` — Expo Router route files only; routes stay thin and delegate to features
- `src/features` — Feature implementations that own screens and business logic
- `src/components` — Shared UI primitives and feedback states
- `src/providers` — Application-level providers and route guards
- `assets` — Static images and fonts

## Requirements

- Node.js (see `.nvmrc` if present) with Corepack enabled
- pnpm 10 (`packageManager` is pinned in the root `package.json`)

## Local development

Install dependencies from the repository root:

```bash
pnpm install
```

Start the Expo development server:

```bash
pnpm dev
```

Then press `a` for Android, `i` for iOS, or `w` for web, or open the printed
URL in Expo Go.

## Running authentication locally

Authentication is adapter-based (`EXPO_PUBLIC_AUTHENTICATION_MODE`):

- `mock` (development default) — deterministic development flow, works
  everywhere including Expo Go. Dev customer: mobile `9876543210`,
  OTP `123456`.
- `clerk` — Clerk's prebuilt components. Web renders Clerk's `SignIn`/`SignUp`
  cards; iOS/Android render the native `AuthView`, which requires a
  **development build** (Expo Go is NOT supported for Clerk's native UI):

  1. Add `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` and
     `EXPO_PUBLIC_AUTHENTICATION_MODE=clerk` to `apps/banking/.env.local`.
  2. Ensure the Clerk application's Native API is enabled in the dashboard.
  3. From `apps/banking`, run `npx expo run:ios` or `npx expo run:android`.

  Sessions are cached in secure storage via Clerk's token cache and persist
  across app restarts. No authentication step opens Clerk's hosted pages or
  the system browser.

Platform shortcuts are also available from the root:

```bash
pnpm android
pnpm ios
pnpm web
```

## Quality checks

Run all checks from the repository root:

```bash
pnpm lint       # ESLint via expo lint
pnpm typecheck  # Strict TypeScript, no emit
pnpm test       # Jest via jest-expo
pnpm check      # lint + typecheck
```

## Conventions

- One universal Expo application; no per-platform forks.
- Strict TypeScript everywhere; external data is validated at the boundary.
- Deterministic development fixtures only — never real customer data.
- Authoritative financial and suitability decisions live behind service or API
  boundaries, not in the client.
