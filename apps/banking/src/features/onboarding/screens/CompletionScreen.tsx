import { useUser } from "@clerk/expo";
import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { PageContainer } from "@/src/components/layout/PageContainer";
import { Row } from "@/src/components/layout/Row";
import { Screen } from "@/src/components/layout/Screen";
import { Stack } from "@/src/components/layout/Stack";
import { Button } from "@/src/components/ui/Button";
import { Heading } from "@/src/components/ui/Heading";
import { Icon } from "@/src/components/ui/Icon";
import { Text } from "@/src/components/ui/Text";
import { ONBOARDING_WIREFRAME } from "@/src/features/onboarding/wireframe/onboarding.fixture";
import { colors, radius, spacing } from "@/src/theme";

const data = ONBOARDING_WIREFRAME.completion;

// Onboarding step 3 of 3 — celebration and the real onboarding -> app
// hand-off. Completion is persisted to Clerk user metadata (unsafeMetadata —
// the client-writable slot; the bank's backoffice would set publicMetadata in
// production) so the root dispatcher skips onboarding on every future
// sign-in, then the route is replaced with the protected app shell.
export function CompletionScreen() {
  const router = useRouter();
  const { user } = useUser();
  const [isCompleting, setIsCompleting] = useState(false);

  const handleEnterDashboard = async () => {
    if (isCompleting) {
      return;
    }
    setIsCompleting(true);
    try {
      await user?.update({
        unsafeMetadata: { ...user.unsafeMetadata, onboardingStatus: "complete" },
      });
    } catch {
      // Persistence failure must not trap the customer in onboarding — the
      // dispatcher will simply route them through it again next session.
    } finally {
      setIsCompleting(false);
      router.replace("/(app)/(tabs)");
    }
  };

  return (
    <Screen scroll>
      <PageContainer>
        <Stack gap="xl" style={styles.content}>
          <Stack gap="md" align="center">
            <View style={styles.badge}>
              <Icon name="check" size={32} color={colors.brandPrimary} />
            </View>
            <Stack gap="xs" align="center">
              <Heading level="pageTitle">{data.title}</Heading>
              <Text variant="body" color={colors.textSecondary} style={styles.subtitle}>
                {data.subtitle}
              </Text>
            </Stack>
          </Stack>

          {/* What onboarding set up. The check glyph is decorative — each
              item's text label carries the status, so colour is never the
              only signal. */}
          <Stack gap="sm">
            {data.summary.map((item) => (
              <Row key={item.label} gap="sm" align="flex-start">
                <View style={styles.check}>
                  <Icon name="check" size={16} color={colors.textInverse} />
                </View>
                <Stack gap="xxs" style={styles.flex}>
                  <Text variant="cardTitle">{item.label}</Text>
                  <Text variant="supporting" color={colors.textSecondary}>
                    {item.detail}
                  </Text>
                </Stack>
              </Row>
            ))}
          </Stack>

          <Text variant="caption" color={colors.textSecondary}>
            {data.note}
          </Text>

          <Button
            label="Enter your dashboard"
            loading={isCompleting}
            onPress={handleEnterDashboard}
          />
        </Stack>
      </PageContainer>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingVertical: spacing.xxl,
  },
  badge: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: colors.brandPrimarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  subtitle: {
    textAlign: "center",
  },
  flex: {
    flex: 1,
  },
});
