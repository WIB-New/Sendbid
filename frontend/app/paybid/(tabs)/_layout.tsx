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
      <Tabs.Screen name="index" options={{ title: "Tableau", tabBarIcon: ({ color }) => <Icon name="home" color={color} /> }} />
      {/* Item 2 — Onglet Offres SUPPRIMÉ du tab bar, intégré dans Transferts */}
      <Tabs.Screen name="auctions" options={{ href: null }} />
      <Tabs.Screen name="transfers" options={{ title: "Transferts", tabBarIcon: ({ color }) => <Icon name="paper-plane" color={color} /> }} />
      {/* Item 5 — Portefeuille (clone Sendbid avec design Paybid) */}
      <Tabs.Screen name="wallet" options={{ title: "Portefeuille", tabBarIcon: ({ color }) => <Icon name="wallet" color={color} /> }} />
      {/* "Mon compte" = caisse de l'agence (différent du portefeuille personnel) */}
      <Tabs.Screen name="account" options={{ title: "Activités", tabBarIcon: ({ color }) => <Icon name="briefcase" color={color} /> }} />
      {/* Item 5 — Onglet "Gains" masqué : l'historique des commissions est dans Portefeuille */}
      <Tabs.Screen name="earnings" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ title: "Profil", tabBarIcon: ({ color }) => <Icon name="person" color={color} /> }} />
    </Tabs>
  );
}
