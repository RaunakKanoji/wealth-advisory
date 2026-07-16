import type { ReactNode } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { OfflineBanner } from "@/src/components/feedback/OfflineBanner";
import { PageContainer } from "@/src/components/layout/PageContainer";
import { Row } from "@/src/components/layout/Row";
import { Stack } from "@/src/components/layout/Stack";
import { Button } from "@/src/components/ui/Button";
import { Heading } from "@/src/components/ui/Heading";
import { IconButton } from "@/src/components/ui/IconButton";
import { ProgressBar } from "@/src/components/ui/ProgressBar";
import { Text } from "@/src/components/ui/Text";
import { colors, spacing } from "@/src/theme";

type StepScaffoldProps = {
  step: number;
  totalSteps: number;
  title: string;
  description?: string;
  onBack?: () => void;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  children: ReactNode;
};

// Placeholder — nothing is persisted in this wireframe preview.
function handleSaveAndExit() {
  Alert.alert("Save & exit", "Your progress is not saved in this preview.");
}

// Shared shell for every onboarding step: a top bar (optional back + a
// Save & exit placeholder), a progress indicator with the step heading, the
// caller's scrollable body, and a genuinely sticky footer with the
// primary/secondary actions. The footer is a sibling of the ScrollView (not a
// child of it), so it stays pinned to the bottom no matter how long the step
// content is. Keyboard-aware so steps that embed a TextField stay usable.
// Layout + navigation only; the calling screen owns all content and handlers.
export function StepScaffold({
  step,
  totalSteps,
  title,
  description,
  onBack,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  children,
}: StepScaffoldProps) {
  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <OfflineBanner />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <PageContainer>
            <Stack gap="xl" style={styles.body}>
              <Row justify={onBack ? "space-between" : "flex-end"}>
                {onBack ? (
                  <IconButton icon="back" accessibilityLabel="Go back" onPress={onBack} />
                ) : null}
                <Button label="Save & exit" variant="ghost" onPress={handleSaveAndExit} />
              </Row>

              <Stack gap="sm">
                {/* Orange step indicator (hi-fi reference: onboarding progress). */}
                <ProgressBar
                  value={(step / totalSteps) * 100}
                  tint={colors.brandSecondaryStrong}
                  accessibilityLabel={`Step ${step} of ${totalSteps}`}
                />
                <Text variant="caption" color={colors.textSecondary}>
                  Step {step} of {totalSteps}
                </Text>
                <Heading level="pageTitle">{title}</Heading>
                {description ? (
                  <Text variant="body" color={colors.textSecondary}>
                    {description}
                  </Text>
                ) : null}
              </Stack>

              {children}
            </Stack>
          </PageContainer>
        </ScrollView>

        {/* Sticky action bar — sibling of the ScrollView, so it never scrolls
            away even when the step body overflows the viewport. */}
        <View style={styles.footer}>
          <Stack gap="sm" style={styles.footerInner}>
            <Button label={primaryLabel} onPress={onPrimary} />
            {secondaryLabel && onSecondary ? (
              <Button label={secondaryLabel} variant="secondary" onPress={onSecondary} />
            ) : null}
          </Stack>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  body: {
    paddingVertical: spacing.xl,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  footerInner: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
});
