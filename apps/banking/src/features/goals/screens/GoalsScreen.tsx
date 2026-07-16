import { Alert, StyleSheet, View } from "react-native";

import { AppHeader } from "@/src/components/navigation/AppHeader";
import { PageContainer } from "@/src/components/layout/PageContainer";
import { Row } from "@/src/components/layout/Row";
import { Screen } from "@/src/components/layout/Screen";
import { Section } from "@/src/components/layout/Section";
import { Stack } from "@/src/components/layout/Stack";
import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import { Card } from "@/src/components/ui/Card";
import { Chip } from "@/src/components/ui/Chip";
import { Heading } from "@/src/components/ui/Heading";
import { ProgressBar } from "@/src/components/ui/ProgressBar";
import { Text } from "@/src/components/ui/Text";
import { EmptyState } from "@/src/components/feedback/EmptyState";
import { GOALS_WIREFRAME } from "@/src/features/goals/wireframe/goals.fixture";
import { colors, spacing } from "@/src/theme";

const data = GOALS_WIREFRAME;

function handleAddGoal() {
  Alert.alert("Add goal", "Not available in this preview.");
}

function handleGoalPress() {
  Alert.alert("Goal detail", "Not available in this preview.");
}

// Goals tab wireframe (demo: goals overview). Composition and navigation only —
// every figure is static placeholder content from goals.fixture.ts, nothing is
// fetched or calculated here.
export function GoalsScreen() {
  return (
    <Screen scroll>
      <AppHeader />
      <PageContainer>
        <Stack gap="xl" style={styles.content}>
          <Stack gap="xxs">
            <Text variant="supporting" color={colors.textSecondary}>
              Your goals
            </Text>
            <Heading level="pageTitle">Financial goals</Heading>
          </Stack>

          {/* Overview summary */}
          <Card>
            <Stack gap="md">
              <Stack gap="xxs">
                <Text variant="financialValueLabel" color={colors.textSecondary}>
                  Combined target
                </Text>
                <Text variant="financialValue">{data.summary.totalTargetLabel}</Text>
              </Stack>
              <Row justify="space-between" align="flex-start">
                <View style={styles.summaryItem}>
                  <Text variant="caption" color={colors.textSecondary}>
                    Total goals
                  </Text>
                  <Text variant="cardTitle">{data.summary.totalGoals}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text variant="caption" color={colors.textSecondary}>
                    On track
                  </Text>
                  <Text variant="cardTitle">{data.summary.onTrack}</Text>
                </View>
              </Row>
            </Stack>
          </Card>

          {/* Active goals list */}
          <Section title="Active goals">
            {data.goals.map((goal) => (
              <Card
                key={goal.id}
                onPress={handleGoalPress}
                accessibilityLabel={`${goal.title}, ${goal.category}. ${goal.progress}% funded, ${goal.current} of ${goal.target}. ${goal.statusLabel}. View goal detail.`}
              >
                <Stack gap="sm">
                  <Row justify="space-between" align="flex-start">
                    <Stack gap="xxs" style={styles.flex}>
                      <Text variant="cardTitle">{goal.title}</Text>
                      <Chip label={goal.category} />
                    </Stack>
                    <Badge label={goal.statusLabel} tone={goal.statusTone} />
                  </Row>
                  <ProgressBar
                    value={goal.progress}
                    accessibilityLabel={`${goal.title} ${goal.progress}% funded`}
                  />
                  <Row justify="space-between">
                    <Text variant="supporting" color={colors.textSecondary}>
                      {goal.current} of {goal.target}
                    </Text>
                    <Text variant="supporting" color={colors.textSecondary}>
                      {goal.targetDate}
                    </Text>
                  </Row>
                </Stack>
              </Card>
            ))}
            <Button label="Add goal" onPress={handleAddGoal} />
          </Section>

          {/* Empty-state pattern: no archived goals yet */}
          <Section title="Achieved goals">
            <View style={styles.emptyWrap}>
              <EmptyState
                message="You have not archived any goals yet. Completed goals will move here once you close them out."
                actionLabel="Add a goal"
                onAction={handleAddGoal}
              />
            </View>
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
  summaryItem: {
    gap: spacing.xxs,
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  emptyWrap: {
    minHeight: 200,
  },
});
