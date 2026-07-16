import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { PropsWithChildren } from "react";

import { DEV_INITIAL_SESSION_STATUS } from "@/src/config/devSession";
import type { Session, SessionStatus, SessionUser } from "@/src/types/session";

// PLACEHOLDER — in-memory only, resets on reload. No real token storage or
// bank IdP integration yet; see src/storage/session.ts for the persistence
// boundary this will eventually read/write through.
//
// Status progression: unauthenticated -> authentication-in-progress ->
// onboarding-required -> active. `completeOnboarding` performs the final
// hand-off into the authenticated (app) shell. The initial status is seeded
// from the DEV-ONLY shell-preview switch (src/config/devSession.ts) so each
// shell is reachable on boot during development; it is always
// `unauthenticated` in a customer build.

type SessionContextValue = Session & {
  beginAuthentication: () => void;
  completeAuthentication: (user: SessionUser) => void;
  completeOnboarding: () => void;
  signOut: () => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

// Deterministic placeholder identity used only when the dev switch boots
// straight into the onboarding or authenticated shell. Fictional — never real
// customer data.
const DEV_PREVIEW_USER: SessionUser = { id: "dev-preview", identifier: "Preview customer" };

function seedSession(status: SessionStatus): Session {
  if (status === "unauthenticated" || status === "restoring") {
    return { status, user: null };
  }
  return { status, user: DEV_PREVIEW_USER };
}

export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session>(() =>
    seedSession(DEV_INITIAL_SESSION_STATUS),
  );

  const beginAuthentication = useCallback(() => {
    setSession((current) => ({ ...current, status: "authentication-in-progress" }));
  }, []);

  const completeAuthentication = useCallback((user: SessionUser) => {
    setSession({ status: "onboarding-required", user });
  }, []);

  const completeOnboarding = useCallback(() => {
    setSession((current) => ({ status: "active", user: current.user }));
  }, []);

  const signOut = useCallback(() => {
    setSession({ status: "unauthenticated", user: null });
  }, []);

  const value = useMemo(
    () => ({
      ...session,
      beginAuthentication,
      completeAuthentication,
      completeOnboarding,
      signOut,
    }),
    [session, beginAuthentication, completeAuthentication, completeOnboarding, signOut],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
}
