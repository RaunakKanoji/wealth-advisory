import { ActivityIndicator, StyleSheet, View } from "react-native";

import { Text } from "@/src/components/ui/Text";
import { colors, spacing } from "@/src/theme";

type LoadingStateProps = {
  label?: string;
};

export function LoadingState({ label }: LoadingStateProps) {
  return (
    <View
      style={styles.container}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? "Loading"}
    >
      <ActivityIndicator color={colors.brandPrimary} />
      {label ? (
        <Text variant="supporting" color={colors.textSecondary}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
});
