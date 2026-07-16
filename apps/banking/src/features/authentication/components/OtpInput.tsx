import { useRef } from "react";
import { StyleSheet, TextInput, View } from "react-native";

import { colors, radius, spacing, typography } from "@/src/theme";

type OtpInputProps = {
  length: number;
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
  disabled?: boolean;
};

// maxLength is set to the full code length (not 1) on every box, so a full
// paste into any box arrives intact in onChangeText instead of being
// truncated by native input clamping — that's what makes paste support work
// below.
export function OtpInput({ length, value, onChange, error = false, disabled = false }: OtpInputProps) {
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const digits = Array.from({ length }, (_, index) => value[index] ?? "");

  function handleChangeDigit(index: number, text: string) {
    const sanitized = text.replace(/\D/g, "");

    if (sanitized.length > 1) {
      const next = (value.slice(0, index) + sanitized).slice(0, length);
      onChange(next);
      const focusIndex = Math.min(next.length, length - 1);
      inputRefs.current[focusIndex]?.focus();
      return;
    }

    const nextDigits = value.split("");
    nextDigits[index] = sanitized;
    const joined = nextDigits.join("").slice(0, length);
    onChange(joined);

    if (sanitized && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyPress(index: number, key: string) {
    if (key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  return (
    <View style={styles.row}>
      {digits.map((digit, index) => (
        <TextInput
          key={index}
          ref={(instance) => {
            inputRefs.current[index] = instance;
          }}
          value={digit}
          onChangeText={(text) => handleChangeDigit(index, text)}
          onKeyPress={({ nativeEvent }) => handleKeyPress(index, nativeEvent.key)}
          keyboardType="number-pad"
          maxLength={length}
          editable={!disabled}
          // OS OTP autofill targets the first box; the paste-friendly
          // onChangeText above spreads the full code across all boxes.
          textContentType={index === 0 ? "oneTimeCode" : "none"}
          autoComplete={index === 0 ? "one-time-code" : "off"}
          accessibilityLabel={`Verification code digit ${index + 1} of ${length}`}
          style={[styles.box, error && styles.boxError, disabled && styles.boxDisabled]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  box: {
    width: 44,
    height: 52,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    textAlign: "center",
    fontSize: typography.sectionTitle.fontSize,
    color: colors.textPrimary,
  },
  boxError: {
    borderColor: colors.error,
  },
  boxDisabled: {
    backgroundColor: colors.disabledBackground,
    borderColor: colors.disabledBackground,
  },
});
