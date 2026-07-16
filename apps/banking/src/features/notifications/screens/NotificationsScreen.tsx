import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { DetailHeader } from "@/src/components/navigation/DetailHeader";
import { PageContainer } from "@/src/components/layout/PageContainer";
import { Row } from "@/src/components/layout/Row";
import { Screen } from "@/src/components/layout/Screen";
import { Section } from "@/src/components/layout/Section";
import { Stack } from "@/src/components/layout/Stack";
import { EmptyState } from "@/src/components/feedback/EmptyState";
import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import { Card } from "@/src/components/ui/Card";
import { Icon } from "@/src/components/ui/Icon";
import { Text } from "@/src/components/ui/Text";
import { NOTIFICATIONS_WIREFRAME } from "@/src/features/notifications/wireframe/notifications.fixture";
import type { NotificationItem } from "@/src/features/notifications/wireframe/notifications.fixture";
import { colors, spacing } from "@/src/theme";

const data = NOTIFICATIONS_WIREFRAME;

// Notifications detail wireframe (demo: alerts inbox). Composition and a single
// visual toggle only — every item is static placeholder content from
// notifications.fixture.ts, nothing is fetched, marked read, or dismissed here.
export function NotificationsScreen() {
  // Local, visual-only toggle to preview the empty ("all caught up") state.
  const [showEmpty, setShowEmpty] = useState(false);

  const newItems = data.notifications.filter((item) => item.unread);
  const earlierItems = data.notifications.filter((item) => !item.unread);

  // Unread is signalled by the "New" Badge AND a left accent border; read items
  // drop the accent and sit on the muted background surface. Colour is never the
  // only cue — the badge text carries the state for screen readers.
  const renderCard = (item: NotificationItem) => (
    <Card key={item.id} style={item.unread ? styles.unreadCard : styles.readCard}>
      <Row gap="sm" align="flex-start">
        <Icon name={item.icon} color={item.unread ? colors.brandPrimary : colors.textMuted} />
        <Stack gap="xxs" style={styles.flex}>
          <Row justify="space-between" align="flex-start" gap="sm">
            <Text variant="cardTitle" style={styles.flex}>
              {item.title}
            </Text>
            {item.unread ? <Badge label="New" tone="primary" /> : null}
          </Row>
          <Text variant="supporting" color={colors.textSecondary}>
            {item.body}
          </Text>
          <Text variant="caption" color={colors.textSecondary}>
            {item.time}
          </Text>
        </Stack>
      </Row>
    </Card>
  );

  return (
    <Screen scroll>
      <DetailHeader title="Notifications" />
      <PageContainer>
        <Stack gap="xl" style={styles.content}>
          <Button
            label={showEmpty ? "Show notifications" : "Preview empty state"}
            variant="secondary"
            onPress={() => setShowEmpty((previous) => !previous)}
          />

          {showEmpty ? (
            <View style={styles.emptyWrap}>
              <EmptyState message="You're all caught up" />
            </View>
          ) : (
            <Stack gap="xl">
              {newItems.length > 0 ? (
                <Section title="New">{newItems.map(renderCard)}</Section>
              ) : null}
              {earlierItems.length > 0 ? (
                <Section title="Earlier">{earlierItems.map(renderCard)}</Section>
              ) : null}
            </Stack>
          )}
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
  unreadCard: {
    borderLeftWidth: 3,
    borderLeftColor: colors.brandPrimary,
  },
  readCard: {
    backgroundColor: colors.background,
  },
  emptyWrap: {
    minHeight: 320,
  },
});
