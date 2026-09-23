import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { appColors, appRadii, appSpacing } from "@/components/theme/tokens";
import { formatINR } from "@/lib/currency";

const TOPICS = [
  {
    id: "spending",
    label: "Spending",
    iconName: "wallet-outline" as const,
    prompt: "Where did I spend the most this month?",
  },
  {
    id: "savings",
    label: "Savings",
    iconName: "trending-up-outline" as const,
    prompt: "How can I increase my savings?",
  },
  {
    id: "goals",
    label: "Goals",
    iconName: "flag-outline" as const,
    prompt: "How am I progressing toward my goals?",
  },
  {
    id: "affordability",
    label: "Affordability",
    iconName: "cart-outline" as const,
    prompt: `Can I afford a ${formatINR(50000)} purchase?`,
  },
] as const;

type CoachTopicActionsProps = {
  onSelect: (prompt: string) => void;
};

export function CoachTopicActions({ onSelect }: CoachTopicActionsProps) {
  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>Quick questions</Text>
      <ScrollView
        horizontal
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.actions}
      >
        {TOPICS.map((topic) => (
          <Pressable
            key={topic.id}
            accessibilityLabel={`Ask Wealth Coach about ${topic.label.toLocaleLowerCase()}`}
            accessibilityHint="Fills the Coach question box with this prompt"
            accessibilityRole="button"
            onPress={() => onSelect(topic.prompt)}
            style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
          >
            <Ionicons name={topic.iconName} size={18} color={appColors.primary} />
            <Text style={styles.actionLabel}>{topic.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 0,
  },
  title: {
    color: appColors.textPrimary,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "700",
  },
  actions: {
    marginTop: appSpacing.md,
    paddingRight: appSpacing.sm,
    columnGap: appSpacing.sm,
  },
  action: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: appRadii.round,
    backgroundColor: appColors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: appColors.border,
  },
  actionPressed: {
    backgroundColor: appColors.primarySoft,
    borderColor: appColors.primaryBorder,
    transform: [{ scale: 0.98 }],
  },
  actionLabel: {
    marginLeft: 7,
    color: appColors.textBody,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "600",
  },
});
