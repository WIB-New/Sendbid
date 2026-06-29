import React from "react";
import { Stack } from "expo-router";
import { useThemedPaybidColors } from "../../src/themeContext";
import { paybidColors } from "../../src/paybidTheme";
export default function PaybidRootLayout() {
  const paybidColors = useThemedPaybidColors();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: paybidColors.neutrals.background } }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="transfer/[id]" />
      <Stack.Screen name="scan" options={{ presentation: "modal" }} />
    </Stack>
  );
}
