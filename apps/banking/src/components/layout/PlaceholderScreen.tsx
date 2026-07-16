import { StyleSheet, Text, View } from "react-native";

import { Screen } from "@/src/components/layout/Screen";
import { colors, typography } from "@/src/theme";

type PlaceholderScreenProps = {
  title: string;
};

export function PlaceholderScreen({ title }: PlaceholderScreenProps) {
  return (
    <Screen>
      <View style={styles.center}>
        <Text style={styles.title}>{title}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    ...typography.sectionTitle,
    color: colors.textPrimary,
  },
});
