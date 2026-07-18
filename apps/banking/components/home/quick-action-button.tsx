import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type QuickActionButtonProps = {
  iconName: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
};

export default function QuickActionButton({
  iconName,
  label,
  accessibilityLabel,
  onPress,
}: QuickActionButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={styles.container}
    >
      {({ pressed }) => (
        <>
          <View style={[styles.button, pressed && styles.buttonPressed]}>
            <Ionicons name={iconName} size={31} color="#FF8500" />
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
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#EBEDF0",
    // Subtle shadow
    shadowColor: "#111827",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  buttonPressed: {
    opacity: 0.75,
    backgroundColor: "#F9FAFB",
  },
  label: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "500",
    color: "#374151",
    marginTop: 10,
    textAlign: "center",
  },
});
