import Ionicons from "@expo/vector-icons/Ionicons";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { appColors, appMotion, appRadii } from "@/components/theme/tokens";

export type IconButtonProps = Omit<PressableProps, "children" | "style"> & {
  accessibilityLabel: string;
  busyIconColor?: string;
  iconColor?: string;
  iconName: React.ComponentProps<typeof Ionicons>["name"];
  iconSize?: number;
  isBusy?: boolean;
  rotateWhenBusy?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function IconButton({
  accessibilityLabel,
  accessibilityState,
  busyIconColor = appColors.iconMuted,
  disabled = false,
  iconColor = appColors.textSecondary,
  iconName,
  iconSize = 20,
  isBusy = false,
  rotateWhenBusy = false,
  style,
  ...pressableProps
}: IconButtonProps) {
  const rotation = useRef(new Animated.Value(0)).current;
  const shouldRotate = isBusy && rotateWhenBusy;

  useEffect(() => {
    if (!shouldRotate) {
      rotation.stopAnimation();
      rotation.setValue(0);
      return;
    }

    const animation = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: appMotion.refreshRotation,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    animation.start();

    return () => animation.stop();
  }, [rotation, shouldRotate]);

  const iconRotation = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <Pressable
      {...pressableProps}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{
        ...accessibilityState,
        busy: isBusy || accessibilityState?.busy,
        disabled: disabled || accessibilityState?.disabled,
      }}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        style,
        styles.touchTarget,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Animated.View style={{ transform: [{ rotate: iconRotation }] }}>
        <Ionicons
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          name={iconName}
          size={iconSize}
          color={isBusy ? busyIconColor : iconColor}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: appRadii.control,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: appColors.border,
    backgroundColor: appColors.surface,
  },
  touchTarget: {
    width: 44,
    height: 44,
  },
  pressed: {
    opacity: 0.72,
  },
});
