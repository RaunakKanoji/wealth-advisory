import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { FEEDBACK_COPY } from "@/src/components/feedback/feedbackCopy";
import { useAccessibilityAnnouncement } from "@/src/components/feedback/useAccessibilityAnnouncement";
import { Button } from "@/src/components/ui/Button";
import { Text } from "@/src/components/ui/Text";
import { colors, spacing } from "@/src/theme";

type UnavailableStateProps = {
  message?: string;
  onRetry?: () => void;
  illustration?: ReactNode;
};

// A dependency is known to be down or not yet available — distinct from
// ErrorState (an operation failed) so screens can be explicit about which
// experience the customer is in (see docs: data-and-integration-context).
export function UnavailableState({
  message = FEEDBACK_COPY.unavailable.message,
  onRetry,
  illustration,
}: UnavailableStateProps) {
  useAccessibilityAnnouncement(message);

  return (
    <View style={styles.container} accessibilityRole="alert">
      {illustration}
      {/* textSecondary, not textMuted: body copy must meet 4.5:1 (see theme/colors.ts) */}
      <Text variant="body" color={colors.textSecondary} style={styles.message}>
        {message}
      </Text>
      {onRetry ? (
        <Button label={FEEDBACK_COPY.unavailable.retryLabel} variant="secondary" onPress={onRetry} />
      ) : null}
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
