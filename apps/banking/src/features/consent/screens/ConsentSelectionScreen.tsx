import { useRouter } from "expo-router";
import { StyleSheet } from "react-native";

import { ErrorState } from "@/src/components/feedback/ErrorState";
import { LoadingState } from "@/src/components/feedback/LoadingState";
import { PageContainer } from "@/src/components/layout/PageContainer";
import { Screen } from "@/src/components/layout/Screen";
import { Section } from "@/src/components/layout/Section";
import { Stack } from "@/src/components/layout/Stack";
import { Button } from "@/src/components/ui/Button";
import { Heading } from "@/src/components/ui/Heading";
import { Text } from "@/src/components/ui/Text";
import { ConsentCategoryCard } from "@/src/features/consent/components/ConsentCategoryCard";
import { ConsentDetails } from "@/src/features/consent/components/ConsentDetails";
import { useConsent } from "@/src/features/consent/hooks/useConsent";
import { colors, spacing } from "@/src/theme";

export function ConsentSelectionScreen() {
  const router = useRouter();
  const {
    state,
    requiredCategories,
    optionalCategories,
    toggleCategory,
    openDetails,
    closeDetails,
    goToReview,
    reload,
  } = useConsent();

  const detailsCategory =
    state.categories.find((category) => category.id === state.detailsCategoryId) ?? null;

  if (state.phase === "loading") {
    return (
      <Screen>
        <LoadingState label="Loading permissions" />
      </Screen>
    );
  }

  if (state.phase === "error") {
    return (
      <Screen>
        <ErrorState message={state.errorMessage ?? undefined} onRetry={reload} />
      </Screen>
    );
  }

  function handleContinue() {
    goToReview();
    router.push("/(onboarding)/consent/review");
  }

  return (
    <Screen scroll>
      <PageContainer>
        <Stack gap="xl" style={styles.content}>
          <Stack gap="sm">
            <Heading level="pageTitle">Choose your permissions</Heading>
            <Text variant="body" color={colors.textSecondary}>
              Required permissions are needed for the service to work. Everything else is
              optional — nothing optional is selected until you choose it.
            </Text>
          </Stack>

          <Section title="Required">
            <Stack gap="sm">
              {requiredCategories.map((category) => (
                <ConsentCategoryCard
                  key={category.id}
                  title={category.title}
                  summary={category.summary}
                  required={category.required}
                  selected={category.selected}
                  onToggle={() => toggleCategory(category.id)}
                  onViewDetails={() => openDetails(category.id)}
                />
              ))}
            </Stack>
          </Section>

          <Section title="Optional">
            <Stack gap="sm">
              {optionalCategories.map((category) => (
                <ConsentCategoryCard
                  key={category.id}
                  title={category.title}
                  summary={category.summary}
                  required={category.required}
                  selected={category.selected}
                  onToggle={() => toggleCategory(category.id)}
                  onViewDetails={() => openDetails(category.id)}
                />
              ))}
            </Stack>
          </Section>

          <Button label="Continue" variant="primary" onPress={handleContinue} />
        </Stack>
      </PageContainer>

      <ConsentDetails
        category={detailsCategory}
        onClose={closeDetails}
        onToggle={() => {
          if (detailsCategory) {
            toggleCategory(detailsCategory.id);
          }
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingVertical: spacing.xxl,
  },
});
