import React from "react";
import {
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";

import { Skeleton, useSkeletonPulse } from "@/components/skeleton";

export default function HomeSkeletons() {
  const { width } = useWindowDimensions();
  const opacity = useSkeletonPulse();

  const isSmall = width < 375;
  const isTablet = width >= 768;

  // Card responsive formulas matching account-carousel
  const cardWidth = isTablet ? 620 : width - 56;
  const cardHeight = isSmall ? 190 : 210;
  const quickActionBtnSize = 72;

  return (
    <View style={styles.container}>
      {/* 1. Greeting Skeleton (Padded) */}
      <View style={{ paddingHorizontal: 20 }}>
        <Skeleton opacity={opacity} style={styles.greetingSkeleton} />
      </View>

      {/* 2. Account Card Skeleton Carousel (Full Width) */}
      <View style={styles.carouselSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEnabled={false}
          contentContainerStyle={{
            paddingLeft: 20,
            paddingRight: 20,
            paddingTop: 4,
            paddingBottom: 12,
            columnGap: 16,
          }}
        >
          <Skeleton
            style={[
              styles.cardSkeleton,
              { width: cardWidth, height: cardHeight },
            ]}
            opacity={opacity}
          />
          <Skeleton
            style={[
              styles.cardSkeleton,
              { width: cardWidth, height: cardHeight },
            ]}
            opacity={opacity}
          />
        </ScrollView>

        {/* 3. Pagination Dots Skeleton */}
        <View style={styles.paginationRow}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} opacity={opacity} style={styles.dotSkeleton} />
          ))}
        </View>
      </View>

      {/* Padded Bottom Section */}
      <View style={{ paddingHorizontal: 20, rowGap: 24 }}>
        {/* 4. Quick Actions Skeleton */}
        <View style={styles.quickActionsRow}>
          {Array.from({ length: 4 }).map((_, i) => (
            <View key={i} style={styles.quickActionCol}>
              <Skeleton
                opacity={opacity}
                style={[styles.quickActionBtn, { width: quickActionBtnSize, height: quickActionBtnSize }]}
              />
              <Skeleton opacity={opacity} style={styles.quickActionLabel} />
            </View>
          ))}
        </View>

        {/* 5. Total Balance Skeleton (Archived) */}
        {/* <Animated.View style={[styles.totalBalanceSkeleton, { opacity }]} /> */}

        {/* 6. Wealth Coach Skeleton */}
        <Skeleton opacity={opacity} style={styles.coachSkeleton} />

        {/* 7. Activity Skeleton */}
        <Skeleton opacity={opacity} style={styles.activitySkeleton} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    rowGap: 24,
  },
  greetingSkeleton: {
    height: 32,
    width: "60%",
    borderRadius: 8,
    marginBottom: 6,
  },
  cardSkeleton: {
    borderRadius: 24,
  },
  carouselSection: {
    marginBottom: 4,
  },
  paginationRow: {
    flexDirection: "row",
    alignSelf: "center",
    columnGap: 9,
    marginTop: 8,
  },
  dotSkeleton: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  quickActionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  quickActionCol: {
    alignItems: "center",
  },
  quickActionBtn: {
    borderRadius: 18,
  },
  quickActionLabel: {
    height: 14,
    width: 50,
    borderRadius: 4,
    marginTop: 10,
  },
  totalBalanceSkeleton: {
    height: 145,
    borderRadius: 24,
  },
  coachSkeleton: {
    height: 200,
    borderRadius: 24,
  },
  activitySkeleton: {
    height: 180,
    borderRadius: 24,
  },
});
