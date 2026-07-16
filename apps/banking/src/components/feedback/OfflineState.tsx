import { StyleSheet, View } from "react-native";

import { FEEDBACK_COPY } from "@/src/components/feedback/feedbackCopy";
import { Text } from "@/src/components/ui/Text";
import { colors, spacing } from "@/src/theme";

type OfflineStateProps = {
  message?: string;
};

// Ports the demo's offline-banner.tsx (role="status", warning-soft
// background). RN's AccessibilityRole has no "status" equivalent — "alert"
// is the closest available role that still gets announced. The live
// OfflineBanner owns the iOS announcement so it fires once per offline
// transition, not on every screen mount.
export function OfflineState({ message = FEEDBACK_COPY.offline.message }: OfflineStateProps) {
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Text variant="caption" color={colors.warning}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    width: "100%",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.warningSoft,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});
