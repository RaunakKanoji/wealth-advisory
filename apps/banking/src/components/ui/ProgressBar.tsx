import { StyleSheet, View } from "react-native";

import { colors, radius } from "@/src/theme";

type ProgressBarProps = {
  value: number;
  accessibilityLabel?: string;
  /** Fill color override — pass a theme token (e.g. colors.chart[i]) only.
   *  Adjacent text must always carry the value; color is never the signal. */
  tint?: string;
};

export function ProgressBar({ value, accessibilityLabel, tint = colors.brandPrimary }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <View
      style={styles.track}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      // `now` must be an integer: iOS (new architecture) converts it to a
      // native integer and hard-crashes on fractional values like 100/3.
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped) }}
    >
      <View style={[styles.fill, { width: `${clamped}%`, backgroundColor: tint }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.border,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: radius.full,
  },
});
