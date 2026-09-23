import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { privacySafeFinancialText } from "@/lib/privacy";
import type { WealthInsight } from "@/types/wealth-coach";

import { InsightCard } from "./insight-card";
import { coachColors } from "./tokens";

type SipInsightCardProps = {
  insight: WealthInsight;
  onPress: () => void;
  onAskCoach?: () => void;
  balanceVisible?: boolean;
};

export function SipInsightCard({ insight, onPress, balanceVisible = true }: SipInsightCardProps) {
  const title = balanceVisible ? insight.title : privacySafeFinancialText(insight.title, "Investment insight");
  const description = balanceVisible
    ? insight.summary?.trim() || insight.description
    : "This investment insight is based on the financial context currently available.";

  return (
    <InsightCard>
      <Pressable accessibilityRole="button" accessibilityLabel={`View ${title} insight`} onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
        <View style={styles.iconContainer}><Ionicons name="trending-up-outline" size={27} color={coachColors.brandGreen} /></View>
        <View style={styles.copy}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
        </View>
        <Ionicons name="chevron-forward" size={21} color={coachColors.iconMuted} />
      </Pressable>
    </InsightCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", borderRadius: 16 },
  iconContainer: { width: 60, height: 60, alignItems: "center", justifyContent: "center", borderRadius: 30, backgroundColor: coachColors.brandGreenSoft },
  copy: { flex: 1, minWidth: 0, marginHorizontal: 14 },
  title: { color: coachColors.textPrimary, fontSize: 19, lineHeight: 25, fontWeight: "700" },
  description: { marginTop: 6, color: coachColors.textSecondary, fontSize: 14, lineHeight: 19 },
  pressed: { opacity: 0.78 },
});
