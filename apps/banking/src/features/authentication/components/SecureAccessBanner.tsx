import { StyleSheet, View } from "react-native";

import { Icon } from "@/src/components/ui/Icon";
import { Text } from "@/src/components/ui/Text";
import { colors, radius, spacing } from "@/src/theme";

// Reassurance banner for the authentication shell (demo reference:
// secure-access messaging). Static informational content only.
export function SecureAccessBanner() {
  return (
    <View style={styles.banner}>
      <Icon name="consent" size={18} color={colors.brandPrimary} />
      <Text variant="caption" color={colors.textSecondary} style={styles.text}>
        Your sign-in details are used only to verify your identity and protect access to your
        account.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.control,
    backgroundColor: colors.brandPrimarySoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  text: {
    flex: 1,
  },
});
