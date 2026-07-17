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

Clerk's native authentication UI requires a development build; Expo Go and
web are not authentication targets for this app.

## Running authentication locally

Authentication uses Clerk's native Expo components and requires a
**development build**. Expo Go is not supported for the authentication UI.

1. Copy `apps/banking/.env.example` to `apps/banking/.env.local` and set
   `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`.
2. In Clerk Dashboard, enable Native API and enable email address + password
   authentication for the selected application.
3. Install dependencies from the repository root with `pnpm install`.
4. Launch from `apps/banking` with `npx expo run:ios` or
   `npx expo run:android`.

Sign-in and sign-up both render `AuthView` inside the app. Clerk's token cache
uses secure storage so the session survives app restarts; root protected
routes remove auth screens after sign-in and protected screens after sign-out.

Platform shortcuts are also available from the root:

```bash
pnpm android
pnpm ios
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
