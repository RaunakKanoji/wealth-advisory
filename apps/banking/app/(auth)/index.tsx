import { AuthView } from "@clerk/expo/native";
import React from "react";
import { StyleSheet, View } from "react-native";

export default function NativeAuthScreen() {
  return (
    <View style={styles.container}>
      <AuthView mode="signIn" isDismissible={false} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
});
