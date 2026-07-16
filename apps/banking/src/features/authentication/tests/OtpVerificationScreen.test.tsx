import { fireEvent, waitFor } from "@testing-library/react-native";
import type { RenderResult } from "@testing-library/react-native";
import { Redirect, useRouter } from "expo-router";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { Text as RNText } from "react-native";

import {
  DEV_EXPIRED_OTP,
  DEV_OTP_TTL_MS,
  DEV_VALID_OTP,
} from "@/src/features/authentication/fixtures/authentication.fixtures";
import type { RequestOtpResult } from "@/src/features/authentication/models/authentication";
import { OtpVerificationScreen } from "@/src/features/authentication/screens/OtpVerificationScreen";
import { AuthenticationServiceProvider } from "@/src/features/authentication/services/authentication.context";
import { createMockAuthenticationService } from "@/src/features/authentication/services/authentication.mock";
import type { AuthenticationService } from "@/src/features/authentication/services/authentication.service";
import {
  AuthenticationFlowProvider,
  useAuthenticationFlow,
} from "@/src/features/authentication/state/AuthenticationFlowProvider";
import { clearIntendedDestination, SessionProvider, useSession } from "@/src/features/session";
import type { SessionStorage, StoredSession } from "@/src/storage/session-storage";
import { render } from "@/src/testing/render";

