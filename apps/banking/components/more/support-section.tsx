import React from "react";
import { StyleSheet, Text, View } from "react-native";

import type { SupportActionItem } from "@/types/more-actions";

import { ServiceRow } from "./service-row";
import { moreCardShadow, moreColors } from "./tokens";

type SupportSectionProps = {
  items: SupportActionItem[];
};

export function SupportSection({ items }: SupportSectionProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>
          Help &amp; Support
        </Text>
      </View>
      {items.map((item, index) => (
        <ServiceRow
          key={item.id}
          item={item}
          showDivider={index < items.length - 1}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: "hidden",
    borderRadius: 20,
    backgroundColor: moreColors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: moreColors.border,
    ...moreCardShadow,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: moreColors.divider,
  },
  title: {
    color: "#222222",
    fontSize: 23,
    lineHeight: 29,
    fontWeight: "700",
  },
});
