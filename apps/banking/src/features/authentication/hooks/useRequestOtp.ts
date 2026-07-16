import { useRouter } from "expo-router";
import { useCallback, useState } from "react";

import { normalizeAuthenticationError } from "@/src/features/authentication/models/authentication-errors";
import type { AuthenticationError } from "@/src/features/authentication/models/authentication-errors";
import { mobileNumberSchema } from "@/src/features/authentication/schemas/customer-identifier.schema";
import { useAuthenticationService } from "@/src/features/authentication/services/authentication.context";
import { useAuthenticationFlow } from "@/src/features/authentication/state/AuthenticationFlowProvider";

// Sign-in step: validate + normalize the mobile number, request an OTP
// challenge, stash it in the flow provider, and move to verification. The
// identifier never enters route params; the OTP screen reads the masked
// destination from flow state.
export function useRequestOtp() {
  const router = useRouter();
  const service = useAuthenticationService();
  const { enteredIdentifier, setEnteredIdentifier, setChallenge } = useAuthenticationFlow();

  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<AuthenticationError | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);

  const requestOtp = useCallback(async () => {
    if (isRequesting) {
      return; // No duplicate requests while one is in flight.
    }
    setSubmitError(null);

    const parsed = mobileNumberSchema.safeParse(enteredIdentifier);
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? "Enter a valid mobile number.");
      return;
    }
    setFieldError(null);
    setIsRequesting(true);

    try {
      const challenge = await service.requestOtp({
        identifierType: "mobile-number",
        identifier: parsed.data,
      });
      setChallenge(challenge);
      router.push("/(auth)/verify-otp");
    } catch (error) {
      // Entered value is preserved so the customer can correct and retry.
      setSubmitError(normalizeAuthenticationError(error));
    } finally {
      setIsRequesting(false);
    }
  }, [isRequesting, enteredIdentifier, service, setChallenge, router]);

  return {
    identifier: enteredIdentifier,
    setIdentifier: setEnteredIdentifier,
    fieldError,
    submitError,
    isRequesting,
    requestOtp,
  };
}
