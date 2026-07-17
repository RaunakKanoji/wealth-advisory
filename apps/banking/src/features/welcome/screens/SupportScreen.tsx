import { useRouter } from "expo-router";
import { Alert, StyleSheet } from "react-native";

import { PageContainer } from "@/src/components/layout/PageContainer";
import { Row } from "@/src/components/layout/Row";
import { Screen } from "@/src/components/layout/Screen";
import { Section } from "@/src/components/layout/Section";
import { Stack } from "@/src/components/layout/Stack";
import { Button } from "@/src/components/ui/Button";
import { Card } from "@/src/components/ui/Card";
import { Heading } from "@/src/components/ui/Heading";
import { Icon } from "@/src/components/ui/Icon";
import { IconButton } from "@/src/components/ui/IconButton";
import { Text } from "@/src/components/ui/Text";
import { PUBLIC_CONTENT_WIREFRAME } from "@/src/features/welcome/wireframe/publicContent.fixture";
import { colors, spacing } from "@/src/theme";

const data = PUBLIC_CONTENT_WIREFRAME;

// Placeholder used for every contact action — this preview cannot actually
// place a call, send mail, or open a map, so each control just acknowledges.
function showPreviewNotice() {
  Alert.alert("Contact", "Not available in this preview.");
}

// Public Support shell (demo: pre-auth help). No authenticated navigation —
// contacts, FAQs, and hours are static placeholder content from
// publicContent.fixture.ts; the action buttons only show a preview notice.
export function SupportScreen() {
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
                router.canGoBack() ? router.back() : router.replace("/(auth)")
              }
            />
            <Text variant="caption" color={colors.brandPrimary}>
              IDBI WEALTH ADVISORY
            </Text>
          </Row>

          <Heading level="pageTitle">Support</Heading>

          {/* Contact options */}
          <Section title="Ways to reach us">
            {data.support.contacts.map((contact) => (
              <Card key={contact.id}>
                <Stack gap="md">
                  <Row gap="sm" align="flex-start">
                    <Icon name={contact.icon} color={colors.brandPrimary} />
                    <Stack gap="xxs" style={styles.flex}>
                      <Text variant="caption" color={colors.textSecondary}>
                        {contact.label}
                      </Text>
                      <Text variant="cardTitle">{contact.value}</Text>
                    </Stack>
                  </Row>
                  <Button
                    label={`Contact via ${contact.label}`}
                    variant="secondary"
                    onPress={showPreviewNotice}
                  />
                </Stack>
              </Card>
            ))}
          </Section>

          {/* Frequently asked questions */}
          <Section title="Frequently asked questions">
            {data.support.faqs.map((faq) => (
              <Stack key={faq.id} gap="xxs">
                <Text variant="cardTitle">{faq.q}</Text>
                <Text variant="body" color={colors.textSecondary}>
                  {faq.a}
                </Text>
              </Stack>
            ))}
          </Section>

          <Text variant="supporting" color={colors.textSecondary}>
            {data.support.hours}
          </Text>

          <Button
            label="Back to welcome"
            variant="ghost"
            onPress={() => router.replace("/(auth)")}
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
  flex: {
    flex: 1,
  },
});
