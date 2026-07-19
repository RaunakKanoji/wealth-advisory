import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import React from "react";
import { StyleSheet, View } from "react-native";

import type { ActionTone, MoreActionIcon } from "@/types/more-actions";

import { moreColors } from "./tokens";

type ServiceIconProps = {
  icon: MoreActionIcon;
  tone: ActionTone;
  size?: number;
  containerSize?: number;
};

export function ServiceIcon({
  icon,
  tone,
  size = 23,
  containerSize = 46,
}: ServiceIconProps) {
  const iconColor = tone === "green" ? moreColors.brandGreen : moreColors.brandOrange;
  const iconBackground =
    tone === "green" ? moreColors.brandGreenSoft : moreColors.brandOrangeSoft;

  return (
    <View
      style={[
        styles.container,
        {
          width: containerSize,
          height: containerSize,
          borderRadius: containerSize / 2,
          backgroundColor: iconBackground,
        },
      ]}
    >
      {icon.family === "material-community" ? (
        <MaterialCommunityIcons name={icon.name} size={size} color={iconColor} />
      ) : (
        <Ionicons name={icon.name} size={size} color={iconColor} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
});
