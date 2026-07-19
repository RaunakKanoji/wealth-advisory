import { UserProfile } from "@clerk/expo/web";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { Href } from "expo-router";
import React from "react";
import { Button, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";

export default function WebProfileScreen() {
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{
    returnTo?: string | string[];
  }>();

  const handleBack = () => {
    const destination = Array.isArray(returnTo) ? returnTo[0] : returnTo;

    if (destination) {
      router.replace((destination as Href | undefined) || "/(app)/(tabs)/more");
      return;
    }

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(app)/(tabs)");
    }
  };

  return (
    <ScreenContainer scroll backgroundColor="#FFFFFF">
      <View style={styles.header}>
        <Button title="Back" color="#0B5B4C" onPress={handleBack} />
        <Text style={styles.title}>Account & security</Text>
      </View>
      <View style={styles.center}>
        <UserProfile routing="hash" />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#C9CFCC",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#14201D",
  },
  center: {
    alignItems: "center",
    paddingVertical: 32,
  },
});
