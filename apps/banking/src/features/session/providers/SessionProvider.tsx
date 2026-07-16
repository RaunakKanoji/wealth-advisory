import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { PropsWithChildren } from "react";

import { DEV_SESSION_SHELL_OVERRIDE } from "@/src/config/devSession";
import type { DevSessionShell } from "@/src/config/devSession";
import { env } from "@/src/config/env";
import type {
  AuthenticatedCustomer,
  VerifyOtpResult,
} from "@/src/features/authentication/models/authentication";
import { clearIntendedDestination } from "@/src/features/session/services/intended-destination";
import { statusForOnboarding } from "@/src/features/session/models/session";
import type { SessionState, SessionStatus } from "@/src/features/session/models/session";
import { sessionStorage as defaultSessionStorage } from "@/src/storage/session-storage";
import type { SessionStorage } from "@/src/storage/session-storage";

// Established customer session: bootstrap from storage on startup, establish
// after OTP verification, expire centrally, clear on sign-out. Temporary OTP
// challenge state lives in the authentication feature and never leaks here.
//
// Adapter interplay:
// - mock mode: this provider owns persistence through the SessionStorage
//   boundary (secure store on native; documented dev strategy on web).
// - clerk mode: Clerk owns token persistence; ClerkSessionBridge feeds
//   customer state in via syncExternalSession and nothing is written to our
//   own storage.

