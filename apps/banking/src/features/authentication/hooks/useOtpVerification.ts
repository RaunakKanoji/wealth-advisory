import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";

import {
  AuthenticationServiceError,
  getAuthenticationErrorMessage,
} from "@/src/features/authentication/models/authentication";
import { otpCodeSchema } from "@/src/features/authentication/schemas/authentication.schema";
import { authenticationService } from "@/src/features/authentication/services/authentication.service";
import { useSession } from "@/src/providers/SessionProvider";

type UseOtpVerificationParams = {
  identifier: string;
  initialRequestId: string;
  initialResendAvailableAt: string;
};

export function useOtpVerification({
  identifier,
  initialRequestId,
  initialResendAvailableAt,
}: UseOtpVerificationParams) {
  const router = useRouter();
  const { completeAuthentication } = useSession();

  const [requestId, setRequestId] = useState(initialRequestId);
  const [code, setCode] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendAvailableAt, setResendAvailableAt] = useState(() =>
    new Date(initialResendAvailableAt).getTime(),
  );
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const secondsUntilResend = Math.max(0, Math.ceil((resendAvailableAt - now) / 1000));
  const canResend = secondsUntilResend === 0 && !isResending;

  const verify = useCallback(async () => {
    setSubmitError(null);
    const result = otpCodeSchema.safeParse(code);
    if (!result.success) {
      setFieldError(result.error.issues[0]?.message ?? "Enter the verification code.");
      return;
    }
    setFieldError(null);
    setIsVerifying(true);
    try {
      const { user } = await authenticationService.verifyOtp({
        requestId,
        identifier,
        code: result.data,
      });
      completeAuthentication(user);
      router.replace("/(onboarding)");
    } catch (error) {
      if (error instanceof AuthenticationServiceError) {
        setSubmitError(getAuthenticationErrorMessage(error.code));
      } else {
        setSubmitError(getAuthenticationErrorMessage("network-error"));
      }
    } finally {
      setIsVerifying(false);
    }
  }, [code, requestId, identifier, completeAuthentication, router]);

  const resend = useCallback(async () => {
    if (!canResend) return;
    setSubmitError(null);
    setIsResending(true);
    try {
      const result = await authenticationService.resendOtp({ requestId, identifier });
      setRequestId(result.requestId);
      setResendAvailableAt(new Date(result.resendAvailableAt).getTime());
      setCode("");
    } catch (error) {
      if (error instanceof AuthenticationServiceError) {
        setSubmitError(getAuthenticationErrorMessage(error.code));
      } else {
        setSubmitError(getAuthenticationErrorMessage("network-error"));
      }
    } finally {
      setIsResending(false);
    }
  }, [canResend, requestId, identifier]);

  const changeIdentifier = useCallback(() => {
    router.replace("/(auth)/sign-in");
  }, [router]);

  return {
    code,
    setCode,
    fieldError,
    submitError,
    isVerifying,
    isResending,
    canResend,
    secondsUntilResend,
    verify,
    resend,
    changeIdentifier,
  };
}
