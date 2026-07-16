import {
  DEV_CUSTOMERS,
  DEV_EXPIRED_OTP,
  DEV_LATENCY_MS,
  DEV_MAX_VERIFY_ATTEMPTS,
  DEV_OTP_TTL_MS,
  DEV_RESEND_COOLDOWN_MS,
  DEV_SERVICE_UNAVAILABLE_IDENTIFIER,
  DEV_SESSION_TTL_MS,
  DEV_VALID_OTP,
} from "@/src/features/authentication/fixtures/authentication.fixtures";
import type {
  RequestOtpInput,
  RequestOtpResult,
  VerifyOtpInput,
  VerifyOtpResult,
} from "@/src/features/authentication/models/authentication";
import { maskMobileNumber } from "@/src/features/authentication/models/authentication";
import { AuthenticationServiceError } from "@/src/features/authentication/models/authentication-errors";
import type { AuthenticationService } from "@/src/features/authentication/services/authentication.service";

type Challenge = {
  identifier: string;
  createdAt: number;
  resendAvailableAt: number;
  attempts: number;
};

export type MockAuthenticationServiceOptions = {
  /** Artificial latency; pass 0 in tests for instant responses. */
  latencyMs?: number;
  /** Injectable clock for deterministic expiry tests. */
  now?: () => number;
};

// Deterministic development adapter — in-memory, no real OTP provider, no
// network. Scenario identifiers/codes are documented in
// fixtures/authentication.fixtures.ts. Never enabled in production builds
// (see authentication.factory.ts + config/env.ts).
export function createMockAuthenticationService(
  options: MockAuthenticationServiceOptions = {},
): AuthenticationService {
  const { latencyMs = DEV_LATENCY_MS, now = Date.now } = options;
  const challenges = new Map<string, Challenge>();
  let challengeSequence = 0;

  async function simulateLatency(): Promise<void> {
    if (latencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, latencyMs));
    }
  }

  function createChallenge(identifier: string): RequestOtpResult {
    challengeSequence += 1;
    const challengeId = `mock-challenge-${challengeSequence}`;
    const createdAt = now();
    const resendAvailableAt = createdAt + DEV_RESEND_COOLDOWN_MS;
    challenges.set(challengeId, { identifier, createdAt, resendAvailableAt, attempts: 0 });

    return {
      challengeId,
      maskedDestination: maskMobileNumber(identifier),
      expiresAt: new Date(createdAt + DEV_OTP_TTL_MS).toISOString(),
      resendAvailableAt: new Date(resendAvailableAt).toISOString(),
    };
  }

  return {
    async requestOtp({ identifier }: RequestOtpInput): Promise<RequestOtpResult> {
      await simulateLatency();

      if (identifier === DEV_SERVICE_UNAVAILABLE_IDENTIFIER) {
        throw new AuthenticationServiceError("SERVICE_UNAVAILABLE");
      }
      if (!DEV_CUSTOMERS[identifier]) {
        throw new AuthenticationServiceError("INVALID_IDENTIFIER");
      }
      return createChallenge(identifier);
    },

    async resendOtp(challengeId: string): Promise<RequestOtpResult> {
      await simulateLatency();

      const challenge = challenges.get(challengeId);
      if (!challenge) {
        throw new AuthenticationServiceError("MISSING_CHALLENGE");
      }
      if (now() < challenge.resendAvailableAt) {
        throw new AuthenticationServiceError("RESEND_NOT_AVAILABLE");
      }
      // A resent code retires the previous challenge — a stale code must not
      // stay valid alongside the new one.
      challenges.delete(challengeId);
      return createChallenge(challenge.identifier);
    },

    async verifyOtp({ challengeId, otp }: VerifyOtpInput): Promise<VerifyOtpResult> {
      await simulateLatency();

      const challenge = challenges.get(challengeId);
      if (!challenge) {
        throw new AuthenticationServiceError("MISSING_CHALLENGE");
      }
      if (challenge.attempts >= DEV_MAX_VERIFY_ATTEMPTS) {
        challenges.delete(challengeId);
        throw new AuthenticationServiceError("TOO_MANY_ATTEMPTS");
      }
      if (otp === DEV_EXPIRED_OTP || now() - challenge.createdAt > DEV_OTP_TTL_MS) {
        throw new AuthenticationServiceError("OTP_EXPIRED");
      }
      if (otp !== DEV_VALID_OTP) {
        challenge.attempts += 1;
        throw new AuthenticationServiceError(
          challenge.attempts >= DEV_MAX_VERIFY_ATTEMPTS ? "TOO_MANY_ATTEMPTS" : "INVALID_OTP",
        );
      }

      const customer = DEV_CUSTOMERS[challenge.identifier];
      challenges.delete(challengeId);

      return {
        session: {
          // Development-only opaque tokens — meaningless outside the mock.
          accessToken: `dev-access-${customer.customerId}-${challengeSequence}`,
          refreshToken: `dev-refresh-${customer.customerId}-${challengeSequence}`,
          expiresAt: new Date(now() + DEV_SESSION_TTL_MS).toISOString(),
        },
        customer: { ...customer },
      };
    },

    async signOut(): Promise<void> {
      await simulateLatency();
      challenges.clear();
    },
  };
}
