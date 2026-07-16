import type { ComponentProps } from "react";
import { Pressable, StyleSheet } from "react-native";

import { Icon } from "@/src/components/ui/Icon";
import type { IconName } from "@/src/components/ui/Icon";
import { colors, radius, spacing } from "@/src/theme";

type IconButtonProps = Omit<
  ComponentProps<typeof Pressable>,
  "style" | "children" | "disabled"
> & {
  icon: IconName;
  // Required, not optional: icon-only controls have no visible text
  // fallback, so a label is mandatory for screen-reader users.
  accessibilityLabel: string;
  size?: number;
  disabled?: boolean;
};

export function IconButton({
  icon,
  accessibilityLabel,
  size = 24,
  disabled = false,
  ...rest
}: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={spacing.sm}
      style={({ pressed }) => [
        styles.base,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
      {...rest}
    >
      <Icon name={icon} size={size} color={disabled ? colors.disabledText : colors.textPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: spacing.touchTargetMin,
    height: spacing.touchTargetMin,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    backgroundColor: colors.background,
  },
  disabled: {
    opacity: 0.5,
  },
});
