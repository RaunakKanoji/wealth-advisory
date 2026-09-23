/**
 * IDBI visual foundation.
 *
 * Keep feature components semantic: use brandGreen for actions, not for a
 * transaction's financial meaning; use orangeAccent for shortcut icons, not
 * as a generic error colour.
 */
export const appColors = {
  primary: "#008764",
  primaryPressed: "#006B52",
  primarySoft: "#E6F3EF",
  primaryBorder: "#C8E3DB",
  background: "#F7F8FA",
  surface: "#FFFFFF",
  surfaceMuted: "#F3F4F6",
  textPrimary: "#111827",
  textBody: "#374151",
  textSecondary: "#6B7280",
  textMuted: "#9CA3AF",
  border: "#E8EDF0",
  divider: "#EDF0F2",
  orangeAccent: "#FF8500",
  orangeText: "#B45309",
  success: "#087443",
  successSoft: "#E8F6EF",
  warning: "#9A6112",
  warningSoft: "#FFF5E6",
  danger: "#A62B32",
  dangerSoft: "#FDECEC",
  info: "#2563EB",
  infoSoft: "#EFF6FF",
  focus: "#0E7490",
  disabled: "#D1D5DB",
  iconMuted: "#9CA3AF",
  skeleton: "#E5E7EB",
} as const;

export const appSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
  display: 48,
} as const;

export const appRadii = {
  small: 8,
  control: 12,
  medium: 16,
  tile: 18,
  card: 20,
  hero: 24,
  round: 999,
} as const;

export const appTypography = {
  pageTitle: { fontSize: 28, lineHeight: 36, fontWeight: "700" as const },
  sectionTitle: { fontSize: 20, lineHeight: 27, fontWeight: "700" as const },
  cardTitle: { fontSize: 18, lineHeight: 25, fontWeight: "600" as const },
  body: { fontSize: 16, lineHeight: 24, fontWeight: "400" as const },
  supporting: { fontSize: 14, lineHeight: 20, fontWeight: "400" as const },
  metadata: { fontSize: 12, lineHeight: 17, fontWeight: "400" as const },
  amount: { fontSize: 20, lineHeight: 27, fontWeight: "700" as const },
  heroAmount: { fontSize: 34, lineHeight: 42, fontWeight: "700" as const },
  button: { fontSize: 16, lineHeight: 22, fontWeight: "600" as const },
} as const;

export const appShadows = {
  surface: {
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 24,
    elevation: 2,
  },
  hero: {
    shadowColor: "#0E3228",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.14,
    shadowRadius: 36,
    elevation: 7,
  },
  navigation: {
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 7,
  },
} as const;

export const appMotion = {
  press: 140,
  standard: 180,
  emphasis: 220,
  refreshRotation: 850,
} as const;

export type AppColor = keyof typeof appColors;
