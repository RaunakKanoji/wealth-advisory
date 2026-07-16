import { act, renderHook } from "@testing-library/react-native";
import { useRouter } from "expo-router";
import type { PropsWithChildren } from "react";

import {
  DEV_OTP_TTL_MS,
  DEV_RESEND_COOLDOWN_MS,
} from "@/src/features/authentication/fixtures/authentication.fixtures";
import { useRequestOtp } from "@/src/features/authentication/hooks/useRequestOtp";
import { useResendOtp } from "@/src/features/authentication/hooks/useResendOtp";
import type { RequestOtpResult } from "@/src/features/authentication/models/authentication";
import { AuthenticationServiceProvider } from "@/src/features/authentication/services/authentication.context";
import { createMockAuthenticationService } from "@/src/features/authentication/services/authentication.mock";
import type { AuthenticationService } from "@/src/features/authentication/services/authentication.service";
import {
  AuthenticationFlowProvider,
  useAuthenticationFlow,
} from "@/src/features/authentication/state/AuthenticationFlowProvider";
import { SessionProvider } from "@/src/features/session";
import type { SessionStorage, StoredSession } from "@/src/storage/session-storage";

jest.mock("expo-router", () => ({
  useRouter: jest.fn(),
}));

function createMemorySessionStorage(): SessionStorage {
  let stored: StoredSession | null = null;
  return {
    async getSession() {
      return stored;
    },
    async setSession(next: StoredSession) {
      stored = next;
    },
    async clearSession() {
      stored = null;
    },
  };
}

function createWrapper(service: AuthenticationService) {
  const storage = createMemorySessionStorage();
  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <AuthenticationServiceProvider service={service}>
        <SessionProvider storage={storage} devShellOverride={null} externallyManaged={false}>
          <AuthenticationFlowProvider>{children}</AuthenticationFlowProvider>
        </SessionProvider>
      </AuthenticationServiceProvider>
    );
  };
}

let push: jest.Mock;

beforeEach(() => {
  push = jest.fn();
  (useRouter as jest.Mock).mockReturnValue({
    push,
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => false),
  });
});

