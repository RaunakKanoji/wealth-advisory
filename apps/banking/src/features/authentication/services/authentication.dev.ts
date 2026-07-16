import {
  AuthenticationServiceError,
} from "@/src/features/authentication/models/authentication";
import type {
  AuthenticatedUser,
  RequestOtpInput,
  RequestOtpResult,
  ResendOtpInput,
  VerifyOtpInput,
  VerifyOtpResult,
} from "@/src/features/authentication/models/authentication";
import {
  DEV_EXPIRED_OTP,
  DEV_OTP_TTL_MS,
  DEV_RATE_LIMITED_IDENTIFIER,
  DEV_RESEND_COOLDOWN_MS,
  DEV_SERVICE_UNAVAILABLE_IDENTIFIER,
  DEV_VALID_OTP,
} from "@/src/features/authentication/services/authentication.fixtures";
import type { AuthenticationService } from "@/src/features/authentication/services/authentication.service";

type PendingRequest = {
  identifier: string;
  createdAt: number;
};

export type DevAuthenticationServiceOptions = {
  simulateNetworkError?: boolean;
};

// Explicit development adapter — deterministic, in-memory, no real OTP
// provider involved. See authentication.fixtures.ts for the documented
// identifiers/codes that trigger each scenario.
export function createDevAuthenticationService(
  options: DevAuthenticationServiceOptions = {},
): AuthenticationService {
  const pendingRequests = new Map<string, PendingRequest>();
  let requestSequence = 0;

  function createRequest(identifier: string): RequestOtpResult {
    if (options.simulateNetworkError) {
      throw new AuthenticationServiceError("network-error", "Simulated network failure.");
    }
    if (identifier === DEV_SERVICE_UNAVAILABLE_IDENTIFIER) {
      throw new AuthenticationServiceError(
        "service-unavailable",
        "Development fixture: service unavailable.",
      );
    }
    if (identifier === DEV_RATE_LIMITED_IDENTIFIER) {
      throw new AuthenticationServiceError("rate-limited", "Development fixture: rate limited.");
    }

    requestSequence += 1;
    const requestId = `dev-otp-${requestSequence}`;
    const now = Date.now();
    pendingRequests.set(requestId, { identifier, createdAt: now });

    return {
      requestId,
      identifier,
      channel: "sms",
      expiresAt: new Date(now + DEV_OTP_TTL_MS).toISOString(),
      resendAvailableAt: new Date(now + DEV_RESEND_COOLDOWN_MS).toISOString(),
    };
  }

  return {
    async requestOtp({ identifier }: RequestOtpInput): Promise<RequestOtpResult> {
      return createRequest(identifier);
    },

    async resendOtp({ requestId, identifier }: ResendOtpInput): Promise<RequestOtpResult> {
      // A resent code retires the previous one — otherwise a stale code
      // would stay valid indefinitely alongside the new one.
      pendingRequests.delete(requestId);
      return createRequest(identifier);
    },

    async verifyOtp({ requestId, identifier, code }: VerifyOtpInput): Promise<VerifyOtpResult> {
      const pending = pendingRequests.get(requestId);
      if (!pending || pending.identifier !== identifier) {
        throw new AuthenticationServiceError("invalid-otp", "This code is no longer valid.");
      }

      if (code === DEV_EXPIRED_OTP) {
        throw new AuthenticationServiceError("expired-otp", "Development fixture: expired code.");
      }

      const age = Date.now() - pending.createdAt;
      if (age > DEV_OTP_TTL_MS) {
        throw new AuthenticationServiceError("expired-otp", "This code has expired.");
      }

      if (code !== DEV_VALID_OTP) {
        throw new AuthenticationServiceError("invalid-otp", "That code didn't match.");
      }

      pendingRequests.delete(requestId);

      const user: AuthenticatedUser = {
        id: `dev-user-${identifier}`,
        identifier,
      };

      return { user };
    },
  };
}
