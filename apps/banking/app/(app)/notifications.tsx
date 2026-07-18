import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { ScreenContainer } from "@/components/screen-container";

export default function NotificationsScreen() {
  return (
    <ScreenContainer backgroundColor="#FFFFFF">
      <View style={styles.container}>
        <Ionicons name="notifications-off-outline" size={64} color="#9CA3AF" />
        <Text style={styles.title}>No notifications yet</Text>
        <Text style={styles.subtitle}>
          {"We'll let you know when there's an update on your accounts or advice."}
        </Text>
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
    maxWidth: 400,
    alignSelf: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: "#14201D",
    marginTop: 16,
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: "#55655F",
    textAlign: "center",
  },
});
