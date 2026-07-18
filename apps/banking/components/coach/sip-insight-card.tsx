import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { formatIndianCurrencyWithoutSpace } from "@/lib/currency";
import type { WealthInsight } from "@/types/wealth-coach";

import { InsightCard } from "./insight-card";
import { coachColors } from "./tokens";

type SipInsightCardProps = {
  insight: WealthInsight;
  onPress: () => void;
};

export function SipInsightCard({ insight, onPress }: SipInsightCardProps) {
  const amount = insight.amount ?? 0;

  return (
    <InsightCard accessibilityLabel="View SIP recommendation" onPress={onPress}>
      <View style={styles.row}>
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons name="piggy-bank" size={25} color={coachColors.brandGreen} />
        </View>

        <View style={styles.copy}>
          <Text style={styles.title}>
            Increase your SIP by{`\n`}
            <Text style={styles.amount}>{formatIndianCurrencyWithoutSpace(amount)}</Text>
          </Text>
          <Text style={styles.description}>{insight.description}</Text>
        </View>

      </View>
    </InsightCard>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconContainer: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 26,
    backgroundColor: "#E6F3EF",
  },
  copy: {
    flex: 1,
    marginLeft: 14,
    marginRight: 8,
  },
  title: {
    color: coachColors.textPrimary,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "700",
  },
  amount: {
    color: coachColors.textPrimary,
    fontWeight: "700",
  },
  description: {
    marginTop: 5,
    color: "#747E8E",
    fontSize: 14,
    lineHeight: 20,
  },
});
