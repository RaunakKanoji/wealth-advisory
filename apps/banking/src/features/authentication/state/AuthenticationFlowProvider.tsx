import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { PropsWithChildren } from "react";

import type { RequestOtpResult } from "@/src/features/authentication/models/authentication";

// Temporary authentication-challenge state, alive only while the (auth)
// route group is mounted — never persisted, never placed in route params,
// and never mixed with the established session (features/session).
//
// May contain: challenge id, masked destination, expiry, resend timing, and
// the customer-entered identifier (memory-only, so "change number" can
// prefill). Must NEVER contain: OTP values, access/refresh tokens, or
// customer profile data.

export type AuthenticationChallenge = {
  challengeId: string;
  maskedDestination: string;
  expiresAt: string;
  resendAvailableAt: string;
};

type AuthenticationFlowContextValue = {
  challenge: AuthenticationChallenge | null;
  /** Raw identifier being edited; kept for change-number prefill only. */
  enteredIdentifier: string;
  setEnteredIdentifier: (identifier: string) => void;
  setChallenge: (result: RequestOtpResult) => void;
  updateChallenge: (result: RequestOtpResult) => void;
  clearChallenge: () => void;
  /** Full reset — challenge AND identifier. Used after success/cancel. */
  clearFlow: () => void;
};

const AuthenticationFlowContext = createContext<AuthenticationFlowContextValue | null>(null);

export function AuthenticationFlowProvider({ children }: PropsWithChildren) {
  const [challenge, setChallengeState] = useState<AuthenticationChallenge | null>(null);
  const [enteredIdentifier, setEnteredIdentifier] = useState("");

  const setChallenge = useCallback((result: RequestOtpResult) => {
    setChallengeState({
      challengeId: result.challengeId,
      maskedDestination: result.maskedDestination,
      expiresAt: result.expiresAt,
      resendAvailableAt: result.resendAvailableAt,
    });
  }, []);

  const clearChallenge = useCallback(() => {
    setChallengeState(null);
  }, []);

  const clearFlow = useCallback(() => {
    setChallengeState(null);
    setEnteredIdentifier("");
  }, []);

  const value = useMemo(
    () => ({
      challenge,
      enteredIdentifier,
      setEnteredIdentifier,
      setChallenge,
      updateChallenge: setChallenge,
      clearChallenge,
      clearFlow,
    }),
    [challenge, enteredIdentifier, setChallenge, clearChallenge, clearFlow],
  );

  return (
    <AuthenticationFlowContext.Provider value={value}>
      {children}
    </AuthenticationFlowContext.Provider>
  );
}

export function useAuthenticationFlow(): AuthenticationFlowContextValue {
  const context = useContext(AuthenticationFlowContext);
  if (!context) {
    throw new Error("useAuthenticationFlow must be used within AuthenticationFlowProvider");
  }
  return context;
}
