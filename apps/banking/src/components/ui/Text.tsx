import type { ComponentProps } from "react";
import { Text as RNText } from "react-native";

import { colors, typography } from "@/src/theme";
import type { TypographyRole } from "@/src/theme";

type TextProps = ComponentProps<typeof RNText> & {
  variant?: TypographyRole;
  color?: string;
};

export function Text({ variant = "body", color = colors.textPrimary, style, ...rest }: TextProps) {
  return <RNText style={[typography[variant], { color }, style]} {...rest} />;
}