jest.mock("expo-router", () => ({
  useRouter: jest.fn(),
  Redirect: jest.fn(() => null),
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

/** Seeds the flow provider with a service-issued challenge, then mounts the
 *  screen — mirroring arrival from the sign-in step. */
function ChallengeBootstrap({
  challenge,
  children,
}: {
  challenge: RequestOtpResult;
  children: ReactNode;
}) {
  const { challenge: activeChallenge, setChallenge } = useAuthenticationFlow();
  useEffect(() => {
    setChallenge(challenge);
  }, [challenge, setChallenge]);
  return activeChallenge ? <>{children}</> : null;
}

function SessionStatusProbe() {
  const { status } = useSession();
  return <RNText testID="session-status">{status}</RNText>;
}

function ChallengeProbe() {
  const { challenge } = useAuthenticationFlow();
  return (
    <RNText testID="challenge-state">{challenge ? "challenge-active" : "challenge-cleared"}</RNText>
  );
}

type HarnessOptions = {
  service?: AuthenticationService;
  identifier?: string;
};

async function renderVerification({ service, identifier = "9876543210" }: HarnessOptions = {}) {
  const activeService = service ?? createMockAuthenticationService({ latencyMs: 0 });
  const challenge = await activeService.requestOtp({
    identifierType: "mobile-number",
    identifier,
  });
  const view = await render(
    <AuthenticationServiceProvider service={activeService}>
      <SessionProvider
        storage={createMemorySessionStorage()}
        devShellOverride={null}
        externallyManaged={false}
      >
        <AuthenticationFlowProvider>
          <ChallengeBootstrap challenge={challenge}>
            <OtpVerificationScreen />
          </ChallengeBootstrap>
          <SessionStatusProbe />
          <ChallengeProbe />
        </AuthenticationFlowProvider>
      </SessionProvider>
    </AuthenticationServiceProvider>,
  );
  return { ...view, service: activeService, challenge };
}

/** Enters the full code through the first OTP box — the paste path spreads it
 *  across all boxes. */
async function enterOtp(view: Pick<RenderResult, "getAllByLabelText">, code: string) {
  const boxes = view.getAllByLabelText(/Verification code digit/);
  await fireEvent.changeText(boxes[0], code);
}

const redirectMock = Redirect as unknown as jest.Mock;

let push: jest.Mock;
let replace: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  clearIntendedDestination();
  push = jest.fn();
  replace = jest.fn();
  (useRouter as jest.Mock).mockReturnValue({
    push,
    replace,
    back: jest.fn(),
    canGoBack: jest.fn(() => false),
  });
});

describe("OtpVerificationScreen", () => {
  it("redirects to sign-in when opened without an active challenge", async () => {
    const service = createMockAuthenticationService({ latencyMs: 0 });
    await render(
      <AuthenticationServiceProvider service={service}>
        <SessionProvider
          storage={createMemorySessionStorage()}
          devShellOverride={null}
          externallyManaged={false}
        >
          <AuthenticationFlowProvider>
            <OtpVerificationScreen />
          </AuthenticationFlowProvider>
        </SessionProvider>
      </AuthenticationServiceProvider>,
    );

    expect(redirectMock).toHaveBeenCalled();
    expect(redirectMock.mock.calls[0][0]).toMatchObject({ href: "/(auth)/sign-in" });
  });

  it("shows only the masked destination — the full number never appears in the tree", async () => {
    const view = await renderVerification();

    expect(view.getByText(/\+91 ••••• ••210/)).toBeOnTheScreen();
    expect(view.queryByText(/9876543210/)).toBeNull();
    expect(JSON.stringify(view.toJSON())).not.toContain("9876543210");
  });

  it("spreads a pasted code across the boxes and shows the invalid-code notice on a wrong OTP", async () => {
    const view = await renderVerification();

    await enterOtp(view, "654321");
    const boxes = view.getAllByLabelText(/Verification code digit/);
    expect(boxes).toHaveLength(6);
    boxes.forEach((box, index) => {
      expect(box.props.value).toBe("654321"[index]);
    });

    await fireEvent.press(view.getByRole("button", { name: "Verify" }));

    expect(
      await view.findByText("That code didn't match. Check the code and try again."),
    ).toBeOnTheScreen();
    // Inputs stay editable so the customer can correct and retry.
    for (const box of view.getAllByLabelText(/Verification code digit/)) {
      expect(box.props.editable).toBe(true);
    }
  });

  it("shows the expired-code notice when the service reports OTP_EXPIRED", async () => {
    const view = await renderVerification();

    await enterOtp(view, DEV_EXPIRED_OTP);
    await fireEvent.press(view.getByRole("button", { name: "Verify" }));

    expect(
      await view.findByText("This code has expired. Request a new code to continue."),
    ).toBeOnTheScreen();
    // Reality: a service-reported OTP_EXPIRED does NOT disable Verify — only
    // client-clock expiry (isExpired) or exhausted attempts do.
    expect(view.getByRole("button", { name: "Verify" })).not.toBeDisabled();
  });

  it("disables Verify and shows the expired notice once the challenge TTL has passed", async () => {
    // Issue the challenge from a clock far enough in the past that it is
    // already expired by the screen's real-time countdown.
    const service = createMockAuthenticationService({
      latencyMs: 0,
      now: () => Date.now() - DEV_OTP_TTL_MS - 60_000,
    });
    const view = await renderVerification({ service });

    expect(
      view.getByText("This code has expired. Request a new code to continue."),
    ).toBeOnTheScreen();
    expect(view.getByRole("button", { name: "Verify" })).toBeDisabled();
  });

  it("establishes the session and routes to onboarding for an onboarding-required customer", async () => {
    const view = await renderVerification({ identifier: "9876543210" });

    await enterOtp(view, DEV_VALID_OTP);
    await fireEvent.press(view.getByRole("button", { name: "Verify" }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/(onboarding)"));
    expect(view.getByTestId("session-status")).toHaveTextContent("onboarding-required");
  });

  it("routes a fully onboarded customer straight to the app shell", async () => {
    const view = await renderVerification({ identifier: "9876543212" });

    await enterOtp(view, DEV_VALID_OTP);
    await fireEvent.press(view.getByRole("button", { name: "Verify" }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/(app)/(tabs)"));
    expect(view.getByTestId("session-status")).toHaveTextContent("authenticated");
  });

  it("shows the resend countdown and keeps resend disabled while in cooldown", async () => {
    const view = await renderVerification();

    const resendButton = view.getByRole("button", { name: /Resend code in \d+s/ });
    expect(resendButton).toBeOnTheScreen();
    expect(resendButton).toBeDisabled();
  });

  it("returns to sign-in and clears the challenge when changing the number", async () => {
    const view = await renderVerification();

    await fireEvent.press(view.getByRole("button", { name: "Change mobile number" }));

    expect(replace).toHaveBeenCalledWith("/(auth)/sign-in");
    expect(push).not.toHaveBeenCalled();
    expect(view.getByTestId("challenge-state")).toHaveTextContent("challenge-cleared");
  });
});
