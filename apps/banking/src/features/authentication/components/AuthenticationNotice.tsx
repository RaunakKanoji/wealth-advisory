import { StyleSheet, View } from "react-native";

import { Text } from "@/src/components/ui/Text";
import { colors, radius, spacing } from "@/src/theme";

type NoticeTone = "info" | "error";

type AuthenticationNoticeProps = {
  message: string;
  tone?: NoticeTone;
};

// Customer-safe status banner for the authentication screens (expired
// session, service unavailable, rate limits). Always renders normalized
// copy — never raw provider errors.
export function AuthenticationNotice({ message, tone = "error" }: AuthenticationNoticeProps) {
  return (
    <View
      style={[styles.notice, tone === "info" ? styles.noticeInfo : styles.noticeError]}
      accessibilityRole="alert"
    >
      <Text variant="supporting" color={tone === "info" ? colors.textSecondary : colors.error}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    borderRadius: radius.control,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  noticeError: {
    borderColor: colors.error,
    backgroundColor: colors.surface,
  },
  noticeInfo: {
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
});
