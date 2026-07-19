import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { MoreActionItem } from "@/types/more-actions";

import { ServiceIcon } from "./service-icon";
import { moreColors } from "./tokens";

type ServiceRowProps = {
  item: MoreActionItem;
  showDivider: boolean;
};

export function ServiceRow({ item, showDivider }: ServiceRowProps) {
  const router = useRouter();
  const isDisabled = item.isDisabled === true;

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={item.accessibilityLabel ?? item.label}
        accessibilityHint={
          item.accessibilityHint ?? `Opens ${item.label.toLowerCase()}`
        }
        accessibilityState={{ disabled: isDisabled }}
        disabled={isDisabled}
        onPress={() => {
          if (!isDisabled) {
            router.push(item.route);
          }
        }}
        style={({ pressed }) => [
          styles.row,
          pressed && !isDisabled && styles.pressed,
          isDisabled && styles.disabled,
        ]}
      >
        <ServiceIcon icon={item.icon} tone={item.iconTone} />
        <View style={styles.labelContainer}>
          <Text numberOfLines={1} ellipsizeMode="tail" style={styles.label}>
            {item.label}
          </Text>
          {item.badge ? <Text style={styles.badge}>{item.badge}</Text> : null}
        </View>
        <Ionicons
          name="chevron-forward"
          size={19}
          color={moreColors.chevron}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      </Pressable>
      {showDivider ? <View style={styles.divider} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 92,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 22,
    paddingVertical: 14,
  },
  labelContainer: {
    flex: 1,
    minWidth: 0,
    marginLeft: 14,
  },
  label: {
    color: "#222222",
    fontSize: 17,
    lineHeight: 23,
    fontWeight: "400",
  },
  badge: {
    marginTop: 3,
    color: moreColors.textSecondary,
    fontSize: 12,
  },
  divider: {
    height: 1,
    width: "100%",
    backgroundColor: moreColors.divider,
  },
  pressed: {
    backgroundColor: "#F8F9FA",
  },
  disabled: {
    opacity: 0.5,
  },
});
