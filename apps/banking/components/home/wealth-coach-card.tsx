import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { WealthInsight } from "../../types/banking";
import { SectionHeader, Surface } from "@/components/design-system";
import { appColors } from "@/components/theme/tokens";
import { privacySafeFinancialText } from "@/lib/privacy";

type WealthCoachCardProps = {
  insight: WealthInsight;
  balanceVisible: boolean;
};

export default function WealthCoachCard({ insight, balanceVisible }: WealthCoachCardProps) {
  const router = useRouter();
  const insightTitle = balanceVisible
    ? insight.title
    : privacySafeFinancialText(insight.title, "Financial insight");
  const comparisonLabel = insight.comparisonLabel
    ? balanceVisible
      ? insight.comparisonLabel
      : privacySafeFinancialText(insight.comparisonLabel, "Comparison hidden")
    : undefined;

  const handlePressAction = () => {
    // Navigate to the Tab coach route
    router.push("/(app)/(tabs)/coach");
  };

  return (
    <Surface style={styles.card}>
      <SectionHeader
        title="Wealth Coach"
        action={<View style={styles.betaBadge}><Text style={styles.betaText}>BETA</Text></View>}
      />

      {/* Inset Insight Panel */}
      <View style={styles.insetPanel}>
        <View style={styles.insightContent}>
          <View style={styles.iconContainer}>
            <Ionicons name="trending-up" size={20} color="#FFFFFF" />
          </View>
          <Text style={styles.insightText}>{insightTitle}</Text>
        </View>
        {comparisonLabel && (
          <Text style={styles.comparisonText}>{comparisonLabel}</Text>
        )}
      </View>

      {/* Footer Action Link */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="View more wealth insights"
        onPress={handlePressAction}
        style={({ pressed }) => [
          styles.actionLink,
          pressed && styles.actionLinkPressed,
        ]}
      >
        <Text style={styles.actionText}>View More Insights</Text>
        <Ionicons name="chevron-forward" size={16} color="#00866A" style={styles.chevron} />
      </Pressable>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 20,
  },
  betaBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: appColors.primarySoft,
  },
  betaText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.4,
    color: appColors.primary,
  },
  insetPanel: {
    marginTop: 6,
    paddingVertical: 8,
  },
  insightContent: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: appColors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  insightText: {
    fontSize: 17,
    lineHeight: 23,
    fontWeight: "500",
    color: appColors.textPrimary,
    flex: 1,
  },
  comparisonText: {
    fontSize: 14,
    color: appColors.textSecondary,
    marginTop: 12,
    marginLeft: 52, // Align text underneath the insight text (width of icon 38 + margin 14)
  },
  actionLink: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    paddingVertical: 8,
  },
  actionLinkPressed: {
    opacity: 0.7,
  },
  actionText: {
    fontSize: 16,
    fontWeight: "600",
    color: appColors.primary,
  },
  chevron: {
    marginLeft: 4,
    marginTop: 1,
  },
});
