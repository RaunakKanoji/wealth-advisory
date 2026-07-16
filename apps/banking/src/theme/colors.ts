// Ported by value from the demo's app/globals.css @theme block (light theme
// only — the demo has no dark-mode overrides to port). Tokens not present in
// the demo (surfaceElevated, textInverse, disabled*, textSecondary as a tier
// distinct from textMuted) are reasonable extrapolations, not demo values.
//
// Contrast (WCAG 2.1 AA, ratios verified in contrast.test.ts):
// - textPrimary, textSecondary, success, error, warning, info all pass 4.5:1
//   on surface and background; textInverse passes on brandPrimary(Strong).
// - textMuted is 3.07:1 on surface / 2.85:1 on background — large text (18pt+)
//   or non-text use only; never body copy.
// - brandSecondary (orange) is 2.82:1 on surface, and textInverse on
//   brandSecondary is also 2.82:1 — decorative accents (icons, illustration,
//   gradient stops) and large text only; never small text or button labels.
// - brandSecondaryStrong is the TEXT/CTA-safe orange: 5.17:1 with textInverse
//   on it, 4.80:1 as text on background, 5.17:1 on surface — use it for solid
//   accent buttons and orange link text.
// - disabledText on disabledBackground is 2.07:1 — exempt under WCAG
//   (inactive controls), kept intentionally faint.
export const colors = {
  brandPrimary: "#0B5B4C",
  brandPrimaryStrong: "#084A3E",
  brandPrimarySoft: "#E3F0EC",
  brandSecondary: "#EE7A23",
  brandSecondaryStrong: "#B54E09",
  brandSecondarySoft: "#FDEEDD",

  background: "#F4F7F6",
  surface: "#FFFFFF",
  surfaceElevated: "#FFFFFF",

  textPrimary: "#14201D",
  textSecondary: "#55655F",
  textMuted: "#8A968F",
  textInverse: "#FFFFFF",

  border: "#DBE5E1",

  disabledBackground: "#E4E8EF",
  disabledText: "#9CA3AF",

  success: "#156B40",
  warning: "#8A5A10",
  warningSoft: "#FDF3DF",
  error: "#B93A2B",
  info: "#2563EB",

  chart: ["#0B5B4C", "#EE7A23", "#2563EB", "#156B40", "#8A5A10"],

  // Brand-green hero gradient (IDBI app reference: Wealth Coach card).
  // Both stops keep textInverse above 7:1, so white copy is safe anywhere
  // on the gradient.
  gradientHero: ["#116B58", "#053529"],
} as const;

export type ColorToken = keyof typeof colors;
