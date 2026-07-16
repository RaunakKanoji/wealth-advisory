import { Alert, StyleSheet } from "react-native";

import { DetailHeader } from "@/src/components/navigation/DetailHeader";
import { PageContainer } from "@/src/components/layout/PageContainer";
import { Row } from "@/src/components/layout/Row";
import { Screen } from "@/src/components/layout/Screen";
import { Stack } from "@/src/components/layout/Stack";
import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import { Card } from "@/src/components/ui/Card";
import { Chip } from "@/src/components/ui/Chip";
import { Text } from "@/src/components/ui/Text";
import { RECOMMENDATIONS_WIREFRAME } from "@/src/features/recommendations/wireframe/recommendations.fixture";
import { colors, spacing } from "@/src/theme";

const data = RECOMMENDATIONS_WIREFRAME;

// Recommendations detail wireframe (demo: explainable guidance). Composition and
// navigation only — every item is static placeholder content from
// recommendations.fixture.ts. The theme is explainability: each card leads with
// a "why", and the "Review" action is a placeholder, nothing is executed here.
export function RecommendationsScreen() {
  const handleReview = () => {
    Alert.alert("Review recommendation", "Not available in this preview.");
  };

  return (
    <Screen scroll>
      <DetailHeader title="Recommendations" />
      <PageContainer>
        <Stack gap="lg" style={styles.content}>
          <Text variant="supporting" color={colors.textSecondary}>
            Guidance based on your profile — always explained.
          </Text>

          {data.recommendations.map((rec) => (
            <Card key={rec.id}>
              <Stack gap="sm">
                <Row gap="sm" wrap>
                  <Badge label={`${rec.priorityLabel} priority`} tone={rec.priorityTone} />
                  <Chip label={rec.category} />
                </Row>

                <Text variant="cardTitle">{rec.title}</Text>

                <Stack gap="xxs">
                  <Text variant="caption" color={colors.textSecondary}>
                    Why this
                  </Text>
                  <Text variant="supporting" color={colors.textSecondary}>
                    {rec.why}
                  </Text>
                </Stack>

                <Stack gap="xxs">
                  <Text variant="caption" color={colors.textSecondary}>
                    Suggested action
                  </Text>
                  <Text variant="body">{rec.action}</Text>
                </Stack>

                <Button label="Review" variant="secondary" onPress={handleReview} />
              </Stack>
            </Card>
          ))}

          <Text variant="caption" color={colors.textSecondary} style={styles.note}>
            These are guidance only, chosen to explain the reasoning behind each
            suggestion. Nothing is acted on or executed automatically — you stay
            in control of every decision.
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
  note: {
    paddingTop: spacing.xs,
  },
});
