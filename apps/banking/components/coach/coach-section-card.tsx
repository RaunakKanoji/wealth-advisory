import React, { type PropsWithChildren } from "react";
import { StyleSheet, View, type TextStyle } from "react-native";

import { SectionHeader } from "@/components/design-system";

type CoachSectionCardProps = PropsWithChildren<{
  title: string;
  actionLabel?: string;
  accessibilityLabel?: string;
  onActionPress?: () => void;
  titleStyle?: TextStyle;
}>;

export function CoachSectionCard({
  title,
  actionLabel,
  accessibilityLabel,
  onActionPress,
  titleStyle,
  children,
}: CoachSectionCardProps) {
  return (
    <View style={styles.section}>
      <SectionHeader
        title={title}
        actionLabel={actionLabel}
        accessibilityLabel={accessibilityLabel}
        onActionPress={onActionPress}
        titleStyle={titleStyle}
      />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    minWidth: 0,
  },
  content: {
    minWidth: 0,
  },
});
