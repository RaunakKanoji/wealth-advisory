import { useRouter } from "expo-router";
import { Alert, StyleSheet } from "react-native";

import { PageContainer } from "@/src/components/layout/PageContainer";
import { Screen } from "@/src/components/layout/Screen";
import { Section } from "@/src/components/layout/Section";
import { Stack } from "@/src/components/layout/Stack";
import { Button } from "@/src/components/ui/Button";
import { Heading } from "@/src/components/ui/Heading";
import { Text } from "@/src/components/ui/Text";
import { colors, spacing } from "@/src/theme";

function handleNotNowPress() {
  Alert.alert(
    "Limited access",
    "Without reviewing permissions, we can't personalize your wealth advisory experience. You can continue when you're ready.",
  );
}

export function ConsentIntroductionScreen() {
  const router = useRouter();

  return (
    <Screen scroll>
      <PageContainer>
        <Stack gap="xl" style={styles.content}>
          <Stack gap="sm">
            <Heading level="pageTitle">Why we need your permission</Heading>
            <Text variant="body" color={colors.textSecondary}>
              To give you useful, personalized guidance, we ask permission to use specific
              information from your banking relationship.
            </Text>
          </Stack>

          <Section title="What information may be used">
            <Text variant="body" color={colors.textSecondary}>
              Banking activity, investments, loans, and profile details you choose to share
              — organized into clear categories you review next.
            </Text>
          </Section>

          <Section title="How it helps your advisory experience">
            <Text variant="body" color={colors.textSecondary}>
              The more complete your picture, the more relevant your guidance. Recommendations
              depend on the information that&apos;s available to us.
            </Text>
          </Section>

          <Section title="How you stay in control">
            <Text variant="body" color={colors.textSecondary}>
              Some permissions are required for the service to work. Everything else is
              optional — you can decline it now and grant it later, and you can review or
              revoke any permission at any time.
            </Text>
          </Section>

          <Stack gap="sm">
            <Button
              label="Review permissions"
              variant="primary"
              onPress={() => router.push("/(onboarding)/consent/permissions")}
            />
            <Button label="Not now" variant="ghost" onPress={handleNotNowPress} />
          </Stack>
        </Stack>
      </PageContainer>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingVertical: spacing.xxl,
  },
});
