import React, { useState } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { TText } from "../src/components/TText";
import { Button } from "../src/components/Button";
import { SendBidLogo } from "../src/components/Logo";
import { colors, spacing, radii } from "../src/theme";
import { useTranslation, setLocale, SUPPORTED_LOCALES, i18n } from "../src/i18n";

/**
 * SENDBID Welcome — Imperial Edition (v4.0 faithful).
 * Dedicated to the client app. NO cross-link to the PAYBID agent app
 * (agent access lives in its own APK).
 */
export default function Welcome() {
  const router = useRouter();
  const { t } = useTranslation(); // Hook qui force le re-render quand la langue change

  const switchLang = async (code: any) => {
    await setLocale(code);
    // Le re-render global est géré par key={locale} dans _layout.tsx
  };
  const cur = i18n.locale;

  return (
    <View style={styles.bg}>
      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        <View style={styles.hero}>
          <View style={styles.logoBox}>
            <SendBidLogo size={80} variant="dark" />
          </View>
          <TText variant="display" weight="extraBold" color="#1A2B4C" align="center" style={{ letterSpacing: 6, marginTop: spacing.xl }}>
            S E N D B I D
          </TText>
          <TText variant="subtitle" color="#1A2B4C" align="center" style={{ marginTop: 6, fontStyle: "italic" }} serif>
            {t("welcome.slogan")}
          </TText>
          <TText variant="body" color="#6B7280" align="center" style={{ marginTop: spacing.lg, paddingHorizontal: spacing.xl }}>
            {t("welcome.tagline")}
          </TText>

          <View style={styles.statsRow}>
            <Stat label={t("welcome.countries")} value="100+" />
            <View style={styles.sep} />
            <Stat label={t("welcome.agents")} value="10k+" />
            <View style={styles.sep} />
            <Stat label={t("welcome.transfers")} value="2M+" />
          </View>
        </View>
      </SafeAreaView>

      <SafeAreaView edges={["bottom"]} style={styles.actions}>
        <Button
          testID="welcome-login"
          title={t("welcome.logIn")}
          onPress={() => router.push("/(auth)/login")}
          style={{ backgroundColor: "#1A2B4C" }}
        />
        <View style={{ height: 12 }} />
        <TouchableOpacity
          testID="welcome-create-account"
          onPress={() => router.push("/(auth)/signup")}
          style={styles.signupOutline}
          activeOpacity={0.85}
        >
          <TText variant="body" weight="bold" color="#1A2B4C">{t("welcome.signUp")}</TText>
        </TouchableOpacity>

        <View style={styles.orRow}>
          <View style={styles.orLine} />
          <TText variant="caption" color="#9CA3AF" style={{ marginHorizontal: 12 }}>Ou</TText>
          <View style={styles.orLine} />
        </View>

        <View style={styles.langRow}>
          <Ionicons name="language-outline" size={14} color="#6B7280" />
          {SUPPORTED_LOCALES.map((l, i) => (
            <React.Fragment key={l.code}>
              {i > 0 ? <TText variant="caption" color="#D1D5DB" style={{ marginHorizontal: 6 }}>|</TText> : <View style={{ width: 6 }} />}
              <TouchableOpacity testID={`lang-${l.code}`} onPress={() => switchLang(l.code)}>
                <TText
                  variant="caption"
                  weight={cur === l.code ? "extraBold" : "semiBold"}
                  color={cur === l.code ? "#1A2B4C" : "#9CA3AF"}
                >
                  {l.code.toUpperCase()}
                </TText>
              </TouchableOpacity>
            </React.Fragment>
          ))}
        </View>
      </SafeAreaView>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ alignItems: "center", paddingHorizontal: 12 }}>
      <TText variant="title" weight="extraBold" color="#1A2B4C" serif>{value}</TText>
      <TText variant="label" color="#6B7280">{label}</TText>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: "#FFFFFF" },
  hero: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg },
  logoBox: {
    width: 112, height: 112, borderRadius: 56,
    backgroundColor: "#E6ECF8",
    alignItems: "center", justifyContent: "center",
  },
  statsRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    marginTop: spacing.xxl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: "#F9FAFB",
    borderRadius: radii.xl,
    borderWidth: 1, borderColor: "#E5E7EB",
  },
  sep: { width: 1, height: 28, backgroundColor: "#E5E7EB" },
  actions: { padding: spacing.lg, paddingBottom: spacing.xl },
  signupOutline: { height: 56, borderRadius: radii.xl, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF", borderWidth: 1.5, borderColor: "#1A2B4C" },
  orRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: spacing.lg },
  orLine: { flex: 1, height: 1, backgroundColor: "#E5E7EB" },
  langRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: spacing.lg },
});
