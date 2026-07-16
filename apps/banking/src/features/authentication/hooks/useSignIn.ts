import { useRouter } from "expo-router";
import { useCallback, useState } from "react";

import {
  AuthenticationServiceError,
  getAuthenticationErrorMessage,
} from "@/src/features/authentication/models/authentication";
import { identifierSchema } from "@/src/features/authentication/schemas/authentication.schema";
import { authenticationService } from "@/src/features/authentication/services/authentication.service";
import { useSession } from "@/src/providers/SessionProvider";

export function useSignIn() {
  const router = useRouter();
  const { beginAuthentication } = useSession();
  const [identifier, setIdentifier] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = useCallback(async () => {
    setSubmitError(null);
    const result = identifierSchema.safeParse(identifier);
    if (!result.success) {
      setFieldError(result.error.issues[0]?.message ?? "Enter a valid identifier.");
      return;
    }
    setFieldError(null);
    setIsSubmitting(true);
    beginAuthentication();

    try {
      const otpRequest = await authenticationService.requestOtp({ identifier: result.data });
      router.push({
        pathname: "/(auth)/verify-otp",
        params: {
          identifier: otpRequest.identifier,
          requestId: otpRequest.requestId,
          resendAvailableAt: otpRequest.resendAvailableAt,
        },
      });
    } catch (error) {
      if (error instanceof AuthenticationServiceError) {
        setSubmitError(getAuthenticationErrorMessage(error.code));
      } else {
        setSubmitError(getAuthenticationErrorMessage("network-error"));
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [identifier, beginAuthentication, router]);

  return {
    identifier,
    setIdentifier,
    fieldError,
    submitError,
    isSubmitting,
    submit,
  };
}
