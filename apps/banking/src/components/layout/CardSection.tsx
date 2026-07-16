import type { PropsWithChildren } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, radius, shadows, spacing, typography } from "@/src/theme";

type CardSectionProps = PropsWithChildren<{
  title?: string;
}>;

export function CardSection({ title, children }: CardSectionProps) {
  return (
    <View style={styles.card}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card,
  },
  title: {
    ...typography.cardTitle,
    color: colors.textPrimary,
  },
});
