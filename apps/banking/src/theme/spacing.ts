// The demo has no named spacing scale (raw Tailwind 4px-step utilities used
// inconsistently per component) — this is a clean scale built for production,
// not a port. touchTargetMin carries forward the demo's real a11y constant
// (--touch-target-min: 44px in styles/tokens.css).
export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  touchTargetMin: 44,
} as const;

export type SpacingToken = keyof typeof spacing;
