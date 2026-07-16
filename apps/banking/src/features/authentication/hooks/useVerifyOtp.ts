import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";

import { normalizeAuthenticationError } from "@/src/features/authentication/models/authentication-errors";
import type { AuthenticationError } from "@/src/features/authentication/models/authentication-errors";
import { otpSchema } from "@/src/features/authentication/schemas/otp.schema";
import { useAuthenticationService } from "@/src/features/authentication/services/authentication.context";
import { useAuthenticationFlow } from "@/src/features/authentication/state/AuthenticationFlowProvider";
import { consumeIntendedDestination, useSession } from "@/src/features/session";

// OTP verification step. On success the session is established and the
// customer routes by onboarding status: incomplete -> onboarding; complete ->
// their originally intended protected destination (if any) or home. The OTP
// value itself lives only in this hook's state and is cleared on success,
// change-number, and expiry.
export function useVerifyOtp() {
  const router = useRouter();
  const service = useAuthenticationService();
  const { challenge, clearFlow, clearChallenge } = useAuthenticationFlow();
  const { establishSession } = useSession();

  const [otp, setOtp] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<AuthenticationError | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [attemptsExhausted, setAttemptsExhausted] = useState(false);

  // Live expiry countdown from the service-provided challenge expiry. Once
  // expired, verification is blocked client-side too — resend is the only
  // path forward, and it never happens silently.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const expiresAtMs = challenge ? new Date(challenge.expiresAt).getTime() : null;
  const isExpired = expiresAtMs !== null && now >= expiresAtMs;
  const secondsUntilExpiry =
    expiresAtMs === null ? null : Math.max(0, Math.ceil((expiresAtMs - now) / 1000));

  const verify = useCallback(async () => {
    if (!challenge || isVerifying || attemptsExhausted) {
      return;
    }
    if (isExpired) {
      setVerifyError({
        code: "OTP_EXPIRED",
        message: "This code has expired. Request a new code to continue.",
        retryable: false,
      });
      return;
    }
    setVerifyError(null);

    const parsed = otpSchema.safeParse(otp);
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? "Enter the verification code.");
      return;
    }
    setFieldError(null);
    setIsVerifying(true);

    try {
      const result = await service.verifyOtp({
        challengeId: challenge.challengeId,
        otp: parsed.data,
      });
      setOtp("");
      clearFlow();
      await establishSession(result);
      if (result.customer.onboardingStatus === "complete") {
        const destination = consumeIntendedDestination();
        // Typed-route templates don't cover runtime-captured paths; the
        // destination is always one of our own pathnames captured by the
        // (app) layout guard.
        router.replace((destination ?? "/(app)/(tabs)") as never);
      } else {
        router.replace("/(onboarding)");
      }
    } catch (error) {
      const normalized = normalizeAuthenticationError(error);
      if (normalized.code === "MISSING_CHALLENGE") {
        clearChallenge();
        router.replace("/(auth)/sign-in");
        return;
      }
      if (normalized.code === "TOO_MANY_ATTEMPTS") {
        setAttemptsExhausted(true);
        setOtp("");
      }
      setVerifyError(normalized);
    } finally {
      setIsVerifying(false);
    }
  }, [
    challenge,
    isVerifying,
    attemptsExhausted,
    isExpired,
    otp,
    service,
    clearFlow,
    clearChallenge,
    establishSession,
    router,
  ]);

  /** Called by resend flows so stale code/errors don't survive a new code. */
  const resetForNewCode = useCallback(() => {
    setOtp("");
    setFieldError(null);
    setVerifyError(null);
    setAttemptsExhausted(false);
  }, []);

  const changeNumber = useCallback(() => {
    // Clears challenge + OTP but keeps the entered identifier for editing.
    setOtp("");
    setFieldError(null);
    setVerifyError(null);
    setAttemptsExhausted(false);
    clearChallenge();
    // replace, not push — no stacked sign-in screens in history.
    router.replace("/(auth)/sign-in");
  }, [clearChallenge, router]);

  return {
    challenge,
    otp,
    setOtp,
    fieldError,
    verifyError,
    isVerifying,
    isExpired,
    secondsUntilExpiry,
    attemptsExhausted,
    verify,
    resetForNewCode,
    changeNumber,
  };
}
