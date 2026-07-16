import { StyleSheet, View } from "react-native";

import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import { Card } from "@/src/components/ui/Card";
import { Checkbox } from "@/src/components/ui/Checkbox";
import { Text } from "@/src/components/ui/Text";
import { colors, spacing } from "@/src/theme";

// Deliberately does not accept a ConsentCategory domain object directly —
// only the fields this card actually renders, so the UI layer stays
// decoupled from the domain model shape.
type ConsentCategoryCardProps = {
  title: string;
  summary: string;
  required: boolean;
  selected: boolean;
  onToggle: () => void;
  onViewDetails: () => void;
};

export function ConsentCategoryCard({
  title,
  summary,
  required,
  selected,
  onToggle,
  onViewDetails,
}: ConsentCategoryCardProps) {
  return (
    <Card>
      <View style={styles.header}>
        <View style={styles.titleGroup}>
          <View style={styles.titleRow}>
            <Text variant="cardTitle">{title}</Text>
            <Badge label={required ? "Required" : "Optional"} tone={required ? "primary" : "neutral"} />
          </View>
          <Text variant="supporting" color={colors.textSecondary}>
            {summary}
          </Text>
        </View>
        <Checkbox
          checked={selected}
          onChange={onToggle}
          disabled={required}
          accessibilityLabel={`${title}${required ? ", required" : ""}`}
        />
      </View>
      <Button label="View details" variant="ghost" onPress={onViewDetails} />
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  titleGroup: {
    flex: 1,
    gap: spacing.xs,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
});
