import React from "react";
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from "react-native";

import { appColors, appRadii, appSpacing } from "@/components/theme/tokens";

export type ProgressBarProps = Omit<
  ViewProps,
  "accessibilityRole" | "accessibilityValue"
> & {
  accessibilityValueText?: string;
  fillStyle?: StyleProp<ViewStyle>;
  max?: number;
  value: number;
};

export function ProgressBar({
  accessibilityLabel = "Progress",
  accessibilityValueText,
  fillStyle,
  max = 100,
  style,
  value,
  ...viewProps
}: ProgressBarProps) {
  const clampedMax = Number.isFinite(max) && max > 0 ? max : 100;
  const finiteValue = Number.isFinite(value) ? value : 0;
  const clampedValue = Math.min(Math.max(finiteValue, 0), clampedMax);
  const percentage = (clampedValue / clampedMax) * 100;

  return (
    <View
      {...viewProps}
      accessible
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="progressbar"
      accessibilityValue={{
        min: 0,
        max: clampedMax,
        now: clampedValue,
        ...(accessibilityValueText ? { text: accessibilityValueText } : {}),
      }}
      style={[styles.track, style]}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={[styles.fill, fillStyle, { width: `${percentage}%` }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: "100%",
    height: appSpacing.sm,
    overflow: "hidden",
    borderRadius: appRadii.round,
    backgroundColor: appColors.primaryBorder,
  },
  fill: {
    height: "100%",
    borderRadius: appRadii.round,
    backgroundColor: appColors.primary,
  },
});
