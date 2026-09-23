import { serve } from "@hono/node-server";
import { sql } from "drizzle-orm";

import { app } from "./app.js";
import { apiPort, env, isDemoMode } from "./env.js";
import { closeDatabase, db } from "./db/client.js";

let server: ReturnType<typeof serve> | undefined;
let shuttingDown = false;

function describeError(error: unknown): { code?: string; message: string } {
  if (error && typeof error === "object") {
    const candidate = error as { code?: unknown; message?: unknown };
    return {
      code: typeof candidate.code === "string" ? candidate.code : undefined,
      message: typeof candidate.message === "string" ? candidate.message : "unknown error",
    };
  }
  return { message: "unknown error" };
}

async function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  await new Promise<void>((resolve) => {
    if (!server) {
      resolve();
      return;
    }
    try {
      server.close(() => resolve());
    } catch {
      resolve();
    }
  });
  await closeDatabase();
  if (exitCode !== 0) process.exitCode = exitCode;
}

function handleServerError(error: unknown) {
  const { code, message } = describeError(error);
  if (code === "EADDRINUSE") {
    console.error(`[API] Port ${apiPort} is already in use. Stop the existing API process or set PORT to another value.`);
    // There is no listening server to drain in this case. Exit immediately so
    // pnpm does not leave a failed API command hanging while an idle database
    // pool waits for its normal timeout.
    process.exit(1);
  } else {
    console.error("[API] Server failed to start", { code, message });
    void shutdown(1);
  }
}

async function checkDatabaseConnectivity() {
  try {
    const result = await db.execute<{ ok: number }>(sql`select 1 as ok`);
    if (Number(result.rows[0]?.ok) !== 1) throw new Error("SELECT 1 returned an unexpected result.");
    console.info("[DB] Neon connectivity verified");
  } catch (error) {
    const { code, message } = describeError(error);
    console.error("[DB] Connectivity check failed", { code, message: message === "unknown error" ? message : "SELECT 1 failed" });
  }
}

try {
  server = serve({ fetch: app.fetch, hostname: env.API_HOST, port: apiPort }, (info) => {
    console.log(`[API] Listening on ${info.address}:${info.port}`);
  });
  server.once("error", handleServerError);
  console.info("[DB] Neon configuration loaded");
  console.info("[AUTH] Demo authentication enabled", { enabled: isDemoMode });
  console.info(`[ENV] ${process.env.NODE_ENV ?? "development"}`);
  void checkDatabaseConnectivity();
} catch (error) {
  handleServerError(error);
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());

export { app };
export default app;
