# Wealth Coach data boundary

The Coach is not an unrestricted database agent. `apps/api/src/services/coach.service.ts` owns a small, explicit context builder.

## Context inputs

- current account summary and available balances;
- up to 40 recent account transactions;
- debit totals grouped by controlled transaction category;
- active and historical wealth goals;
- current financial insights;
- the latest monthly snapshots.

The context builder scopes every query to the authenticated user before combining the results. It emits formatted financial values and selected fields only.

## Response behavior

The prototype uses deterministic, grounded responses for spending and goal prompts. Each response can include structured cards, suggested prompts, and a source marker such as `financial_context`. If an LLM provider is introduced later, it must receive this bounded context and must not receive database credentials, arbitrary SQL tools, or unrestricted table access.

## Conversation persistence

`coach_conversations` and `coach_messages` are user-owned. Empty conversations are excluded from history. Messages are length-limited and returned with safe DTOs. Conversation creation and assistant reply writes are audited.

## Future provider boundary

An LLM adapter may be added behind the Coach service with:

```text
validated user message
  → financial context builder
  → prompt/provider adapter
  → output validation
  → persisted assistant message
```

Provider failures must not expose provider errors or financial context details in the client response.
