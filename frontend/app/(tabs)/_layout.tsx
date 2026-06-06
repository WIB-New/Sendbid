import { Tabs } from "expo-router";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fontFamily } from "../../src/theme";
import { useThemedColors } from "../../src/themeContext";
import FirstLoginVerificationGuard from "../../src/components/FirstLoginVerificationGuard";
export default function TabsLayout() {
  const colors = useThemedColors();
  const insets = useSafeAreaInsets();
  // Tab bar : 60 (contenu) + insets.bottom (safe area) pour iPhone à encoche.
  const tabBarHeight = 60 + Math.max(insets.bottom, 8);
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary.base,
          tabBarInactiveTintColor: colors.neutrals.textTertiary,
          tabBarStyle: {
            backgroundColor: colors.neutrals.surface,
            borderTopColor: colors.neutrals.border,
            height: tabBarHeight,
            paddingTop: 8,
            paddingBottom: Math.max(insets.bottom, 8),
          },
          tabBarLabelStyle: { fontFamily: fontFamily.semiBold, fontSize: 11 },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Accueil",
            tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="transfers"
          options={{
            title: "Transfert",
            tabBarIcon: ({ color, size }) => <Ionicons name="swap-horizontal-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="wallet"
          options={{
            title: "Portefeuille",
            tabBarIcon: ({ color, size }) => <Ionicons name="wallet-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profil",
            tabBarIcon: ({ color, size }) => <Ionicons name="person-circle-outline" size={size} color={color} />,
          }}
        />
      </Tabs>
      {/* v7 — Procédure de vérification post-1ère-connexion (popup + bannière de rappel) */}
      <FirstLoginVerificationGuard />
      {/* Note : VerificationShieldFloating est désormais monté dans app/_layout.tsx
          pour être visible sur TOUTES les pages (tabs + stack). */}
    </View>
  );
}
