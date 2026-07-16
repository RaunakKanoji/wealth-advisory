import { StyleSheet, View } from "react-native";

import { Text } from "@/src/components/ui/Text";
import { colors, radius, spacing } from "@/src/theme";

export type BadgeTone = "primary" | "success" | "warning" | "error" | "info" | "neutral";

type BadgeProps = {
  label: string;
  tone?: BadgeTone;
};

// Only primary-soft and warning-soft are real demo tokens (with a verified
// >=4.5:1 contrast pairing per the demo's own accessibility comment); the
// demo has no dedicated soft background for success/error/info, so those
// tones fall back to the neutral page background rather than a fabricated
// color.
const TONE_STYLES: Record<BadgeTone, { background: string; text: string }> = {
  primary: { background: colors.brandPrimarySoft, text: colors.brandPrimary },
  success: { background: colors.brandPrimarySoft, text: colors.success },
  warning: { background: colors.warningSoft, text: colors.warning },
  error: { background: colors.background, text: colors.error },
  info: { background: colors.background, text: colors.info },
  neutral: { background: colors.background, text: colors.textSecondary },
};

export function Badge({ label, tone = "neutral" }: BadgeProps) {
  const toneStyle = TONE_STYLES[tone];

  return (
    <View style={[styles.badge, { backgroundColor: toneStyle.background }]}>
      <Text variant="caption" color={toneStyle.text}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    alignSelf: "flex-start",
  },
});
