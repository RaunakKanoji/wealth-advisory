import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { PageContainer } from "@/src/components/layout/PageContainer";
import { Screen } from "@/src/components/layout/Screen";
import { Stack } from "@/src/components/layout/Stack";
import { Button } from "@/src/components/ui/Button";
import { Heading } from "@/src/components/ui/Heading";
import { Text } from "@/src/components/ui/Text";
import { colors, radius, spacing } from "@/src/theme";

// Decorative hero block (hi-fi reference: abstract gradient shapes on the
// onboarding screens). Pure Views — no image assets — and hidden from
// assistive tech because it carries no information.
function HeroIllustration() {
  return (
    <View
      style={styles.hero}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <LinearGradient
        colors={[colors.brandSecondary, colors.brandSecondarySoft]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.heroShape, styles.heroShapeLarge]}
      />
      <LinearGradient
        colors={[colors.brandSecondarySoft, colors.brandSecondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.heroShape, styles.heroShapeSmall]}
      />
      <View style={[styles.heroShape, styles.heroShapeGreen]} />
    </View>
  );
}

export function WelcomeScreen() {
  const router = useRouter();

  return (
    <Screen scroll>
      <PageContainer>
        <Stack gap="xl" style={styles.content}>
          <HeroIllustration />

          <Stack gap="sm">
            <Text variant="caption" color={colors.brandSecondaryStrong} style={styles.brand}>
              IDBI WEALTH ADVISORY
            </Text>
            <Heading level="display">Your finances, understood.</Heading>
            <Text variant="body" color={colors.textSecondary}>
              Understand your finances, plan your goals, and receive guidance based on your
              banking relationship and investment preferences.
            </Text>
          </Stack>

          <Stack gap="sm">
            <Text variant="supporting" color={colors.textSecondary}>
              We only use your banking information after you review and grant permission.
              You stay in control of what is shared, and you can change your choices later.
            </Text>
            <Text variant="caption" color={colors.textSecondary}>
              Your session and data are protected using bank-grade security practices.
            </Text>
          </Stack>

          <Stack gap="md">
            <Button
              label="Get started"
              variant="primary"
              onPress={() => router.push("/(auth)/sign-in")}
            />
            <Stack gap="xs" align="center">
              <Button
                label="Read our disclosures"
                variant="ghost"
                onPress={() => router.push("/(public)/disclosures")}
              />
              <Button
                label="Need help? Contact support"
                variant="ghost"
                onPress={() => router.push("/(public)/support")}
              />
            </Stack>
          </Stack>
        </Stack>
      </PageContainer>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingVertical: spacing.xxl,
  },
  brand: {
    fontWeight: "700",
    letterSpacing: 1,
  },
  hero: {
    height: 200,
    borderRadius: radius.card,
    backgroundColor: colors.brandPrimarySoft,
    overflow: "hidden",
  },
  heroShape: {
    position: "absolute",
    borderRadius: radius.card,
  },
  heroShapeLarge: {
    width: 128,
    height: 128,
    top: spacing.xl,
    left: spacing.xl,
    transform: [{ rotate: "8deg" }],
  },
  heroShapeSmall: {
    width: 72,
    height: 72,
    top: spacing.xxl,
    right: spacing.xxxl,
    transform: [{ rotate: "-12deg" }],
  },
  heroShapeGreen: {
    width: 56,
    height: 56,
    bottom: spacing.lg,
    right: spacing.xl,
    backgroundColor: colors.brandPrimary,
    transform: [{ rotate: "14deg" }],
  },
});
