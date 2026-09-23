import { appColors } from "@/components/theme/tokens";

export const moreColors = {
  background: appColors.background,
  surface: appColors.surface,
  textPrimary: appColors.textPrimary,
  textSecondary: appColors.textSecondary,
  textMuted: appColors.textMuted,
  brandGreen: appColors.primary,
  brandGreenDark: appColors.primaryPressed,
  brandGreenSoft: appColors.primarySoft,
  brandGreenBorder: appColors.primaryBorder,
  brandOrange: appColors.orangeAccent,
  brandOrangeSoft: appColors.warningSoft,
  border: appColors.border,
  divider: appColors.divider,
  chevron: appColors.textSecondary,
} as const;

export const moreSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const moreCardShadow = {
  shadowColor: "#111827",
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.04,
  shadowRadius: 24,
  elevation: 2,
} as const;
