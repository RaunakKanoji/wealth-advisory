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
