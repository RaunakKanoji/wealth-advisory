import { env, EnvConfigError } from "@/src/config/env";
import type { AppEnvironment } from "@/src/config/env";

/**
 * DEV-ONLY shell preview switch.
 *
 * The authenticated (app) shell is otherwise only reachable after completing
 * the whole journey (welcome -> sign-in -> OTP -> onboarding). To review each
 * shell in isolation during development, set:
 *
 *   EXPO_PUBLIC_DEV_SESSION=public         # -> welcome
 *   EXPO_PUBLIC_DEV_SESSION=onboarding     # -> onboarding / consent
 *   EXPO_PUBLIC_DEV_SESSION=authenticated  # -> home dashboard
 *
 * This is NOT authentication: it only overrides the SessionProvider's
 * initial state with a fictional preview identity. When the switch is unset
 * the provider bootstraps normally from stored session state. Setting this
 * variable in a production build fails startup loudly, so the switch can
 * never ship in a customer build.
 */
export const DEV_SESSION_SHELLS = ["public", "onboarding", "authenticated"] as const;

export type DevSessionShell = (typeof DEV_SESSION_SHELLS)[number];

/** The shell override implied by the dev switch, or null for the normal
 *  storage-backed session bootstrap. */
export function resolveDevSessionShell(
  raw: string | undefined,
  appEnv: AppEnvironment,
): DevSessionShell | null {
  if (raw === undefined || raw === "") {
    return null;
  }
  if (appEnv === "production") {
    throw new EnvConfigError([
      "EXPO_PUBLIC_DEV_SESSION: the shell preview switch must not be set in production",
    ]);
  }
  if (!(DEV_SESSION_SHELLS as readonly string[]).includes(raw)) {
    throw new EnvConfigError([
      `EXPO_PUBLIC_DEV_SESSION: must be one of ${DEV_SESSION_SHELLS.join(", ")}, got "${raw}"`,
    ]);
  }
  return raw as DevSessionShell;
}

/* EXPO_PUBLIC_* variables must be referenced as static literals for Expo's
 * build-time inlining to work. */
export const DEV_SESSION_SHELL_OVERRIDE: DevSessionShell | null = resolveDevSessionShell(
  process.env.EXPO_PUBLIC_DEV_SESSION,
  env.appEnv,
);
