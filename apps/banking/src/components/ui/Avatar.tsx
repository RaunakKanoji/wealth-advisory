import { Image } from "expo-image";
import type { ComponentProps } from "react";
import { StyleSheet, View } from "react-native";

import { Text } from "@/src/components/ui/Text";
import { colors } from "@/src/theme";

type AvatarSize = "sm" | "md" | "lg";

const SIZE_MAP: Record<AvatarSize, number> = {
  sm: 32,
  md: 44,
  lg: 64,
};

type AvatarProps = {
  source?: ComponentProps<typeof Image>["source"];
  initials?: string;
  size?: AvatarSize;
  accessibilityLabel?: string;
};

// Generic raster/initials avatar for user profile images — deliberately
// decoupled from the demo's copilot mascot SVGs (see assets/avatar/),
// which need react-native-svg to render and belong to the copilot feature,
// out of scope for this task.
export function Avatar({ source, initials, size = "md", accessibilityLabel }: AvatarProps) {
  const dimension = SIZE_MAP[size];
  const shape = { width: dimension, height: dimension, borderRadius: dimension / 2 };

  if (source) {
    return (
      <Image
        source={source}
        style={[styles.image, shape]}
        accessible={Boolean(accessibilityLabel)}
        accessibilityLabel={accessibilityLabel}
      />
    );
  }

  return (
    <View
      style={[styles.fallback, shape]}
      accessible={Boolean(accessibilityLabel)}
      accessibilityLabel={accessibilityLabel}
    >
      <Text variant="caption" color={colors.brandPrimary} style={styles.initials}>
        {initials?.slice(0, 2).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: colors.border,
  },
  fallback: {
    backgroundColor: colors.brandPrimarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    fontWeight: "700",
  },
});
