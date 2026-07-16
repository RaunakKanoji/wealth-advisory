import { Alert, Modal, ScrollView, StyleSheet, View } from "react-native";

import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import { Divider } from "@/src/components/ui/Divider";
import { Heading } from "@/src/components/ui/Heading";
import { Text } from "@/src/components/ui/Text";
import type { ConsentCategory } from "@/src/features/consent/models/consent";
import { colors, radius, spacing } from "@/src/theme";

function handlePolicyPress() {
  Alert.alert("Disclosure", "The full policy document is not yet available in this preview.");
}

type ConsentDetailsProps = {
  category: ConsentCategory | null;
  onClose: () => void;
  onToggle: () => void;
};

// A modal presentation (react-native's built-in Modal, no new dependency)
// stands in for a bottom sheet — the demo's more-sheet.tsx pattern was
// catalogued as Reference-only; a full gesture-driven bottom sheet primitive
// is out of scope for this task.
export function ConsentDetails({ category, onClose, onToggle }: ConsentDetailsProps) {
  return (
    <Modal
      visible={category !== null}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {category ? (
            <ScrollView contentContainerStyle={styles.content}>
              <View style={styles.headerRow}>
                <Heading level="sectionTitle">{category.title}</Heading>
                <Badge
                  label={category.required ? "Required" : "Optional"}
                  tone={category.required ? "primary" : "neutral"}
                />
              </View>

              <Text variant="body" color={colors.textSecondary}>
                {category.summary}
              </Text>

              <Divider spacing={spacing.sm} />

              <View style={styles.section}>
                <Text variant="cardTitle">Purpose</Text>
                {category.purposes.map((purpose) => (
                  <Text key={purpose} variant="supporting" color={colors.textSecondary}>
                    {"•"} {purpose}
                  </Text>
                ))}
              </View>

              <View style={styles.section}>
                <Text variant="cardTitle">If you decline</Text>
                <Text variant="supporting" color={colors.textSecondary}>
                  {category.required
                    ? "This permission is required for the wealth advisory service to function and cannot be declined."
                    : "Recommendations and insights that depend on this information will be limited or unavailable. You can grant this permission later from consent settings."}
                </Text>
              </View>

              <View style={styles.section}>
                <Text variant="caption" color={colors.textSecondary}>
                  Policy version {category.policyVersion}
                </Text>
                <Button
                  label="Read the full disclosure"
                  variant="ghost"
                  onPress={handlePolicyPress}
                />
              </View>

              <View style={styles.actions}>
                {!category.required ? (
                  <Button
                    label={category.selected ? "Remove this permission" : "Grant this permission"}
                    variant="secondary"
                    onPress={onToggle}
                  />
                ) : null}
                <Button label="Close" variant="primary" onPress={onClose} />
              </View>
            </ScrollView>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(20, 32, 29, 0.4)",
  },
  sheet: {
    maxHeight: "85%",
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  section: {
    gap: spacing.xs,
  },
  actions: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
});
