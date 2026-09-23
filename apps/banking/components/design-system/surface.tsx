import React from "react";
import { StyleSheet, View, type ViewProps } from "react-native";

import {
  appColors,
  appRadii,
  appShadows,
  appSpacing,
} from "@/components/theme/tokens";

export type SurfaceVariant = "standard" | "subtle" | "brand";

export type SurfaceProps = ViewProps & {
  variant?: SurfaceVariant;
};

export function Surface({
  children,
  style,
  variant = "standard",
  ...viewProps
}: SurfaceProps) {
  return (
    <View
      {...viewProps}
      style={[styles.base, variantStyles[variant], style]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    padding: appSpacing.lg,
    borderRadius: appRadii.card,
    borderWidth: StyleSheet.hairlineWidth,
  },
  standard: {
    backgroundColor: appColors.surface,
    borderColor: appColors.border,
    ...appShadows.surface,
  },
  subtle: {
    backgroundColor: appColors.surfaceMuted,
    borderColor: appColors.divider,
  },
  brand: {
    backgroundColor: appColors.primary,
    borderColor: appColors.primary,
  },
});

const variantStyles = {
  standard: styles.standard,
  subtle: styles.subtle,
  brand: styles.brand,
} satisfies Record<SurfaceVariant, ViewProps["style"]>;
