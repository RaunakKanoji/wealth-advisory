import { useAuth, useUser } from "@clerk/expo";
import { useRouter } from "expo-router";
import React from "react";
import { Button, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";

export default function WebHomeScreen() {
  const { user } = useUser();
  const { signOut } = useAuth();
  const router = useRouter();

  return (
    <ScreenContainer>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.welcomeText}>
            Welcome, {user?.firstName || "User"}
          </Text>
        </View>

        <Text style={styles.email}>
          {user?.primaryEmailAddress?.emailAddress}
        </Text>

        <View style={styles.buttonContainer}>
          <Button
            title="View Account Profile"
            color="#0B5B4C"
            onPress={() => router.push("/profile")}
          />
          <Button
            title="Sign Out"
            color="#8A5A10"
            onPress={() => signOut()}
          />
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    maxWidth: 600,
    alignSelf: "center",
    width: "100%",
  },
  header: {
    marginBottom: 8,
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#14201D",
  },
  email: {
    fontSize: 15,
    color: "#55655F",
    marginBottom: 32,
  },
  buttonContainer: {
    gap: 16,
  },
});
