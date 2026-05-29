import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { paybidColors } from "../../../src/paybidTheme";

function Icon({ name, color }: { name: any; color: string }) {
  return <Ionicons name={name} size={22} color={color} />;
}

export default function PaybidTabsLayout() {
  const insets = useSafeAreaInsets();
  const safeBottom = Math.max(insets.bottom, 8);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: paybidColors.primary.base,
        tabBarInactiveTintColor: paybidColors.neutrals.textTertiary,
        tabBarStyle: {
          backgroundColor: paybidColors.neutrals.surface,
          borderTopColor: paybidColors.neutrals.border,
          height: 56 + safeBottom,
          paddingTop: 6,
          paddingBottom: safeBottom,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Tableau", tabBarIcon: ({ color }) => <Icon name="home" color={color} /> }} />
      <Tabs.Screen name="auctions" options={{ title: "Offres", tabBarIcon: ({ color }) => <Icon name="flash" color={color} /> }} />
      <Tabs.Screen name="transfers" options={{ title: "Transferts", tabBarIcon: ({ color }) => <Icon name="paper-plane" color={color} /> }} />
      <Tabs.Screen name="earnings" options={{ title: "Gains", tabBarIcon: ({ color }) => <Icon name="cash" color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profil", tabBarIcon: ({ color }) => <Icon name="person" color={color} /> }} />
    </Tabs>
  );
}
