import { config } from "dotenv";
import { resolve } from "node:path";
import { z } from "zod";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

const envSchema = z.object({
  GEMINI_API_KEY: z.string().trim().optional(),
  GEMINI_MODEL: z.string().trim().regex(/^[a-zA-Z0-9._-]+$/).optional(),
  GEMINI_FALLBACK_MODEL: z.string().trim().regex(/^[a-zA-Z0-9._-]+$/).default("gemini-3.5-flash"),
  DATABASE_URL: z.string().trim().min(1, "DATABASE_URL is required for the API server"),
  DATABASE_URL_UNPOOLED: z.string().trim().optional(),
  DB_POOL_MAX: z.coerce.number().int().positive().max(50).default(10),
  DB_IDLE_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  DB_CONNECTION_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  DB_QUERY_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
  NEON_BRANCH: z.string().trim().optional(),
  CLERK_SECRET_KEY: z.string().trim().optional(),
  CLERK_AUDIENCE: z.string().trim().optional(),
  CLERK_AUTHORIZED_PARTIES: z.string().trim().optional(),
  DEMO_MODE: z.enum(["true", "false"]).default("false"),
  DEMO_USER_ID: z.string().trim().min(1).default("usr_demo_a"),
  DEMO_AUTH_ID: z.string().trim().min(1).default("demo-customer-a"),
  API_HOST: z.string().default("127.0.0.1"),
  PORT: z.coerce.number().int().positive().optional(),
  API_PORT: z.coerce.number().int().positive().optional(),
  API_ORIGIN: z.string().url().default("http://localhost:8080"),
  VANNA_SERVICE_URL: z.string().trim().url().optional(),
  VANNA_SERVICE_SECRET: z.string().trim().min(16).optional(),
  VANNA_QUERY_TIMEOUT_MS: z.coerce.number().int().positive().max(60_000).default(20_000),
  AA_ENABLED: z.enum(["true", "false"]).default("false"),
  AA_PROVIDER: z.enum(["finvu", "setu", "onemoney", "mock"]).default("finvu"),
  AA_API_BASE_URL: z.string().trim().url().optional(),
  AA_FIU_ID: z.string().trim().optional(),
  AA_CLIENT_API_KEY: z.string().trim().optional(),
  AA_JWS_PRIVATE_KEY: z.string().trim().optional(),
  AA_JWS_PUBLIC_KEY: z.string().trim().optional(),
  AA_JWS_KEY_ID: z.string().trim().optional(),
  AA_WEBHOOK_SECRET: z.string().trim().optional(),
  AA_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  AA_DATA_RETENTION_DAYS: z.coerce.number().int().positive().max(3650).default(30),
});

export const env = envSchema.parse({
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GEMINI_MODEL: process.env.GEMINI_MODEL,
  GEMINI_FALLBACK_MODEL: process.env.GEMINI_FALLBACK_MODEL,
  DATABASE_URL: process.env.DATABASE_URL,
  DATABASE_URL_UNPOOLED: process.env.DATABASE_URL_UNPOOLED,
  DB_POOL_MAX: process.env.DB_POOL_MAX,
  DB_IDLE_TIMEOUT_MS: process.env.DB_IDLE_TIMEOUT_MS,
  DB_CONNECTION_TIMEOUT_MS: process.env.DB_CONNECTION_TIMEOUT_MS,
  DB_QUERY_TIMEOUT_MS: process.env.DB_QUERY_TIMEOUT_MS,
  NEON_BRANCH: process.env.NEON_BRANCH,
  CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
  CLERK_AUDIENCE: process.env.CLERK_AUDIENCE,
  CLERK_AUTHORIZED_PARTIES: process.env.CLERK_AUTHORIZED_PARTIES,
  DEMO_MODE: process.env.DEMO_MODE,
  DEMO_USER_ID: process.env.DEMO_USER_ID,
  DEMO_AUTH_ID: process.env.DEMO_AUTH_ID,
  API_HOST: process.env.API_HOST,
  PORT: process.env.PORT,
  API_PORT: process.env.API_PORT,
  API_ORIGIN: process.env.API_ORIGIN,
  VANNA_SERVICE_URL: process.env.VANNA_SERVICE_URL,
  VANNA_SERVICE_SECRET: process.env.VANNA_SERVICE_SECRET,
  VANNA_QUERY_TIMEOUT_MS: process.env.VANNA_QUERY_TIMEOUT_MS,
  AA_ENABLED: process.env.AA_ENABLED,
  AA_PROVIDER: process.env.AA_PROVIDER,
  AA_API_BASE_URL: process.env.AA_API_BASE_URL,
  AA_FIU_ID: process.env.AA_FIU_ID,
  AA_CLIENT_API_KEY: process.env.AA_CLIENT_API_KEY,
  AA_JWS_PRIVATE_KEY: process.env.AA_JWS_PRIVATE_KEY,
  AA_JWS_PUBLIC_KEY: process.env.AA_JWS_PUBLIC_KEY,
  AA_JWS_KEY_ID: process.env.AA_JWS_KEY_ID,
  AA_WEBHOOK_SECRET: process.env.AA_WEBHOOK_SECRET,
  AA_REQUEST_TIMEOUT_MS: process.env.AA_REQUEST_TIMEOUT_MS,
  AA_DATA_RETENTION_DAYS: process.env.AA_DATA_RETENTION_DAYS,
});

export const isDemoMode = env.DEMO_MODE === "true";
export const apiPort = env.PORT ?? env.API_PORT ?? 8080;
export const isAAEnabled = env.AA_ENABLED === "true";
export const clerkAuthorizedParties = env.CLERK_AUTHORIZED_PARTIES
  ? env.CLERK_AUTHORIZED_PARTIES.split(",").map((value) => value.trim()).filter(Boolean)
  : undefined;

if (process.env.NODE_ENV === "production" && isDemoMode) {
  throw new Error("DEMO_MODE must be false in production.");
}

if (isAAEnabled && env.AA_PROVIDER !== "mock") {
  const missing = [
    ["AA_API_BASE_URL", env.AA_API_BASE_URL],
    ["AA_FIU_ID", env.AA_FIU_ID],
    ["AA_CLIENT_API_KEY", env.AA_CLIENT_API_KEY],
    ["AA_JWS_PRIVATE_KEY", env.AA_JWS_PRIVATE_KEY],
    ["AA_JWS_PUBLIC_KEY", env.AA_JWS_PUBLIC_KEY],
    ["AA_JWS_KEY_ID", env.AA_JWS_KEY_ID],
    ["AA_WEBHOOK_SECRET", env.AA_WEBHOOK_SECRET],
  ].filter(([, value]) => !value).map(([name]) => name);
  if (missing.length > 0) {
    throw new Error(`Account Aggregator configuration is incomplete: ${missing.join(", ")}`);
  }
}

if (isAAEnabled && env.AA_PROVIDER === "mock" && !env.AA_WEBHOOK_SECRET) {
  throw new Error("AA_WEBHOOK_SECRET is required when the explicit mock AA provider is enabled.");
}
