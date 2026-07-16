import type { PropsWithChildren } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, spacing, typography } from "@/src/theme";

type SectionProps = PropsWithChildren<{
  title?: string;
  description?: string;
  /** Optional trailing action ("View all") rendered beside the title. */
  actionLabel?: string;
  onAction?: () => void;
}>;

export function Section({ title, description, actionLabel, onAction, children }: SectionProps) {
  return (
    <View style={styles.container}>
      {title ? (
        <View style={styles.titleRow}>
          <Text style={styles.title}>{title}</Text>
          {actionLabel && onAction ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${actionLabel}: ${title}`}
              onPress={onAction}
              hitSlop={spacing.sm}
            >
              <Text style={styles.action}>{actionLabel}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {description ? <Text style={styles.description}>{description}</Text> : null}
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  title: {
    ...typography.sectionTitle,
    color: colors.textPrimary,
  },
  // Orange link treatment from the reference design ("View All").
  // brandSecondaryStrong is the text-safe orange (see theme/colors.ts).
  action: {
    ...typography.supporting,
    fontWeight: "600",
    color: colors.brandSecondaryStrong,
  },
  description: {
    ...typography.supporting,
    color: colors.textSecondary,
  },
  body: {
    gap: spacing.md,
  },
});
