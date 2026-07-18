import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { accountColors } from "./tokens";

type AccountPaginationProps = {
  total: number;
  activeIndex: number;
  onDotPress: (index: number) => void;
};

export function AccountPagination({
  total,
  activeIndex,
  onDotPress,
}: AccountPaginationProps) {
  if (total <= 1) {
    return null;
  }

  return (
    <View accessibilityRole="tablist" style={styles.container}>
      {Array.from({ length: total }, (_, index) => {
        const isActive = index === activeIndex;

        return (
          <Pressable
            key={index}
            accessibilityRole="tab"
            accessibilityLabel={`Show account ${index + 1} of ${total}`}
            accessibilityState={{ selected: isActive }}
            onPress={() => onDotPress(index)}
            style={[
              styles.dot,
              isActive ? styles.activeDot : styles.inactiveDot,
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: "center",
    flexDirection: "row",
    columnGap: 9,
    marginTop: 14,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  activeDot: {
    backgroundColor: accountColors.brandGreen,
  },
  inactiveDot: {
    backgroundColor: "#D2D7DE",
  },
});
