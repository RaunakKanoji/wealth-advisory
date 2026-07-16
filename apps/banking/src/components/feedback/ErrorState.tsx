import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { FEEDBACK_COPY } from "@/src/components/feedback/feedbackCopy";
import { useAccessibilityAnnouncement } from "@/src/components/feedback/useAccessibilityAnnouncement";
import { Button } from "@/src/components/ui/Button";
import { Text } from "@/src/components/ui/Text";
import { colors, spacing } from "@/src/theme";

type ErrorStateProps = {
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  illustration?: ReactNode;
};

// Default copy is deliberately generic — never surface a raw error message
// or technical detail to the customer here; pass a specific `message` only
// when it's already customer-safe.
export function ErrorState({
  message = FEEDBACK_COPY.error.message,
  onRetry,
  retryLabel = FEEDBACK_COPY.error.retryLabel,
  illustration,
}: ErrorStateProps) {
  useAccessibilityAnnouncement(message);

  return (
    <View style={styles.container} accessibilityRole="alert">
      {illustration}
      <Text variant="body" color={colors.error} style={styles.message}>
        {message}
      </Text>
      {onRetry ? <Button label={retryLabel} variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    padding: spacing.lg,
  },
  message: {
    textAlign: "center",
  },
});
