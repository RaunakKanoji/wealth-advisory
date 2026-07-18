import { SignUp } from "@clerk/expo/web";
import React from "react";
import { StyleSheet, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";

export default function WebSignUpScreen() {
  return (
    <ScreenContainer edges={["top", "bottom"]} backgroundColor="#FFFFFF">
      <View style={styles.container}>
        <SignUp signInUrl="/(auth)" />
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
