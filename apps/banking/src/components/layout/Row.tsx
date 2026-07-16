import type { PropsWithChildren } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { View } from "react-native";

import { spacing } from "@/src/theme";
import type { SpacingToken } from "@/src/theme";

type RowProps = PropsWithChildren<{
  gap?: SpacingToken;
  align?: ViewStyle["alignItems"];
  justify?: ViewStyle["justifyContent"];
  wrap?: boolean;
  style?: StyleProp<ViewStyle>;
}>;

export function Row({
  children,
  gap = "sm",
  align = "center",
  justify,
  wrap = false,
  style,
}: RowProps) {
  return (
    <View
      style={[
        {
          flexDirection: "row",
          gap: spacing[gap],
          alignItems: align,
          justifyContent: justify,
          flexWrap: wrap ? "wrap" : "nowrap",
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
