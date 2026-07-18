import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";

export default function CoachScreen() {
  return (
    <ScreenContainer>
      <View style={styles.container}>
        <Text style={styles.title}>Wealth Coach</Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    color: "#14201D",
  },
});
