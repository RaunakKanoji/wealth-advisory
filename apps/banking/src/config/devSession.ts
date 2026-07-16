import { env, EnvConfigError } from "@/src/config/env";
import type { AppEnvironment } from "@/src/config/env";
import type { SessionStatus } from "@/src/types/session";

/**
 * DEV-ONLY shell preview switch.
 *
 * The authenticated (app) shell is otherwise only reachable after completing
 * the whole journey (welcome -> sign-in -> OTP -> consent -> onboarding). To
 * review each shell in isolation during development, set:
 *
 *   EXPO_PUBLIC_DEV_SESSION=public         # -> welcome (default when unset)
 *   EXPO_PUBLIC_DEV_SESSION=onboarding     # -> onboarding / consent
 *   EXPO_PUBLIC_DEV_SESSION=authenticated  # -> home dashboard
 *
 * This is NOT authentication: it only seeds the in-memory SessionProvider's
 * initial status. Nothing is persisted and no credential is checked. Setting
 * this variable in a production build is a configuration mistake and fails
 * startup loudly, so the switch can never ship in a customer build.
 */
export const DEV_SESSION_SHELLS = ["public", "onboarding", "authenticated"] as const;

export type DevSessionShell = (typeof DEV_SESSION_SHELLS)[number];

const SHELL_TO_STATUS: Record<DevSessionShell, SessionStatus> = {
  public: "unauthenticated",
  onboarding: "onboarding-required",
  authenticated: "active",
};

/** The initial session status implied by the dev switch, defaulting to the
 *  real customer entry point (`unauthenticated`) when the switch is unset. */
export function resolveDevSessionStatus(
  raw: string | undefined,
  appEnv: AppEnvironment,
): SessionStatus {
  if (raw === undefined || raw === "") {
    return "unauthenticated";
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
  return SHELL_TO_STATUS[raw as DevSessionShell];
}

/* EXPO_PUBLIC_* variables must be referenced as static literals for Expo's
 * build-time inlining to work. */
export const DEV_INITIAL_SESSION_STATUS: SessionStatus = resolveDevSessionStatus(
  process.env.EXPO_PUBLIC_DEV_SESSION,
  env.appEnv,
);
