// The demo defines no duration/easing tokens — only a prefers-reduced-motion
// kill-switch (styles/motion.css) applied globally via CSS. These durations
// are reasonable RN defaults for future Reanimated/Animated usage, not a
// port. The reduced-motion *principle* itself (the demo treats honoring it
// as non-optional) must be re-implemented at animation call sites via
// AccessibilityInfo.isReduceMotionEnabled() when real animations are added —
// not encoded here since no animations exist yet to gate.
export const motion = {
  duration: {
    fast: 120,
    base: 200,
    slow: 320,
  },
  easing: {
    standard: [0.4, 0, 0.2, 1],
  },
} as const;
