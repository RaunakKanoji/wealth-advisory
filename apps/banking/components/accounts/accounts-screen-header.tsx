import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { accountColors } from "./tokens";

type AccountsScreenHeaderProps = {
  accountCount: number;
  lastUpdated?: string;
  isRefreshing: boolean;
  onRefresh: () => void;
};

export function AccountsScreenHeader({
  accountCount,
  lastUpdated,
  isRefreshing,
  onRefresh,
}: AccountsScreenHeaderProps) {
  const { width } = useWindowDimensions();
  const isSmall = width < 375;

  return (
    <View style={styles.container}>
      <View style={styles.titleColumn}>
        <Text
          accessibilityRole="header"
          style={[styles.title, isSmall && styles.titleSmall]}
        >
          My Accounts
        </Text>
        <Text style={styles.subtitle}>
          {accountCount} {accountCount === 1 ? "account" : "accounts"} linked
          {lastUpdated ? ` · Updated ${lastUpdated}` : ""}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isRefreshing ? "Refreshing accounts" : "Refresh accounts"}
        accessibilityState={{ busy: isRefreshing }}
        onPress={onRefresh}
        style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed]}
      >
        <Ionicons
          name="refresh-outline"
          size={22}
          color={isRefreshing ? "#A3ABB7" : "#4B5563"}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  titleColumn: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: accountColors.textPrimary,
    fontSize: 30,
    lineHeight: 38,
    fontWeight: "700",
  },
  titleSmall: {
    fontSize: 27,
    lineHeight: 34,
  },
  subtitle: {
    marginTop: 3,
    color: accountColors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  refreshButton: {
    width: 48,
    height: 48,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: accountColors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E7EB",
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  pressed: {
    opacity: 0.72,
  },
});
