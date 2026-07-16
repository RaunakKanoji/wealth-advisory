import { Alert, StyleSheet } from "react-native";

import { PageContainer } from "@/src/components/layout/PageContainer";
import { Row } from "@/src/components/layout/Row";
import { Screen } from "@/src/components/layout/Screen";
import { Section } from "@/src/components/layout/Section";
import { Stack } from "@/src/components/layout/Stack";
import { DetailHeader } from "@/src/components/navigation/DetailHeader";
import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import { Card } from "@/src/components/ui/Card";
import { Icon } from "@/src/components/ui/Icon";
import { Text } from "@/src/components/ui/Text";
import { REPORTS_WIREFRAME } from "@/src/features/reports/wireframe/reports.fixture";
import { colors, spacing } from "@/src/theme";

const data = REPORTS_WIREFRAME;

// Reports detail wireframe (demo: statements & exports). Composition and
// navigation only — the report catalogue and recent history are static
// placeholder content from reports.fixture.ts; nothing is generated, fetched
// or downloaded here. Every action shows a not-available placeholder.
export function ReportsScreen() {
  const notAvailable = (title: string) =>
    Alert.alert(title, "Not available in this preview.");

  return (
    <Screen scroll>
      <DetailHeader title="Reports" />
      <PageContainer>
        <Stack gap="xl" style={styles.content}>
          <Button
            label="Generate a report"
            onPress={() => notAvailable("Generate a report")}
          />

          {/* Report catalogue */}
          <Section title="Report types">
            {data.reportTypes.map((report) => (
              <Card key={report.id}>
                <Stack gap="sm">
                  <Row gap="sm">
                    <Icon name={report.icon} color={colors.brandPrimary} />
                    <Text variant="cardTitle" style={styles.flex}>
                      {report.title}
                    </Text>
                  </Row>
                  <Text variant="supporting" color={colors.textSecondary}>
                    {report.description}
                  </Text>
                  <Button
                    label="Generate"
                    variant="secondary"
                    onPress={() => notAvailable("Generate report")}
                  />
                </Stack>
              </Card>
            ))}
          </Section>

          {/* Recent reports history */}
          <Section title="Recent reports">
            {data.recent.map((report) => {
              const isReady = report.status === "ready";
              const row = (
                <Row justify="space-between">
                  <Stack gap="xxs" style={styles.flex}>
                    <Text variant="cardTitle">{report.title}</Text>
                    <Text variant="caption" color={colors.textSecondary}>
                      {report.date}
                    </Text>
                  </Stack>
                  <Badge label={report.statusLabel} tone={report.statusTone} />
                </Row>
              );

              return isReady ? (
                <Card
                  key={report.id}
                  onPress={() => notAvailable("Open report")}
                  accessibilityLabel={`${report.title}, ${report.statusLabel}. Open report.`}
                >
                  {row}
                </Card>
              ) : (
                <Card key={report.id}>{row}</Card>
              );
            })}
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
  flex: {
    flex: 1,
  },
});
