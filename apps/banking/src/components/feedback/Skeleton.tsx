import { useEffect, useRef, useState } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { AccessibilityInfo, Animated, StyleSheet } from "react-native";

import { colors, radius } from "@/src/theme";

type SkeletonProps = {
  width?: number | `${number}%`;
  height?: number;
  style?: StyleProp<ViewStyle>;
};

// The demo treats honoring prefers-reduced-motion as non-optional for every
// animation (styles/motion.css) — this is the one place in this task that
// actually animates, so it's also where that principle gets implemented,
// via AccessibilityInfo rather than a CSS media query.
export function Skeleton({ width = "100%", height = 16, style }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.4)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(0.6);
      return;
    }

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [reduceMotion, opacity]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.base, { width, height, opacity }, style]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.card,
    backgroundColor: colors.border,
  },
});
