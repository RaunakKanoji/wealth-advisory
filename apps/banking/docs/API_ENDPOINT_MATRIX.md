# IDBI Wealth Advisory API matrix

This is the MVP endpoint inventory. The mobile app calls the `/api/v1` routes through `lib/api/client.ts`; the server handlers live in `apps/api/src/api/routes/v1.ts` unless noted otherwise.

| Area | Method | Path | Mobile owner |
| --- | --- | --- | --- |
| Health | GET | `/api/health` | `app/_layout.tsx` diagnostics |
| Health | GET | `/api/health/database` | deployment diagnostics |
| Health | GET | `/api/health/data` | authenticated data diagnostics |
| Health | GET | `/api/health/ai` | deployment diagnostics |
| Accounts | GET | `/api/v1/accounts/overview` | `useFinancialData` |
| Accounts | GET | `/api/v1/accounts/:id` | account details |
| Transactions | GET | `/api/v1/transactions` | transaction explorer and Coach context |
| Transactions | GET | `/api/v1/transactions/:id` | transaction detail |
| Activity | POST | `/api/v1/activity/search` | scoped activity explorer |
| Cards | GET | `/api/v1/cards` | cards list |
| Cards | GET | `/api/v1/cards/:id` | card detail |
| Cards | GET | `/api/v1/cards/:id/transactions` | card activity |
| Cards | PATCH | `/api/v1/cards/:id/controls` | card controls |
| Cards | PATCH | `/api/v1/cards/:id/status` | card status |
| Transfers | GET | `/api/v1/transfers` | transfer history |
| Transfers | POST | `/api/v1/transfers/draft` | transfer flow |
| Transfers | POST | `/api/v1/transfers/:id/review` | transfer review |
| Transfers | POST | `/api/v1/transfers/:id/submit` | demo confirmation |
| Wealth | GET | `/api/v1/wealth/summary` | Home and Insights |
| Wealth | GET | `/api/v1/wealth/insights` | Insights |
| Wealth | GET/PATCH | `/api/v1/wealth/goals[/:id]` | goals |
| Coach | GET/POST | `/api/v1/coach/consent` | Coach consent |
| Coach | GET/POST | `/api/v1/coach/conversations[/:id]/messages` | live Wealth Coach |
| Coach | GET | `/api/v1/coach/messages/:id/sources` | Coach evidence |
| Notifications | GET/PATCH/POST | `/api/v1/notifications...` | notifications |
| Services | GET/POST/DELETE | `/api/v1/services...` | filtered MVP service directory |
| Account Aggregator | GET/POST | `/api/v1/aa/consents...` | optional account linking |

All user-scoped routes resolve the user from Clerk or the explicit development-only demo header. Client code must not send a user ID as an authority, a database URL, or a model credential.
