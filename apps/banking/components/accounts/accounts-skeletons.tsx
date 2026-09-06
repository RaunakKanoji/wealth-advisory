import React from "react";
import { StyleSheet, View } from "react-native";

export function AccountsSkeletons() {
  return (
    <View accessible accessibilityLabel="Loading accounts">
      <View style={[styles.skeleton, styles.summarySkeleton]} />
      <View style={styles.filterRow}>
        {Array.from({ length: 4 }, (_, index) => (
          <View key={index} style={[styles.skeleton, styles.filterSkeleton]} />
        ))}
      </View>
      <View style={[styles.skeleton, styles.sectionTitleSkeleton]} />
      <View style={[styles.skeleton, styles.listSkeleton]} />
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
  filterRow: {
    flexDirection: "row",
    columnGap: 8,
    marginTop: 24,
  },
  filterSkeleton: {
    width: 68,
    height: 38,
    borderRadius: 19,
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
});
