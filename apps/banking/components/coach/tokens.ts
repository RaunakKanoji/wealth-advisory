import { appColors } from "@/components/theme/tokens";

export const coachColors = {
  background: appColors.background,
  surface: appColors.surface,
  surfaceMuted: appColors.surfaceMuted,
  textPrimary: appColors.textPrimary,
  textSecondary: appColors.textSecondary,
  textMuted: appColors.textSecondary,
  brandGreen: appColors.primary,
  brandGreenDark: appColors.primaryPressed,
  brandGreenSoft: appColors.primarySoft,
  brandGreenBorder: appColors.primaryBorder,
  brandOrange: appColors.orangeText,
  brandOrangeSoft: appColors.warningSoft,
  border: appColors.border,
  divider: appColors.divider,
  progressTrack: "#D9E7E2",
  iconMuted: appColors.iconMuted,
} as const;

export const coachSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;
