import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { Heading } from "@/src/components/ui/Heading";
import { IconButton } from "@/src/components/ui/IconButton";
import { colors, spacing } from "@/src/theme";

type DetailHeaderProps = {
  title: string;
};

// Back + title bar for authenticated detail routes that sit outside the tab
// bar (notifications, reports, recommendations, settings). Falls back to the
// tabs home if there is no screen to pop back to (e.g. deep link / dev boot).
export function DetailHeader({ title }: DetailHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(app)/(tabs)");
  };

  return (
    <View style={styles.header}>
      <IconButton icon="back" accessibilityLabel="Go back" onPress={handleBack} />
      <Heading level="sectionTitle">{title}</Heading>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});
