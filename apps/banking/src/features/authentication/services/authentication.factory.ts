import { EnvConfigError, env } from "@/src/config/env";
import type { AuthenticationMode } from "@/src/config/env";
import { createClerkAuthenticationService } from "@/src/features/authentication/services/authentication.clerk";
import { createMockAuthenticationService } from "@/src/features/authentication/services/authentication.mock";
import type { AuthenticationService } from "@/src/features/authentication/services/authentication.service";

/**
 * Selects the authentication adapter from typed runtime configuration.
 *
 * - mock  → deterministic development adapter (config/env.ts already rejects
 *           mock outside development/preview, so production can never reach it)
 * - clerk → Clerk phone-code adapter (publishable key validated at startup)
 * - bank  → not yet implemented: fails loudly instead of silently
 *           authenticating with a stand-in
 */
export function createAuthenticationService(
  mode: AuthenticationMode = env.authenticationMode,
): AuthenticationService {
  switch (mode) {
    case "mock":
      return createMockAuthenticationService();
    case "clerk":
      return createClerkAuthenticationService();
    case "bank":
      throw new EnvConfigError([
        "EXPO_PUBLIC_AUTHENTICATION_MODE: the bank authentication adapter is not implemented yet — do not enable \"bank\"",
      ]);
  }
}
