import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { ScreenContainer } from "./screen-container";

export function AuthLoadingScreen() {
  return (
    <ScreenContainer>
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0B5B4C" />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
