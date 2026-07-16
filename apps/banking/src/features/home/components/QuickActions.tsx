import { useRouter } from "expo-router";
import type { Href } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { Icon } from "@/src/components/ui/Icon";
import type { IconName } from "@/src/components/ui/Icon";
import { Text } from "@/src/components/ui/Text";
import { colors, radius, spacing } from "@/src/theme";

// Quick-action tile row (IDBI reference: Scan QR / Cards / Transfer / All).
// Pure navigation shortcuts — outlined tiles with the brand-orange icon and a
// caption below. Destinations live here (not in the fixture) because they are
// structure, not wireframe data.
const ACTIONS: { icon: IconName; label: string; href: Href }[] = [
  { icon: "goals", label: "Goals", href: "/(app)/(tabs)/goals" },
  { icon: "documents", label: "Reports", href: "/(app)/reports" },
  { icon: "recommendations", label: "Advice", href: "/(app)/recommendations" },
  { icon: "settings", label: "Settings", href: "/(app)/settings" },
];

export function QuickActions() {
  const router = useRouter();

  return (
    <View style={styles.row}>
      {ACTIONS.map((action) => (
        <Pressable
          key={action.label}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          onPress={() => router.push(action.href)}
          style={styles.item}
        >
          <View style={styles.tile}>
            <Icon name={action.icon} size={24} color={colors.brandSecondaryStrong} />
          </View>
          <Text variant="caption" color={colors.textSecondary}>
            {action.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  item: {
    flex: 1,
    alignItems: "center",
    gap: spacing.xs,
  },
  tile: {
    width: 56,
    height: 56,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
});
