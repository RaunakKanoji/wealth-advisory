import type { AppEnvironment } from "@/src/config/env";
import { env, EnvConfigError } from "@/src/config/env";

/**
 * Explicit development feature flags (F007). Flags gate presentation and
 * capability rollout only — never business rules, calculations, suitability,
 * or consent (those stay behind service/API boundaries).
 *
 * Overrides come from public `EXPO_PUBLIC_FLAG_*` build-time variables and are
 * honored in development and preview only. A flag variable baked into a
 * production build is a configuration mistake and fails startup loudly.
 */
export const DEFAULT_FLAGS = {
  /** Voice input/output in the copilot (text remains the fallback). */
  copilotVoice: false,
  /** Animated advisor avatar (static fallback otherwise). */
  avatarAnimation: false,
} as const;

export type FeatureFlagName = keyof typeof DEFAULT_FLAGS;

export type FeatureFlags = { [K in FeatureFlagName]: boolean };

export type RawFlagEnv = Partial<Record<FeatureFlagName, string>>;

/**
 * Resolves the flag set for the given environment.
 *
 * - Unset overrides fall back to {@link DEFAULT_FLAGS}.
 * - Overrides must be exactly "true" or "false"; anything else throws.
 * - Any override present in production throws.
 */
export function resolveFeatureFlags(raw: RawFlagEnv, appEnv: AppEnvironment): FeatureFlags {
  const flags: FeatureFlags = { ...DEFAULT_FLAGS };
  const issues: string[] = [];

  for (const name of Object.keys(DEFAULT_FLAGS) as FeatureFlagName[]) {
    const value = raw[name];
    if (value === undefined) {
      continue;
    }
    if (appEnv === "production") {
      issues.push(`${name}: feature flag overrides are not allowed in production`);
      continue;
    }
    if (value !== "true" && value !== "false") {
      issues.push(`${name}: must be "true" or "false", got "${value}"`);
      continue;
    }
    flags[name] = value === "true";
  }

  if (issues.length > 0) {
    throw new EnvConfigError(issues);
  }

  return flags;
}

/* EXPO_PUBLIC_* variables must be referenced as static literals for Expo's
 * build-time inlining to work. */
const rawFlagEnv: RawFlagEnv = {
  copilotVoice: process.env.EXPO_PUBLIC_FLAG_COPILOT_VOICE,
  avatarAnimation: process.env.EXPO_PUBLIC_FLAG_AVATAR_ANIMATION,
};

/** Validated flag set for this bundle. */
export const featureFlags: FeatureFlags = resolveFeatureFlags(rawFlagEnv, env.appEnv);
