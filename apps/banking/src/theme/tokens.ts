import { breakpoints } from "@/src/theme/breakpoints";
import { colors } from "@/src/theme/colors";
import { motion } from "@/src/theme/motion";
import { radius } from "@/src/theme/radius";
import { shadows } from "@/src/theme/shadows";
import { spacing } from "@/src/theme/spacing";
import { typography } from "@/src/theme/typography";

export const theme = {
  colors,
  typography,
  spacing,
  radius,
  shadows,
  motion,
  breakpoints,
} as const;

export type Theme = typeof theme;
