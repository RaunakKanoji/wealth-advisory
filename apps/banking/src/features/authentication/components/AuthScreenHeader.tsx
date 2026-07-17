import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { IconButton } from "@/src/components/ui/IconButton";
import { Text } from "@/src/components/ui/Text";
import { colors, spacing } from "@/src/theme";

// Shared header for the sign-in / sign-up screens (native AuthView and web
// card variants): a back control so a customer who picked the wrong entry
// action can return to the welcome screen, plus the brand eyebrow so the
// Clerk surface always sits inside recognisable IDBI chrome.
export function AuthScreenHeader() {
  const router = useRouter();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(auth)");
  };

  return (
    <View style={styles.header}>
      <IconButton icon="back" accessibilityLabel="Go back" onPress={handleBack} />
      <Text variant="caption" color={colors.brandSecondaryStrong} style={styles.brand}>
        IDBI WEALTH ADVISORY
      </Text>
      {/* Spacer balances the back button so the brand stays centered. */}
      <View style={styles.spacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  brand: {
    fontWeight: "700",
    letterSpacing: 1,
  },
  spacer: {
    width: spacing.touchTargetMin,
  },
});
