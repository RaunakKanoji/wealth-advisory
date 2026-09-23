import React, { type PropsWithChildren } from "react";
import { StyleSheet } from "react-native";

import { Surface } from "@/components/design-system";
import { appRadii } from "@/components/theme/tokens";

type InsightCardProps = PropsWithChildren;

export function InsightCard({ children }: InsightCardProps) {
  return <Surface style={styles.card}>{children}</Surface>;
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    overflow: "hidden",
    borderRadius: appRadii.hero,
  },
});
