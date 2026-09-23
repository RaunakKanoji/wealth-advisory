import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { appColors, appRadii, appSpacing } from "@/components/theme/tokens";
import type { TransferRecipientSnapshot } from "@/types/transfers";

export type TransferOption = {
  id: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  description: string;
  onPress: () => void;
};

type RecentRecipient = TransferRecipientSnapshot & { lastUsedAt: string };

function compactRecipientName(name: string): string {
  const firstName = name.trim().split(/\s+/)[0];
  return firstName || "Recipient";
}

export function DemoModeBanner() {
  return (
    <View style={styles.demoBanner} accessibilityLiveRegion="polite">
      <Ionicons name="information-circle-outline" size={20} color={appColors.orangeText} />
      <View style={styles.demoCopy}>
        <Text style={styles.demoTitle}>Demo mode</Text>
        <Text style={styles.demoDescription}>Transactions are simulated. No real money will be transferred.</Text>
      </View>
    </View>
  );
}

export function SectionHeader({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={onAction}
          style={({ pressed }) => [styles.sectionAction, pressed && styles.pressed]}
        >
          <Text style={styles.sectionActionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function TransferOptionList({ options }: { options: TransferOption[] }) {
  return (
    <View style={styles.optionList}>
      {options.map((option, index) => (
        <TransferOptionRow key={option.id} option={option} withDivider={index > 0} />
      ))}
    </View>
  );
}

export function TransferOptionRow({ option, withDivider = false }: { option: TransferOption; withDivider?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${option.title}. ${option.description}`}
      accessibilityHint="Opens this transfer flow"
      onPress={option.onPress}
      style={({ pressed }) => [styles.optionRow, withDivider && styles.insetDivider, pressed && styles.optionPressed]}
    >
      <View style={styles.optionIcon} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Ionicons name={option.icon} size={23} color={appColors.primaryPressed} />
      </View>
      <View style={styles.optionCopy}>
        <Text style={styles.optionTitle}>{option.title}</Text>
        <Text numberOfLines={2} style={styles.optionDescription}>{option.description}</Text>
      </View>
      <View style={styles.chevronTarget}>
        <Ionicons name="chevron-forward" size={19} color={appColors.textMuted} />
      </View>
    </Pressable>
  );
}

export function TransferOptionListSkeleton() {
  return (
    <View accessible accessibilityLabel="Loading transfer options" style={styles.optionList}>
      {[0, 1, 2].map((item) => (
        <View key={item} style={[styles.optionRow, item > 0 && styles.insetDivider]}>
          <View style={[styles.optionIcon, styles.skeletonIcon]} />
          <View style={styles.optionCopy}>
            <View style={styles.skeletonTitle} />
            <View style={[styles.skeletonDescription, item === 2 && styles.skeletonShort]} />
          </View>
          <Ionicons name="chevron-forward" size={19} color={appColors.border} />
        </View>
      ))}
    </View>
  );
}

export function RecentRecipientList({
  recipients,
  onRecipientPress,
  onAddPress,
}: {
  recipients: RecentRecipient[];
  onRecipientPress: (recipient: RecentRecipient) => void;
  onAddPress: () => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.recipientStrip}
      accessibilityLabel="Recent recipients"
    >
      {recipients.map((recipient) => (
        <RecipientItem
          key={`${recipient.type}:${recipient.beneficiaryId ?? recipient.maskedDestination}:${recipient.upiId ?? ""}`}
          recipient={recipient}
          onPress={() => onRecipientPress(recipient)}
        />
      ))}
      <AddRecipientItem onPress={onAddPress} />
    </ScrollView>
  );
}

function RecipientItem({ recipient, onPress }: { recipient: RecentRecipient; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Transfer to ${recipient.displayName}`}
      onPress={onPress}
      style={({ pressed }) => [styles.recipientItem, pressed && styles.pressed]}
    >
      <RecipientAvatar name={recipient.displayName} />
      <Text numberOfLines={1} ellipsizeMode="tail" style={styles.recipientName}>{compactRecipientName(recipient.displayName)}</Text>
      <Text numberOfLines={1} style={styles.recipientDetail}>{recipient.upiId ?? recipient.maskedDestination}</Text>
    </Pressable>
  );
}

function AddRecipientItem({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Add a new recipient"
      onPress={onPress}
      style={({ pressed }) => [styles.recipientItem, pressed && styles.pressed]}
    >
      <View style={[styles.recipientAvatar, styles.addAvatar]}>
        <Ionicons name="add" size={23} color={appColors.primaryPressed} />
      </View>
      <Text numberOfLines={1} style={styles.recipientName}>Add</Text>
      <Text numberOfLines={1} style={styles.recipientDetail}>New</Text>
    </Pressable>
  );
}

export function RecipientAvatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "R";

  return (
    <View style={styles.recipientAvatar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Text style={styles.recipientInitials}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  demoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: appSpacing.xxl,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: appRadii.control,
    backgroundColor: appColors.warningSoft,
  },
  demoCopy: {
    flex: 1,
    marginLeft: 8,
  },
  demoTitle: {
    color: appColors.orangeText,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  demoDescription: {
    marginTop: 1,
    color: appColors.textBody,
    fontSize: 13,
    lineHeight: 18,
  },
  sectionHeader: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: appSpacing.xxl,
  },
  sectionTitle: {
    color: appColors.textPrimary,
    fontSize: 19,
    lineHeight: 25,
    fontWeight: "700",
  },
  sectionAction: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: 16,
  },
  sectionActionText: {
    color: appColors.primaryPressed,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  optionList: {
    overflow: "hidden",
    borderRadius: appRadii.card,
    backgroundColor: appColors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: appColors.border,
  },
  optionRow: {
    minHeight: 84,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: appColors.surface,
  },
  insetDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: appColors.divider,
  },
  optionPressed: {
    backgroundColor: appColors.primarySoft,
  },
  optionIcon: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: appColors.primarySoft,
  },
  optionCopy: {
    flex: 1,
    minWidth: 0,
    marginLeft: 14,
  },
  optionTitle: {
    color: appColors.textPrimary,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "700",
  },
  optionDescription: {
    marginTop: 2,
    color: appColors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  chevronTarget: {
    width: 32,
    height: 44,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  skeletonIcon: {
    backgroundColor: appColors.surfaceMuted,
  },
  skeletonTitle: {
    width: "44%",
    height: 14,
    borderRadius: 7,
    backgroundColor: "#E7ECEE",
  },
  skeletonDescription: {
    width: "76%",
    height: 11,
    marginTop: 8,
    borderRadius: 6,
    backgroundColor: "#EEF1F3",
  },
  skeletonShort: {
    width: "57%",
  },
  recipientStrip: {
    columnGap: 10,
    paddingVertical: 4,
  },
  recipientItem: {
    width: 96,
    minHeight: 102,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 7,
    borderRadius: appRadii.control,
  },
  recipientAvatar: {
    width: 50,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 25,
    backgroundColor: appColors.primarySoft,
  },
  addAvatar: {
    borderWidth: 1,
    borderColor: appColors.primaryBorder,
    backgroundColor: appColors.surface,
  },
  recipientInitials: {
    color: appColors.primaryPressed,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
  },
  recipientName: {
    width: "100%",
    marginTop: 7,
    color: appColors.textPrimary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  recipientDetail: {
    width: "100%",
    marginTop: 1,
    color: appColors.textSecondary,
    fontSize: 11,
    lineHeight: 15,
    textAlign: "center",
  },
  pressed: {
    opacity: 0.72,
  },
});
