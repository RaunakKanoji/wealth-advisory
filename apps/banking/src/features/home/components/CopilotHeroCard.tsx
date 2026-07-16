import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";

import { Button } from "@/src/components/ui/Button";
import { Text } from "@/src/components/ui/Text";
import { colors, radius, spacing } from "@/src/theme";

type CopilotHeroCardProps = {
  title: string;
  subtitle: string;
  body: string;
  cta: string;
  onPress: () => void;
};

// Hero promotion for the wealth copilot (IDBI reference: the gradient
// "Wealth Coach" card with an orange CTA). Both gradient stops keep white
// copy above 7:1 — verified in theme/contrast.test.ts.
export function CopilotHeroCard({ title, subtitle, body, cta, onPress }: CopilotHeroCardProps) {
  return (
    <LinearGradient
      colors={colors.gradientHero}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <View style={styles.copy}>
        <Text variant="sectionTitle" color={colors.textInverse}>
          {title}
        </Text>
        <Text variant="cardTitle" color={colors.textInverse}>
          {subtitle}
        </Text>
        <Text variant="supporting" color={colors.brandPrimarySoft}>
          {body}
        </Text>
      </View>
      <Button label={cta} variant="accent" onPress={onPress} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  copy: {
    gap: spacing.xs,
  },
});
