import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { AppHeader } from "@/src/components/navigation/AppHeader";
import { PageContainer } from "@/src/components/layout/PageContainer";
import { Row } from "@/src/components/layout/Row";
import { Screen } from "@/src/components/layout/Screen";
import { Section } from "@/src/components/layout/Section";
import { Stack } from "@/src/components/layout/Stack";
import { Badge } from "@/src/components/ui/Badge";
import { Card } from "@/src/components/ui/Card";
import { Divider } from "@/src/components/ui/Divider";
import { Heading } from "@/src/components/ui/Heading";
import { ProgressBar } from "@/src/components/ui/ProgressBar";
import { Text } from "@/src/components/ui/Text";
import { CopilotHeroCard } from "@/src/features/home/components/CopilotHeroCard";
import { QuickActions } from "@/src/features/home/components/QuickActions";
import { HOME_WIREFRAME } from "@/src/features/home/wireframe/home.fixture";
import { colors, spacing } from "@/src/theme";

const data = HOME_WIREFRAME;

// Home dashboard wireframe (demo: overview). Composition and navigation only —
// every figure is static placeholder content from home.fixture.ts, nothing is
// fetched or calculated here.
export function HomeScreen() {
  const router = useRouter();

  const allocationSummary = data.portfolio.allocation
    .map((slice) => `${slice.label} ${slice.percent}%`)
    .join(", ");

  return (
    <Screen scroll>
      <AppHeader initials={data.initials} />
      <PageContainer>
        <Stack gap="xl" style={styles.content}>
          <Stack gap="xxs">
            <Text variant="supporting" color={colors.textSecondary}>
              {data.greeting},
            </Text>
            <Heading level="pageTitle">{data.customerName}</Heading>
          </Stack>

          {/* Total financial snapshot (IDBI reference: balance card) */}
          <Card>
            <Stack gap="md">
              <Stack gap="xxs">
                <Text variant="financialValueLabel" color={colors.textSecondary} style={styles.balanceLabel}>
                  {data.netWorth.label}
                </Text>
                <Text variant="financialValue">{data.netWorth.value}</Text>
                {/* "▲" carries the direction alongside color (never color alone). */}
                <Text variant="supporting" color={colors.success} style={styles.balanceChange}>
                  ▲ {data.netWorth.change}
                </Text>
              </Stack>
              <Divider />
              <Row justify="space-between" align="flex-start">
                {data.snapshot.map((item) => (
                  <View key={item.label} style={styles.snapshotItem}>
                    <Text variant="caption" color={colors.textSecondary}>
                      {item.label}
                    </Text>
                    <Text variant="cardTitle">{item.value}</Text>
                  </View>
                ))}
              </Row>
              <Text variant="caption" color={colors.textSecondary}>
                {data.netWorth.detail}
              </Text>
            </Stack>
          </Card>

          {/* Quick actions (IDBI reference: Scan QR / Cards / Transfer / All) */}
          <QuickActions />

          {/* Wealth copilot hero (IDBI reference: Wealth Coach card) */}
          <CopilotHeroCard
            title={data.copilotHero.title}
            subtitle={data.copilotHero.subtitle}
            body={data.copilotHero.body}
            cta={data.copilotHero.cta}
            onPress={() => router.navigate("/(app)/(tabs)/copilot")}
          />

          {/* Goal progress */}
          <Section
            title="Your top goal"
            actionLabel="View all"
            onAction={() => router.navigate("/(app)/(tabs)/goals")}
          >
            <Card
              onPress={() => router.navigate("/(app)/(tabs)/goals")}
              accessibilityLabel={`${data.goal.title}, ${data.goal.progress}% funded. View goals.`}
            >
              <Stack gap="sm">
                <Row justify="space-between">
                  <Text variant="cardTitle">{data.goal.title}</Text>
                  <Text variant="cardTitle" color={colors.brandPrimary}>
                    {data.goal.progress}%
                  </Text>
                </Row>
                <ProgressBar
                  value={data.goal.progress}
                  accessibilityLabel={`${data.goal.title} ${data.goal.progress}% funded`}
                />
                <Row justify="space-between">
                  <Text variant="supporting" color={colors.textSecondary}>
                    {data.goal.current} of {data.goal.target}
                  </Text>
                  <Text variant="supporting" color={colors.textSecondary}>
                    {data.goal.status}
                  </Text>
                </Row>
              </Stack>
            </Card>
          </Section>

          {/* Portfolio summary */}
          <Section
            title="Portfolio"
            actionLabel="View all"
            onAction={() => router.navigate("/(app)/(tabs)/portfolio")}
          >
            <Card
              onPress={() => router.navigate("/(app)/(tabs)/portfolio")}
              accessibilityLabel={`Portfolio ${data.portfolio.value}. Allocation: ${allocationSummary}. View portfolio.`}
            >
              <Stack gap="md">
                <Row justify="space-between" align="flex-end">
                  <Stack gap="xxs">
                    <Text variant="financialValueLabel" color={colors.textSecondary}>
                      Invested value
                    </Text>
                    <Text variant="sectionTitle">{data.portfolio.value}</Text>
                  </Stack>
                  <Badge label={data.portfolio.change} tone={data.portfolio.changeTone} />
                </Row>
                <Stack gap="sm">
                  {data.portfolio.allocation.map((slice, index) => (
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
              </Stack>
            </Card>
          </Section>

          {/* Advisory insight */}
          <Card>
            <Stack gap="sm">
              <Badge label={data.insight.badge} tone={data.insight.tone} />
              <Text variant="cardTitle">{data.insight.title}</Text>
              <Text variant="supporting" color={colors.textSecondary}>
                {data.insight.body}
              </Text>
            </Stack>
          </Card>

          {/* Recent report / activity */}
          <Section
            title="Recent activity"
            actionLabel="View all"
            onAction={() => router.push("/(app)/reports")}
          >
            <Card
              onPress={() => router.push("/(app)/reports")}
              accessibilityLabel={`${data.recentReport.title}, ${data.recentReport.status}. View reports.`}
            >
              <Row justify="space-between">
                <Stack gap="xxs" style={styles.flex}>
                  <Text variant="cardTitle">{data.recentReport.title}</Text>
                  <Text variant="caption" color={colors.textSecondary}>
                    {data.recentReport.date}
                  </Text>
                </Stack>
                <Badge label={data.recentReport.status} tone={data.recentReport.statusTone} />
              </Row>
            </Card>
          </Section>
        </Stack>
      </PageContainer>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingVertical: spacing.xl,
  },
  balanceLabel: {
    letterSpacing: 1,
  },
  balanceChange: {
    fontWeight: "600",
  },
  snapshotItem: {
    gap: spacing.xxs,
    flex: 1,
  },
  flex: {
    flex: 1,
  },
});
