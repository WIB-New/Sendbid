import { Stack, useRouter, useSegments } from "expo-router";
import React, { useEffect, useState, useRef } from "react";
import { View, ActivityIndicator, Platform, Image, StyleSheet, Text, AppState } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import Constants from "expo-constants";
import { initLocale, useLocale } from "../src/i18n";
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
import {
  OpenSans_400Regular,
  OpenSans_500Medium,
  OpenSans_600SemiBold,
  OpenSans_700Bold,
  OpenSans_800ExtraBold,
} from "@expo-google-fonts/open-sans";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from "@expo-google-fonts/inter";
import * as Notifications from "expo-notifications";
import { useAuth, usePinSession } from "../src/store";
import { registerForPushAndSync } from "../src/push";
import { colors } from "../src/theme";
import { useThemeStore } from "../src/hooks/useThemeMode";
import { ThemeProvider } from "../src/themeContext";
import { ToastProvider } from "../src/components/Toast";
// PinBiometryModal et StripeProvider non disponibles dans cette version
const PinBiometryModal = (_: any) => null;
const StripeProvider = ({ children }: any) => children;

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
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
    OpenSans_400Regular,
    OpenSans_500Medium,
    OpenSans_600SemiBold,
    OpenSans_700Bold,
    OpenSans_800ExtraBold,
    // Inter font for PayBID
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });
  const hydrate = useAuth((s) => s.hydrate);
  const hydrated = useAuth((s) => s.hydrated);
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const locale = useLocale((s) => s.locale);
  const segments = useSegments();
  const router = useRouter();
  const [i18nReady, setI18nReady] = React.useState(false);

  // ── PIN session state (store mémoire partagé) ──
  const pinValidated = usePinSession((s) => s.pinValidated);
  const setPinValidated = usePinSession((s) => s.setPinValidated);
  const [showPinModal, setShowPinModal] = useState(false);
  const appStateRef = useRef(AppState.currentState);

  // APP_VARIANT controls which app this APK is — "sendbid" (client) or "paybid" (agent).
  const appVariant: "sendbid" | "paybid" =
    ((Constants.expoConfig?.extra as any)?.appVariant ||
      (process.env.EXPO_PUBLIC_APP_VARIANT as any) ||
      "sendbid");

  const hydrateTheme = useThemeStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
    hydrateTheme();
    initLocale().then(() => setI18nReady(true)).catch(() => setI18nReady(true));
  }, [hydrate, hydrateTheme]);

  // ── Pop-up PIN : si session valide + PIN existant + pas encore validé ──
  useEffect(() => {
    if (!hydrated || !user) return;
    if (pinValidated) {
      setShowPinModal(false);
      return;
    }

    const hasPin = (user as any)?.has_pin;
    const role = (user as any)?.role;
    const isRegularUser = role === "user" || !role;

    console.log("[PIN]", { has_pin: hasPin, role, pinValidated });

    if (isRegularUser && hasPin) {
      setShowPinModal(true);
    }
  }, [hydrated, user, pinValidated]);

  // ── AppState : réinitialiser pinValidated quand l'app passe en background ──
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (
        appStateRef.current.match(/active/) &&
        (nextState === "background" || nextState === "inactive")
      ) {
        setPinValidated(false);
      }
      appStateRef.current = nextState;
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const segs = segments as string[];
    console.log("[NAV] segments:", JSON.stringify(segs), "user:", !!user);
    const inAuth = segs[0] === "(auth)";
    const inTabs = segs[0] === "(tabs)";
    const inPaybid = segs[0] === "paybid";
    const isAgent = (user as any)?.role === "agent";

    // === STRICT SPLIT BETWEEN SENDBID AND PAYBID ===
    if (appVariant === "paybid") {
      // PAYBID-only APK — every SENDBID route must redirect into /paybid/*
      if (!user) {
        if (!inPaybid || (segs[1] !== "login" && segs[1] !== "signup" && segs[1] !== "create-pin")) {
          router.replace("/paybid/login" as any);
        }
        return;
      }
      if (!isAgent) {
        router.replace("/paybid/login" as any);
        return;
      }
      if (!inPaybid) {
        router.replace("/paybid/(tabs)" as any);
      }
      return;
    }

    // === SENDBID (client) variant — default ===
    if (inPaybid && Platform.OS !== "web") {
      router.replace(user ? "/(tabs)" : "/welcome");
      return;
    }
    const isCreatePin = segs.includes("create-pin");
    const isVerifyPin = segs.includes("verify-pin");
    const isLoginPin = segs.includes("login");
    const isSignup = segs.includes("signup");
    const isPublic =
      segs.length === 0 ||
      segs[0] === "index" ||
      segs[0] === "onboarding" ||
      segs[0] === "welcome" ||
      segs[0] === "landing" ||
      inAuth ||
      isLoginPin ||
      isSignup ||
      isCreatePin ||
      isVerifyPin;
    if (!user && !isPublic) {
      router.replace("/welcome");
    } else if (user && (inAuth || segs[0] === "welcome" || segs[0] === "onboarding") && !isCreatePin && !isVerifyPin && !isLoginPin && !isSignup) {
      // Post-login routing basé sur le rôle (sauf si besoin de créer le PIN)
      const role = (user as any).role;
      if (isAgent) {
        // Agent sur build client → déconnecter et laisser sur welcome
        logout().catch(() => {});
        return;
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
      router.replace("/welcome");
    }
  }, [user, hydrated, segments, router, appVariant]);

  // Register push token once user is authenticated
  useEffect(() => {
    if (!hydrated || !user) return;
    registerForPushAndSync().catch(() => {});
  }, [hydrated, user]);

  // Naviguer vers les notifications quand l'utilisateur tape sur une notification
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as any;
      if (data?.type === "transfer_received" || data?.type === "transfer") {
        router.push("/(tabs)/notifications" as any);
      } else {
        router.push("/(tabs)/notifications" as any);
      }
    });
    return () => sub.remove();
  }, [router]);

  useEffect(() => {
    if (fontsLoaded && hydrated && i18nReady) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, hydrated, i18nReady]);

  if (!fontsLoaded || !hydrated || !i18nReady) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" }}>
        <StatusBar style="dark" />
        <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: "#E6ECF8", alignItems: "center", justifyContent: "center" }}>
          <Image
            source={require("../assets/images/splash-icon.png")}
            style={{ width: 90, height: 90 }}
            resizeMode="contain"
          />
        </View>
        <Text style={{ marginTop: 24, fontSize: 28, fontWeight: "800", color: "#1A2B4C", textAlign: "center", letterSpacing: 6 }}>
          S E N D B I D
        </Text>
        <View style={{ flexDirection: "row", marginTop: 32, gap: 8 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#00E676" }} />
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#00E676", opacity: 0.6 }} />
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#00E676", opacity: 0.3 }} />
        </View>
      </View>
    );
  }

  // ── PIN modal handlers ──
  const handlePinSuccess = () => {
    setPinValidated(true);
    setShowPinModal(false);
  };

  const handlePinCancel = async () => {
    setShowPinModal(false);
    await logout();
    router.replace("/welcome");
  };

  // Clé publique Stripe depuis les variables d'environnement
  const stripePublishableKey = process.env.EXPO_PUBLIC_STRIPE_PK || "";

  return (
    <StripeProvider
      publishableKey={stripePublishableKey}
      merchantIdentifier="merchant.com.sendbid"
      urlScheme="sendbid"
    >
      <ThemeProvider>
      <ToastProvider>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack key={locale} screenOptions={{ headerShown: false, animation: "fade", contentStyle: { backgroundColor: colors.neutrals.background } }} />
        {/* Pop-up PIN au démarrage si session existante */}
        <PinBiometryModal
          visible={showPinModal}
          onSuccess={handlePinSuccess}
          onCancel={handlePinCancel}
        />
      </SafeAreaProvider>
      </ToastProvider>
      </ThemeProvider>
    </StripeProvider>
  );
}
