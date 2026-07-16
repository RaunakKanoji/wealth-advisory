import { Children } from "react";
import type { PropsWithChildren, ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { useBreakpoint } from "@/src/hooks/useBreakpoint";
import { spacing } from "@/src/theme";
import type { SpacingToken } from "@/src/theme";

const DEFAULT_COLUMNS_BY_BREAKPOINT = {
  compact: 1,
  medium: 2,
  expanded: 3,
} as const;

type ResponsiveGridProps = PropsWithChildren<{
  gap?: SpacingToken;
  columns?: Partial<typeof DEFAULT_COLUMNS_BY_BREAKPOINT>;
}>;

export function ResponsiveGrid({ children, gap = "md", columns }: ResponsiveGridProps) {
  const breakpoint = useBreakpoint();
  const columnCount =
    columns?.[breakpoint] ?? DEFAULT_COLUMNS_BY_BREAKPOINT[breakpoint];
  const gapValue = spacing[gap];
  const items = Children.toArray(children) as ReactNode[];

  return (
    <View style={[styles.grid, { marginHorizontal: -gapValue / 2 }]}>
      {items.map((child, index) => (
        <View
          key={index}
          style={{
            width: `${100 / columnCount}%`,
            paddingHorizontal: gapValue / 2,
            marginBottom: gapValue,
          }}
        >
          {child}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
});
