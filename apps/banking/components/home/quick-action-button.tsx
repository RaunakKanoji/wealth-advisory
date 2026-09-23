import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";

import { appColors, appRadii, appShadows } from "@/components/theme/tokens";

type QuickActionButtonProps = {
  iconName: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
  containerStyle?: StyleProp<ViewStyle>;
};

export default function QuickActionButton({
  iconName,
  label,
  accessibilityLabel,
  onPress,
  containerStyle,
}: QuickActionButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={[styles.container, containerStyle]}
    >
      {({ pressed }) => (
        <>
          <View style={[styles.button, pressed && styles.buttonPressed]}>
          <Ionicons name={iconName} size={30} color={appColors.orangeAccent} />
          </View>
          <Text style={styles.label}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1, // Equally distributed width (approx 25%)
    minWidth: 72,
  },
  button: {
    width: 72,
    height: 72,
    borderRadius: appRadii.tile,
    backgroundColor: appColors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: appColors.border,
    ...appShadows.surface,
  },
  buttonPressed: {
    opacity: 0.75,
    backgroundColor: appColors.surfaceMuted,
  },
  label: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "500",
    color: appColors.textBody,
    marginTop: 10,
    textAlign: "center",
  },
});
