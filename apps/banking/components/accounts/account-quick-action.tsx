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

type AccountQuickActionProps = {
  iconName: React.ComponentProps<typeof Ionicons>["name"];
  iconColor: string;
  label: string;
  accessibilityLabel: string;
  accessibilityHint?: string;
  disabled?: boolean;
  onPress?: () => void;
};

export function AccountQuickAction({
  iconName,
  iconColor,
  label,
  accessibilityLabel,
  accessibilityHint,
  disabled = false,
  onPress,
}: AccountQuickActionProps) {
  const { width } = useWindowDimensions();
  const isSmall = width < 375;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        disabled && styles.disabledContainer,
        pressed && !disabled && styles.pressed,
      ]}
    >
          <View style={[styles.button, isSmall && styles.buttonSmall]}>
        <Ionicons
          name={iconName}
          size={31}
          color={disabled ? accountColors.iconMuted : iconColor}
        />
      </View>
      <Text numberOfLines={2} style={styles.label}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
  },
  button: {
    width: 70,
    height: 70,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: accountColors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: accountColors.border,
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  buttonSmall: {
    width: 64,
    height: 64,
  },
  label: {
    maxWidth: 84,
    marginTop: 10,
    color: "#374151",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "500",
    textAlign: "center",
  },
  disabledContainer: {
    opacity: 0.62,
  },
  pressed: {
    opacity: 0.7,
  },
});
