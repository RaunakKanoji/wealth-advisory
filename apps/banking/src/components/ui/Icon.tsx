import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";

import { colors } from "@/src/theme";

// Maps the demo's hand-authored SVG icon set (components/navigation/icons.tsx
// in the demo — 16 semantic names, web-only markup) onto @expo/vector-icons,
// which is already a dependency — no new install needed. "check" has no
// demo equivalent, added for Checkbox/RadioGroup/SelectCard selected states.
export type IconName =
  | "home"
  | "wealth"
  | "copilot"
  | "goals"
  | "more"
  | "spending"
  | "portfolio"
  | "recommendations"
  | "simulator"
  | "documents"
  | "consent"
  | "notifications"
  | "profile"
  | "settings"
  | "back"
  | "close"
  | "check";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

const ICON_NAME_MAP: Record<IconName, IoniconName> = {
  home: "home-outline",
  wealth: "wallet-outline",
  copilot: "chatbubble-ellipses-outline",
  goals: "flag-outline",
  more: "ellipsis-horizontal",
  spending: "card-outline",
  portfolio: "pie-chart-outline",
  recommendations: "bulb-outline",
  simulator: "options-outline",
  documents: "document-text-outline",
  consent: "shield-checkmark-outline",
  notifications: "notifications-outline",
  profile: "person-outline",
  settings: "settings-outline",
  back: "chevron-back",
  close: "close",
  check: "checkmark",
};

type IconProps = {
  name: IconName;
  size?: number;
  color?: string;
};

// Icons are decorative by default — the owning control (IconButton, Button,
// tab) carries the accessible label, so the raw glyph is hidden from screen
// readers to avoid announcing font characters.
export function Icon({ name, size = 24, color = colors.textPrimary }: IconProps) {
  return (
    <Ionicons
      name={ICON_NAME_MAP[name]}
      size={size}
      color={color}
      accessible={false}
      importantForAccessibility="no"
      accessibilityElementsHidden
    />
  );
}
