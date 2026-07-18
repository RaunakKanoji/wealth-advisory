import { useAuth } from "@clerk/expo";
import { useRouter } from "expo-router";
import React from "react";
import { Button, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";

export default function MoreScreen() {
  const { signOut } = useAuth();
  const router = useRouter();

  return (
    <ScreenContainer>
      <View style={styles.container}>
        <Text style={styles.title}>More</Text>

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
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    color: "#14201D",
    marginBottom: 32,
    textAlign: "center",
  },
  buttonContainer: {
    gap: 16,
    maxWidth: 400,
    width: "100%",
    alignSelf: "center",
  },
});
