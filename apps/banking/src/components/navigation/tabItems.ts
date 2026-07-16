import type { Href } from "expo-router";

import type { IconName } from "@/src/components/ui/Icon";

// Single source of truth for primary navigation destinations, consumed by
// both the compact bottom tab bar and the medium/expanded rail — the demo's
// lib/navigation.ts pattern (one route list, viewport-switched presentation,
// Decision D-004: never two navigation patterns at once).
export type TabItem = {
  name: string;
  label: string;
  icon: IconName;
  href: Href;
};

export const TAB_ITEMS: TabItem[] = [
  { name: "index", label: "Home", icon: "home", href: "/(app)/(tabs)" },
  { name: "goals", label: "Goals", icon: "goals", href: "/(app)/(tabs)/goals" },
  { name: "portfolio", label: "Portfolio", icon: "portfolio", href: "/(app)/(tabs)/portfolio" },
  { name: "copilot", label: "Copilot", icon: "copilot", href: "/(app)/(tabs)/copilot" },
  { name: "profile", label: "Profile", icon: "profile", href: "/(app)/(tabs)/profile" },
];

// usePathname() returns group-stripped paths: "/", "/goals", "/goals/123".
export function isTabActive(pathname: string, item: TabItem): boolean {
  if (item.name === "index") {
    return pathname === "/";
  }
  const path = `/${item.name}`;
  return pathname === path || pathname.startsWith(`${path}/`);
}
