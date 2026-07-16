import { usePathname, useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { isTabActive, TAB_ITEMS } from "@/src/components/navigation/tabItems";
import { Icon } from "@/src/components/ui/Icon";
import { Text } from "@/src/components/ui/Text";
import { colors, radius, spacing } from "@/src/theme";

// Medium/expanded presentation of primary navigation, ported from the demo's
// tablet-navigation-rail.tsx: same destinations as the bottom tab bar,
// rendered instead of it — never alongside (Decision D-004). Items keep the
// demo's icon-over-label column and primary-soft active treatment.
export function NavigationRail() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <View style={styles.rail}>
      {TAB_ITEMS.map((item) => {
        const active = isTabActive(pathname, item);
        const color = active ? colors.brandPrimary : colors.textSecondary;

        return (
          <Pressable
            key={item.name}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: active }}
            onPress={() => router.navigate(item.href)}
            style={[styles.item, active && styles.itemActive]}
          >
            <Icon name={item.icon} size={22} color={color} />
            <Text variant="caption" color={color} numberOfLines={1}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    width: 88,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    gap: spacing.xs,
  },
  item: {
    minHeight: spacing.touchTargetMin,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xxs,
    borderRadius: radius.control,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  itemActive: {
    backgroundColor: colors.brandPrimarySoft,
  },
});
