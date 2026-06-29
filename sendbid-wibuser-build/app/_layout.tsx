import { Stack, useRouter, useSegments } from "expo-router";
import React, { useEffect } from "react";
import { View, ActivityIndicator, Platform, LogBox } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import Constants from "expo-constants";
import { initLocale } from "../src/i18n";

// === Silencer les warnings web cosmétiques (shadow* deprecated, useNativeDriver, push tokens web) ===
// Ces avertissements sont émis par React Native Web mais n'impactent ni les builds natifs (iOS/Android)
// ni l'expérience utilisateur. On les filtre uniquement sur Expo Web et via LogBox sur mobile.
if (Platform.OS === "web" && typeof console !== "undefined") {
  const SILENCE_PATTERNS = [
    '"shadow*" style props are deprecated',
    "useNativeDriver",
    "[expo-notifications] Listening to push token changes is not yet fully supported",
  ];
  const _origWarn = console.warn;
  console.warn = (...args: any[]) => {
    const msg = typeof args[0] === "string" ? args[0] : "";
    if (SILENCE_PATTERNS.some((p) => msg.includes(p))) return;
    _origWarn(...args);
  };
}
try {
  LogBox.ignoreLogs([
    /"shadow\*" style props are deprecated/,
    /useNativeDriver/,
    /\[expo-notifications\] Listening to push token changes/,
  ]);
} catch {}

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
import VerificationShieldFloating from "../src/components/VerificationShieldFloating";
import AppLockGate from "../src/components/AppLockGate";

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

    // === v10 — PIN-GATE STRICTE POST-INSCRIPTION ===
    // Spec utilisateur item 1 : "La création du code PIN ne peut se déclencher que si
    // et seulement si la création du compte est achevée entièrement et rien d'autre
    // ni aucune autre procédure ne peut être déclenchée."
    //
    // Conséquence : tant que `user && user.has_pin === false`, on force /(auth)/create-pin
    // ET on EMPÊCHE toute autre redirection (KYC, paybid, tabs, popup vérif, AppLock, etc).
    // Cette gate est active SEULEMENT pour les clients SendBid (pas les agents Paybid).
    if (user && (user as any).has_pin === false && !isAgent && appVariant !== "paybid") {
      const onCreatePin = segments[0] === "(auth)" && segments[1] === "create-pin";
      if (!onCreatePin) {
        router.replace("/(auth)/create-pin" as any);
      }
      return; // ← bloque toute autre logique de redirection ci-dessous
    }

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
      // v11 — Whitelist des routes PARTAGÉES autorisées en mode Paybid.
      // Sans cela, ouvrir /profile-account, /chat/[id], /wallet/recharge, /personal-info,
      // /kyc, /notifications, /transfer/[id], /beneficiaries, /disputes etc. depuis Paybid
      // était systématiquement rerouté vers /paybid/(tabs) → "plante" perçu par l'utilisateur.
      const PAYBID_ALLOWED_SHARED_PREFIXES = [
        "profile-",          // profile-account, profile-settings, profile-loyalty, profile-help, profile-rgpd
        "personal-info",
        "kyc",
        "notifications",
        "chat",
        "wallet",
        "transfer",          // transfer/[id] (détail) + transfer/receipt
        "beneficiaries",
        "disputes",
        "loyalty",
        "sessions",
        "languages",
        "sbtag",
        "appearance",
        "billing",
        "security",
        "promo",
        "search",
        "_sitemap",          // expo-router internal
        "+not-found",        // expo-router internal
      ];
      const top = segments[0];
      const isAllowedShared = top && PAYBID_ALLOWED_SHARED_PREFIXES.some(
        (p) => top === p || top.startsWith(p)
      );
      if (!inPaybid && !isAllowedShared) {
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
        {/* v10 — Pendant la création du PIN post-inscription, RIEN d'autre ne doit
            apparaître (pas de bouclier flottant, pas d'AppLockGate). Spec item 1. */}
        {user && (user as any).has_pin !== false ? <VerificationShieldFloating /> : null}
        {user && (user as any).has_pin !== false ? <AppLockGate /> : null}
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
