import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { IconButton } from "@/src/components/ui/IconButton";
import { Text } from "@/src/components/ui/Text";
import { colors, spacing } from "@/src/theme";

// Shared header for the sign-in / sign-up screens (native AuthView and web
// card variants): a back control so a customer who picked the wrong entry
// action can return to the welcome screen, plus the brand eyebrow so the
// Clerk surface always sits inside recognisable IDBI chrome.
type AuthScreenHeaderProps = {
  /** Native AuthView draws its own chevron on inner steps, so the app's
   *  exit control renders as a close glyph there ("close"); web cards have
   *  no built-in back, so they use a conventional chevron ("back"). */
  backControl?: "back" | "close";
};

export function AuthScreenHeader({ backControl = "back" }: AuthScreenHeaderProps) {
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
      <IconButton
        icon={backControl}
        accessibilityLabel={backControl === "close" ? "Close sign-in" : "Go back"}
        onPress={handleBack}
      />
      {/* IDBI Bank lockup (reference logo: orange IDBI, green BANK). */}
      <View style={styles.lockup} accessible accessibilityLabel="IDBI Bank">
        <Text variant="sectionTitle" color={colors.brandSecondary} style={styles.brand}>
          IDBI
        </Text>
        <Text variant="sectionTitle" color={colors.brandPrimary} style={styles.brand}>
          {" "}
          BANK
        </Text>
      </View>
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
  lockup: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  brand: {
    fontWeight: "800",
    letterSpacing: 1,
  },
  spacer: {
    width: spacing.touchTargetMin,
  },
});
