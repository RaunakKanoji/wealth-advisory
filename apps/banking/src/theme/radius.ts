// card/control values ported exactly from the demo's styles/tokens.css
// (--radius-card: 16px, --radius-control: 12px). sm/full added for
// production needs the demo didn't have named tokens for.
export const radius = {
  none: 0,
  sm: 8,
  control: 12,
  card: 16,
  full: 999,
} as const;

export type RadiusToken = keyof typeof radius;
