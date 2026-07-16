import type { ViewStyle } from "react-native";

import { colors } from "@/src/theme/colors";

// Approximated from the demo's two-layer CSS shadows (styles/tokens.css:
// --shadow-card, --shadow-raised) — RN only supports one shadow definition
// per view, so each is collapsed to its dominant (larger-blur) layer, using
// the demo's ink-based shadow color (rgb(16 34 29) ≈ colors.textPrimary).
type ShadowToken = ViewStyle;

export const shadows = {
  card: {
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  raised: {
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 6,
  },
} satisfies Record<string, ShadowToken>;

export type ShadowLevel = keyof typeof shadows;
