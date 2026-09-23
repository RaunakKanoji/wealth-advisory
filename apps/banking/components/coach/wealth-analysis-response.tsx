import React from "react";
import { StyleSheet, Text, View } from "react-native";

import type { ApiWealthAnalyticsResponse } from "@/lib/api/types";
import { privacySafeFinancialText } from "@/lib/privacy";
import { formatINRInText } from "@/lib/currency";

import { appColors, appRadii, appSpacing } from "@/components/theme/tokens";

export function WealthAnalysisResponse({ analysis, balanceVisible }: { analysis?: ApiWealthAnalyticsResponse; balanceVisible: boolean }) {
  if (!analysis) return null;
  const formatValue = (value: number | string, format: string) => {
    const numeric = Number(value);
    if (format === "currency" && Number.isFinite(numeric)) return `₹${numeric.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
    if (format === "percentage" && Number.isFinite(numeric)) return `${numeric.toFixed(1)}%`;
    return String(value);
  };
  const chart = analysis.charts[0];
  const maximum = Math.max(...(chart?.data.map((item) => item.value) ?? [1]), 1);
  const hideValue = (value: string, fallback: string) => balanceVisible ? formatINRInText(value) : privacySafeFinancialText(value, fallback);

  return (
    <View style={styles.container} accessibilityLabel="Wealth analytics answer">
      <View style={styles.headingRow}>
        <View style={styles.headingIcon}><Text style={styles.headingIconText}>✦</Text></View>
        <View style={styles.headingCopy}>
          <Text style={styles.title}>{analysis.answer.title}</Text>
          <Text style={styles.period}>{analysis.period.label}</Text>
        </View>
      </View>
      <Text style={styles.summary}>{hideValue(analysis.answer.summary, "Your financial answer is hidden")}</Text>
      <Text style={styles.detail}>{analysis.answer.detail}</Text>

      {analysis.metrics.length > 0 ? (
        <View style={styles.metrics} accessibilityLabel="Analytics metrics">
          {analysis.metrics.slice(0, 4).map((metric) => {
            const display = formatValue(metric.value, metric.format);
            return <View key={metric.id} style={styles.metric}><Text style={styles.metricLabel}>{metric.label}</Text><Text style={styles.metricValue}>{hideValue(display, "Hidden metric")}</Text>{metric.comparison?.value != null ? <Text style={[styles.comparison, metric.comparison.direction === "down" ? styles.positive : styles.attention]}>{balanceVisible ? `${metric.comparison.direction === "up" ? "↑" : metric.comparison.direction === "down" ? "↓" : "→"} ${Math.abs(metric.comparison.value).toFixed(1)}%` : "Change hidden"}</Text> : null}</View>;
          })}
        </View>
      ) : null}

      {chart?.data.length ? (
        <View style={styles.card} accessibilityLabel={chart.title}>
          <Text style={styles.cardTitle}>{chart.title}</Text>
          {chart.data.slice(0, 8).map((item) => <View key={item.label} style={styles.chartRow}><View style={styles.chartLabelRow}><Text style={styles.chartLabel}>{item.label}</Text><Text style={styles.chartAmount}>{hideValue(`₹${item.value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`, "Hidden amount")}</Text></View><View style={styles.track}><View style={[styles.fill, { width: balanceVisible ? `${Math.max(2, Math.min(100, item.value / maximum * 100))}%` : "0%" }]} /></View></View>)}
        </View>
      ) : null}

      {analysis.table?.rows.length ? <View style={styles.card}><Text style={styles.cardTitle}>Details</Text>{analysis.table.rows.slice(0, 6).map((row, index) => <View key={`row-${index}`} style={styles.tableRow}><Text style={styles.tablePrimary}>{String(row[0] ?? "")}</Text><Text style={styles.tableSecondary}>{row.slice(1).map((value) => typeof value === "number" ? hideValue(`₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`, "Hidden value") : String(value ?? "")).join(" · ")}</Text></View>)}</View> : null}

      {analysis.insights.length > 0 ? <View style={styles.card}><Text style={styles.cardTitle}>What stands out</Text>{analysis.insights.slice(0, 3).map((item) => <Text key={item} style={styles.bullet}>• {item}</Text>)}</View> : null}
      {analysis.recommendations.length > 0 ? <View style={styles.card}><Text style={styles.cardTitle}>Suggested next steps</Text>{analysis.recommendations.slice(0, 3).map((item) => <Text key={item} style={styles.bullet}>• {item}</Text>)}</View> : null}
      {analysis.evidence.length > 0 ? <Text style={styles.evidence}>Based on {analysis.evidence.length} verified {analysis.evidence.length === 1 ? "calculation" : "sources"}{analysis.dataFreshness.lastUpdated ? ` · updated ${analysis.dataFreshness.lastUpdated}` : ""}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: appSpacing.md, gap: appSpacing.sm },
  headingRow: { flexDirection: "row", alignItems: "center", gap: appSpacing.sm },
  headingIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: appColors.primarySoft, alignItems: "center", justifyContent: "center" },
  headingIconText: { color: appColors.primary, fontSize: 20, fontWeight: "800" },
  headingCopy: { flex: 1 },
  title: { color: appColors.textPrimary, fontSize: 18, fontWeight: "800" },
  period: { color: appColors.textMuted, fontSize: 12, marginTop: 2 },
  summary: { color: appColors.textPrimary, fontSize: 16, lineHeight: 23, fontWeight: "700" },
  detail: { color: appColors.textSecondary, fontSize: 13, lineHeight: 18 },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: appSpacing.sm },
  metric: { flexGrow: 1, flexBasis: "45%", minWidth: "45%", padding: 12, borderRadius: appRadii.control, backgroundColor: appColors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: appColors.border },
  metricLabel: { color: appColors.textMuted, fontSize: 12 },
  metricValue: { color: appColors.textPrimary, fontSize: 16, fontWeight: "800", marginTop: 4 },
  comparison: { fontSize: 11, marginTop: 3, color: appColors.textMuted },
  positive: { color: appColors.primary },
  attention: { color: appColors.warning },
  card: { padding: 14, borderRadius: appRadii.control, backgroundColor: appColors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: appColors.border },
  cardTitle: { color: appColors.textPrimary, fontSize: 14, fontWeight: "800", marginBottom: 8 },
  chartRow: { marginTop: 6 },
  chartLabelRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  chartLabel: { color: appColors.textSecondary, fontSize: 13, flex: 1 },
  chartAmount: { color: appColors.textPrimary, fontSize: 13, fontWeight: "700" },
  track: { height: 7, borderRadius: 4, backgroundColor: appColors.surfaceMuted, marginTop: 5, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 4, backgroundColor: appColors.primary },
  tableRow: { paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: appColors.border },
  tablePrimary: { color: appColors.textPrimary, fontSize: 13, fontWeight: "700" },
  tableSecondary: { color: appColors.textSecondary, fontSize: 12, marginTop: 3 },
  bullet: { color: appColors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 4 },
  evidence: { color: appColors.textMuted, fontSize: 11, lineHeight: 16 },
});
