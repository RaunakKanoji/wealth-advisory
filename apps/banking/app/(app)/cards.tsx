import React from "react";
import { StyleSheet, Text, View, Button } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";

export default function CardsScreen() {
  const router = useRouter();

  return (
    <ScreenContainer edges={["top"]} backgroundColor="#FFFFFF">
      <View style={styles.container}>
        <Text style={styles.title}>My Cards</Text>
        <Text style={styles.description}>
          Manage your debit, credit, and virtual cards.
        </Text>
        <View style={styles.cardMock} />
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
  cardMock: {
    width: 300,
    height: 180,
    borderRadius: 16,
    backgroundColor: "#FF8500",
    marginBottom: 40,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
});
