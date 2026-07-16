// Collapsed from the demo's 5-tier Tailwind-aligned scale
// (packages/config: sm 640/md 768/lg 1024/xl 1280/2xl 1536) to the 3 tiers
// this task specifies. `medium` and `expanded` reuse the demo's proven
// md/lg cutoffs (768/1024) — medium is where the demo's own nav switches
// from bottom-tabs to a rail.
export const breakpoints = {
  compact: 0,
  medium: 768,
  expanded: 1024,
} as const;

export type BreakpointName = keyof typeof breakpoints;
