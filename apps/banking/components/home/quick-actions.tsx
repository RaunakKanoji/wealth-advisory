import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, View } from "react-native";
import QuickActionButton from "./quick-action-button";

export default function QuickActions() {
  const router = useRouter();

  const actions = [
    {
      id: "scan-qr",
      iconName: "qr-code-outline" as const,
      label: "Scan QR",
      accessibilityLabel: "Scan QR code",
      route: "/(app)/scan-qr" as const,
    },
    {
      id: "cards",
      iconName: "card-outline" as const,
      label: "Cards",
      accessibilityLabel: "View cards",
      route: "/(app)/cards" as const,
    },
    {
      id: "transfer",
      iconName: "swap-horizontal-outline" as const,
      label: "Transfer",
      accessibilityLabel: "Make a transfer",
      route: "/(app)/transfer" as const,
    },
    {
      id: "all",
      iconName: "grid-outline" as const,
      label: "All",
      accessibilityLabel: "View all services",
      route: "/(app)/services" as const,
    },
  ];

  return (
    <View style={styles.container}>
      {actions.map((action) => (
        <QuickActionButton
          key={action.id}
          iconName={action.iconName}
          label={action.label}
          accessibilityLabel={action.accessibilityLabel}
          onPress={() => router.push(action.route)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    paddingHorizontal: 4,
  },
});
