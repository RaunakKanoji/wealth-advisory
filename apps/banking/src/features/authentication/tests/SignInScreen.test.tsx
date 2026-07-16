import { act, fireEvent, waitFor } from "@testing-library/react-native";
import { useRouter } from "expo-router";
import { Pressable, Text as RNText } from "react-native";

import type {
  RequestOtpResult,
  VerifyOtpResult,
} from "@/src/features/authentication/models/authentication";
import { AuthenticationServiceError } from "@/src/features/authentication/models/authentication-errors";
import { SignInScreen } from "@/src/features/authentication/screens/SignInScreen";
import { AuthenticationServiceProvider } from "@/src/features/authentication/services/authentication.context";
import { createMockAuthenticationService } from "@/src/features/authentication/services/authentication.mock";
import type { AuthenticationService } from "@/src/features/authentication/services/authentication.service";
import { AuthenticationFlowProvider } from "@/src/features/authentication/state/AuthenticationFlowProvider";
import { SessionProvider, useSession } from "@/src/features/session";
import type { SessionStorage, StoredSession } from "@/src/storage/session-storage";
import { render } from "@/src/testing/render";

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

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function buildChallengeResult(): RequestOtpResult {
  const now = Date.now();
  return {
    challengeId: "stub-challenge-1",
    maskedDestination: "+91 ••••• ••210",
    expiresAt: new Date(now + 5 * 60_000).toISOString(),
    resendAvailableAt: new Date(now + 30_000).toISOString(),
  };
}

function createStubAuthenticationService(
  overrides: Partial<AuthenticationService> = {},
): AuthenticationService {
  return {
    requestOtp: jest.fn(async (): Promise<RequestOtpResult> => {
      throw new AuthenticationServiceError("SERVICE_UNAVAILABLE");
    }),
    verifyOtp: jest.fn(async (): Promise<VerifyOtpResult> => {
      throw new AuthenticationServiceError("SERVICE_UNAVAILABLE");
    }),
    resendOtp: jest.fn(async (): Promise<RequestOtpResult> => {
      throw new AuthenticationServiceError("SERVICE_UNAVAILABLE");
    }),
    signOut: jest.fn(async () => undefined),
    ...overrides,
  };
}

/** Tiny harness control that expires the live session on press — the only
 *  supported way to reach the expired state from outside the provider. */
function ExpireSessionProbe() {
  const { expireSession } = useSession();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Expire session probe"
      onPress={expireSession}
    >
      <RNText>Expire session probe</RNText>
    </Pressable>
  );
}

async function renderSignIn(service: AuthenticationService, withExpireProbe = false) {
  return render(
    <AuthenticationServiceProvider service={service}>
      <SessionProvider
        storage={createMemorySessionStorage()}
        devShellOverride={null}
        externallyManaged={false}
      >
        <AuthenticationFlowProvider>
          <SignInScreen />
          {withExpireProbe ? <ExpireSessionProbe /> : null}
        </AuthenticationFlowProvider>
      </SessionProvider>
    </AuthenticationServiceProvider>,
  );
}

let push: jest.Mock;
let replace: jest.Mock;

beforeEach(() => {
  push = jest.fn();
  replace = jest.fn();
  (useRouter as jest.Mock).mockReturnValue({
    push,
    replace,
    back: jest.fn(),
    canGoBack: jest.fn(() => false),
  });
});

describe("SignInScreen", () => {
  it("shows a validation error and never calls the service for a short number", async () => {
    const service = createMockAuthenticationService({ latencyMs: 0 });
    const requestSpy = jest.spyOn(service, "requestOtp");
    const { getByLabelText, getByRole, findByText } = await renderSignIn(service);

    await fireEvent.changeText(getByLabelText("Registered mobile number"), "98765");
    await fireEvent.press(getByRole("button", { name: "Continue" }));

    expect(await findByText("Enter a valid 10-digit mobile number.")).toBeOnTheScreen();
    expect(requestSpy).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("marks Continue busy while requesting and then routes to verify-otp", async () => {
    const deferred = createDeferred<RequestOtpResult>();
    const requestOtp = jest.fn(() => deferred.promise);
    const service = createStubAuthenticationService({ requestOtp });
    const { getByLabelText, getByRole } = await renderSignIn(service);

    await fireEvent.changeText(getByLabelText("Registered mobile number"), "9876543210");

    // Hold the press promise: awaiting it here would wait on the (still
    // pending) service call, hiding the in-flight state we want to assert.
    const pressPromise = fireEvent.press(getByRole("button", { name: "Continue" }));

    await waitFor(() => expect(getByRole("button", { name: "Continue" })).toBeBusy());
    expect(getByRole("button", { name: "Continue" })).toBeDisabled();

    await act(async () => {
      deferred.resolve(buildChallengeResult());
      await pressPromise;
    });

    expect(push).toHaveBeenCalledWith("/(auth)/verify-otp");
    expect(getByRole("button", { name: "Continue" })).not.toBeBusy();
  });

  it("renders the customer-safe notice when the identifier is not registered", async () => {
    const service = createMockAuthenticationService({ latencyMs: 0 });
    const { getByLabelText, getByRole, findByText } = await renderSignIn(service);

    // Valid format, but not a registered development customer.
    await fireEvent.changeText(getByLabelText("Registered mobile number"), "9999999999");
    await fireEvent.press(getByRole("button", { name: "Continue" }));

    expect(
      await findByText(
        "We couldn't find an account with this mobile number. Check the number registered with IDBI Bank.",
      ),
    ).toBeOnTheScreen();
    expect(push).not.toHaveBeenCalled();
  });

  it("shows the expired-session notice once the session expires", async () => {
    const service = createMockAuthenticationService({ latencyMs: 0 });
    const { getByRole, findByText, queryByText } = await renderSignIn(service, true);

    expect(queryByText(/session has expired/)).toBeNull();

    await fireEvent.press(getByRole("button", { name: "Expire session probe" }));

    expect(
      await findByText(
        "Your session has expired to protect your account. Please sign in again.",
      ),
    ).toBeOnTheScreen();
  });

  it("calls the service only once when Continue is pressed twice while pending", async () => {
    const deferred = createDeferred<RequestOtpResult>();
    const requestOtp = jest.fn(() => deferred.promise);
    const service = createStubAuthenticationService({ requestOtp });
    const { getByLabelText, getByRole } = await renderSignIn(service);

    await fireEvent.changeText(getByLabelText("Registered mobile number"), "9876543210");

    // First press starts the (still pending) request; hold its promise.
    const firstPress = fireEvent.press(getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(getByRole("button", { name: "Continue" })).toBeBusy());

    // Second press lands on the disabled, in-flight button.
    await fireEvent.press(getByRole("button", { name: "Continue" }));

    await act(async () => {
      deferred.resolve(buildChallengeResult());
      await firstPress;
    });

    expect(requestOtp).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledTimes(1);
  });
});
