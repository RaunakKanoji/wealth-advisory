import {
  DEV_EXPIRED_OTP,
  DEV_MAX_VERIFY_ATTEMPTS,
  DEV_OTP_TTL_MS,
  DEV_RESEND_COOLDOWN_MS,
  DEV_SERVICE_UNAVAILABLE_IDENTIFIER,
  DEV_SESSION_TTL_MS,
  DEV_VALID_OTP,
} from "@/src/features/authentication/fixtures/authentication.fixtures";
import type { CustomerOnboardingStatus } from "@/src/features/authentication/models/authentication";
import type { AuthenticationErrorCode } from "@/src/features/authentication/models/authentication-errors";
import { AuthenticationServiceError } from "@/src/features/authentication/models/authentication-errors";
import { createMockAuthenticationService } from "@/src/features/authentication/services/authentication.mock";
import type { AuthenticationService } from "@/src/features/authentication/services/authentication.service";

const CONSENT_REQUIRED_NUMBER = "9876543210";
const PROFILE_REQUIRED_NUMBER = "9876543211";
const COMPLETE_NUMBER = "9876543212";
const WRONG_OTP = "999999";

const CLOCK_START = Date.UTC(2026, 0, 1, 12, 0, 0);

type Clock = {
  now: () => number;
  advance: (ms: number) => void;
};

function createClock(start: number = CLOCK_START): Clock {
  let current = start;
  return {
    now: () => current,
    advance: (ms: number) => {
      current += ms;
    },
  };
}

function createService(clock?: Clock): AuthenticationService {
  return createMockAuthenticationService({ latencyMs: 0, now: clock?.now });
}

async function requestChallenge(service: AuthenticationService, identifier: string) {
  return service.requestOtp({ identifierType: "mobile-number", identifier });
}

/** Awaits the operation, asserting it rejects with the given normalized code. */
async function expectAuthenticationError(
  operation: Promise<unknown>,
  code: AuthenticationErrorCode,
): Promise<AuthenticationServiceError> {
  let caught: unknown;
  let resolved = false;
  try {
    await operation;
    resolved = true;
  } catch (error) {
    caught = error;
  }
  if (resolved) {
    throw new Error(`Expected rejection with ${code}, but the operation resolved.`);
  }
  if (!(caught instanceof AuthenticationServiceError)) {
    throw new Error(`Expected AuthenticationServiceError(${code}), got a different error.`);
  }
  expect(caught.code).toBe(code);
  return caught;
}

