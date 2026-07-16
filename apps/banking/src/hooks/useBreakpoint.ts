import { useWindowDimensions } from "react-native";

import { breakpoints } from "@/src/theme";
import type { BreakpointName } from "@/src/theme";

export function useBreakpoint(): BreakpointName {
  const { width } = useWindowDimensions();

  if (width >= breakpoints.expanded) return "expanded";
  if (width >= breakpoints.medium) return "medium";
  return "compact";
}
