import { getClerkInstance } from "@clerk/expo";

import type {
  CustomerOnboardingStatus,
  RequestOtpInput,
  RequestOtpResult,
  VerifyOtpInput,
  VerifyOtpResult,
} from "@/src/features/authentication/models/authentication";
import { AuthenticationServiceError } from "@/src/features/authentication/models/authentication-errors";
import type { AuthenticationService } from "@/src/features/authentication/services/authentication.service";

// Clerk-backed adapter. In clerk mode the ENTIRE sign-in/sign-up journey is
// owned by Clerk's prebuilt components (web <SignIn/>, native <AuthView/>) —
// the app's custom OTP flow is mock-mode-only and never calls this adapter.
// Session state flows through ClerkSessionBridge; the only imperative
// operation the app still drives here is sign-out.

const ONBOARDING_STATUSES: readonly CustomerOnboardingStatus[] = [
  "consent-required",
  "profile-required",
  "risk-profile-required",
  "complete",
];

/** Onboarding progress lives in Clerk publicMetadata until the bank profile
 *  service exists; unknown/missing values default to the safest first step. */
export function readOnboardingStatus(metadata: unknown): CustomerOnboardingStatus {
  if (metadata && typeof metadata === "object" && "onboardingStatus" in metadata) {
    const value = (metadata as { onboardingStatus?: unknown }).onboardingStatus;
    if (typeof value === "string" && (ONBOARDING_STATUSES as readonly string[]).includes(value)) {
      return value as CustomerOnboardingStatus;
    }
  }
  return "consent-required";
}

export function createClerkAuthenticationService(): AuthenticationService {
  // The OTP-shaped operations exist only to satisfy the shared service
  // contract; nothing invokes them in clerk mode. Failing loudly (rather
  // than silently pretending) guards against a future wiring mistake that
  // would bypass Clerk's own UI.
  const prebuiltOnly = () =>
    new AuthenticationServiceError(
      "SERVICE_UNAVAILABLE",
      "Clerk mode uses Clerk's prebuilt sign-in components; the custom OTP flow is disabled.",
    );

  return {
    async requestOtp(_input: RequestOtpInput): Promise<RequestOtpResult> {
      throw prebuiltOnly();
    },

    async verifyOtp(_input: VerifyOtpInput): Promise<VerifyOtpResult> {
      throw prebuiltOnly();
    },

    async resendOtp(_challengeId: string): Promise<RequestOtpResult> {
      throw prebuiltOnly();
    },

    async signOut(): Promise<void> {
      try {
        await getClerkInstance().signOut();
      } catch {
        // Sign-out must never strand the customer in an authenticated UI —
        // local session state is cleared by the caller regardless.
      }
    },
  };
}
