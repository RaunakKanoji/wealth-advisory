import { Alert, StyleSheet } from "react-native";

import { PageContainer } from "@/src/components/layout/PageContainer";
import { Row } from "@/src/components/layout/Row";
import { Screen } from "@/src/components/layout/Screen";
import { Section } from "@/src/components/layout/Section";
import { Stack } from "@/src/components/layout/Stack";
import { DetailHeader } from "@/src/components/navigation/DetailHeader";
import { Card } from "@/src/components/ui/Card";
import { Icon } from "@/src/components/ui/Icon";
import { Text } from "@/src/components/ui/Text";
import { SETTINGS_WIREFRAME } from "@/src/features/settings/wireframe/settings.fixture";
import { colors, spacing } from "@/src/theme";

const data = SETTINGS_WIREFRAME;

// Settings detail wireframe (demo: grouped preferences). Composition and
// navigation only — every group and row is static placeholder content from
// settings.fixture.ts. No preference is read, written or persisted here; each
// row is a not-available placeholder so the layout can be reviewed in isolation.
export function SettingsScreen() {
  const notAvailable = (label: string) =>
    Alert.alert(label, "Not available in this preview.");

  return (
    <Screen scroll>
      <DetailHeader title="Settings" />
      <PageContainer>
        <Stack gap="xl" style={styles.content}>
          <Text variant="supporting" color={colors.textSecondary}>
            Manage how the app looks, alerts you and protects your data.
          </Text>

          {data.groups.map((group) => (
            <Section key={group.id} title={group.title}>
              {group.items.map((item) => (
                <Card
                  key={item.id}
                  onPress={() => notAvailable(item.label)}
                  accessibilityLabel={
                    item.value ? `${item.label}, ${item.value}` : item.label
                  }
                >
                  <Row justify="space-between" gap="md">
                    <Row gap="sm" style={styles.flex}>
                      <Icon name={item.icon} color={colors.brandPrimary} />
                      <Text variant="cardTitle" style={styles.flex}>
                        {item.label}
                      </Text>
                    </Row>
                    <Row gap="sm">
                      {item.value ? (
                        <Text variant="supporting" color={colors.textSecondary}>
                          {item.value}
                        </Text>
                      ) : null}
                      {/* Decorative "drill in" chevron — the Card carries the label. */}
                      <Text
                        variant="body"
                        color={colors.textSecondary}
                        importantForAccessibility="no"
                      >
                        ›
                      </Text>
                    </Row>
                  </Row>
                </Card>
              ))}
            </Section>
          ))}

          <Text variant="caption" color={colors.textSecondary} style={styles.note}>
            Preview only — these controls are illustrative and do not change any
            real setting.
          </Text>
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
  note: {
    paddingTop: spacing.xs,
  },
});
