import React from "react";
import { Stack } from "expo-router";
import { paybidColors } from "../../src/paybidTheme";

export default function PaybidRootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: paybidColors.neutrals.background } }}>
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="create-pin" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="transfer/[id]" />
      <Stack.Screen name="scan" options={{ presentation: "modal" }} />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="account-info" />
      <Stack.Screen name="loyalty" />
      <Stack.Screen name="support" />
    </Stack>
  );
}
