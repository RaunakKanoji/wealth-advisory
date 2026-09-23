import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  type StyleProp,
  type TextStyle,
} from "react-native";

import { appMotion } from "@/components/theme/tokens";
import { formatIndianMinorUnits } from "@/lib/currency";

type PrivateAmountProps = {
  amountMinorUnits: number | null | undefined;
  visible: boolean;
  style?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
  unavailableLabel?: string;
};

export function PrivateAmount({
  amountMinorUnits,
  visible,
  style,
  accessibilityLabel,
  unavailableLabel = "Balance unavailable",
}: PrivateAmountProps) {
  const opacity = useRef(new Animated.Value(1)).current;
  const previousVisibility = useRef(visible);
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);
  const isAvailable = typeof amountMinorUnits === "number" && Number.isFinite(amountMinorUnits);
  const formattedAmount = isAvailable ? formatIndianMinorUnits(amountMinorUnits) : unavailableLabel;
  const displayedAmount = !isAvailable
    ? unavailableLabel
    : visible
      ? formattedAmount
      : "₹••••••••";

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
    if (previousVisibility.current === visible) return;
    previousVisibility.current = visible;
    opacity.stopAnimation();
    if (reduceMotionEnabled) {
      opacity.setValue(1);
      return;
    }
    opacity.setValue(0.42);
    Animated.timing(opacity, {
      toValue: 1,
      duration: appMotion.standard,
      useNativeDriver: true,
    }).start();
  }, [opacity, reduceMotionEnabled, visible]);

  return (
    <Animated.Text
      adjustsFontSizeToFit
      accessibilityLabel={accessibilityLabel ?? (!isAvailable ? unavailableLabel : visible ? formattedAmount : "Balance hidden")}
      minimumFontScale={0.72}
      numberOfLines={1}
      style={[{ fontVariant: ["tabular-nums"], opacity }, style]}
    >
      {displayedAmount}
    </Animated.Text>
  );
}
