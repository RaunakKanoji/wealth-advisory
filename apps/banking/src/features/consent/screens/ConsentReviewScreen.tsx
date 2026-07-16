import { useRouter } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";

import { ErrorState } from "@/src/components/feedback/ErrorState";
import { PageContainer } from "@/src/components/layout/PageContainer";
import { Screen } from "@/src/components/layout/Screen";
import { Section } from "@/src/components/layout/Section";
import { Stack } from "@/src/components/layout/Stack";
import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import { Checkbox } from "@/src/components/ui/Checkbox";
import { Heading } from "@/src/components/ui/Heading";
import { Text } from "@/src/components/ui/Text";
import { useConsent } from "@/src/features/consent/hooks/useConsent";
import { colors, spacing } from "@/src/theme";

export function ConsentReviewScreen() {
  const router = useRouter();
  const { state, selectedCategories, declinedCategories, setAcknowledged, submit, retry, goToEdit } =
    useConsent();

  useEffect(() => {
    if (state.phase === "submitted") {
      router.replace("/(onboarding)/consent/success");
    }
  }, [state.phase, router]);

  async function handleSubmit() {
    if (state.phase === "submission-error") {
      retry();
    }
    await submit();
  }

  function handleEdit() {
    goToEdit();
    router.push("/(onboarding)/consent/permissions");
  }

  const isSubmitting = state.phase === "submitting";
  const canSubmit = state.acknowledged && !isSubmitting;

  return (
    <Screen scroll>
      <PageContainer>
        <Stack gap="xl" style={styles.content}>
          <Stack gap="sm">
            <Heading level="pageTitle">Review your permissions</Heading>
            <Text variant="body" color={colors.textSecondary}>
              Confirm your choices before we save them. Policy version {state.policyVersion}.
            </Text>
          </Stack>

          <Section title="Granted">
            <Stack gap="xs">
              {selectedCategories.map((category) => (
                <View key={category.id} style={styles.reviewRow}>
                  <Text variant="body">{category.title}</Text>
                  <Badge label={category.required ? "Required" : "Optional"} tone="primary" />
                </View>
              ))}
            </Stack>
          </Section>

          {declinedCategories.length > 0 ? (
            <Section title="Declined">
              <Stack gap="xs">
                {declinedCategories.map((category) => (
                  <View key={category.id} style={styles.reviewRow}>
                    <Text variant="body" color={colors.textSecondary}>
                      {category.title}
                    </Text>
                    <Badge label="Optional" tone="neutral" />
                  </View>
                ))}
              </Stack>
            </Section>
          ) : null}

          {state.phase === "submission-error" ? (
            <ErrorState message={state.errorMessage ?? undefined} onRetry={handleSubmit} />
          ) : null}

          <Stack gap="md">
            <Checkbox
              checked={state.acknowledged}
              onChange={setAcknowledged}
              label="I confirm that I have reviewed these permissions and understand how my information will be used for the wealth advisory service."
            />
            <Button
              label="Submit"
              variant="primary"
              loading={isSubmitting}
              disabled={!canSubmit}
              onPress={handleSubmit}
            />
            <Button label="Edit permissions" variant="ghost" onPress={handleEdit} />
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
  reviewRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});
