import { getClerkInstance, isClerkAPIResponseError } from "@clerk/expo";

import type {
  AuthenticatedCustomer,
  CustomerOnboardingStatus,
  RequestOtpInput,
  RequestOtpResult,
  VerifyOtpInput,
  VerifyOtpResult,
} from "@/src/features/authentication/models/authentication";
import { maskMobileNumber } from "@/src/features/authentication/models/authentication";
import { AuthenticationServiceError } from "@/src/features/authentication/models/authentication-errors";
import type { AuthenticationService } from "@/src/features/authentication/services/authentication.service";

// Clerk-backed adapter: phone-code (SMS OTP) sign-in via the Clerk instance
// that ClerkProvider initializes (see AppProviders). The challengeId is the
// Clerk sign-in attempt id; Clerk manages token storage itself through the
// secure-store token cache, so verifyOtp returns a short-lived token snapshot
// only to satisfy the shared contract — nothing here persists it.
//
// Error normalization: Clerk API error codes are collapsed to the shared
// AuthenticationErrorCode set. Raw Clerk messages/trace ids never reach the UI.

const CLERK_ERROR_CODE_MAP: Record<string, AuthenticationServiceError["code"]> = {
  form_identifier_not_found: "INVALID_IDENTIFIER",
  form_param_format_invalid: "INVALID_IDENTIFIER",
  form_code_incorrect: "INVALID_OTP",
  verification_failed: "INVALID_OTP",
  verification_expired: "OTP_EXPIRED",
  too_many_requests: "TOO_MANY_ATTEMPTS",
  rate_limit_exceeded: "TOO_MANY_ATTEMPTS",
};

function normalizeClerkError(error: unknown): AuthenticationServiceError {
  if (error instanceof AuthenticationServiceError) {
    return error;
  }
  if (isClerkAPIResponseError(error)) {
    const code = error.errors[0]?.code;
    const mapped = code ? CLERK_ERROR_CODE_MAP[code] : undefined;
    return new AuthenticationServiceError(mapped ?? "SERVICE_UNAVAILABLE");
  }
  return new AuthenticationServiceError("NETWORK_ERROR");
}

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

// Clerk client resend cooldown is provider-controlled; we surface a fixed
// courtesy window so the shared OtpResendTimer contract keeps working.
const CLERK_RESEND_COOLDOWN_MS = 30 * 1000;
const CLERK_OTP_TTL_MS = 10 * 60 * 1000;

export function createClerkAuthenticationService(): AuthenticationService {
  function requireClerk() {
    const clerk = getClerkInstance();
    if (!clerk.client) {
      throw new AuthenticationServiceError("SERVICE_UNAVAILABLE");
    }
    return clerk;
  }

  async function preparePhoneCode(identifier?: string): Promise<RequestOtpResult> {
    const clerk = requireClerk();
    const signIn = clerk.client!.signIn;

    try {
      if (identifier) {
        await signIn.create({ identifier: `+91${identifier}` });
      }

      const phoneFactor = signIn.supportedFirstFactors?.find(
        (factor) => factor.strategy === "phone_code",
      );
      if (!phoneFactor || !("phoneNumberId" in phoneFactor)) {
        throw new AuthenticationServiceError("INVALID_IDENTIFIER");
      }

      await signIn.prepareFirstFactor({
        strategy: "phone_code",
        phoneNumberId: phoneFactor.phoneNumberId,
      });

      const now = Date.now();
      return {
        challengeId: signIn.id ?? "clerk-sign-in",
        maskedDestination:
          identifier !== undefined
            ? maskMobileNumber(identifier)
            : (phoneFactor.safeIdentifier ?? "your registered mobile number"),
        expiresAt: new Date(now + CLERK_OTP_TTL_MS).toISOString(),
        resendAvailableAt: new Date(now + CLERK_RESEND_COOLDOWN_MS).toISOString(),
      };
    } catch (error) {
      throw normalizeClerkError(error);
    }
  }

  return {
    async requestOtp({ identifier }: RequestOtpInput): Promise<RequestOtpResult> {
      return preparePhoneCode(identifier);
    },

    async resendOtp(challengeId: string): Promise<RequestOtpResult> {
      const clerk = requireClerk();
      if (clerk.client!.signIn.id !== challengeId) {
        throw new AuthenticationServiceError("MISSING_CHALLENGE");
      }
      return preparePhoneCode();
    },

    async verifyOtp({ challengeId, otp }: VerifyOtpInput): Promise<VerifyOtpResult> {
      const clerk = requireClerk();
      const signIn = clerk.client!.signIn;
      if (signIn.id !== challengeId) {
        throw new AuthenticationServiceError("MISSING_CHALLENGE");
      }

      try {
        const attempt = await signIn.attemptFirstFactor({ strategy: "phone_code", code: otp });
        if (attempt.status !== "complete" || !attempt.createdSessionId) {
          throw new AuthenticationServiceError("INVALID_OTP");
        }

        await clerk.setActive({ session: attempt.createdSessionId });

        const user = clerk.user;
        const session = clerk.session;
        if (!user || !session) {
          throw new AuthenticationServiceError("UNKNOWN");
        }

        const customer: AuthenticatedCustomer = {
          customerId: user.id,
          displayName: user.firstName ?? undefined,
          onboardingStatus: readOnboardingStatus(user.publicMetadata),
        };

        // Snapshot only — Clerk owns token lifecycle + storage via its
        // secure-store token cache. Nothing downstream persists this value.
        const accessToken = (await session.getToken()) ?? "";

        return {
          session: {
            accessToken,
            expiresAt: (session.expireAt ?? new Date(Date.now() + CLERK_OTP_TTL_MS)).toISOString(),
          },
          customer,
        };
      } catch (error) {
        throw normalizeClerkError(error);
      }
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
