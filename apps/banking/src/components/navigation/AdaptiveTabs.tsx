import { Tabs } from "expo-router";
import { StyleSheet, View } from "react-native";

import { NavigationRail } from "@/src/components/navigation/NavigationRail";
import { TAB_ITEMS } from "@/src/components/navigation/tabItems";
import { Icon } from "@/src/components/ui/Icon";
import { useBreakpoint } from "@/src/hooks/useBreakpoint";
import { colors, typography } from "@/src/theme";

// The adaptive authenticated shell (demo: responsive-app-shell.tsx +
// responsive-navigation.tsx). One <Tabs> navigator at every width — compact
// shows the bottom tab bar; medium/expanded hides it and renders the rail
// beside the same navigator, so web never becomes a separate app. The
// bottom-tabs navigator applies the bottom safe-area inset itself.
export function AdaptiveTabs() {
  const compact = useBreakpoint() === "compact";

  return (
    <View style={styles.row}>
      {compact ? null : <NavigationRail />}
      <View style={styles.content}>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: colors.brandPrimary,
            tabBarInactiveTintColor: colors.textSecondary,
            tabBarLabelStyle: { ...typography.caption },
            tabBarStyle: compact ? styles.tabBar : styles.tabBarHidden,
          }}
        >
          {TAB_ITEMS.map((item) => (
            <Tabs.Screen
              key={item.name}
              name={item.name}
              options={{
                title: item.label,
                tabBarIcon: ({ color, size }) => (
                  <Icon name={item.icon} size={size} color={color} />
                ),
              }}
            />
          ))}
        </Tabs>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  tabBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
  },
  tabBarHidden: {
    display: "none",
  },
});
