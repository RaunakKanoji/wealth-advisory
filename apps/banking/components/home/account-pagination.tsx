import React from "react";
import { StyleSheet, View, Pressable } from "react-native";

type AccountPaginationProps = {
  total: number;
  activeIndex: number;
  onDotPress?: (index: number) => void;
};

export default function AccountPagination({
  total,
  activeIndex,
  onDotPress,
}: AccountPaginationProps) {
  if (total <= 1) return null;

  return (
    <View style={styles.container}>
      {Array.from({ length: total }).map((_, index) => {
        const isActive = index === activeIndex;
        return (
          <Pressable
            key={index.toString()}
            accessibilityRole="button"
            accessibilityLabel={`Go to account page ${index + 1}`}
            accessibilityState={{ selected: isActive }}
            onPress={() => onDotPress?.(index)}
            style={[
              styles.dot,
              isActive ? styles.dotActive : styles.dotInactive,
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignSelf: "center",
    columnGap: 9,
    marginTop: 0,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotActive: {
    backgroundColor: "#00866A",
  },
  dotInactive: {
    backgroundColor: "#D6DAE0",
  },
});
