import React from "react";
import { StyleSheet, View } from "react-native";

import { Skeleton, useSkeletonPulse } from "@/components/skeleton";

export function AccountsSkeletons() {
  const opacity = useSkeletonPulse();

  return (
    <View
      accessible
      accessibilityLabel="Loading accounts"
      accessibilityState={{ busy: true }}
      style={styles.container}
    >
      <View style={styles.pageHeaderRow}>
        <View style={styles.pageHeaderCopy}>
          <Skeleton opacity={opacity} style={styles.pageTitle} />
          <Skeleton opacity={opacity} style={styles.pageSubtitle} />
        </View>
        <Skeleton opacity={opacity} style={styles.headerAction} />
      </View>

      <Skeleton opacity={opacity} style={styles.balanceCard} />

      <View style={styles.filterRow}>
        {[56, 84, 82, 86].map((width) => (
          <Skeleton key={width} opacity={opacity} style={[styles.filterChip, { width }]} />
        ))}
      </View>

      <View style={styles.sectionHeaderRow}>
        <Skeleton opacity={opacity} style={styles.sectionTitle} />
        <Skeleton opacity={opacity} style={styles.sectionCount} />
      </View>

      <Skeleton opacity={opacity} style={styles.accountCard} />
      <Skeleton opacity={opacity} style={styles.accountCard} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  pageHeaderRow: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 17,
  },
  pageHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  pageTitle: {
    width: 178,
    maxWidth: "68%",
    height: 34,
    borderRadius: 8,
  },
  pageSubtitle: {
    width: 248,
    maxWidth: "86%",
    height: 16,
    marginTop: 5,
    borderRadius: 5,
  },
  headerAction: {
    width: 44,
    height: 44,
    marginLeft: 12,
    borderRadius: 12,
  },
  balanceCard: {
    width: "100%",
    height: 188,
    borderRadius: 20,
  },
  filterRow: {
    width: "100%",
    flexDirection: "row",
    columnGap: 8,
    marginTop: 12,
    overflow: "hidden",
  },
  filterChip: {
    height: 42,
    borderRadius: 21,
  },
  sectionHeaderRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
  },
  sectionTitle: {
    width: 138,
    height: 25,
    borderRadius: 7,
  },
  sectionCount: {
    width: 72,
    height: 17,
    borderRadius: 5,
  },
  accountCard: {
    width: "100%",
    height: 205,
    marginTop: 12,
    borderRadius: 20,
  },
});
