import React from "react";
import { StyleSheet, View } from "react-native";

import { Skeleton, useSkeletonPulse } from "@/components/skeleton";
import { appSpacing } from "@/components/theme/tokens";

export function CoachSkeletons() {
  const opacity = useSkeletonPulse();

  return (
    <View accessible accessibilityLabel="Loading Wealth Coach" accessibilityState={{ busy: true }}>
      <Skeleton opacity={opacity} style={styles.composerBlock} />

      <Skeleton opacity={opacity} style={styles.topicTitle} />
      <View style={styles.topicRow}>
        <Skeleton opacity={opacity} style={[styles.topicBlock, styles.topicBlockWide]} />
        <Skeleton opacity={opacity} style={styles.topicBlock} />
        <Skeleton opacity={opacity} style={styles.topicBlock} />
      </View>

      <Skeleton opacity={opacity} style={styles.summaryBlock} />

      <SectionSkeleton opacity={opacity} cardHeights={[132, 132]} />
      <SectionSkeleton opacity={opacity} cardHeights={[116, 116]} />
      <SectionSkeleton opacity={opacity} cardHeights={[258]} />
    </View>
  );
}

function SectionSkeleton({ opacity, cardHeights }: { opacity: ReturnType<typeof useSkeletonPulse>; cardHeights: number[] }) {
  return (
    <View style={styles.sectionSkeleton}>
      <View style={styles.sectionHeaderRow}>
        <Skeleton opacity={opacity} style={styles.sectionTitleBlock} />
        <Skeleton opacity={opacity} style={styles.sectionActionBlock} />
      </View>
      <View style={styles.sectionCards}>
        {cardHeights.map((height, index) => <Skeleton key={`${height}-${index}`} opacity={opacity} style={[styles.sectionBlock, { height }]} />)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  composerBlock: {
    width: "100%",
    height: 152,
    borderRadius: 20,
  },
  topicTitle: {
    width: 146,
    height: 24,
    marginTop: appSpacing.xxl,
    borderRadius: 7,
  },
  topicRow: {
    flexDirection: "row",
    columnGap: appSpacing.sm,
    marginTop: appSpacing.md,
    overflow: "hidden",
  },
  topicBlock: {
    width: 94,
    height: 44,
    borderRadius: 22,
  },
  topicBlockWide: {
    width: 112,
  },
  summaryBlock: {
    width: "100%",
    height: 180,
    marginTop: appSpacing.xxl,
    borderRadius: 20,
  },
  sectionSkeleton: {
    marginTop: 28,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitleBlock: {
    width: "42%",
    height: 22,
    borderRadius: 7,
  },
  sectionActionBlock: {
    width: 54,
    height: 16,
    borderRadius: 5,
  },
  sectionCards: {
    marginTop: appSpacing.md,
    rowGap: appSpacing.md,
  },
  sectionBlock: {
    width: "100%",
    borderRadius: 16,
  },
});
