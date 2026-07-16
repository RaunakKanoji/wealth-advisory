import { Redirect, useRouter } from "expo-router";
import { StyleSheet } from "react-native";

import { KeyboardScreen } from "@/src/components/layout/KeyboardScreen";
import { PageContainer } from "@/src/components/layout/PageContainer";
import { Row } from "@/src/components/layout/Row";
import { Stack } from "@/src/components/layout/Stack";
import { Button } from "@/src/components/ui/Button";
import { Heading } from "@/src/components/ui/Heading";
import { Text } from "@/src/components/ui/Text";
import { AuthenticationNotice } from "@/src/features/authentication/components/AuthenticationNotice";
import { OtpInput } from "@/src/features/authentication/components/OtpInput";
import { OtpResendTimer } from "@/src/features/authentication/components/OtpResendTimer";
import { useResendOtp } from "@/src/features/authentication/hooks/useResendOtp";
import { useVerifyOtp } from "@/src/features/authentication/hooks/useVerifyOtp";
import { OTP_LENGTH } from "@/src/features/authentication/models/authentication";
import { colors, spacing } from "@/src/theme";

function formatExpiry(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

export function OtpVerificationScreen() {
  const router = useRouter();
  const {
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
  } = useVerifyOtp();
  const { resend, isResending, resendError } = useResendOtp({ onResent: resetForNewCode });

  // Opening this route without an active challenge (deep link, refresh,
  // cleared flow) always lands back on sign-in — never a broken screen.
  if (!challenge) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  const inlineError = fieldError ?? verifyError?.message ?? resendError?.message ?? null;
  const verifyDisabled = isExpired || attemptsExhausted;

  return (
    <KeyboardScreen>
      <PageContainer>
        <Stack gap="xl" style={styles.content}>
          <Row justify="space-between">
            <Heading level="pageTitle">Verify your identity</Heading>
            <Button
              label="Support"
              variant="ghost"
              onPress={() => router.push("/(public)/support")}
            />
          </Row>

          <Stack gap="xs">
            <Text variant="body" color={colors.textSecondary}>
              Enter the {OTP_LENGTH}-digit code sent to {challenge.maskedDestination}.
            </Text>
            {isExpired ? (
              <AuthenticationNotice message="This code has expired. Request a new code to continue." />
            ) : secondsUntilExpiry !== null ? (
              <Text variant="caption" color={colors.textSecondary}>
                Code expires in {formatExpiry(secondsUntilExpiry)}
              </Text>
            ) : null}
          </Stack>

          <Stack gap="sm">
            <OtpInput
              length={OTP_LENGTH}
              value={otp}
              onChange={setOtp}
              error={Boolean(inlineError)}
              disabled={isVerifying || verifyDisabled}
            />
            {inlineError && !isExpired ? <AuthenticationNotice message={inlineError} /> : null}
          </Stack>

          <Stack gap="md">
            <Button
              label="Verify"
              variant="primary"
              loading={isVerifying}
              disabled={verifyDisabled}
              onPress={verify}
            />
            <OtpResendTimer
              resendAvailableAt={challenge.resendAvailableAt}
              onResend={resend}
              isResending={isResending}
            />
            <Button label="Change mobile number" variant="ghost" onPress={changeNumber} />
          </Stack>
        </Stack>
      </PageContainer>
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingVertical: spacing.xl,
  },
});
