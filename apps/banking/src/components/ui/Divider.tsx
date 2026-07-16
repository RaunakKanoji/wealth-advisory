import { StyleSheet, View } from "react-native";

import { colors } from "@/src/theme";

type DividerProps = {
  spacing?: number;
};

export function Divider({ spacing: marginVertical = 0 }: DividerProps) {
  return <View style={[styles.divider, { marginVertical }]} />;
}

const styles = StyleSheet.create({
  divider: {
    height: StyleSheet.hairlineWidth,
    width: "100%",
    backgroundColor: colors.border,
  },
});
