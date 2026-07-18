import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { WealthInsight } from "../../types/banking";

type WealthCoachCardProps = {
  insight: WealthInsight;
};

export default function WealthCoachCard({ insight }: WealthCoachCardProps) {
  const router = useRouter();

  const handlePressAction = () => {
    // Navigate to the Tab coach route
    router.push("/(app)/(tabs)/coach");
  };

  return (
    <View style={styles.card}>
      {/* Header Row */}
      <View style={styles.headerRow}>
        <Text style={styles.title}>Wealth Coach</Text>
        <View style={styles.betaBadge}>
          <Text style={styles.betaText}>BETA</Text>
        </View>
      </View>

      {/* Inset Insight Panel */}
      <View style={styles.insetPanel}>
        <View style={styles.insightContent}>
          <View style={styles.iconContainer}>
            <Ionicons name="trending-up" size={20} color="#FFFFFF" />
          </View>
          <Text style={styles.insightText}>{insight.title}</Text>
        </View>
        {insight.comparisonLabel && (
          <Text style={styles.comparisonText}>{insight.comparisonLabel}</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#F0F1F3",
    // Premium soft card shadow
    shadowColor: "#111827",
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  title: {
    fontSize: 23,
    fontWeight: "700",
    color: "#111827",
  },
  betaBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "#E6F3EF",
    marginLeft: 8,
  },
  betaText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.4,
    color: "#00866A",
  },
  insetPanel: {
    marginTop: 16,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#EDF0F2",
  },
  insightContent: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#00866A",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  insightText: {
    fontSize: 17,
    lineHeight: 23,
    fontWeight: "500",
    color: "#111827",
    flex: 1,
  },
  comparisonText: {
    fontSize: 14,
    color: "#9CA3AF",
    marginTop: 12,
    marginLeft: 52, // Align text underneath the insight text (width of icon 38 + margin 14)
  },
  actionLink: {
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
    color: "#00866A",
  },
  chevron: {
    marginLeft: 4,
    marginTop: 1,
  },
});
