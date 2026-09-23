# Wealth Coach UI notes

## Component rules

- Keep the screen order consistent with Home: page header, primary Ask Coach composer, quick questions, financial snapshot, insights, goals, and recent conversations last.
- Use the shared Home typography, spacing, green accent, muted surface, and rounded-card tokens. Keep section actions compact and right-aligned.
- Let descriptions, insight titles, goal names, and conversation titles wrap. Cards must grow with their content instead of clipping text or relying on fixed heights.
- Show progress tracks with a visible neutral track behind the green fill. Clamp only the visual fill to 0–100%; preserve the actual current and target values in the copy.
- Every interactive action must preserve its context: topic prompts open a new chat, insight actions open the related activity or insight detail, and conversation rows resume the selected conversation.
- Keep composer text state inside the assistant panel so typing does not rerender the financial overview.

## Financial data and formulas

- Remote mode reads the account-backed `/api/v1/wealth/summary` response for the snapshot, while insights and goals use their independent endpoints so one failed module does not blank the rest of Coach. The API derives the snapshot from posted transactions belonging to linked accounts; it does not silently fall back to mock data.
- The rich Coach responder remains available through the deterministic demo adapter. In live-data mode, unscoped questions use the authenticated conversation API by default, including persisted history and client-side cancellation. Account/card/goal-specific live analysis stays capability-gated until the service can enforce that exact scope and return item-level evidence; the UI explains that limitation instead of silently widening the query.
- Savings rate is calculated as `(income - expenses) / income * 100`, rounded to two decimal places with integer minor-unit arithmetic. A zero-income period returns `0.00%`.
- The seeded demo user is clearly labeled in the UI. Snapshot period and scope labels explain whether the values cover a complete period or month to date.

## Privacy and accessibility

- Balance visibility is applied to insight summaries, metrics, goal amounts, and conversation previews. Masked states use complete, neutral sentences and never render a literal amount placeholder.
- Keep meaningful labels on buttons and navigation actions, use readable contrast, and expose loading/error states without shifting the primary content hierarchy.

## Verification

From `apps/banking`:

```sh
npm run typecheck
npm test -- --runInBand
npx eslint app/\(app\)/\(tabs\)/coach.tsx components/coach lib/privacy.ts lib/api/types.ts lib/api/view-models.ts
```

From `apps/api`:

```sh
pnpm typecheck
pnpm test
pnpm test:integration
```

For visual QA, reload the Expo development client in the iPhone simulator, open the Coach tab, and capture the top, insight/snapshot, and goals/conversations scroll positions.
