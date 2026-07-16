import type { TextStyle } from "react-native";

// The demo defines no named type scale — only a system-font stack and
// Tailwind's default text-* utilities used ad hoc. This scale is derived
// from actual usage frequency (text-sm dominant → `body`, text-xs frequent
// → `caption`), not ported verbatim. financialValue/financialValueLabel
// have no demo equivalent — added for this task's emphasis/grouping
// requirement on monetary figures.
type TypographyToken = Pick<
  TextStyle,
  "fontSize" | "lineHeight" | "fontWeight" | "letterSpacing"
>;

export const typography = {
  display: { fontSize: 34, lineHeight: 40, fontWeight: "700" },
  pageTitle: { fontSize: 24, lineHeight: 30, fontWeight: "700" },
  sectionTitle: { fontSize: 20, lineHeight: 26, fontWeight: "600" },
  cardTitle: { fontSize: 16, lineHeight: 22, fontWeight: "600" },
  body: { fontSize: 15, lineHeight: 22, fontWeight: "400" },
  supporting: { fontSize: 13, lineHeight: 18, fontWeight: "400" },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "500" },
  buttonLabel: { fontSize: 15, lineHeight: 20, fontWeight: "600" },
  financialValue: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  financialValueLabel: { fontSize: 12, lineHeight: 16, fontWeight: "500" },
} satisfies Record<string, TypographyToken>;

export type TypographyRole = keyof typeof typography;
