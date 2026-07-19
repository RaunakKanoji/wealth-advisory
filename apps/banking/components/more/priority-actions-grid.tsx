import React from "react";
import { StyleSheet, View } from "react-native";

import type { PriorityActionItem } from "@/types/more-actions";

import { PriorityActionCard } from "./priority-action-card";

type PriorityActionsGridProps = {
  items: PriorityActionItem[];
  cardWidth: number;
};

export function PriorityActionsGrid({ items, cardWidth }: PriorityActionsGridProps) {
  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <PriorityActionCard key={item.id} item={item} width={cardWidth} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
  },
});
