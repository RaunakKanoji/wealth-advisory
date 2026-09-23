import React from "react";
import {
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { appColors, appSpacing, appTypography } from "@/components/theme/tokens";

export type PageHeaderProps = {
  action?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  subtitle?: string;
  title: string;
};

export function PageHeader({ action, style, subtitle, title }: PageHeaderProps) {
  const { width } = useWindowDimensions();
  const isSmall = width < 375;

  return (
    <View style={[styles.container, style]}>
      <View style={styles.titleRow}>
        <View style={styles.titleCopy}>
          <Text
            accessibilityRole="header"
            adjustsFontSizeToFit
            minimumFontScale={0.86}
            numberOfLines={1}
            style={[styles.title, isSmall && styles.titleSmall]}
          >
            {title}
          </Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {action ? <View style={styles.action}>{action}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 17,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleCopy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: appColors.textPrimary,
    ...appTypography.pageTitle,
  },
  titleSmall: {
    fontSize: 27,
    lineHeight: 34,
  },
  subtitle: {
    marginTop: 2,
    color: appColors.textSecondary,
    ...appTypography.supporting,
  },
  action: {
    flexShrink: 0,
    marginLeft: appSpacing.md,
  },
});
