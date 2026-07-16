import { Pressable, StyleSheet, View } from "react-native";

import { Icon } from "@/src/components/ui/Icon";
import { Text } from "@/src/components/ui/Text";
import { colors, radius, shadows, spacing } from "@/src/theme";

type SelectCardProps = {
  title: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
};

// No demo equivalent (features/onboarding/ is empty) — built for immediate
// production need: a card-style single-select option, distinct from the
// demo's list-row ChoiceField pattern (ported as RadioGroup).
export function SelectCard({ title, description, selected, onPress, disabled = false }: SelectCardProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={title}
      disabled={disabled}
      onPress={onPress}
      style={[styles.card, selected && styles.cardSelected, disabled && styles.cardDisabled]}
    >
      <View style={styles.textGroup}>
        <Text variant="cardTitle">{title}</Text>
        {description ? (
          <Text variant="supporting" color={colors.textSecondary}>
            {description}
          </Text>
        ) : null}
      </View>
      {selected ? <Icon name="check" size={20} color={colors.brandPrimary} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    ...shadows.card,
  },
  cardSelected: {
    borderColor: colors.brandPrimary,
    backgroundColor: colors.brandPrimarySoft,
  },
  cardDisabled: {
    opacity: 0.5,
  },
  textGroup: {
    flex: 1,
    gap: 2,
  },
});
