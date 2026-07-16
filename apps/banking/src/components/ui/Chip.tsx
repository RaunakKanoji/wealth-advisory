import { Pressable, StyleSheet } from "react-native";

import { Text } from "@/src/components/ui/Text";
import { colors, radius, spacing } from "@/src/theme";

type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
};

export function Chip({ label, selected = false, onPress, disabled = false }: ChipProps) {
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : "text"}
      accessibilityState={onPress ? { selected, disabled } : undefined}
      disabled={disabled}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected, disabled && styles.chipDisabled]}
    >
      <Text variant="caption" color={selected ? colors.brandPrimary : colors.textSecondary}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 36,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    // Hug the label instead of stretching to fill a column parent (matches Badge).
    alignSelf: "flex-start",
  },
  chipSelected: {
    borderColor: colors.brandPrimary,
    backgroundColor: colors.brandPrimarySoft,
  },
  chipDisabled: {
    opacity: 0.5,
  },
});
