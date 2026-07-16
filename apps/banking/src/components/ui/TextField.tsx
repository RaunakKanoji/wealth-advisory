import { useState } from "react";
import type { ComponentProps } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import type { StyleProp, TextStyle } from "react-native";

import { Text } from "@/src/components/ui/Text";
import { colors, radius, spacing, typography } from "@/src/theme";

type TextFieldProps = Omit<ComponentProps<typeof TextInput>, "style"> & {
  label?: string;
  error?: string;
  disabled?: boolean;
  inputStyle?: StyleProp<TextStyle>;
};

// The demo's shared input chrome (components/forms/fields.tsx) has no
// visible focus-ring — it relies on the browser's default outline, which
// RN has no equivalent for. This fixes that gap with an explicit
// focus-driven border color.
export function TextField({
  label,
  error,
  disabled = false,
  inputStyle,
  onFocus,
  onBlur,
  ...rest
}: TextFieldProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.container}>
      {label ? <Text variant="supporting" color={colors.textSecondary}>{label}</Text> : null}
      <TextInput
        editable={!disabled}
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        onFocus={(event) => {
          setIsFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setIsFocused(false);
          onBlur?.(event);
        }}
        placeholderTextColor={colors.textMuted}
        style={[
          styles.input,
          isFocused && styles.inputFocused,
          Boolean(error) && styles.inputError,
          disabled && styles.inputDisabled,
          inputStyle,
        ]}
        {...rest}
      />
      {error ? (
        <Text variant="caption" color={colors.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  input: {
    minHeight: spacing.touchTargetMin,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
    fontSize: typography.body.fontSize,
  },
  inputFocused: {
    borderColor: colors.brandPrimary,
  },
  inputError: {
    borderColor: colors.error,
  },
  inputDisabled: {
    backgroundColor: colors.disabledBackground,
    borderColor: colors.disabledBackground,
  },
});
