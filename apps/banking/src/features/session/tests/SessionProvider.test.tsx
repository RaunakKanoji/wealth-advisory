import { act, screen, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";

import type { DevSessionShell } from "@/src/config/devSession";
import {
  DEV_CUSTOMERS,
  DEV_SESSION_TTL_MS,
} from "@/src/features/authentication/fixtures/authentication.fixtures";
import type {
  AuthenticatedCustomer,
  VerifyOtpResult,
} from "@/src/features/authentication/models/authentication";
import { SessionProvider, useSession } from "@/src/features/session";
import type { SessionStatus } from "@/src/features/session";
import type { SessionContextValue } from "@/src/features/session/providers/SessionProvider";
import type { SessionStorage, StoredSession } from "@/src/storage/session-storage";
import { render } from "@/src/testing/render";

// ---------------------------------------------------------------------------
// Harness: a probe component exposes status/customer via testIDs, and the
// latest context value is captured so tests can drive the session actions.

let latestContext: SessionContextValue | undefined;

function SessionProbe() {
  latestContext = useSession();
  return (
    <>
      <Text testID="session-status">{latestContext.status}</Text>
      <Text testID="session-customer">{latestContext.customer?.customerId ?? "none"}</Text>
    </>
  );
}

function sessionApi(): SessionContextValue {
  if (!latestContext) {
    throw new Error("SessionProbe has not rendered yet");
  }
  return latestContext;
}

function currentStatus(): string {
  return screen.getByTestId("session-status").props.children as string;
}

function currentCustomerId(): string {
  return screen.getByTestId("session-customer").props.children as string;
}

async function waitForStatus(status: SessionStatus): Promise<void> {
  await waitFor(() => expect(currentStatus()).toBe(status));
}

type MemorySessionStorage = {
  storage: SessionStorage;
  getSession: jest.Mock<Promise<StoredSession | null>, []>;
  setSession: jest.Mock<Promise<void>, [StoredSession]>;
  clearSession: jest.Mock<Promise<void>, []>;
  readStored(): StoredSession | null;
};

function createMemorySessionStorage(initial: StoredSession | null = null): MemorySessionStorage {
  let stored: StoredSession | null = initial;
  const getSession = jest.fn<Promise<StoredSession | null>, []>(async () => stored);
  const setSession = jest.fn<Promise<void>, [StoredSession]>(async (next) => {
    stored = next;
  });
  const clearSession = jest.fn<Promise<void>, []>(async () => {
    stored = null;
  });
  return {
    storage: { getSession, setSession, clearSession },
    getSession,
    setSession,
    clearSession,
    readStored: () => stored,
  };
}

const COMPLETE_CUSTOMER: AuthenticatedCustomer = { ...DEV_CUSTOMERS["9876543212"] };
const CONSENT_REQUIRED_CUSTOMER: AuthenticatedCustomer = { ...DEV_CUSTOMERS["9876543210"] };

// Deterministic, fictional dev-style tokens (mock adapter convention) — never
// real credentials, and never asserted on beyond object identity.
function makeVerifyOtpResult(
  options: { customer?: AuthenticatedCustomer; expiresInMs?: number } = {},
): VerifyOtpResult {
  const { customer = COMPLETE_CUSTOMER, expiresInMs = DEV_SESSION_TTL_MS } = options;
  return {
    session: {
      accessToken: "dev-access-token",
      refreshToken: "dev-refresh-token",
      expiresAt: new Date(Date.now() + expiresInMs).toISOString(),
    },
    customer: { ...customer },
  };
}

function makeStoredSession(
  options: { customer?: AuthenticatedCustomer; expiresInMs?: number } = {},
): StoredSession {
  return { ...makeVerifyOtpResult(options), storedAt: new Date().toISOString() };
}

async function renderSessionProvider(
  storage: SessionStorage,
  options: { devShellOverride?: DevSessionShell | null; externallyManaged?: boolean } = {},
) {
  const { devShellOverride = null, externallyManaged = false } = options;
  return render(
    <SessionProvider
      storage={storage}
      devShellOverride={devShellOverride}
      externallyManaged={externallyManaged}
    >
      <SessionProbe />
    </SessionProvider>,
  );
}

beforeEach(() => {
  latestContext = undefined;
});

describe("SessionProvider", () => {
  describe("bootstrap", () => {
    it("reports bootstrapping while storage is read, then unauthenticated when empty", async () => {
      let resolveRead!: (value: StoredSession | null) => void;
      const pendingRead = new Promise<StoredSession | null>((resolve) => {
        resolveRead = resolve;
      });
      const memory = createMemorySessionStorage();
      memory.getSession.mockReturnValue(pendingRead);

      await renderSessionProvider(memory.storage);

      expect(currentStatus()).toBe("bootstrapping");

      await act(async () => {
        resolveRead(null);
      });

      await waitForStatus("unauthenticated");
      expect(currentCustomerId()).toBe("none");
    });

    it("restores an authenticated session for a fully onboarded customer", async () => {
      const stored = makeStoredSession();
      const memory = createMemorySessionStorage(stored);

      await renderSessionProvider(memory.storage);

      await waitForStatus("authenticated");
      expect(currentCustomerId()).toBe(COMPLETE_CUSTOMER.customerId);
      expect(sessionApi().customer).toEqual(stored.customer);
      expect(sessionApi().session).toEqual(stored.session);
      expect(memory.clearSession).not.toHaveBeenCalled();
    });

    it("sends a consent-required customer to onboarding on restore", async () => {
      const memory = createMemorySessionStorage(
        makeStoredSession({ customer: CONSENT_REQUIRED_CUSTOMER }),
      );

      await renderSessionProvider(memory.storage);

      await waitForStatus("onboarding-required");
      expect(currentCustomerId()).toBe(CONSENT_REQUIRED_CUSTOMER.customerId);
    });

    it("clears an expired stored session and reports unauthenticated", async () => {
      const memory = createMemorySessionStorage(makeStoredSession({ expiresInMs: -1_000 }));

      await renderSessionProvider(memory.storage);

      await waitForStatus("unauthenticated");
      expect(currentCustomerId()).toBe("none");
      expect(memory.clearSession).toHaveBeenCalledTimes(1);
      expect(memory.readStored()).toBeNull();
    });

    it("reports error when the storage read fails and recovers via retryBootstrap", async () => {
      const stored = makeStoredSession();
      const memory = createMemorySessionStorage();
      memory.getSession
        .mockRejectedValueOnce(new Error("secure store unavailable"))
        .mockResolvedValue(stored);

      await renderSessionProvider(memory.storage);

      await waitForStatus("error");
      expect(currentCustomerId()).toBe("none");

      await act(async () => {
        sessionApi().retryBootstrap();
      });

      await waitForStatus("authenticated");
      expect(currentCustomerId()).toBe(COMPLETE_CUSTOMER.customerId);
    });
  });

  describe("establishSession", () => {
    it("authenticates a fully onboarded customer and persists tokens plus customer", async () => {
      const memory = createMemorySessionStorage();
      await renderSessionProvider(memory.storage);
      await waitForStatus("unauthenticated");

      const result = makeVerifyOtpResult();
      await act(async () => {
        await sessionApi().establishSession(result);
      });

      expect(currentStatus()).toBe("authenticated");
      expect(currentCustomerId()).toBe(COMPLETE_CUSTOMER.customerId);
      expect(memory.setSession).toHaveBeenCalledTimes(1);
      expect(memory.setSession).toHaveBeenCalledWith(
        expect.objectContaining({ session: result.session, customer: result.customer }),
      );
      expect(typeof memory.readStored()?.storedAt).toBe("string");
    });

    it("sends a consent-required customer to onboarding", async () => {
      const memory = createMemorySessionStorage();
      await renderSessionProvider(memory.storage);
      await waitForStatus("unauthenticated");

      await act(async () => {
        await sessionApi().establishSession(
          makeVerifyOtpResult({ customer: CONSENT_REQUIRED_CUSTOMER }),
        );
      });

      expect(currentStatus()).toBe("onboarding-required");
      expect(currentCustomerId()).toBe(CONSENT_REQUIRED_CUSTOMER.customerId);
    });
  });

  it("completeOnboarding promotes the customer to authenticated and persists the change", async () => {
    const memory = createMemorySessionStorage();
    await renderSessionProvider(memory.storage);
    await waitForStatus("unauthenticated");

    await act(async () => {
      await sessionApi().establishSession(
        makeVerifyOtpResult({ customer: CONSENT_REQUIRED_CUSTOMER }),
      );
    });
    expect(currentStatus()).toBe("onboarding-required");

    await act(async () => {
      sessionApi().completeOnboarding();
    });

    expect(currentStatus()).toBe("authenticated");
    expect(currentCustomerId()).toBe(CONSENT_REQUIRED_CUSTOMER.customerId);
    await waitFor(() => {
      expect(memory.readStored()?.customer.onboardingStatus).toBe("complete");
    });
  });

  it("expireSession clears storage and reports expired", async () => {
    const memory = createMemorySessionStorage();
    await renderSessionProvider(memory.storage);
    await waitForStatus("unauthenticated");
    await act(async () => {
      await sessionApi().establishSession(makeVerifyOtpResult());
    });

    await act(async () => {
      sessionApi().expireSession();
    });

    expect(currentStatus()).toBe("expired");
    expect(currentCustomerId()).toBe("none");
    expect(memory.clearSession).toHaveBeenCalled();
    expect(memory.readStored()).toBeNull();
  });

  it("signOut clears storage and reports unauthenticated", async () => {
    const memory = createMemorySessionStorage(makeStoredSession());
    await renderSessionProvider(memory.storage);
    await waitForStatus("authenticated");

    await act(async () => {
      await sessionApi().signOut();
    });

    expect(currentStatus()).toBe("unauthenticated");
    expect(currentCustomerId()).toBe("none");
    expect(memory.clearSession).toHaveBeenCalledTimes(1);
    expect(memory.readStored()).toBeNull();
  });

  it("dev shell override shows the preview identity without ever reading storage", async () => {
    const memory = createMemorySessionStorage(makeStoredSession());

    await renderSessionProvider(memory.storage, { devShellOverride: "authenticated" });

    expect(currentStatus()).toBe("authenticated");
    expect(currentCustomerId()).toBe("dev-preview");
    expect(memory.getSession).not.toHaveBeenCalled();
  });

  describe("externally managed (clerk) mode", () => {
    it("stays bootstrapping until the bridge reports, then maps the customer's onboarding status", async () => {
      const memory = createMemorySessionStorage(makeStoredSession());

      await renderSessionProvider(memory.storage, { externallyManaged: true });

      expect(currentStatus()).toBe("bootstrapping");
      expect(memory.getSession).not.toHaveBeenCalled();

      await act(async () => {
        sessionApi().syncExternalSession({ ...CONSENT_REQUIRED_CUSTOMER });
      });
      expect(currentStatus()).toBe("onboarding-required");
      expect(currentCustomerId()).toBe(CONSENT_REQUIRED_CUSTOMER.customerId);
      // Clerk owns the tokens — no session material is mirrored locally.
      expect(sessionApi().session).toBeNull();

      await act(async () => {
        sessionApi().syncExternalSession(null);
      });
      expect(currentStatus()).toBe("unauthenticated");
      expect(currentCustomerId()).toBe("none");
    });

    it("establishSession does not write to the app's own storage", async () => {
      const memory = createMemorySessionStorage();

      await renderSessionProvider(memory.storage, { externallyManaged: true });

      await act(async () => {
        await sessionApi().establishSession(makeVerifyOtpResult());
      });

      expect(currentStatus()).toBe("authenticated");
      expect(memory.setSession).not.toHaveBeenCalled();
    });
  });

  it("expires the session automatically when its expiresAt elapses", async () => {
    const memory = createMemorySessionStorage();
    await renderSessionProvider(memory.storage);
    await waitForStatus("unauthenticated");

    await act(async () => {
      await sessionApi().establishSession(makeVerifyOtpResult({ expiresInMs: 50 }));
    });
    expect(currentStatus()).toBe("authenticated");

    // Let the central expiry timer (~50ms out) fire inside act.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
    });

    expect(currentStatus()).toBe("expired");
    expect(currentCustomerId()).toBe("none");
    expect(memory.clearSession).toHaveBeenCalled();
  });
});
