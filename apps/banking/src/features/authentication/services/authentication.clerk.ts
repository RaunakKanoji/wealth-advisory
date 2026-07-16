import { getClerkInstance, isClerkAPIResponseError } from "@clerk/expo";

import { env } from "@/src/config/env";
import type {
  AuthenticatedCustomer,
  CustomerOnboardingStatus,
  RequestOtpInput,
  RequestOtpResult,
  VerifyOtpInput,
  VerifyOtpResult,
} from "@/src/features/authentication/models/authentication";
import { AuthenticationServiceError } from "@/src/features/authentication/models/authentication-errors";
import type { AuthenticationService } from "@/src/features/authentication/services/authentication.service";

// Clerk-backed adapter: phone-code (SMS OTP) authentication via the Clerk
// instance that ClerkProvider initializes (see AppProviders). Clerk manages
// token storage itself through the secure-store token cache, so verifyOtp
// returns a short-lived token snapshot only to satisfy the shared contract —
// nothing here persists it.
//
// Development affordances (never active in production builds):
// - Clerk TEST NUMBERS: entering 55555501XX maps to +1 555 555 01XX, Clerk's
//   fixed-code test range (code 424242, no real SMS) — lets the full journey
//   run end-to-end without SMS delivery.
// - SIGN-UP FALLBACK: an unknown number auto-provisions a Clerk user on
//   first sign-in (there is no bank directory to check against yet). The
//   production bank adapter must be strictly sign-in-only.
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

function clerkErrorCode(error: unknown): string | null {
  return isClerkAPIResponseError(error) ? (error.errors[0]?.code ?? null) : null;
}

function normalizeClerkError(error: unknown): AuthenticationServiceError {
  if (error instanceof AuthenticationServiceError) {
    return error;
  }
  const code = clerkErrorCode(error);
  if (code) {
    return new AuthenticationServiceError(CLERK_ERROR_CODE_MAP[code] ?? "SERVICE_UNAVAILABLE");
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

/** Clerk's reserved test range (+1 555 555 01XX, fixed code 424242) entered
 *  as a bare 10-digit number. Development/preview only. */
function isClerkTestNumber(normalized: string): boolean {
  return env.appEnv !== "production" && /^55555501\d{2}$/.test(normalized);
}

function toE164(normalized: string): string {
  return isClerkTestNumber(normalized) ? `+1${normalized}` : `+91${normalized}`;
}

function maskE164(e164: string): string {
  const countryCode = e164.startsWith("+1") && e164.length === 12 ? "+1" : "+91";
  return `${countryCode} ••••• ••${e164.slice(-3)}`;
}

// Clerk controls the real cooldown/expiry server-side; these mirror the shared
// contract so the resend timer and expiry copy keep working.
const CLERK_RESEND_COOLDOWN_MS = 30 * 1000;
const CLERK_OTP_TTL_MS = 10 * 60 * 1000;

type ActiveFlow = {
  kind: "sign-in" | "sign-up";
  challengeId: string;
  e164: string;
};

export function createClerkAuthenticationService(): AuthenticationService {
  let activeFlow: ActiveFlow | null = null;

  function requireClerk() {
    const clerk = getClerkInstance();
    if (!clerk.client) {
      throw new AuthenticationServiceError("SERVICE_UNAVAILABLE");
    }
    return clerk;
  }

  function challengeResult(challengeId: string, e164: string): RequestOtpResult {
    const now = Date.now();
    return {
      challengeId,
      maskedDestination: maskE164(e164),
      expiresAt: new Date(now + CLERK_OTP_TTL_MS).toISOString(),
      resendAvailableAt: new Date(now + CLERK_RESEND_COOLDOWN_MS).toISOString(),
    };
  }

  async function startSignIn(e164: string): Promise<RequestOtpResult> {
    const clerk = requireClerk();
    const signIn = clerk.client!.signIn;

    await signIn.create({ identifier: e164 });
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

    activeFlow = { kind: "sign-in", challengeId: signIn.id ?? "clerk-sign-in", e164 };
    return challengeResult(activeFlow.challengeId, e164);
  }

  async function startSignUp(e164: string): Promise<RequestOtpResult> {
    const clerk = requireClerk();
    const signUp = clerk.client!.signUp;

    await signUp.create({ phoneNumber: e164 });
    await signUp.preparePhoneNumberVerification({ strategy: "phone_code" });

    activeFlow = { kind: "sign-up", challengeId: signUp.id ?? "clerk-sign-up", e164 };
    return challengeResult(activeFlow.challengeId, e164);
  }

  async function startFlow(e164: string): Promise<RequestOtpResult> {
    try {
      return await startSignIn(e164);
    } catch (error) {
      // DEV-ONLY auto-provisioning: no bank customer directory exists yet, so
      // an unknown number becomes a new Clerk user on first sign-in. The
      // production adapter must reject unknown customers instead.
      if (env.appEnv !== "production" && clerkErrorCode(error) === "form_identifier_not_found") {
        return startSignUp(e164);
      }
      throw normalizeClerkError(error);
    }
  }

  async function buildResult(): Promise<VerifyOtpResult> {
    const clerk = requireClerk();
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
  }

  return {
    async requestOtp({ identifier }: RequestOtpInput): Promise<RequestOtpResult> {
      try {
        return await startFlow(toE164(identifier));
      } catch (error) {
        throw normalizeClerkError(error);
      }
    },

    async resendOtp(challengeId: string): Promise<RequestOtpResult> {
      if (!activeFlow || activeFlow.challengeId !== challengeId) {
        throw new AuthenticationServiceError("MISSING_CHALLENGE");
      }
      try {
        return await startFlow(activeFlow.e164);
      } catch (error) {
        throw normalizeClerkError(error);
      }
    },

    async verifyOtp({ challengeId, otp }: VerifyOtpInput): Promise<VerifyOtpResult> {
      if (!activeFlow || activeFlow.challengeId !== challengeId) {
        throw new AuthenticationServiceError("MISSING_CHALLENGE");
      }
      const clerk = requireClerk();

      try {
        let createdSessionId: string | null;
        if (activeFlow.kind === "sign-in") {
          const attempt = await clerk.client!.signIn.attemptFirstFactor({
            strategy: "phone_code",
            code: otp,
          });
          createdSessionId = attempt.status === "complete" ? attempt.createdSessionId : null;
        } else {
          const attempt = await clerk.client!.signUp.attemptPhoneNumberVerification({
            code: otp,
          });
          createdSessionId = attempt.status === "complete" ? attempt.createdSessionId : null;
        }

        if (!createdSessionId) {
          throw new AuthenticationServiceError("INVALID_OTP");
        }

        await clerk.setActive({ session: createdSessionId });
        activeFlow = null;
        return await buildResult();
      } catch (error) {
        throw normalizeClerkError(error);
      }
    },

    async signOut(): Promise<void> {
      activeFlow = null;
      try {
        await getClerkInstance().signOut();
      } catch {
        // Sign-out must never strand the customer in an authenticated UI —
        // local session state is cleared by the caller regardless.
      }
    },
  };
}
