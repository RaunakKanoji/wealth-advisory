import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { StatusBanner } from "@/components/status-banner";
import { Skeleton, useSkeletonPulse } from "@/components/skeleton";

import { CoachSectionCard } from "./coach-section-card";
import { ConversationRow, type CoachConversationListItem } from "./conversation-row";
import { coachColors } from "./tokens";

type RecentConversationsProps = {
  conversations: CoachConversationListItem[];
  onViewAll: () => void;
  onConversationPress: (conversationId: string) => void;
  onStartConversation: () => void;
  balanceVisible?: boolean;
  errorMessage?: string;
  isLoading?: boolean;
  onRetry?: () => void;
  title?: string;
};

export function RecentConversations({ conversations, onViewAll, onConversationPress, onStartConversation, balanceVisible = true, errorMessage, isLoading = false, onRetry, title = "Recent conversations" }: RecentConversationsProps) {
  const visibleConversations = conversations
    .filter((conversation) => "messageCount" in conversation ? conversation.messageCount > 0 : conversation.messages.some((message) => message.role === "user" && message.content.trim().length > 0))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, 3);

  return (
    <CoachSectionCard
      title={title}
      actionLabel="View all"
      accessibilityLabel="View all Coach conversations"
      onActionPress={onViewAll}
    >
      {isLoading ? (
        <ConversationRowsSkeleton />
      ) : visibleConversations.length > 0 ? (
        <>
          <View style={styles.list}>
            {visibleConversations.map((conversation) => (
              <ConversationRow
                key={conversation.id}
                conversation={conversation}
                onPress={() => onConversationPress(conversation.id)}
                showDivider
                balanceVisible={balanceVisible}
              />
            ))}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Start a new Wealth Coach conversation"
              onPress={onStartConversation}
              style={({ pressed }) => [styles.newConversationRow, pressed && styles.pressed]}
            >
              <Ionicons name="add" size={18} color={coachColors.brandGreen} />
              <Text style={styles.newConversationText}>New conversation</Text>
            </Pressable>
          </View>
          {errorMessage ? (
            <View style={styles.errorBanner}>
              <StatusBanner
                actionLabel={onRetry ? "Retry" : undefined}
                actionAccessibilityLabel="Retry loading recent Wealth Coach conversations"
                iconName="refresh-outline"
                message="Showing your latest available conversations."
                onAction={onRetry}
                title="Couldn’t refresh conversations"
                tone="warning"
              />
            </View>
          ) : null}
        </>
      ) : errorMessage ? (
        <View style={styles.errorBanner}>
          <StatusBanner
            actionLabel={onRetry ? "Retry" : undefined}
            actionAccessibilityLabel="Retry loading recent Wealth Coach conversations"
            iconName="cloud-offline-outline"
            message={errorMessage}
            onAction={onRetry}
            title="Conversations unavailable"
            tone="warning"
          />
        </View>
      ) : (
        <View style={styles.list}>
          <View style={styles.emptyRow}>
            <View style={styles.emptyCopy}>
              <Text style={styles.emptyTitle}>Ask your first question</Text>
              <Text style={styles.emptyMeta}>Try “Where did I spend the most this month?”</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Ask Coach" onPress={onStartConversation} style={({ pressed }) => [styles.startButton, pressed && styles.pressed]}>
              <Text style={styles.startText}>Ask Coach</Text>
            </Pressable>
          </View>
        </View>
      )}
    </CoachSectionCard>
  );
}

function ConversationRowsSkeleton() {
  const opacity = useSkeletonPulse();

  return (
    <View accessibilityLabel="Loading recent Coach conversations" accessibilityState={{ busy: true }} style={styles.skeletonList}>
      {[0, 1, 2].map((item) => (
        <View key={item} style={styles.skeletonRow}>
          <Skeleton opacity={opacity} style={styles.skeletonIcon} />
          <View style={styles.skeletonCopy}>
            <Skeleton opacity={opacity} style={styles.skeletonTitle} />
            <Skeleton opacity={opacity} style={styles.skeletonMeta} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    marginTop: 14,
    overflow: "hidden",
    borderRadius: 18,
    backgroundColor: coachColors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: coachColors.border,
  },
  errorBanner: {
    marginTop: 14,
  },
  skeletonList: {
    marginTop: 14,
    overflow: "hidden",
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: coachColors.border,
    backgroundColor: coachColors.surface,
  },
  skeletonRow: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: coachColors.divider,
  },
  skeletonIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  skeletonCopy: {
    flex: 1,
    marginLeft: 12,
  },
  skeletonTitle: {
    width: "72%",
    height: 14,
    borderRadius: 6,
  },
  skeletonMeta: {
    width: "44%",
    height: 11,
    marginTop: 8,
    borderRadius: 5,
  },
  emptyRow: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  emptyCopy: {
    flex: 1,
    minWidth: 0,
  },
  emptyTitle: {
    color: coachColors.textPrimary,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "700",
  },
  emptyMeta: {
    marginTop: 2,
    color: coachColors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  startButton: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 8,
    borderRadius: 9,
  },
  startText: {
    color: coachColors.brandGreen,
    fontSize: 13,
    fontWeight: "700",
  },
  newConversationRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    columnGap: 5,
    paddingHorizontal: 16,
  },
  newConversationText: {
    color: coachColors.brandGreen,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.7,
  },
});
