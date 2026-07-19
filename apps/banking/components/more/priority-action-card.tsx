import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import type { PriorityActionItem } from "@/types/more-actions";

import { ServiceIcon } from "./service-icon";
import { moreColors } from "./tokens";

type PriorityActionCardProps = {
  item: PriorityActionItem;
  width: number;
};

export function PriorityActionCard({ item, width }: PriorityActionCardProps) {
  const router = useRouter();
  const isDisabled = item.isDisabled === true;
  const isCompact = width < 200;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.accessibilityLabel ?? item.label}
      accessibilityHint={item.accessibilityHint ?? `Opens ${item.label.toLowerCase()}`}
      accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled}
      onPress={() => {
        if (!isDisabled) {
          router.push(item.route);
        }
      }}
      style={({ pressed }) => [
        styles.card,
        { width },
        isCompact && styles.compactCard,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
      ]}
    >
      <ServiceIcon
        icon={item.icon}
        tone={item.iconTone}
        containerSize={isCompact ? 42 : 48}
        size={isCompact ? 23 : 25}
      />
      <Text
        numberOfLines={2}
        style={[styles.label, isCompact && styles.compactLabel]}
      >
        {item.label}
      </Text>
      <Ionicons
        name="chevron-forward"
        size={18}
        color={moreColors.chevron}
        style={isCompact ? styles.compactChevron : undefined}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 92,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderRadius: 16,
    backgroundColor: moreColors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: moreColors.border,
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 7,
    elevation: 2,
  },
  compactCard: {
    minHeight: 104,
    flexDirection: "column",
    alignItems: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  label: {
    flex: 1,
    minWidth: 0,
    marginLeft: 12,
    color: "#222222",
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "500",
  },
  compactLabel: {
    flex: 0,
    width: "100%",
    marginTop: 8,
    marginLeft: 0,
    paddingRight: 22,
    fontSize: 14,
    lineHeight: 19,
  },
  compactChevron: {
    position: "absolute",
    top: 16,
    right: 12,
  },
  pressed: {
    backgroundColor: "#F8F9FA",
  },
  disabled: {
    opacity: 0.5,
  },
});
