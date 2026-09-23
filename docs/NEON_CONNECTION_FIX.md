# Neon Database Integration Audit & Connection Fix

## 1. Executive Summary

This document details the audit of the IDBI Wealth Advisory & Banking application's data flow, diagnosing why the physical iPhone client displayed:

> **"Accounts unavailable"**
> *"We couldn’t load your accounts. Please try again."*

and provides the end-to-end fix connecting the Expo mobile app to the backend Hono API service and Neon PostgreSQL database.

---

## 2. Architecture & Data Flow

The system follows a strict 3-tier architecture with no direct database access from the client:

```
┌─────────────────────────────────────────────────────────┐
│                      Expo Mobile App                    │
│      (apps/banking running on iOS / Android / Web)      │
│     Only knows: EXPO_PUBLIC_API_BASE_URL (NO DATABASE_URL)│
└────────────────────────────┬────────────────────────────┘
                             │ HTTP / JSON
                             ▼
┌─────────────────────────────────────────────────────────┐
│                    Backend API Gateway                  │
│             (apps/api running on Hono / Node)           │
│           Knows: DATABASE_URL (Private & Server-only)   │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│               Service & Repository Layer                │
│    accounts.service.ts -> accounts.repository.ts        │
│          Drizzle ORM (@neondatabase/serverless)         │
└────────────────────────────┬────────────────────────────┘
                             │ PostgreSQL Connection Pool
                             ▼
┌─────────────────────────────────────────────────────────┐
│                 Neon PostgreSQL Database                │
│                Branch: production (us-east-2)           │
│        Tables: users, accounts, balances, txns...       │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Findings & Audit Results

| Layer | Component | Status | Finding / Detail |
|---|---|---|---|
| **Database** | Neon PostgreSQL | Healthy | Branch `production` is active; all 22 tables exist; `SELECT 1` succeeds. |
| **Backend API** | Hono server (`apps/api`) | Healthy | Listening on `0.0.0.0:8080`; `/api/health/database` returns `200 OK`; `/api/v1/accounts` returns 4 accounts. |
| **Auth Mapping** | User resolution | Working | Resolves demo user `usr_demo_a` from `x-demo-auth-id: demo-customer-a`. |
| **Mobile Config** | `apps/banking/.env.local` | **Root Cause** | Configured with `EXPO_PUBLIC_API_BASE_URL=http://localhost:8080`. |
| **Network Layer** | Physical iPhone | **Root Cause** | On a real iPhone, `localhost` resolves to `127.0.0.1` on the phone itself, failing network requests. |
| **CORS Policy** | `apps/api/src/app.ts` | **Secondary Risk**| Restricted origin header to `API_ORIGIN`, potentially rejecting LAN origins from device browsers. |

---

## 4. Root Cause Analysis of "Accounts Unavailable"

1. **Localhost Isolation on Native Hardware**:
   - The user launched the app on a physical iPhone connected via USB/Wi-Fi.
   - The app's environment variable `EXPO_PUBLIC_API_BASE_URL` was `http://localhost:8080`.
   - When TanStack Query's `useAccounts()` hook executed `fetch("http://localhost:8080/api/v1/accounts")`, the iOS operating system attempted to connect to port 8080 on the iPhone itself.
   - The connection was immediately refused (`TypeError: Network request failed`).
2. **UI State Mapping**:
   - `apiRequest` in `apps/banking/lib/api/client.ts` caught the network failure and threw an `ApiError(0, "NETWORK_ERROR", ...)`.
   - `AccountsScreen` rendered the `StateCard` with title **"Accounts unavailable"** and description **"We couldn’t reach the banking service. Check your connection and try again."**

---

## 5. End-to-End Remediation Plan

1. **Targeting the Mac's LAN IP**:
   - Update `EXPO_PUBLIC_API_BASE_URL` in `apps/banking/.env.local` to `http://10.20.84.184:8080` (the Mac's local network IP).
2. **Automatic Host IP Resolution Fallback**:
   - Enhance `apps/banking/lib/api/client.ts`: if running on native device and `localhost` is configured, automatically rewrite `localhost` to the Metro host IP from `Constants.expoConfig?.hostUri`.
3. **CORS Normalization**:
   - In `apps/api/src/app.ts`, allow wildcard/origin reflection so mobile requests over LAN are never rejected.
4. **Data Seed Alignment**:
   - Update `apps/api/src/db/seed.ts` so:
     - Account 1 (Savings): ledger `101250.00`, holds `1250.00`, available `100000.00`
     - Account 2 (Current): ledger `125000.00`, holds `0.00`, available `125000.00`
     - Account 3 (FD): balance `70678.00`
     - Account 4 (RD): balance `50000.00`
     - Summary: `totalBalance: 345678.00`, `availableToSpend: 225000.00`, `deposits: 120678.00`
     - Seed Aug/Sep 2026 transactions including Acme Technologies, The Green Fork, QuickBite, Cedar Table, Rohan Shah, Fresh Basket, MSEDCL.
5. **Idempotent DB Setup**:
   - `npm run db:setup` validates `DATABASE_URL`, verifies `SELECT 1`, applies migrations, seeds data, checks row counts, and outputs the expected verification checklist.
