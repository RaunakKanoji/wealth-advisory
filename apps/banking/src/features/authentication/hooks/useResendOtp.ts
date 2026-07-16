import { useCallback, useState } from "react";

import { normalizeAuthenticationError } from "@/src/features/authentication/models/authentication-errors";
import type { AuthenticationError } from "@/src/features/authentication/models/authentication-errors";
import { useAuthenticationService } from "@/src/features/authentication/services/authentication.context";
import { useAuthenticationFlow } from "@/src/features/authentication/state/AuthenticationFlowProvider";

type UseResendOtpOptions = {
  /** Invoked after a successful resend so the screen can clear stale code state. */
  onResent?: () => void;
};

// Resend flow: replaces the active challenge with a fresh one (new expiry,
// new resend window). The OtpResendTimer component gates WHEN this can fire;
// the service enforces the same rule server-side (RESEND_NOT_AVAILABLE).
export function useResendOtp({ onResent }: UseResendOtpOptions = {}) {
  const service = useAuthenticationService();
  const { challenge, updateChallenge } = useAuthenticationFlow();

  const [isResending, setIsResending] = useState(false);
  const [resendError, setResendError] = useState<AuthenticationError | null>(null);

  const resend = useCallback(async () => {
    if (!challenge || isResending) {
      return;
    }
    setResendError(null);
    setIsResending(true);
    try {
      const next = await service.resendOtp(challenge.challengeId);
      updateChallenge(next);
      onResent?.();
    } catch (error) {
      setResendError(normalizeAuthenticationError(error));
    } finally {
      setIsResending(false);
    }
  }, [challenge, isResending, service, updateChallenge, onResent]);

  return { resend, isResending, resendError };
}
