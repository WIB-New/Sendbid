import React, { useState } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { TText } from "../src/components/TText";
import { Button } from "../src/components/Button";
import { SendBidLogo } from "../src/components/Logo";
import { colors, spacing, radii } from "../src/theme";
import { t, setLocale, SUPPORTED_LOCALES, i18n } from "../src/i18n";

/**
 * SENDBID Welcome — Imperial Edition (v4.0 faithful).
 * Dedicated to the client app. NO cross-link to the PAYBID agent app
 * (agent access lives in its own APK).
 */
export default function Welcome() {
  const router = useRouter();
  const [, force] = useState(0);

  const switchLang = async (code: any) => {
    await setLocale(code);
    force((n) => n + 1);
  };
  const cur = i18n.locale;

  return (
    <LinearGradient colors={["#000A42", "#00147E", "#000A42"]} style={styles.bg} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        <View style={styles.hero}>
          <View style={styles.logoBox}>
            <SendBidLogo size={80} />
          </View>
          <TText variant="display" weight="extraBold" color="white" align="center" style={{ letterSpacing: 2, marginTop: spacing.xl }}>
            SENDBID
          </TText>
          <TText variant="subtitle" color="rgba(255,255,255,0.92)" align="center" style={{ marginTop: 6, fontStyle: "italic" }} serif>
            {t("welcome.slogan")}
          </TText>
          <TText variant="body" color="rgba(255,255,255,0.78)" align="center" style={{ marginTop: spacing.lg, paddingHorizontal: spacing.xl }}>
            {t("welcome.tagline")}
          </TText>

          <View style={styles.statsRow}>
            <Stat label={t("welcome.countries")} value="250+" />
            <View style={styles.sep} />
            <Stat label={t("welcome.agents")} value="10k+" />
            <View style={styles.sep} />
            <Stat label={t("welcome.transfers")} value="2M+" />
          </View>
        </View>
      </SafeAreaView>

      <SafeAreaView edges={["bottom"]} style={styles.actions}>
        <Button
          testID="welcome-create-account"
          title={t("welcome.signUp")}
          icon="rocket"
          onPress={() => router.push("/(auth)/signup")}
          style={{ backgroundColor: "#10B981" }}
        />
        <View style={{ height: 12 }} />
        <TouchableOpacity
          testID="welcome-login"
          onPress={() => router.push("/(auth)/login")}
          style={styles.loginFrosted}
          activeOpacity={0.85}
        >
          <TText variant="body" weight="bold" color="white">{t("welcome.logIn")}</TText>
        </TouchableOpacity>

        <View style={styles.langRow}>
          <Ionicons name="language-outline" size={14} color="rgba(255,255,255,0.7)" />
          {SUPPORTED_LOCALES.map((l, i) => (
            <React.Fragment key={l.code}>
              {i > 0 ? <TText variant="caption" color="rgba(255,255,255,0.4)" style={{ marginHorizontal: 6 }}>|</TText> : <View style={{ width: 6 }} />}
              <TouchableOpacity testID={`lang-${l.code}`} onPress={() => switchLang(l.code)}>
                <TText
                  variant="caption"
                  weight={cur === l.code ? "extraBold" : "semiBold"}
                  color={cur === l.code ? "white" : "rgba(255,255,255,0.55)"}
                >
                  {l.code.toUpperCase()}
                </TText>
              </TouchableOpacity>
            </React.Fragment>
          ))}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ alignItems: "center", paddingHorizontal: 12 }}>
      <TText variant="title" weight="extraBold" color="white" serif>{value}</TText>
      <TText variant="label" color="rgba(255,255,255,0.7)">{label}</TText>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  hero: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg },
  logoBox: {
    width: 112, height: 112, borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.2)",
  },
  statsRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    marginTop: spacing.xxl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: radii.xl,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  sep: { width: 1, height: 28, backgroundColor: "rgba(255,255,255,0.15)" },
  actions: { padding: spacing.lg, paddingBottom: spacing.xl },
  loginFrosted: { height: 56, borderRadius: radii.xl, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.14)", borderWidth: 1, borderColor: "rgba(255,255,255,0.38)" },
  langRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: spacing.lg },
});
