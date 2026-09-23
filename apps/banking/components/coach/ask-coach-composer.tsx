import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { appColors, appRadii, appSpacing, appTypography } from "@/components/theme/tokens";

import { coachColors } from "./tokens";

type AskCoachComposerProps = {
  value: string;
  onChangeText: (value: string) => void;
  onSubmit: (question: string) => void;
  inputRef?: React.RefObject<TextInput | null>;
  isSubmitting?: boolean;
  maxLength?: number;
  helperText?: string;
};

export function AskCoachComposer({
  value,
  onChangeText,
  onSubmit,
  inputRef,
  isSubmitting = false,
  maxLength = 1_200,
  helperText = "Based on your linked accounts",
}: AskCoachComposerProps) {
  const [isFocused, setIsFocused] = React.useState(false);
  const submit = () => {
    const trimmedQuestion = value.trim();
    if (!trimmedQuestion) return;
    onSubmit(trimmedQuestion);
  };

  const isDisabled = !value.trim() || isSubmitting;

  return (
    <View style={styles.container}>
      <View style={[styles.composer, isFocused && styles.composerFocused]}>
        <TextInput
          ref={inputRef}
          accessibilityLabel="Ask your Wealth Coach"
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={submit}
          placeholder="Ask about your money…"
          placeholderTextColor={coachColors.textMuted}
          returnKeyType="send"
          submitBehavior="submit"
          multiline
          maxLength={maxLength}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={styles.input}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send message"
          accessibilityState={{ disabled: isDisabled, busy: isSubmitting }}
          disabled={isDisabled}
          onPress={submit}
          style={({ pressed }) => [styles.sendButton, isDisabled && styles.sendButtonDisabled, pressed && styles.pressed]}
        >
          <Ionicons name={isSubmitting ? "ellipsis-horizontal" : "arrow-up"} size={18} color={coachColors.surface} />
        </Pressable>
      </View>
      <View style={styles.helperRow}>
        <Ionicons name="shield-checkmark-outline" size={14} color={appColors.textMuted} />
        <Text style={styles.helperText}>{helperText}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minWidth: 0,
    marginTop: 10,
  },
  composer: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: appSpacing.lg,
    paddingRight: appSpacing.sm,
    paddingVertical: 6,
    borderRadius: appRadii.medium,
    backgroundColor: appColors.surfaceMuted,
    borderWidth: 1,
    borderColor: coachColors.border,
  },
  composerFocused: {
    borderColor: appColors.primary,
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 40,
    maxHeight: 112,
    marginLeft: 0,
    paddingTop: 8,
    paddingBottom: 8,
    textAlignVertical: "center",
    color: coachColors.textPrimary,
    ...appTypography.body,
  },
  sendButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: appRadii.round,
    backgroundColor: appColors.primary,
  },
  sendButtonDisabled: {
    backgroundColor: appColors.disabled,
  },
  helperRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  helperText: {
    marginLeft: 5,
    color: coachColors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  pressed: {
    opacity: 0.72,
  },
});
