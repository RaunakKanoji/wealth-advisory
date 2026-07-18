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
  onAddPress: () => void;
};

export function AccountsScreenHeader({
  onAddPress,
}: AccountsScreenHeaderProps) {
  const { width } = useWindowDimensions();
  const isSmall = width < 375;

  return (
    <View style={styles.container}>
      <Text
        accessibilityRole="header"
        style={[styles.title, isSmall && styles.titleSmall]}
      >
        My Accounts
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add an account"
        accessibilityHint="Opens the account application flow"
        onPress={onAddPress}
        style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
      >
        <Ionicons name="add" size={29} color="#4B5563" />
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
  addButton: {
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
