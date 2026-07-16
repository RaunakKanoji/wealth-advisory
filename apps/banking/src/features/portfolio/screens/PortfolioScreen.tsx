import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { AppHeader } from "@/src/components/navigation/AppHeader";
import { PageContainer } from "@/src/components/layout/PageContainer";
import { Row } from "@/src/components/layout/Row";
import { Screen } from "@/src/components/layout/Screen";
import { Section } from "@/src/components/layout/Section";
import { Stack } from "@/src/components/layout/Stack";
import { Badge } from "@/src/components/ui/Badge";
import { Card } from "@/src/components/ui/Card";
import { Chip } from "@/src/components/ui/Chip";
import { Divider } from "@/src/components/ui/Divider";
import { ProgressBar } from "@/src/components/ui/ProgressBar";
import { Text } from "@/src/components/ui/Text";
import { PORTFOLIO_WIREFRAME } from "@/src/features/portfolio/wireframe/portfolio.fixture";
import { colors, spacing } from "@/src/theme";

const data = PORTFOLIO_WIREFRAME;

// Portfolio tab wireframe (demo: holdings overview). Composition and a single
// visual chip selection only — every figure is static placeholder content from
// portfolio.fixture.ts, nothing is fetched or calculated here.
export function PortfolioScreen() {
  // Visual-only selection for the performance period Chips (no data changes).
  const [selectedPeriod, setSelectedPeriod] = useState(data.performance.periods[0].id);

  const selected =
    data.performance.periods.find((period) => period.id === selectedPeriod) ??
    data.performance.periods[0];

  // Plain-text allocation summary so color is never the only signal (a11y).
  const allocationSummary = data.allocation
    .map((slice) => `${slice.label} ${slice.percent}%`)
    .join(", ");

  return (
    <Screen scroll>
      <AppHeader />
      <PageContainer>
        <Stack gap="xl" style={styles.content}>
          {/* Total portfolio value */}
          <Card>
            <Stack gap="xxs">
              <Text variant="financialValueLabel" color={colors.textSecondary}>
                Total portfolio value
              </Text>
              <Text variant="financialValue">{data.totalValue}</Text>
              <Badge label={data.change} tone={data.changeTone} />
            </Stack>
          </Card>

          {/* Allocation "chart" — labelled rows with a plain-text summary */}
          <Section title="Allocation">
            <Card>
              <Stack gap="md">
                <Stack gap="sm">
                  {data.allocation.map((slice, index) => (
                    <Stack key={slice.label} gap="xxs">
                      <Row justify="space-between">
                        <Text variant="caption" color={colors.textSecondary}>
                          {slice.label}
                        </Text>
                        <Text variant="caption" color={colors.textSecondary}>
                          {slice.percent}%
                        </Text>
                      </Row>
                      <ProgressBar
                        value={slice.percent}
                        tint={colors.chart[index % colors.chart.length]}
                        accessibilityLabel={`${slice.label} ${slice.percent} percent of portfolio`}
                      />
                    </Stack>
                  ))}
                </Stack>
                <Text variant="caption" color={colors.textSecondary}>
                  Allocation: {allocationSummary}.
                </Text>
              </Stack>
            </Card>
          </Section>

          {/* Holdings preview */}
          <Section title="Holdings">
            <Card>
              <Stack gap="sm">
                {data.holdings.map((holding, index) => (
                  <View key={holding.id}>
                    {index > 0 ? <Divider spacing={spacing.sm} /> : null}
                    <Row justify="space-between" align="flex-start">
                      <Stack gap="xxs" style={styles.flex}>
                        <Text variant="cardTitle">{holding.name}</Text>
                        <Text variant="caption" color={colors.textSecondary}>
                          {holding.detail}
                        </Text>
                      </Stack>
                      <Stack gap="xxs" align="flex-end">
                        <Text variant="cardTitle">{holding.value}</Text>
                        <Badge label={holding.change} tone={holding.changeTone} />
                      </Stack>
                    </Row>
                  </View>
                ))}
              </Stack>
            </Card>
          </Section>

          {/* Performance placeholder — period Chips + static return line */}
          <Section title="Performance">
            <Card>
              <Stack gap="md">
                <Row gap="sm" wrap>
                  {data.performance.periods.map((period) => (
                    <Chip
                      key={period.id}
                      label={period.label}
                      selected={period.id === selectedPeriod}
                      onPress={() => setSelectedPeriod(period.id)}
                    />
                  ))}
                </Row>
                <Text variant="body" color={colors.textSecondary}>
                  {selected.returnLabel}
                </Text>
              </Stack>
            </Card>
          </Section>

          {/* Diversification insight */}
          <Card>
            <Stack gap="sm">
              <Badge label={data.insight.badge} tone={data.insight.tone} />
              <Text variant="cardTitle">{data.insight.title}</Text>
              <Text variant="supporting" color={colors.textSecondary}>
                {data.insight.body}
              </Text>
            </Stack>
          </Card>
        </Stack>
      </PageContainer>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingVertical: spacing.xl,
  },
  flex: {
    flex: 1,
  },
});
