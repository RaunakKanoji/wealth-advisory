import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from "react-native";

import { appColors } from "./theme/tokens";

type SkeletonProps = Omit<ViewProps, "style"> & {
  opacity?: Animated.Value;
  style?: StyleProp<ViewStyle>;
};

export function useSkeletonPulse() {
  const opacity = useRef(new Animated.Value(0.4)).current;
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotionEnabled(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotionEnabled);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    opacity.stopAnimation();
    if (reduceMotionEnabled) {
      opacity.setValue(0.6);
      return;
    }

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
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity, reduceMotionEnabled]);

  return opacity;
}

export function Skeleton({ opacity, style, ...props }: SkeletonProps) {
  return (
    <Animated.View
      {...props}
      accessible={false}
      style={[styles.base, style, opacity ? { opacity } : undefined]}
    />
  );
}

const styles = {
  base: {
    backgroundColor: appColors.skeleton,
  },
} satisfies Record<string, ViewStyle>;
