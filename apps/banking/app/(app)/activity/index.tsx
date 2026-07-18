import React from "react";
import { StyleSheet, Text, View, Button } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";

export default function ActivityIndexScreen() {
  const router = useRouter();

  return (
    <ScreenContainer edges={["top"]} backgroundColor="#FFFFFF">
      <View style={styles.container}>
        <Text style={styles.title}>All Activity</Text>
        <Text style={styles.description}>
          View your complete transaction history.
        </Text>
        <Button title="Go Back" color="#00866A" onPress={() => router.back()} />
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
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: "#4B5563",
    textAlign: "center",
    marginBottom: 32,
  },
});
