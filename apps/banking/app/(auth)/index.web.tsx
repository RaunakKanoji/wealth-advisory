import { SignIn } from "@clerk/expo/web";
import React from "react";
import { StyleSheet, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";

export default function WebSignInScreen() {
  return (
    <ScreenContainer edges={["top", "bottom"]} backgroundColor="#FFFFFF">
      <View style={styles.container}>
        <SignIn signUpUrl="/(auth)/sign-up" />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
});
