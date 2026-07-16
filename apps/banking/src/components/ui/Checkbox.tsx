import { Pressable, StyleSheet, View } from "react-native";

import { Icon } from "@/src/components/ui/Icon";
import { Text } from "@/src/components/ui/Text";
import { colors, radius, spacing } from "@/src/theme";

type CheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  // Falls back to `label` when omitted. Set explicitly when the visible
  // label is rendered elsewhere (e.g. a card title) and repeating it next
  // to the checkbox would be visually redundant.
  accessibilityLabel?: string;
  disabled?: boolean;
};

export function Checkbox({
  checked,
  onChange,
  label,
  accessibilityLabel,
  disabled = false,
}: CheckboxProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled}
      onPress={() => onChange(!checked)}
      style={styles.row}
    >
      <View style={[styles.box, checked && styles.boxChecked, disabled && styles.boxDisabled]}>
        {checked ? <Icon name="check" size={14} color={colors.textInverse} /> : null}
      </View>
      {label ? (
        <Text variant="body" color={disabled ? colors.disabledText : colors.textPrimary}>
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: spacing.touchTargetMin,
  },
  box: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  boxChecked: {
    backgroundColor: colors.brandPrimary,
    borderColor: colors.brandPrimary,
  },
  boxDisabled: {
    backgroundColor: colors.disabledBackground,
    borderColor: colors.disabledBackground,
  },
});
