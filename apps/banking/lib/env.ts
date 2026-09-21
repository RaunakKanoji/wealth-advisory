import { z } from "zod";

const envSchema = z.object({
  EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: z
    .string()
    .trim()
    .min(1, "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is required"),
  EXPO_PUBLIC_API_BASE_URL: z.string().trim().url().optional(),
  EXPO_PUBLIC_USE_MOCK_DATA: z.enum(["true", "false"]).default("true"),
});

export const env = envSchema.parse({
  EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
  EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL || undefined,
  EXPO_PUBLIC_USE_MOCK_DATA: process.env.EXPO_PUBLIC_USE_MOCK_DATA ?? "true",
});
