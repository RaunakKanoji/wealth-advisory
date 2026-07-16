import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { Button } from "@/src/components/ui/Button";
import { Text } from "@/src/components/ui/Text";
import { colors, spacing } from "@/src/theme";

type EmptyStateProps = {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  illustration?: ReactNode;
};

export function EmptyState({ message, actionLabel, onAction, illustration }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      {illustration}
      {/* textSecondary, not textMuted: body copy must meet 4.5:1 (see theme/colors.ts) */}
      <Text variant="body" color={colors.textSecondary} style={styles.message}>
        {message}
      </Text>
      {actionLabel && onAction ? (
        <Button label={actionLabel} variant="secondary" onPress={onAction} />
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