describe("useRequestOtp", () => {
  it("stores the challenge in the flow provider and routes to verify-otp without params", async () => {
    const service = createMockAuthenticationService({ latencyMs: 0 });
    const { result } = await renderHook(
      () => ({ request: useRequestOtp(), flow: useAuthenticationFlow() }),
      { wrapper: createWrapper(service) },
    );

    await act(async () => {
      result.current.request.setIdentifier("9876543210");
    });
    await act(async () => {
      await result.current.request.requestOtp();
    });

    expect(result.current.flow.challenge).toMatchObject({
      challengeId: expect.any(String),
      maskedDestination: "+91 ••••• ••210",
      expiresAt: expect.any(String),
      resendAvailableAt: expect.any(String),
    });
    expect(result.current.request.submitError).toBeNull();
    expect(result.current.request.fieldError).toBeNull();
    // The destination is a bare pathname — the identifier never enters params.
    expect(push).toHaveBeenCalledTimes(1);
    expect(push.mock.calls[0]).toEqual(["/(auth)/verify-otp"]);
  });

  it("sets a field error and never calls the service for an invalid number", async () => {
    const service = createMockAuthenticationService({ latencyMs: 0 });
    const requestSpy = jest.spyOn(service, "requestOtp");
    const { result } = await renderHook(
      () => ({ request: useRequestOtp(), flow: useAuthenticationFlow() }),
      { wrapper: createWrapper(service) },
    );

    await act(async () => {
      result.current.request.setIdentifier("12345");
    });
    await act(async () => {
      await result.current.request.requestOtp();
    });

    expect(result.current.request.fieldError).toBe("Enter a valid 10-digit mobile number.");
    expect(result.current.flow.challenge).toBeNull();
    expect(requestSpy).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("surfaces INVALID_IDENTIFIER as a submit error and preserves the entered identifier", async () => {
    const service = createMockAuthenticationService({ latencyMs: 0 });
    const { result } = await renderHook(
      () => ({ request: useRequestOtp(), flow: useAuthenticationFlow() }),
      { wrapper: createWrapper(service) },
    );

    // Valid format but not a registered development customer.
    await act(async () => {
      result.current.request.setIdentifier("9999999999");
    });
    await act(async () => {
      await result.current.request.requestOtp();
    });

    expect(result.current.request.submitError?.code).toBe("INVALID_IDENTIFIER");
    expect(result.current.request.identifier).toBe("9999999999");
    expect(result.current.flow.challenge).toBeNull();
    expect(push).not.toHaveBeenCalled();
  });
});

describe("AuthenticationFlowProvider — change-number semantics", () => {
  function buildChallengeResult(): RequestOtpResult {
    const now = Date.now();
    return {
      challengeId: "provider-test-challenge",
      maskedDestination: "+91 ••••• ••210",
      expiresAt: new Date(now + DEV_OTP_TTL_MS).toISOString(),
      resendAvailableAt: new Date(now + DEV_RESEND_COOLDOWN_MS).toISOString(),
    };
  }

  it("clearChallenge drops the challenge but keeps the entered identifier for prefill", async () => {
    const { result } = await renderHook(() => useAuthenticationFlow(), {
      wrapper: ({ children }: PropsWithChildren) => (
        <AuthenticationFlowProvider>{children}</AuthenticationFlowProvider>
      ),
    });

    await act(async () => {
      result.current.setEnteredIdentifier("9876543210");
      result.current.setChallenge(buildChallengeResult());
    });
    expect(result.current.challenge).not.toBeNull();

    await act(async () => {
      result.current.clearChallenge();
    });

    expect(result.current.challenge).toBeNull();
    expect(result.current.enteredIdentifier).toBe("9876543210");
  });

  it("clearFlow resets both the challenge and the entered identifier", async () => {
    const { result } = await renderHook(() => useAuthenticationFlow(), {
      wrapper: ({ children }: PropsWithChildren) => (
        <AuthenticationFlowProvider>{children}</AuthenticationFlowProvider>
      ),
    });

    await act(async () => {
      result.current.setEnteredIdentifier("9876543210");
      result.current.setChallenge(buildChallengeResult());
    });
    await act(async () => {
      result.current.clearFlow();
    });

    expect(result.current.challenge).toBeNull();
    expect(result.current.enteredIdentifier).toBe("");
  });
});

describe("useResendOtp", () => {
  it("replaces the active challenge with fresh timing and notifies the caller", async () => {
    let currentNow = Date.now();
    const service = createMockAuthenticationService({ latencyMs: 0, now: () => currentNow });
    const onResent = jest.fn();
    const { result } = await renderHook(
      () => ({ flow: useAuthenticationFlow(), resend: useResendOtp({ onResent }) }),
      { wrapper: createWrapper(service) },
    );

    const initial = await service.requestOtp({
      identifierType: "mobile-number",
      identifier: "9876543210",
    });
    await act(async () => {
      result.current.flow.setChallenge(initial);
    });

    // Move the injected clock past the resend cooldown.
    currentNow += DEV_RESEND_COOLDOWN_MS + 1;
    await act(async () => {
      await result.current.resend.resend();
    });

    expect(onResent).toHaveBeenCalledTimes(1);
    expect(result.current.resend.resendError).toBeNull();
    const next = result.current.flow.challenge;
    expect(next).not.toBeNull();
    expect(next?.challengeId).not.toBe(initial.challengeId);
    expect(next?.resendAvailableAt).toBe(
      new Date(currentNow + DEV_RESEND_COOLDOWN_MS).toISOString(),
    );
    expect(next?.expiresAt).toBe(new Date(currentNow + DEV_OTP_TTL_MS).toISOString());
  });

  it("keeps the existing challenge when resend is not yet available", async () => {
    const service = createMockAuthenticationService({ latencyMs: 0 });
    const onResent = jest.fn();
    const { result } = await renderHook(
      () => ({ flow: useAuthenticationFlow(), resend: useResendOtp({ onResent }) }),
      { wrapper: createWrapper(service) },
    );

    const initial = await service.requestOtp({
      identifierType: "mobile-number",
      identifier: "9876543210",
    });
    await act(async () => {
      result.current.flow.setChallenge(initial);
    });

    // Cooldown has not elapsed — the service must refuse and state must hold.
    await act(async () => {
      await result.current.resend.resend();
    });

    expect(result.current.resend.resendError?.code).toBe("RESEND_NOT_AVAILABLE");
    expect(result.current.flow.challenge?.challengeId).toBe(initial.challengeId);
    expect(onResent).not.toHaveBeenCalled();
  });
});
