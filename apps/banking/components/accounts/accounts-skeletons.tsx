import React from "react";
import { StyleSheet, View } from "react-native";

import { accountColors } from "./tokens";

export function AccountsSkeletons() {
  return (
    <View accessible accessibilityLabel="Loading accounts">
      <View style={[styles.skeleton, styles.summarySkeleton]} />
      <View style={styles.actionsRow}>
        {Array.from({ length: 4 }, (_, index) => (
          <View key={index} style={[styles.skeleton, styles.actionSkeleton]} />
        ))}
      </View>
      <View style={[styles.skeleton, styles.sectionTitleSkeleton]} />
      <View style={[styles.skeleton, styles.listSkeleton]} />
      <View style={[styles.skeleton, styles.promoSkeleton]} />
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: "#E7ECEE",
  },
  summarySkeleton: {
    height: 122,
    borderRadius: 20,
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 24,
  },
  actionSkeleton: {
    width: 70,
    height: 70,
    borderRadius: 18,
  },
  sectionTitleSkeleton: {
    width: 160,
    height: 28,
    marginTop: 32,
    marginBottom: 14,
    borderRadius: 8,
  },
  listSkeleton: {
    height: 416,
    borderRadius: 24,
  },
  promoSkeleton: {
    height: 220,
    marginTop: 24,
    borderRadius: 24,
  },
});
