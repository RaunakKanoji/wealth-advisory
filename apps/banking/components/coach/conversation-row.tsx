import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { privacySafeFinancialText } from "@/lib/privacy";
import type { CoachConversation } from "@/types/wealth-coach-conversation";

import { coachColors } from "./tokens";

type ConversationRowProps = {
  conversation: CoachConversationListItem;
  onPress: () => void;
  showDivider?: boolean;
  trailing?: React.ReactNode;
  balanceVisible?: boolean;
};

export type CoachConversationSummary = Pick<CoachConversation, "id" | "title" | "createdAt" | "updatedAt"> & { status?: string; messageCount: number };
export type CoachConversationListItem = CoachConversation | CoachConversationSummary;

export function ConversationRow({ conversation, onPress, showDivider = false, trailing, balanceVisible = true }: ConversationRowProps) {
  const messageCount = "messageCount" in conversation ? conversation.messageCount : conversation.messages.length;
  const displayTitle = balanceVisible
    ? conversation.title
    : privacySafeFinancialText(conversation.title, "Financial question");

  return (
    <View style={styles.wrapper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Resume ${displayTitle}`}
        accessibilityHint="Opens this Wealth Coach conversation"
        onPress={onPress}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <View style={styles.iconContainer}>
          <Ionicons name="chatbubble-ellipses-outline" size={20} color={coachColors.brandGreen} />
        </View>
        <View style={styles.copy}>
          <Text numberOfLines={2} ellipsizeMode="tail" style={styles.title}>{displayTitle}</Text>
          <Text style={styles.meta}>{conversationDateLabel(conversation.updatedAt)} · {messageCount} message{messageCount === 1 ? "" : "s"}</Text>
        </View>
        {trailing ?? <Ionicons name="chevron-forward" size={19} color={coachColors.textMuted} />}
      </Pressable>
      {showDivider ? <View style={styles.divider} /> : null}
    </View>
  );
}

export function conversationDateLabel(value: string, reference = new Date()): string {
  const date = new Date(value);
  if (isSameCalendarDay(date, reference)) return "Today";

  const yesterday = new Date(reference);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameCalendarDay(date, yesterday)) return "Yesterday";

  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function conversationGroupLabel(value: string, reference = new Date()): string {
  const date = new Date(value);
  if (isSameCalendarDay(date, reference)) return "Today";

  const yesterday = new Date(reference);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameCalendarDay(date, yesterday)) return "Yesterday";

  const daysAgo = Math.floor((startOfDay(reference).getTime() - startOfDay(date).getTime()) / 86_400_000);
  if (daysAgo >= 0 && daysAgo < 7) return "Earlier this week";
  return "Earlier";
}

function startOfDay(value: Date): Date {
  const result = new Date(value);
  result.setHours(0, 0, 0, 0);
  return result;
}

function isSameCalendarDay(left: Date, right: Date): boolean {
  return left.toDateString() === right.toDateString();
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: coachColors.surface,
  },
  row: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: coachColors.brandGreenSoft,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    marginLeft: 12,
    marginRight: 10,
  },
  title: {
    color: coachColors.textPrimary,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "600",
  },
  meta: {
    marginTop: 2,
    color: coachColors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 68,
    backgroundColor: coachColors.divider,
  },
  pressed: {
    opacity: 0.7,
  },
});
