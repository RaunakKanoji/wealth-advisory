import { Alert, StyleSheet, View } from "react-native";

import { AppHeader } from "@/src/components/navigation/AppHeader";
import { KeyboardScreen } from "@/src/components/layout/KeyboardScreen";
import { PageContainer } from "@/src/components/layout/PageContainer";
import { Row } from "@/src/components/layout/Row";
import { Section } from "@/src/components/layout/Section";
import { Stack } from "@/src/components/layout/Stack";
import { Avatar } from "@/src/components/ui/Avatar";
import { Button } from "@/src/components/ui/Button";
import { Card } from "@/src/components/ui/Card";
import { Chip } from "@/src/components/ui/Chip";
import { Heading } from "@/src/components/ui/Heading";
import { IconButton } from "@/src/components/ui/IconButton";
import { Text } from "@/src/components/ui/Text";
import { TextField } from "@/src/components/ui/TextField";
import { COPILOT_WIREFRAME } from "@/src/features/copilot/wireframe/copilot.fixture";
import { colors, radius, spacing } from "@/src/theme";

const data = COPILOT_WIREFRAME;

// Wealth Copilot tab wireframe (demo: conversational assistant). Layout and
// navigation only — the transcript, action offers, and prompts are static
// placeholder content from copilot.fixture.ts. No input is captured and no
// model is contacted; every control routes to a "not available" placeholder.
export function CopilotScreen() {
  const notAvailable = () => Alert.alert("Copilot", "Not available in this preview.");

  return (
    <KeyboardScreen>
      <AppHeader />
      <PageContainer>
        <Stack gap="xl" style={styles.content}>
          {/* Copilot intro */}
          <Row gap="md" align="center">
            <Avatar initials={data.copilot.initials} size="md" accessibilityLabel="Wealth copilot" />
            <Stack gap="xxs" style={styles.flex}>
              <Heading level="cardTitle">{data.copilot.name}</Heading>
              <Text variant="supporting" color={colors.textSecondary}>
                {data.copilot.tagline}
              </Text>
            </Stack>
          </Row>

          {/* Conversation transcript */}
          <Stack gap="sm">
            {data.messages.map((message) => {
              const isCustomer = message.role === "customer";
              const speaker = isCustomer ? "You" : "Copilot";
              return (
                <View
                  key={message.id}
                  accessible
                  accessibilityLabel={`${speaker}: ${message.text}`}
                  style={[styles.bubble, isCustomer ? styles.bubbleCustomer : styles.bubbleCopilot]}
                >
                  <Text variant="supporting" color={colors.textPrimary}>
                    {message.text}
                  </Text>
                </View>
              );
            })}
          </Stack>

          {/* Structured action suggestions */}
          <Section title="Suggested actions">
            <Stack gap="md">
              {data.actions.map((action) => (
                <Card key={action.id}>
                  <Stack gap="sm">
                    <Text variant="cardTitle">{action.title}</Text>
                    <Text variant="supporting" color={colors.textSecondary}>
                      {action.body}
                    </Text>
                    <Button label={action.cta} variant="secondary" onPress={notAvailable} />
                  </Stack>
                </Card>
              ))}
            </Stack>
          </Section>

          {/* Suggested prompts */}
          <Section title="Try asking">
            <Row gap="sm" wrap>
              {data.suggestedPrompts.map((prompt) => (
                <Chip key={prompt} label={prompt} onPress={notAvailable} />
              ))}
            </Row>
          </Section>

          {/* Message input */}
          <Row gap="sm" align="center">
            <View style={styles.flex}>
              <TextField placeholder="Ask your wealth copilot…" editable={false} />
            </View>
            <IconButton icon="copilot" accessibilityLabel="Send message" onPress={notAvailable} />
          </Row>
        </Stack>
      </PageContainer>
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingVertical: spacing.xl,
  },
  flex: {
    flex: 1,
  },
  bubble: {
    maxWidth: "88%",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.card,
  },
  bubbleCustomer: {
    alignSelf: "flex-end",
    backgroundColor: colors.brandPrimarySoft,
  },
  bubbleCopilot: {
    alignSelf: "flex-start",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
