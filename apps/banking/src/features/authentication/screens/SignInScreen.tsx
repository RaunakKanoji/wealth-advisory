import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { KeyboardScreen } from "@/src/components/layout/KeyboardScreen";
import { PageContainer } from "@/src/components/layout/PageContainer";
import { Row } from "@/src/components/layout/Row";
import { Stack } from "@/src/components/layout/Stack";
import { Button } from "@/src/components/ui/Button";
import { Heading } from "@/src/components/ui/Heading";
import { IconButton } from "@/src/components/ui/IconButton";
import { Text } from "@/src/components/ui/Text";
import { AuthenticationNotice } from "@/src/features/authentication/components/AuthenticationNotice";
import { CustomerIdentifierField } from "@/src/features/authentication/components/CustomerIdentifierField";
import { SecureAccessBanner } from "@/src/features/authentication/components/SecureAccessBanner";
import { useRequestOtp } from "@/src/features/authentication/hooks/useRequestOtp";
import { useSession } from "@/src/features/session";
import { colors, spacing } from "@/src/theme";

export function SignInScreen() {
  const router = useRouter();
  const { status } = useSession();
  const { identifier, setIdentifier, fieldError, submitError, isRequesting, requestOtp } =
    useRequestOtp();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(public)/welcome");
  };

  return (
    <KeyboardScreen>
      <PageContainer>
        <Stack gap="xl" style={styles.content}>
          <Row justify="space-between">
            <IconButton icon="back" accessibilityLabel="Go back" onPress={handleBack} />
            <Button
              label="Support"
              variant="ghost"
              onPress={() => router.push("/(public)/support")}
            />
          </Row>

          <Stack gap="sm">
            <Text variant="caption" color={colors.brandSecondaryStrong} style={styles.brand}>
              IDBI WEALTH ADVISORY
            </Text>
            <Heading level="pageTitle">Secure sign in</Heading>
            <Text variant="body" color={colors.textSecondary}>
              Enter the mobile number registered with IDBI Bank. We will send a one-time
              verification code.
            </Text>
          </Stack>

          {status === "expired" ? (
            <AuthenticationNotice
              tone="info"
              message="Your session has expired to protect your account. Please sign in again."
            />
          ) : null}

          <Stack gap="md">
            <CustomerIdentifierField
              value={identifier}
              onChangeText={setIdentifier}
              error={fieldError ?? undefined}
              disabled={isRequesting}
              onSubmitEditing={requestOtp}
            />
            {submitError ? <AuthenticationNotice message={submitError.message} /> : null}
            <Button
              label="Continue"
              variant="primary"
              loading={isRequesting}
              onPress={requestOtp}
            />
          </Stack>

          <SecureAccessBanner />

          {/* Clerk smart-CAPTCHA mount point (web only; inert elsewhere and
              in mock mode). Required for the dev sign-up fallback. */}
          <View nativeID="clerk-captcha" />
        </Stack>
      </PageContainer>
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingVertical: spacing.xl,
  },
  brand: {
    fontWeight: "700",
    letterSpacing: 1,
  },
});
