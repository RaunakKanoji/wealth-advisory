import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/src/components/ui/Text";
import { colors, radius, spacing } from "@/src/theme";

export type RadioOption = {
  value: string;
  label: string;
  description?: string;
};

type RadioGroupProps = {
  options: RadioOption[];
  value: string | null;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export function RadioGroup({ options, value, onChange, disabled = false }: RadioGroupProps) {
  return (
    <View accessibilityRole="radiogroup" style={styles.group}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled }}
            accessibilityLabel={option.label}
            disabled={disabled}
            onPress={() => onChange(option.value)}
            style={[styles.row, selected && styles.rowSelected, disabled && styles.rowDisabled]}
          >
            <View style={[styles.dot, selected && styles.dotSelected]}>
              {selected ? <View style={styles.dotInner} /> : null}
            </View>
            <View style={styles.textGroup}>
              <Text variant="body">{option.label}</Text>
              {option.description ? (
                <Text variant="supporting" color={colors.textSecondary}>
                  {option.description}
                </Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: spacing.touchTargetMin,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  rowSelected: {
    borderColor: colors.brandPrimary,
    backgroundColor: colors.brandPrimarySoft,
  },
  rowDisabled: {
    opacity: 0.5,
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  dotSelected: {
    borderColor: colors.brandPrimary,
  },
  dotInner: {
    width: 10,
    height: 10,
    borderRadius: radius.full,
    backgroundColor: colors.brandPrimary,
  },
  textGroup: {
    flex: 1,
    gap: 2,
  },
});
