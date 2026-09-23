import { z } from "zod";

const envSchema = z.object({
  EXPO_PUBLIC_APP_ENV: z.enum(["development", "preview", "production"]).default("development"),
  EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: z
    .string()
    .trim()
    .min(1, "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is required"),
  EXPO_PUBLIC_API_BASE_URL: z
    .string()
    .trim()
    .url()
    .refine((value) => ["http:", "https:"].includes(new URL(value).protocol), "EXPO_PUBLIC_API_BASE_URL must use HTTP or HTTPS")
    .optional(),
  EXPO_PUBLIC_DEMO_AUTH_ID: z.string().trim().min(1).default("demo-customer-a"),
  EXPO_PUBLIC_ALLOW_DEMO_AUTH: z.enum(["true", "false"]).default("false"),
  EXPO_PUBLIC_DEMO_MODE: z.enum(["true", "false"]).default("false"),
  EXPO_PUBLIC_USE_MOCK_DATA: z.enum(["true", "false"]).default("false"),
  EXPO_PUBLIC_REMOTE_COACH_ENABLED: z.enum(["true", "false"]).default("true"),
});

export const env = envSchema.parse({
  EXPO_PUBLIC_APP_ENV: process.env.EXPO_PUBLIC_APP_ENV,
  EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
  EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL,
  EXPO_PUBLIC_DEMO_AUTH_ID: process.env.EXPO_PUBLIC_DEMO_AUTH_ID,
  EXPO_PUBLIC_ALLOW_DEMO_AUTH: process.env.EXPO_PUBLIC_ALLOW_DEMO_AUTH,
  EXPO_PUBLIC_DEMO_MODE: process.env.EXPO_PUBLIC_DEMO_MODE,
  EXPO_PUBLIC_USE_MOCK_DATA: process.env.EXPO_PUBLIC_USE_MOCK_DATA,
  EXPO_PUBLIC_REMOTE_COACH_ENABLED: process.env.EXPO_PUBLIC_REMOTE_COACH_ENABLED,
});

if (env.EXPO_PUBLIC_APP_ENV === "production") {
  if (env.EXPO_PUBLIC_DEMO_MODE === "true" || env.EXPO_PUBLIC_USE_MOCK_DATA === "true") throw new Error("Demo mode must be disabled in production.");
  if (!env.EXPO_PUBLIC_API_BASE_URL) throw new Error("EXPO_PUBLIC_API_BASE_URL is required in production.");
  if (!env.EXPO_PUBLIC_API_BASE_URL?.startsWith("https://")) throw new Error("EXPO_PUBLIC_API_BASE_URL must use HTTPS in production.");
  const productionApiHost = new URL(env.EXPO_PUBLIC_API_BASE_URL).hostname.toLowerCase();
  const isPrivateIpv4 = /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(productionApiHost);
  if (["localhost", "::1"].includes(productionApiHost) || isPrivateIpv4) {
    throw new Error("EXPO_PUBLIC_API_BASE_URL must point to a public HTTPS backend in production.");
  }
}

export const isExplicitDemoMode = env.EXPO_PUBLIC_DEMO_MODE === "true" || env.EXPO_PUBLIC_USE_MOCK_DATA === "true";

if (!isExplicitDemoMode && !env.EXPO_PUBLIC_API_BASE_URL) {
  throw new Error("EXPO_PUBLIC_API_BASE_URL is required when remote data mode is enabled.");
}

export const isRemoteDataEnabled = Boolean(env.EXPO_PUBLIC_API_BASE_URL) && !isExplicitDemoMode;
/** The authenticated conversation API is the default for unscoped live-data Coach questions. */
export const isRemoteCoachEnabled = isRemoteDataEnabled && env.EXPO_PUBLIC_REMOTE_COACH_ENABLED === "true";
export const isExplicitDemoAuthEnabled = env.EXPO_PUBLIC_APP_ENV !== "production" && env.EXPO_PUBLIC_ALLOW_DEMO_AUTH === "true";

export function isFinancialAuthReady(isLoaded: boolean, isSignedIn: boolean | undefined): boolean {
  return isLoaded && (isSignedIn === true || isExplicitDemoAuthEnabled);
}
