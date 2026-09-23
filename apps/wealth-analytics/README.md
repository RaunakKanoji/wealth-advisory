# IDBI Wealth Analytics

This is the private Python service behind the Node `/api/wealth/query` gateway.
The Expo client never calls this service and never receives `VANNA_DATABASE_URL`.

## Local start

1. Apply the API migration and provision the read-only role:

   ```bash
   pnpm db:migrate:coach
   WEALTH_ANALYTICS_READER_PASSWORD="$(openssl rand -base64 36)" pnpm --filter @idbi/api analytics:provision-reader
   ```

2. Create a server-only `apps/wealth-analytics/.env.local` from `.env.example`.
   Set `VANNA_DATABASE_URL` to the pooled Neon URL using the
   `wealth_analytics_reader` credentials, and set a separate random
   `VANNA_SERVICE_SECRET`.

   If the Vanna agent is enabled, set GOOGLE_API_KEY (or the existing
   server-only GEMINI_API_KEY alias) in this file. Do not put either key in
   apps/banking/.env.local or any EXPO_PUBLIC_* variable.

3. Install and start the service:

   ```bash
   python3 -m venv .venv
   .venv/bin/pip install -r requirements.txt
   .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8001
   ```

4. Set the same service URL and secret in the API's server-only environment:
   `VANNA_SERVICE_URL=http://127.0.0.1:8001` and
   `VANNA_SERVICE_SECRET=...`.

`VANNA_ENABLE_AGENT` is off by default. When enabled, Vanna 2's
`Agent`/`ToolRegistry`/`UserResolver` composition is available for orchestration,
but its SQL runner is wrapped by the same read-only validator and transaction-local
`app.user_id` scope. The deterministic analytics engine remains the response
contract and safe fallback.
