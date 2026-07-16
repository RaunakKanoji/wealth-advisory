import type { ComponentProps, ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet } from "react-native";

import { Text } from "@/src/components/ui/Text";
import { colors, radius, spacing } from "@/src/theme";

export type ButtonVariant = "primary" | "accent" | "secondary" | "ghost" | "destructive";

type ButtonProps = Omit<
  ComponentProps<typeof Pressable>,
  "style" | "children" | "disabled"
> & {
  label: string;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
};

const VARIANT_STYLES = {
  primary: {
    container: { backgroundColor: colors.brandPrimary },
    pressedContainer: { backgroundColor: colors.brandPrimaryStrong },
    labelColor: colors.textInverse,
  },
  // Brand-orange CTA (IDBI reference: "Explore Wealth Coach"). Uses the
  // text-safe strong orange — vivid brandSecondary fails AA under white.
  accent: {
    container: { backgroundColor: colors.brandSecondaryStrong },
    pressedContainer: { backgroundColor: colors.brandSecondary },
    labelColor: colors.textInverse,
  },
  secondary: {
    container: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    pressedContainer: { backgroundColor: colors.background },
    labelColor: colors.textPrimary,
  },
  ghost: {
    container: { backgroundColor: "transparent" },
    pressedContainer: { backgroundColor: colors.background },
    labelColor: colors.brandPrimary,
  },
  destructive: {
    container: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    pressedContainer: { backgroundColor: colors.background },
    labelColor: colors.error,
  },
} as const;

export function Button({
  label,
  variant = "primary",
  loading = false,
  disabled = false,
  icon,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const variantStyle = VARIANT_STYLES[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variantStyle.container,
        pressed && !isDisabled && variantStyle.pressedContainer,
        isDisabled && styles.disabledContainer,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variantStyle.labelColor} />
      ) : (
        <>
          {icon}
          <Text
            variant="buttonLabel"
            color={isDisabled ? colors.disabledText : variantStyle.labelColor}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    // Pill CTA treatment from the approved IDBI reference design.
    minHeight: 48,
    borderRadius: radius.full,
    paddingHorizontal: spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  disabledContainer: {
    backgroundColor: colors.disabledBackground,
    borderColor: colors.disabledBackground,
  },
});
