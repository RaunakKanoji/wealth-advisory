import { AuthView } from "@clerk/expo/native";
import React from "react";
import { StyleSheet, View } from "react-native";

import { appColors } from "@/components/theme/tokens";

export default function NativeSignUpScreen() {
  return (
    <View style={styles.container}>
      <AuthView mode="signUp" isDismissible={false} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: appColors.background,
  },
});
