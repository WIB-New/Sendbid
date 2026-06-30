import React, { useRef, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Platform, ScrollView, KeyboardAvoidingView, Dimensions,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, apiError } from "../../src/api";
import { useAuth } from "../../src/store";
import { useTranslation } from "../../src/i18n";
import { useThemeColors } from "../../src/hooks/useThemeMode";
import { fontFamily } from "../../src/theme";

const { height: SCREEN_H } = Dimensions.get("window");
const BANNER_H = 180;

export default function Login() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const setSession = useAuth((s) => s.setSession);
  const refreshMe = useAuth((s) => s.refreshMe);

  // ── Login form state ──
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [pwVisible, setPwVisible] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const pwRef = useRef<TextInput>(null);

  // ── Route helper ──
  const routeForRole = (u: any): any => {
    const r = u?.role;
    if (r === "admin" || r === "super_admin") return "/admin";
    if (r === "partner_admin") return "/partner";
    if (r === "agent_admin") return "/agent";
    if (r === "agent") return "/paybid/(tabs)";
    return "/(tabs)";
  };

  // ── Login submit ──
  const submit = async () => {
    setErr(null); setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { identifier, password });
      await setSession(data.access_token, data.user);
      // Rafraîchir le profil pour avoir has_pin à jour
      await refreshMe();
      const store = useAuth.getState();
      const u = store.user;
      const hasPin = u?.has_pin;
      const role = (u as any)?.role;

      console.log("[LOGIN] after refreshMe →", { has_pin: hasPin, role });

      if ((role === "user" || !role) && !hasPin) {
        router.replace("/(auth)/create-pin");
        return;
      }

      // Navigation → _layout.tsx gère le pop-up PIN
      router.replace(routeForRole(u));
    } catch (e: any) { setErr(apiError(e)); }
    finally { setLoading(false); }
  };

  const canSubmit = identifier.trim().length > 0 && password.length > 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={colors.statusBar} translucent backgroundColor="transparent" />
      <View style={[styles.blueBg, { backgroundColor: colors.banner }]} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
          bounces={false}
        >
          {/* ===== BANDEAU ===== */}
          <View style={styles.bannerContent}>
            <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.backBtnBg }]}>
              <Ionicons name="chevron-back" size={22} color={colors.textOnBanner} />
            </TouchableOpacity>
            <Text style={[styles.brandText, { color: "#00E676" }]}>S E N D B I D</Text>
            <Text style={[styles.bannerTitle, { color: colors.textOnBanner }]}>{t("auth.loginTitle")}</Text>
            <Text style={[styles.bannerSubtitle, { color: colors.textOnBannerSub }]}>{t("auth.loginSubtitle")}</Text>
          </View>

          {/* ===== CARTE ===== */}
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            {/* Identifiant */}
            <View style={{ marginBottom: 24 }}>
              <Text style={[styles.label, { color: colors.banner }]}>{t("auth.identifier")}</Text>
              <View style={[styles.inputBox, { borderColor: colors.border, backgroundColor: colors.inputBg }]}>
                <Ionicons name="person-outline" size={18} color={colors.banner} style={{ marginRight: 10 }} />
                <TextInput
                  style={[styles.inputText, { color: colors.textPrimary }]}
                  value={identifier}
                  onChangeText={setIdentifier}
                  placeholder={t("auth.emailPlaceholder")}
                  placeholderTextColor={colors.placeholder}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  returnKeyType="next"
                  onSubmitEditing={() => pwRef.current?.focus()}
                  blurOnSubmit={false}
                />
              </View>
            </View>

            {/* Mot de passe */}
            <View style={{ marginBottom: 12 }}>
              <Text style={[styles.label, { color: colors.banner }]}>{t("auth.password")}</Text>
              <View style={[styles.inputBox, { borderColor: colors.border, backgroundColor: colors.inputBg }]}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.banner} style={{ marginRight: 10 }} />
                <TextInput
                  ref={pwRef}
                  style={[styles.inputText, { color: colors.textPrimary }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t("auth.passwordPlaceholder")}
                  placeholderTextColor={colors.placeholder}
                  secureTextEntry={!pwVisible}
                  returnKeyType="done"
                  onSubmitEditing={() => { if (canSubmit) submit(); }}
                />
                <TouchableOpacity onPress={() => setPwVisible(!pwVisible)} hitSlop={10}>
                  <Ionicons name={pwVisible ? "eye-off-outline" : "eye-outline"} size={20} color={colors.placeholder} />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity onPress={() => router.push("/(auth)/forgot-password")} style={styles.forgotRow}>
              <Text style={[styles.forgotText, { color: colors.link }]}>{t("auth.forgot")}</Text>
            </TouchableOpacity>

            {err ? <Text style={[styles.errorText, { color: colors.error }]}>{err}</Text> : null}

            {/* Bouton Se connecter */}
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: colors.button, opacity: canSubmit && !loading ? 1 : 0.5 }]}
              onPress={submit}
              disabled={!canSubmit || loading}
              activeOpacity={0.85}
            >
              <Text style={[styles.btnText, { color: colors.buttonText }]}>
                {loading ? t("common.loading") : t("auth.login")}
              </Text>
            </TouchableOpacity>

            {/* Lien inscription */}
            <View style={styles.signupRow}>
              <Text style={[styles.signupText, { color: colors.linkSecondary }]}>{t("auth.noAccount")} </Text>
              <TouchableOpacity onPress={() => router.replace("/(auth)/signup")}>
                <Text style={[styles.signupLink, { color: colors.link }]}>{t("auth.signUp")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  blueBg: { position: "absolute", top: 0, left: 0, right: 0, height: BANNER_H + 40 },
  scrollContent: { flexGrow: 1 },

  bannerContent: {
    height: BANNER_H,
    paddingTop: Platform.OS === "ios" ? 56 : 44,
    paddingHorizontal: 20,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center", marginBottom: 12,
  },
  brandText: { fontSize: 14, fontFamily: fontFamily.openSansBold, letterSpacing: 3 },
  bannerTitle: { fontSize: 22, fontFamily: fontFamily.openSansBold, marginTop: 8 },
  bannerSubtitle: { fontSize: 14, fontFamily: fontFamily.openSansRegular, marginTop: 4 },

  card: {
    flex: 1, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 24, paddingTop: 28, paddingBottom: 40,
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 5,
  },

  label: { fontSize: 13, fontFamily: fontFamily.openSansSemiBold, marginBottom: 6 },
  inputBox: {
    height: 48, borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 12, flexDirection: "row", alignItems: "center",
  },
  inputText: { flex: 1, fontSize: 16, fontFamily: fontFamily.openSansRegular },
  forgotRow: { alignSelf: "flex-end", marginBottom: 16 },
  forgotText: { fontSize: 12, fontFamily: fontFamily.openSansSemiBold },
  errorText: { fontSize: 12, marginBottom: 8, fontFamily: fontFamily.openSansRegular },

  btn: {
    height: 52, borderRadius: 12,
    alignItems: "center", justifyContent: "center", marginTop: 8,
  },
  btnText: { fontSize: 16, fontFamily: fontFamily.openSansSemiBold },

  signupRow: { flexDirection: "row", justifyContent: "center", marginTop: 20 },
  signupText: { fontSize: 14, fontFamily: fontFamily.openSansRegular },
  signupLink: { fontSize: 14, fontFamily: fontFamily.openSansBold, textDecorationLine: "underline" },
});