describe("createMockAuthenticationService", () => {
  describe("requestOtp", () => {
    it("issues a challenge with masked destination and future expiry timestamps", async () => {
      const clock = createClock();
      const service = createService(clock);

      const result = await requestChallenge(service, CONSENT_REQUIRED_NUMBER);

      expect(result.challengeId).toEqual(expect.any(String));
      expect(result.challengeId.length).toBeGreaterThan(0);
      expect(result.maskedDestination).toBe("+91 ••••• ••210");
      expect(result.expiresAt).toBe(new Date(CLOCK_START + DEV_OTP_TTL_MS).toISOString());
      expect(result.resendAvailableAt).toBe(
        new Date(CLOCK_START + DEV_RESEND_COOLDOWN_MS).toISOString(),
      );
      expect(Date.parse(result.expiresAt)).toBeGreaterThan(clock.now());
      expect(Date.parse(result.resendAvailableAt)).toBeGreaterThan(clock.now());
    });

    it("rejects an unregistered mobile number with non-retryable INVALID_IDENTIFIER", async () => {
      const service = createService();

      const error = await expectAuthenticationError(
        requestChallenge(service, "9999999999"),
        "INVALID_IDENTIFIER",
      );

      expect(error.retryable).toBe(false);
    });

    it("reports retryable SERVICE_UNAVAILABLE for the outage fixture number", async () => {
      const service = createService();

      const error = await expectAuthenticationError(
        requestChallenge(service, DEV_SERVICE_UNAVAILABLE_IDENTIFIER),
        "SERVICE_UNAVAILABLE",
      );

      expect(error.retryable).toBe(true);
    });
  });

  describe("verifyOtp", () => {
    it("returns a session with opaque tokens and an ISO expiry a session-TTL ahead", async () => {
      const clock = createClock();
      const service = createService(clock);
      const { challengeId } = await requestChallenge(service, CONSENT_REQUIRED_NUMBER);

      const { session } = await service.verifyOtp({ challengeId, otp: DEV_VALID_OTP });

      expect(typeof session.accessToken).toBe("string");
      expect(session.accessToken.length).toBeGreaterThan(0);
      expect(typeof session.refreshToken).toBe("string");
      expect(session.refreshToken?.length).toBeGreaterThan(0);
      expect(session.accessToken).not.toBe(session.refreshToken);
      expect(session.expiresAt).toBe(new Date(clock.now() + DEV_SESSION_TTL_MS).toISOString());
    });

    it.each<[string, string, CustomerOnboardingStatus]>([
      [CONSENT_REQUIRED_NUMBER, "dev-cust-0210", "consent-required"],
      [PROFILE_REQUIRED_NUMBER, "dev-cust-0211", "profile-required"],
      [COMPLETE_NUMBER, "dev-cust-0212", "complete"],
    ])(
      "returns fixture customer %s / %s with the correct onboardingStatus (%s)",
      async (identifier, customerId, onboardingStatus) => {
        const service = createService();
        const { challengeId } = await requestChallenge(service, identifier);

        const { customer } = await service.verifyOtp({ challengeId, otp: DEV_VALID_OTP });

        expect(customer.customerId).toBe(customerId);
        expect(customer.onboardingStatus).toBe(onboardingStatus);
      },
    );

    it("consumes the challenge on success so it cannot be verified twice", async () => {
      const service = createService();
      const { challengeId } = await requestChallenge(service, COMPLETE_NUMBER);
      await service.verifyOtp({ challengeId, otp: DEV_VALID_OTP });

      await expectAuthenticationError(
        service.verifyOtp({ challengeId, otp: DEV_VALID_OTP }),
        "MISSING_CHALLENGE",
      );
    });

    it("rejects a wrong code with retryable INVALID_OTP and keeps the challenge usable", async () => {
      const service = createService();
      const { challengeId } = await requestChallenge(service, CONSENT_REQUIRED_NUMBER);

      const error = await expectAuthenticationError(
        service.verifyOtp({ challengeId, otp: WRONG_OTP }),
        "INVALID_OTP",
      );
      expect(error.retryable).toBe(true);

      const { customer } = await service.verifyOtp({ challengeId, otp: DEV_VALID_OTP });
      expect(customer.customerId).toBe("dev-cust-0210");
    });

    it("reports OTP_EXPIRED for the always-expired fixture code", async () => {
      const service = createService();
      const { challengeId } = await requestChallenge(service, CONSENT_REQUIRED_NUMBER);

      const error = await expectAuthenticationError(
        service.verifyOtp({ challengeId, otp: DEV_EXPIRED_OTP }),
        "OTP_EXPIRED",
      );

      expect(error.retryable).toBe(false);
    });

    it("rejects an unknown challengeId with MISSING_CHALLENGE", async () => {
      const service = createService();

      await expectAuthenticationError(
        service.verifyOtp({ challengeId: "mock-challenge-never-issued", otp: DEV_VALID_OTP }),
        "MISSING_CHALLENGE",
      );
    });

    it("still accepts the valid code at exactly the OTP TTL boundary", async () => {
      const clock = createClock();
      const service = createService(clock);
      const { challengeId } = await requestChallenge(service, COMPLETE_NUMBER);

      clock.advance(DEV_OTP_TTL_MS);

      const { customer } = await service.verifyOtp({ challengeId, otp: DEV_VALID_OTP });
      expect(customer.onboardingStatus).toBe("complete");
    });

    it("expires the challenge once the OTP TTL has elapsed", async () => {
      const clock = createClock();
      const service = createService(clock);
      const { challengeId } = await requestChallenge(service, COMPLETE_NUMBER);

      clock.advance(DEV_OTP_TTL_MS + 1);

      await expectAuthenticationError(
        service.verifyOtp({ challengeId, otp: DEV_VALID_OTP }),
        "OTP_EXPIRED",
      );
    });

    it("reports non-retryable TOO_MANY_ATTEMPTS on the fifth consecutive wrong code", async () => {
      const service = createService();
      const { challengeId } = await requestChallenge(service, CONSENT_REQUIRED_NUMBER);

      for (let attempt = 1; attempt < DEV_MAX_VERIFY_ATTEMPTS; attempt += 1) {
        await expectAuthenticationError(
          service.verifyOtp({ challengeId, otp: WRONG_OTP }),
          "INVALID_OTP",
        );
      }

      const error = await expectAuthenticationError(
        service.verifyOtp({ challengeId, otp: WRONG_OTP }),
        "TOO_MANY_ATTEMPTS",
      );
      expect(error.retryable).toBe(false);
    });

    it("locks a maxed-out challenge even for the valid code, then retires it", async () => {
      const service = createService();
      const { challengeId } = await requestChallenge(service, CONSENT_REQUIRED_NUMBER);

      for (let attempt = 1; attempt <= DEV_MAX_VERIFY_ATTEMPTS; attempt += 1) {
        await expectAuthenticationError(
          service.verifyOtp({ challengeId, otp: WRONG_OTP }),
          attempt < DEV_MAX_VERIFY_ATTEMPTS ? "INVALID_OTP" : "TOO_MANY_ATTEMPTS",
        );
      }

      // The next verify hits the attempts guard (TOO_MANY_ATTEMPTS) and deletes
      // the challenge; after that the challenge no longer exists.
      await expectAuthenticationError(
        service.verifyOtp({ challengeId, otp: DEV_VALID_OTP }),
        "TOO_MANY_ATTEMPTS",
      );
      await expectAuthenticationError(
        service.verifyOtp({ challengeId, otp: DEV_VALID_OTP }),
        "MISSING_CHALLENGE",
      );
    });
  });

  describe("resendOtp", () => {
    it("rejects a resend during the cooldown with retryable RESEND_NOT_AVAILABLE", async () => {
      const clock = createClock();
      const service = createService(clock);
      const { challengeId } = await requestChallenge(service, CONSENT_REQUIRED_NUMBER);

      clock.advance(DEV_RESEND_COOLDOWN_MS - 1);

      const error = await expectAuthenticationError(
        service.resendOtp(challengeId),
        "RESEND_NOT_AVAILABLE",
      );
      expect(error.retryable).toBe(true);
    });

    it("issues a fresh challenge with a new id once the cooldown has elapsed", async () => {
      const clock = createClock();
      const service = createService(clock);
      const original = await requestChallenge(service, CONSENT_REQUIRED_NUMBER);

      clock.advance(DEV_RESEND_COOLDOWN_MS);

      const resent = await service.resendOtp(original.challengeId);

      expect(resent.challengeId).not.toBe(original.challengeId);
      expect(resent.maskedDestination).toBe("+91 ••••• ••210");
      expect(resent.expiresAt).toBe(new Date(clock.now() + DEV_OTP_TTL_MS).toISOString());
      expect(resent.resendAvailableAt).toBe(
        new Date(clock.now() + DEV_RESEND_COOLDOWN_MS).toISOString(),
      );

      const { customer } = await service.verifyOtp({
        challengeId: resent.challengeId,
        otp: DEV_VALID_OTP,
      });
      expect(customer.customerId).toBe("dev-cust-0210");
    });

    it("retires the old challenge on resend — even the valid code reports MISSING_CHALLENGE", async () => {
      const clock = createClock();
      const service = createService(clock);
      const original = await requestChallenge(service, CONSENT_REQUIRED_NUMBER);

      clock.advance(DEV_RESEND_COOLDOWN_MS);
      await service.resendOtp(original.challengeId);

      await expectAuthenticationError(
        service.verifyOtp({ challengeId: original.challengeId, otp: DEV_VALID_OTP }),
        "MISSING_CHALLENGE",
      );
    });

    it("rejects a resend for an unknown challengeId with MISSING_CHALLENGE", async () => {
      const service = createService();

      await expectAuthenticationError(
        service.resendOtp("mock-challenge-never-issued"),
        "MISSING_CHALLENGE",
      );
    });
  });

  describe("signOut", () => {
    it("clears pending challenges so verification reports MISSING_CHALLENGE", async () => {
      const service = createService();
      const { challengeId } = await requestChallenge(service, COMPLETE_NUMBER);

      await service.signOut();

      await expectAuthenticationError(
        service.verifyOtp({ challengeId, otp: DEV_VALID_OTP }),
        "MISSING_CHALLENGE",
      );
    });
  });
});
