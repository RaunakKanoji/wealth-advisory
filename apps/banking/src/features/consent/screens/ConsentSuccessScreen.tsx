import { useRouter } from "expo-router";
import { StyleSheet } from "react-native";

import { PageContainer } from "@/src/components/layout/PageContainer";
import { Screen } from "@/src/components/layout/Screen";
import { Section } from "@/src/components/layout/Section";
import { Stack } from "@/src/components/layout/Stack";
import { Button } from "@/src/components/ui/Button";
import { Heading } from "@/src/components/ui/Heading";
import { Text } from "@/src/components/ui/Text";
import { useConsent } from "@/src/features/consent/hooks/useConsent";
import { colors, spacing } from "@/src/theme";

export function ConsentSuccessScreen() {
  const router = useRouter();
  const { selectedCategories, state } = useConsent();

  return (
    <Screen scroll>
      <PageContainer>
        <Stack gap="xl" style={styles.content}>
          <Stack gap="sm">
            <Heading level="pageTitle">Permissions saved</Heading>
            <Text variant="body" color={colors.textSecondary}>
              Your permissions have been recorded
              {state.receipt ? ` (reference ${state.receipt.receiptId})` : ""}.
            </Text>
          </Stack>

          <Section title="What you granted">
            <Stack gap="xs">
              {selectedCategories.map((category) => (
                <Text key={category.id} variant="body">
                  {category.title}
                </Text>
              ))}
            </Stack>
          </Section>

          <Text variant="supporting" color={colors.textSecondary}>
            You can review or change these permissions at any time from your settings.
          </Text>

          <Text variant="body" color={colors.textSecondary}>
            Next, we&apos;ll set up your financial profile to personalize your guidance.
          </Text>

          <Button
            label="Continue"
            variant="primary"
            onPress={() => router.replace("/(onboarding)")}
          />
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
