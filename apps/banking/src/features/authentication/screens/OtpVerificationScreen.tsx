import { useLocalSearchParams } from "expo-router";
import { StyleSheet } from "react-native";

import { KeyboardScreen } from "@/src/components/layout/KeyboardScreen";
import { PageContainer } from "@/src/components/layout/PageContainer";
import { Stack } from "@/src/components/layout/Stack";
import { Button } from "@/src/components/ui/Button";
import { Heading } from "@/src/components/ui/Heading";
import { Text } from "@/src/components/ui/Text";
import { OtpInput } from "@/src/features/authentication/components/OtpInput";
import { useOtpVerification } from "@/src/features/authentication/hooks/useOtpVerification";
import { OTP_LENGTH, maskIdentifier } from "@/src/features/authentication/models/authentication";
import { colors, spacing } from "@/src/theme";

export function OtpVerificationScreen() {
  const params = useLocalSearchParams<{
    identifier?: string;
    requestId?: string;
    resendAvailableAt?: string;
  }>();

  const identifier = params.identifier ?? "";
  const {
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
  } = useOtpVerification({
    identifier,
    initialRequestId: params.requestId ?? "",
    initialResendAvailableAt: params.resendAvailableAt ?? new Date().toISOString(),
  });

  const errorMessage = fieldError ?? submitError;

  return (
    <KeyboardScreen>
      <PageContainer>
        <Stack gap="xl" style={styles.content}>
          <Stack gap="sm">
            <Heading level="pageTitle">Enter verification code</Heading>
            <Text variant="body" color={colors.textSecondary}>
              We sent a verification code to {maskIdentifier(identifier)}.
            </Text>
          </Stack>

          <Stack gap="sm">
            <OtpInput
              length={OTP_LENGTH}
              value={code}
              onChange={setCode}
              error={Boolean(errorMessage)}
              disabled={isVerifying}
            />
            {errorMessage ? (
              <Text variant="caption" color={colors.error} accessibilityRole="alert">
                {errorMessage}
              </Text>
            ) : null}
          </Stack>

          <Stack gap="md">
            <Button label="Verify" variant="primary" loading={isVerifying} onPress={verify} />
            <Button
              label={canResend ? "Resend code" : `Resend code in ${secondsUntilResend}s`}
              variant="secondary"
              disabled={!canResend}
              loading={isResending}
              onPress={resend}
            />
            <Button
              label="Use a different mobile number or ID"
              variant="ghost"
              onPress={changeIdentifier}
            />
          </Stack>
        </Stack>
      </PageContainer>
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingVertical: spacing.xxl,
  },
});
