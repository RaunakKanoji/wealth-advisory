import React from "react";
import { StyleSheet, View } from "react-native";

import type { MoreActionItem } from "@/types/more-actions";

import { ServiceRow } from "./service-row";
import { moreCardShadow, moreColors } from "./tokens";

type ServiceSectionCardProps = {
  items: MoreActionItem[];
};

export function ServiceSectionCard({ items }: ServiceSectionCardProps) {
  return (
    <View style={styles.card}>
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
});
