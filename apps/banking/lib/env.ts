import { z } from "zod";

const envSchema = z.object({
  EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: z
    .string()
    .trim()
    .min(1, "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is required"),
});

export const env = envSchema.parse({
  EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
});
