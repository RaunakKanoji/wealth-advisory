import { useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { ClerkUserButton } from "@/src/components/navigation/ClerkUserButton";
import { Avatar } from "@/src/components/ui/Avatar";
import { IconButton } from "@/src/components/ui/IconButton";
import { Text } from "@/src/components/ui/Text";
import { env } from "@/src/config/env";
import { colors, spacing } from "@/src/theme";

type AppHeaderProps = {
  /** Optional short customer initials for the profile shortcut avatar. */
  initials?: string;
};

// Top bar for the authenticated tab shell (demo: components/shell header row).
// Carries the bank identity on the left and the two persistent shell actions on
// the right — notifications and a profile shortcut. In clerk mode the shortcut
// is Clerk's prebuilt <UserButton/> (opens Clerk's account UI); otherwise it's
// the app avatar linking to the Profile tab. Rendered inside each tab screen's
// <Screen>, so safe-area insets are already applied by the time it mounts.
export function AppHeader({ initials = "AN" }: AppHeaderProps) {
  const router = useRouter();

  const avatarShortcut = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Your profile"
      onPress={() => router.navigate("/(app)/(tabs)/profile")}
    >
      <Avatar initials={initials} size="sm" />
    </Pressable>
  );

  return (
    <View style={styles.header}>
      {/* Brand lockup (IDBI reference: orange mark + green wordmark). */}
      <View>
        <Text variant="caption" color={colors.brandSecondaryStrong} style={styles.brandMark}>
          IDBI
        </Text>
        <Text variant="cardTitle" color={colors.brandPrimary}>
          Wealth Advisory
        </Text>
      </View>

      <View style={styles.actions}>
        <IconButton
          icon="notifications"
          accessibilityLabel="Notifications"
          onPress={() => router.push("/(app)/notifications")}
        />
        {env.authenticationMode === "clerk" ? (
          <ClerkUserButton fallback={avatarShortcut} />
        ) : (
          avatarShortcut
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  brandMark: {
    fontWeight: "700",
    letterSpacing: 1,
  },
});
