import { Alert, StyleSheet } from "react-native";

import { KeyboardScreen } from "@/src/components/layout/KeyboardScreen";
import { PageContainer } from "@/src/components/layout/PageContainer";
import { Stack } from "@/src/components/layout/Stack";
import { Button } from "@/src/components/ui/Button";
import { Heading } from "@/src/components/ui/Heading";
import { Text } from "@/src/components/ui/Text";
import { TextField } from "@/src/components/ui/TextField";
import { useSignIn } from "@/src/features/authentication/hooks/useSignIn";
import { colors, spacing } from "@/src/theme";

function handleSupportPress() {
  Alert.alert("Support", "Support contact options are not yet available in this preview.");
}

export function SignInScreen() {
  const { identifier, setIdentifier, fieldError, submitError, isSubmitting, submit } =
    useSignIn();

  return (
    <KeyboardScreen>
      <PageContainer>
        <Stack gap="xl" style={styles.content}>
          <Stack gap="sm">
            <Heading level="pageTitle">Secure sign-in</Heading>
            <Text variant="body" color={colors.textSecondary}>
              Enter your registered mobile number or customer ID. We&apos;ll send a
              verification code to confirm it&apos;s you.
            </Text>
          </Stack>

          <Stack gap="md">
            <TextField
              label="Mobile number or customer ID"
              placeholder="e.g. 9876543210"
              value={identifier}
              onChangeText={setIdentifier}
              error={fieldError ?? undefined}
              editable={!isSubmitting}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="go"
              onSubmitEditing={submit}
            />
            {submitError ? (
              <Text variant="caption" color={colors.error} accessibilityRole="alert">
                {submitError}
              </Text>
            ) : null}
            <Button label="Continue" variant="primary" loading={isSubmitting} onPress={submit} />
          </Stack>

          <Stack gap="xs">
            <Text variant="caption" color={colors.textSecondary}>
              Your identifier is used only to verify your identity and is never stored
              unencrypted on this device.
            </Text>
            <Button label="Need help signing in?" variant="ghost" onPress={handleSupportPress} />
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
