import React, { useEffect, useRef } from "react";
import {
  Animated,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";

export default function HomeSkeletons() {
  const { width } = useWindowDimensions();
  const opacity = useRef(new Animated.Value(0.4)).current;

  const isSmall = width < 375;
  const isTablet = width >= 768;

  // Set up pulsing animation
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.8,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  // Card responsive formulas matching account-carousel
  const cardWidth = isTablet ? 620 : width - 56;
  const cardHeight = isSmall ? 190 : 210;
  const quickActionBtnSize = 72;

  return (
    <View style={styles.container}>
      {/* 1. Greeting Skeleton (Padded) */}
      <View style={{ paddingHorizontal: 20 }}>
        <Animated.View style={[styles.greetingSkeleton, { opacity }]} />
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
            paddingBottom: 20,
            columnGap: 16,
          }}
        >
          <Animated.View
            style={[
              styles.cardSkeleton,
              { width: cardWidth, height: cardHeight, opacity },
            ]}
          />
          <Animated.View
            style={[
              styles.cardSkeleton,
              { width: cardWidth, height: cardHeight, opacity },
            ]}
          />
        </ScrollView>

        {/* 3. Pagination Dots Skeleton */}
        <View style={styles.paginationRow}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Animated.View key={i} style={[styles.dotSkeleton, { opacity }]} />
          ))}
        </View>
      </View>

      {/* Padded Bottom Section */}
      <View style={{ paddingHorizontal: 20, rowGap: 24 }}>
        {/* 4. Quick Actions Skeleton */}
        <View style={styles.quickActionsRow}>
          {Array.from({ length: 4 }).map((_, i) => (
            <View key={i} style={styles.quickActionCol}>
              <Animated.View
                style={[
                  styles.quickActionBtn,
                  { width: quickActionBtnSize, height: quickActionBtnSize, opacity },
                ]}
              />
              <Animated.View style={[styles.quickActionLabel, { opacity }]} />
            </View>
          ))}
        </View>

        {/* 5. Total Balance Skeleton (Archived) */}
        {/* <Animated.View style={[styles.totalBalanceSkeleton, { opacity }]} /> */}

        {/* 6. Wealth Coach Skeleton */}
        <Animated.View style={[styles.coachSkeleton, { opacity }]} />

        {/* 7. Activity Skeleton */}
        <Animated.View style={[styles.activitySkeleton, { opacity }]} />
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
    backgroundColor: "#E5E7EB",
    borderRadius: 8,
    marginBottom: 6,
  },
  cardSkeleton: {
    backgroundColor: "#E5E7EB",
    borderRadius: 24,
  },
  carouselSection: {
    marginBottom: 4,
  },
  paginationRow: {
    flexDirection: "row",
    alignSelf: "center",
    columnGap: 9,
    marginTop: 18,
  },
  dotSkeleton: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#E5E7EB",
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
    backgroundColor: "#E5E7EB",
    borderRadius: 18,
  },
  quickActionLabel: {
    height: 14,
    width: 50,
    backgroundColor: "#E5E7EB",
    borderRadius: 4,
    marginTop: 10,
  },
  totalBalanceSkeleton: {
    height: 145,
    backgroundColor: "#E5E7EB",
    borderRadius: 24,
  },
  coachSkeleton: {
    height: 200,
    backgroundColor: "#E5E7EB",
    borderRadius: 24,
  },
  activitySkeleton: {
    height: 180,
    backgroundColor: "#E5E7EB",
    borderRadius: 24,
  },
});
