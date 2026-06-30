import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemedPaybidColors } from "../../../src/themeContext";
import { paybidColors } from "../../../src/paybidTheme";
function Icon({ name, color }: { name: any; color: string }) {
  return <Ionicons name={name} size={22} color={color} />;
}

export default function PaybidTabsLayout() {
  const paybidColors = useThemedPaybidColors();
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
      {/* 1 — Home dashboard */}
      <Tabs.Screen name="index" options={{ title: "Accueil", tabBarIcon: ({ color }) => <Icon name="home" color={color} /> }} />
      {/* 2 — Transferts (missions) */}
      <Tabs.Screen name="transfers" options={{ title: "Transferts", tabBarIcon: ({ color }) => <Icon name="paper-plane" color={color} /> }} />
      {/* 3 — Opérations Cash In / Cash Out */}
      <Tabs.Screen name="operations" options={{ title: "Opérations", tabBarIcon: ({ color }) => <Icon name="cash" color={color} /> }} />
      {/* 4 — Activités (caisse agence) */}
      <Tabs.Screen name="account" options={{ title: "Activités", tabBarIcon: ({ color }) => <Icon name="wallet" color={color} /> }} />
      {/* 5 — Offres live (enchères) */}
      <Tabs.Screen name="auctions" options={{ title: "Offres live", tabBarIcon: ({ color }) => <Icon name="flash" color={color} />, tabBarBadgeStyle: { backgroundColor: "#F59E0B" } }} />
      {/* 6 — Profil */}
      <Tabs.Screen name="profile" options={{ title: "Profil", tabBarIcon: ({ color }) => <Icon name="person" color={color} /> }} />
      {/* Masqués */}
      <Tabs.Screen name="earnings" options={{ href: null }} />
      <Tabs.Screen name="wallet" options={{ href: null }} />
    </Tabs>
  );
}
