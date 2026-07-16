import type { PropsWithChildren } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { View } from "react-native";

import { spacing } from "@/src/theme";
import type { SpacingToken } from "@/src/theme";

type StackProps = PropsWithChildren<{
  gap?: SpacingToken;
  align?: ViewStyle["alignItems"];
  style?: StyleProp<ViewStyle>;
}>;

export function Stack({ children, gap = "md", align, style }: StackProps) {
  return (
    <View
      style={[
        { flexDirection: "column", gap: spacing[gap], alignItems: align },
        style,
      ]}
    >
      {children}
    </View>
  );
}
