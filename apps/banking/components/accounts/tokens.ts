import { appColors } from "@/components/theme/tokens";

export const accountColors = {
  background: appColors.background,
  surface: appColors.surface,
  surfaceMuted: appColors.surfaceMuted,
  textPrimary: appColors.textPrimary,
  textSecondary: appColors.textSecondary,
  textMuted: appColors.textMuted,
  brandGreen: appColors.primary,
  brandGreenDark: appColors.primaryPressed,
  featuredGreen: appColors.primaryPressed,
  brandGreenSoft: appColors.primarySoft,
  brandGreenBorder: appColors.primaryBorder,
  brandOrange: appColors.orangeAccent,
  brandOrangeDark: appColors.orangeText,
  brandOrangeSoft: appColors.warningSoft,
  border: appColors.border,
  divider: appColors.divider,
  iconMuted: appColors.iconMuted,
  warning: appColors.warning,
  danger: appColors.danger,
  dangerSoft: appColors.dangerSoft,
} as const;

export const softCardShadow = {
  shadowColor: "#111827",
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.04,
  shadowRadius: 24,
  elevation: 2,
} as const;
