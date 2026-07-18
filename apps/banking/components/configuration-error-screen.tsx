import React from "react";
import { Button, StyleSheet, Text, View } from "react-native";
import { ScreenContainer } from "./screen-container";

type ConfigurationErrorScreenProps = {
  error: Error;
  resetErrorBoundary?: () => void;
};

export function ConfigurationErrorScreen({
  error,
  resetErrorBoundary,
}: ConfigurationErrorScreenProps) {
  return (
    <ScreenContainer>
      <View style={styles.container}>
        <Text style={styles.title}>Configuration Error</Text>
        <Text style={styles.message}>{error.message}</Text>
        {resetErrorBoundary && (
          <Button title="Retry" onPress={resetErrorBoundary} color="#0B5B4C" />
        )}
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
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 12,
    color: "#B93A2B",
  },
  message: {
    fontSize: 15,
    textAlign: "center",
    marginBottom: 24,
    color: "#55655F",
  },
});
