import type Ionicons from "@expo/vector-icons/Ionicons";
import type MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { Href } from "expo-router";

export type ActionTone = "green" | "orange";

export type MoreActionIcon =
  | {
      family: "ionicons";
      name: React.ComponentProps<typeof Ionicons>["name"];
    }
  | {
      family: "material-community";
      name: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
    };

export type MoreActionItem = {
  id: string;
  label: string;
  icon: MoreActionIcon;
  iconTone: ActionTone;
  route: Href;
  isDisabled?: boolean;
  badge?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

export type PriorityActionItem = MoreActionItem;
export type SupportActionItem = MoreActionItem;
