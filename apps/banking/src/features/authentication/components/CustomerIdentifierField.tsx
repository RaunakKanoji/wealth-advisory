import { StyleSheet, View } from "react-native";

import { Text } from "@/src/components/ui/Text";
import { TextField } from "@/src/components/ui/TextField";
import { colors, radius, spacing } from "@/src/theme";

type CustomerIdentifierFieldProps = {
  value: string;
  onChangeText: (value: string) => void;
  error?: string;
  disabled?: boolean;
  onSubmitEditing?: () => void;
};

// Registered-mobile-number field: shared TextField with a static +91 prefix.
// The customer types the national number in any accepted form (spaces are
// fine); normalization happens in customer-identifier.schema.ts at submit
// time so typing is never interfered with.
export function CustomerIdentifierField({
  value,
  onChangeText,
  error,
  disabled = false,
  onSubmitEditing,
}: CustomerIdentifierFieldProps) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.prefix}>
          <Text variant="body" color={colors.textSecondary}>
            +91
          </Text>
        </View>
        <View style={styles.field}>
          <TextField
            label="Registered mobile number"
            placeholder="10-digit mobile number"
            value={value}
            onChangeText={onChangeText}
            disabled={disabled}
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            autoCorrect={false}
            returnKeyType="go"
            onSubmitEditing={onSubmitEditing}
            accessibilityHint="We'll send a one-time verification code to this number"
            maxLength={17}
          />
        </View>
      </View>
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
  row: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-end",
  },
  prefix: {
    minHeight: spacing.touchTargetMin,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  field: {
    flex: 1,
  },
});
