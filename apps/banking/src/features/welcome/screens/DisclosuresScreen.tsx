import { useRouter } from "expo-router";
import { StyleSheet } from "react-native";

import { PageContainer } from "@/src/components/layout/PageContainer";
import { Row } from "@/src/components/layout/Row";
import { Screen } from "@/src/components/layout/Screen";
import { Section } from "@/src/components/layout/Section";
import { Stack } from "@/src/components/layout/Stack";
import { Button } from "@/src/components/ui/Button";
import { Heading } from "@/src/components/ui/Heading";
import { IconButton } from "@/src/components/ui/IconButton";
import { Text } from "@/src/components/ui/Text";
import { PUBLIC_CONTENT_WIREFRAME } from "@/src/features/welcome/wireframe/publicContent.fixture";
import { colors, spacing } from "@/src/theme";

const data = PUBLIC_CONTENT_WIREFRAME;

// Public Disclosures shell (demo: pre-auth legal/regulatory copy). No
// authenticated navigation — every section is static placeholder text from
// publicContent.fixture.ts, nothing is fetched or generated here.
export function DisclosuresScreen() {
  const router = useRouter();

  return (
    <Screen scroll>
      <PageContainer>
        <Stack gap="xl" style={styles.content}>
          {/* Public header: back control + bank identity (no tab/app header) */}
          <Row gap="sm">
            <IconButton
              icon="back"
              accessibilityLabel="Go back"
              onPress={() =>
                router.canGoBack() ? router.back() : router.replace("/(public)/welcome")
              }
            />
            <Text variant="caption" color={colors.brandPrimary}>
              IDBI WEALTH ADVISORY
            </Text>
          </Row>

          <Heading level="pageTitle">Disclosures</Heading>

          {data.disclosures.map((item) => (
            <Section key={item.id} title={item.title}>
              <Text variant="body" color={colors.textSecondary}>
                {item.body}
              </Text>
            </Section>
          ))}

          <Button
            label="Contact support"
            variant="ghost"
            onPress={() => router.push("/(public)/support")}
          />
        </Stack>
      </PageContainer>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingVertical: spacing.xl,
  },
});