type SessionContextValue = SessionState & {
  establishSession: (result: VerifyOtpResult) => Promise<void>;
  /** Clerk bridge only: mirror an externally managed auth state. */
  syncExternalSession: (customer: AuthenticatedCustomer | null) => void;
  completeOnboarding: () => void;
  expireSession: () => void;
  signOut: () => Promise<void>;
  retryBootstrap: () => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

// Deterministic, fictional preview identities for the dev shell switch.
const DEV_SHELL_STATE: Record<DevSessionShell, SessionState> = {
  public: { status: "unauthenticated", customer: null, session: null },
  onboarding: {
    status: "onboarding-required",
    customer: {
      customerId: "dev-preview",
      displayName: "Preview customer",
      onboardingStatus: "consent-required",
    },
    session: null,
  },
  authenticated: {
    status: "authenticated",
    customer: {
      customerId: "dev-preview",
      displayName: "Preview customer",
      onboardingStatus: "complete",
    },
    session: null,
  },
};

type SessionProviderProps = PropsWithChildren<{
  /** Test-only injection points; the app uses the real storage + config. */
  storage?: SessionStorage;
  devShellOverride?: DevSessionShell | null;
  externallyManaged?: boolean;
}>;

export function SessionProvider({
  children,
  storage = defaultSessionStorage,
  devShellOverride = DEV_SESSION_SHELL_OVERRIDE,
  externallyManaged = env.authenticationMode === "clerk",
}: SessionProviderProps) {
  const [state, setState] = useState<SessionState>({
    status: "bootstrapping",
    customer: null,
    session: null,
  });
  const [bootstrapAttempt, setBootstrapAttempt] = useState(0);
  const expiryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Bootstrap -----------------------------------------------------------
  useEffect(() => {
    // Dev shell preview takes precedence (development/preview builds only —
    // config/devSession.ts rejects the switch in production).
    if (devShellOverride) {
      setState(DEV_SHELL_STATE[devShellOverride]);
      return;
    }
    // Clerk owns restoration; ClerkSessionBridge reports once Clerk loads.
    if (externallyManaged) {
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const stored = await storage.getSession();
        if (cancelled) return;

        if (!stored) {
          setState({ status: "unauthenticated", customer: null, session: null });
          return;
        }
        if (new Date(stored.session.expiresAt).getTime() <= Date.now()) {
          // Stale material is cleared, never reused.
          await storage.clearSession();
          if (!cancelled) {
            setState({ status: "unauthenticated", customer: null, session: null });
          }
          return;
        }
        setState({
          status: statusForOnboarding(stored.customer.onboardingStatus),
          customer: stored.customer,
          session: stored.session,
        });
      } catch {
        if (!cancelled) {
          // Recoverable: the root screen offers retryBootstrap.
          setState({ status: "error", customer: null, session: null });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [storage, devShellOverride, externallyManaged, bootstrapAttempt]);

  // --- Central expiry watcher ----------------------------------------------
  useEffect(() => {
    if (expiryTimer.current) {
      clearTimeout(expiryTimer.current);
      expiryTimer.current = null;
    }
    const active = state.status === "authenticated" || state.status === "onboarding-required";
    if (!active || !state.session) {
      return;
    }
    const remaining = new Date(state.session.expiresAt).getTime() - Date.now();
    // setTimeout overflows past ~24.8 days; sessions that long re-check on
    // next bootstrap instead.
    if (remaining <= 0 || remaining > 2_147_000_000) {
      if (remaining <= 0) {
        expiryTimer.current = setTimeout(() => expireSessionRef.current(), 0);
      }
      return;
    }
    expiryTimer.current = setTimeout(() => expireSessionRef.current(), remaining);
    return () => {
      if (expiryTimer.current) {
        clearTimeout(expiryTimer.current);
        expiryTimer.current = null;
      }
    };
  }, [state.status, state.session]);

  // --- Actions ---------------------------------------------------------------
  const establishSession = useCallback(
    async (result: VerifyOtpResult) => {
      setState({
        status: statusForOnboarding(result.customer.onboardingStatus),
        customer: result.customer,
        session: result.session,
      });
      if (!externallyManaged) {
        try {
          await storage.setSession({
            session: result.session,
            customer: result.customer,
            storedAt: new Date().toISOString(),
          });
        } catch {
          // Persistence failure must not block the live session — the
          // customer simply signs in again after the next restart.
        }
      }
    },
    [storage, externallyManaged],
  );

  const syncExternalSession = useCallback((customer: AuthenticatedCustomer | null) => {
    setState((current) => {
      if (!customer) {
        // Preserve an explicit expired notice; otherwise reflect signed-out.
        return current.status === "expired"
          ? current
          : { status: "unauthenticated", customer: null, session: null };
      }
      return {
        status: statusForOnboarding(customer.onboardingStatus),
        customer,
        session: null,
      };
    });
  }, []);

  const completeOnboarding = useCallback(() => {
    // Side effects stay outside the setState updater — React may invoke
    // updaters more than once (StrictMode), which would double-write storage.
    if (!state.customer) {
      return;
    }
    const customer: AuthenticatedCustomer = {
      ...state.customer,
      onboardingStatus: "complete",
    };
    if (!externallyManaged && state.session) {
      void storage
        .setSession({
          session: state.session,
          customer,
          storedAt: new Date().toISOString(),
        })
        .catch(() => {});
    }
    setState({ status: "authenticated", customer, session: state.session });
  }, [state.customer, state.session, storage, externallyManaged]);

  const expireSession = useCallback(() => {
    void storage.clearSession().catch(() => {});
    clearIntendedDestination();
    setState({ status: "expired", customer: null, session: null });
  }, [storage]);

  const expireSessionRef = useRef(expireSession);
  useEffect(() => {
    expireSessionRef.current = expireSession;
  }, [expireSession]);

  const signOut = useCallback(async () => {
    try {
      await storage.clearSession();
    } catch {
      // Losing the clear is acceptable only because state below is wiped;
      // stale storage is re-validated (and discarded) on next bootstrap.
    }
    clearIntendedDestination();
    setState({ status: "unauthenticated", customer: null, session: null });
  }, [storage]);

  const retryBootstrap = useCallback(() => {
    setState({ status: "bootstrapping", customer: null, session: null });
    setBootstrapAttempt((attempt) => attempt + 1);
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      establishSession,
      syncExternalSession,
      completeOnboarding,
      expireSession,
      signOut,
      retryBootstrap,
    }),
    [
      state,
      establishSession,
      syncExternalSession,
      completeOnboarding,
      expireSession,
      signOut,
      retryBootstrap,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
}

export type { SessionContextValue, SessionState, SessionStatus };
