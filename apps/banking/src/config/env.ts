import { z } from "zod";

/**
 * Typed environment configuration (F007).
 *
 * Every variable read here is an `EXPO_PUBLIC_*` variable: Expo inlines them
 * into the client bundle at build time, so they are public by definition.
 * Never put secrets, API keys, or privileged service credentials here — those
 * belong behind the bank API (see docs/context/data-and-integration-context.md).
 *
 * `EXPO_PUBLIC_*` variables must be referenced as static literals for Expo's
 * inlining to work, which is why `rawEnv` lists each one explicitly instead of
 * reading `process.env` dynamically.
 */

export const APP_ENVIRONMENTS = ["development", "preview", "production"] as const;

export type AppEnvironment = (typeof APP_ENVIRONMENTS)[number];

export type EnvConfig = {
  /** Which deployment mode this bundle was built for. */
  appEnv: AppEnvironment;
  /** Base URL of the bank API gateway. */
  apiBaseUrl: string;
  /**
   * Explicit mock mode: when true, integration-facing features use their
   * deterministic development adapters instead of the bank API. Never allowed
   * in production, and never inferred implicitly.
   */
  useMockData: boolean;
  /** Clerk publishable key (pk_*) — public by design and always required.
   *  Secrets (sk_*, signing keys, OTP provider credentials) must never appear
   *  in any EXPO_PUBLIC_* variable. */
  clerkPublishableKey: string;
};

export type RawEnv = {
  EXPO_PUBLIC_APP_ENV?: string;
  EXPO_PUBLIC_API_BASE_URL?: string;
  EXPO_PUBLIC_USE_MOCK_DATA?: string;
  EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY?: string;
};

/** Thrown when required configuration is missing or invalid, so a misconfigured
 *  build fails loudly at startup instead of running with unsafe defaults. */
export class EnvConfigError extends Error {
  constructor(issues: readonly string[]) {
    super(`Invalid environment configuration:\n- ${issues.join("\n- ")}`);
    this.name = "EnvConfigError";
  }
}

const booleanString = z
  .enum(["true", "false"], {
    error: 'must be "true" or "false"',
  })
  .transform((value) => value === "true");

const rawEnvSchema = z.object({
  EXPO_PUBLIC_APP_ENV: z
    .enum(APP_ENVIRONMENTS, {
      error: `must be one of: ${APP_ENVIRONMENTS.join(", ")}`,
    })
    .default("development"),
  EXPO_PUBLIC_API_BASE_URL: z
    .url({ error: "must be a valid URL" })
    .optional(),
  EXPO_PUBLIC_USE_MOCK_DATA: booleanString.optional(),
  EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: z
    .string()
    .trim()
    .min(1, "is required"),
});

const DEV_DEFAULT_API_BASE_URL = "http://localhost:8080";

/**
 * Parses and validates raw environment variables into a typed config.
 *
 * Rules:
 * - `EXPO_PUBLIC_APP_ENV` defaults to "development" when unset.
 * - `EXPO_PUBLIC_API_BASE_URL` is required in preview and production (https
 *   only in production); development falls back to localhost.
 * - `EXPO_PUBLIC_USE_MOCK_DATA` must be set explicitly ("true"/"false") to
 *   enable mock mode; it is rejected outright in production.
 *
 * Throws {@link EnvConfigError} with every problem listed when the
 * configuration is unusable.
 */
export function parseEnv(raw: RawEnv): EnvConfig {
  const parsed = rawEnvSchema.safeParse(raw);
  if (!parsed.success) {
    throw new EnvConfigError(
      parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
    );
  }

  const appEnv = parsed.data.EXPO_PUBLIC_APP_ENV;
  const apiBaseUrl = parsed.data.EXPO_PUBLIC_API_BASE_URL;
  const useMockData = parsed.data.EXPO_PUBLIC_USE_MOCK_DATA ?? false;
  const clerkPublishableKey = parsed.data.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

  const issues: string[] = [];

  if (appEnv !== "development" && apiBaseUrl === undefined) {
    issues.push(`EXPO_PUBLIC_API_BASE_URL: required when EXPO_PUBLIC_APP_ENV is "${appEnv}"`);
  }
  if (appEnv === "production" && apiBaseUrl !== undefined && !apiBaseUrl.startsWith("https://")) {
    issues.push("EXPO_PUBLIC_API_BASE_URL: must use https in production");
  }
  if (appEnv === "production" && parsed.data.EXPO_PUBLIC_USE_MOCK_DATA !== undefined) {
    issues.push(
      "EXPO_PUBLIC_USE_MOCK_DATA: must not be set in production; mock mode is development-only",
    );
  }
  if (issues.length > 0) {
    throw new EnvConfigError(issues);
  }

  return {
    appEnv,
    apiBaseUrl: apiBaseUrl ?? DEV_DEFAULT_API_BASE_URL,
    useMockData,
    clerkPublishableKey,
  };
}

const rawEnv: RawEnv = {
  EXPO_PUBLIC_APP_ENV: process.env.EXPO_PUBLIC_APP_ENV,
  EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL,
  EXPO_PUBLIC_USE_MOCK_DATA: process.env.EXPO_PUBLIC_USE_MOCK_DATA,
  EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
};

/** Validated configuration for this bundle. Importing this module fails fast
 *  (with a readable error) when required configuration is missing. */
export const env: EnvConfig = parseEnv(rawEnv);
