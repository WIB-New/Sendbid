import { Stack, useRouter, useSegments } from "expo-router";
import React, { useEffect } from "react";
import { View, ActivityIndicator, Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import Constants from "expo-constants";
import { initLocale } from "../src/i18n";
import {
  useFonts,
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
  Montserrat_700Bold,
  Montserrat_800ExtraBold,
} from "@expo-google-fonts/montserrat";
import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold,
  PlayfairDisplay_800ExtraBold,
  PlayfairDisplay_900Black,
} from "@expo-google-fonts/playfair-display";
import { useAuth } from "../src/store";
import { useLocale } from "../src/i18n";
import { registerForPushAndSync } from "../src/push";
import { useThemedColors } from "../src/themeContext";
import { ThemeProvider } from "../src/themeContext";

export default function RootLayout() {
  const colors = useThemedColors();
  const [fontsLoaded] = useFonts({
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
    Montserrat_800ExtraBold,
    PlayfairDisplay_400Regular,
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_700Bold,
    PlayfairDisplay_800ExtraBold,
    PlayfairDisplay_900Black,
  });
  const hydrate = useAuth((s) => s.hydrate);
  const hydrated = useAuth((s) => s.hydrated);
  const user = useAuth((s) => s.user);
  const locale = useLocale((s) => s.locale);
  const segments = useSegments();
  const router = useRouter();
  const [i18nReady, setI18nReady] = React.useState(false);

  // APP_VARIANT controls which app this APK is — "sendbid" (client) or "paybid" (agent).
  // Read from Constants.expoConfig.extra.appVariant (set by app.config.js) or EXPO_PUBLIC_APP_VARIANT.
  const appVariant: "sendbid" | "paybid" =
    ((Constants.expoConfig?.extra as any)?.appVariant ||
      (process.env.EXPO_PUBLIC_APP_VARIANT as any) ||
      "sendbid");

  useEffect(() => {
    hydrate();
    initLocale().then(() => setI18nReady(true)).catch(() => setI18nReady(true));
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated) return;
    const inAuth = segments[0] === "(auth)";
    const inTabs = segments[0] === "(tabs)";
    const inPaybid = segments[0] === "paybid";
    const isAgent = (user as any)?.role === "agent";

    // === STRICT SPLIT BETWEEN SENDBID AND PAYBID ===
    if (appVariant === "paybid") {
      // PAYBID-only APK — every SENDBID route must redirect into /paybid/*
      if (!user) {
        if (!inPaybid || (segments[1] !== "login" && segments[1] !== "signup")) {
          router.replace("/paybid/login" as any);
        }
        return;
      }
      if (!isAgent) {
        // User logged in but not an agent → force re-auth into paybid
        router.replace("/paybid/login" as any);
        return;
      }
      if (!inPaybid) {
        router.replace("/paybid/(tabs)" as any);
      }
      return;
    }

    // === SENDBID (client) variant — default ===
    // PAYBID routes are blocked in this APK, SAUF sur le web (preview/admin)
    // où les agents peuvent tester l'app PAYBID sans changer de build.
    if (inPaybid && Platform.OS !== "web") {
      router.replace(user ? "/(tabs)" : "/welcome");
      return;
    }
    const isPublic =
      segments.length === 0 ||
      segments[0] === "index" ||
      segments[0] === "onboarding" ||
      segments[0] === "welcome" ||
      segments[0] === "landing" ||
      inAuth;
    if (!user && !isPublic) {
      router.replace("/welcome");
    } else if (user && (inAuth || segments[0] === "welcome" || segments[0] === "onboarding")) {
      // Post-login routing basé sur le rôle
      const role = (user as any).role;
      if (isAgent) {
        // Sur le build web (preview/admin) : permettre aux agents de tester PAYBID.
        // Sur le build natif SENDBID : un compte agent n'a pas sa place ici → /welcome
        if (Platform.OS === "web") {
          router.replace("/paybid/(tabs)" as any);
        } else {
          router.replace("/welcome");
        }
      } else if (role === "admin" || role === "super_admin") {
        router.replace("/admin" as any);
      } else if (role === "partner_admin") {
        router.replace("/partner" as any);
      } else if (role === "agent_admin") {
        router.replace("/agent" as any);
      } else {
        router.replace("/(tabs)");
      }
    } else if (user && isAgent && inTabs) {
      // Agent on client build: shouldn't be here
      if (Platform.OS === "web") {
        router.replace("/paybid/(tabs)" as any);
      } else {
        router.replace("/welcome");
      }
    }
  }, [user, hydrated, segments, router, appVariant]);

  // Register push token once user is authenticated
  useEffect(() => {
    if (!hydrated || !user) return;
    registerForPushAndSync().catch(() => {});
  }, [hydrated, user]);

  if (!fontsLoaded || !hydrated || !i18nReady) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.neutrals.background }}>
        <ActivityIndicator color={colors.primary.base} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <StatusBar style="dark" />
        <Stack key={locale} screenOptions={{ headerShown: false, animation: "slide_from_right", contentStyle: { backgroundColor: colors.neutrals.background } }} />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
