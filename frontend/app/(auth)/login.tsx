import React, { useEffect, useState } from "react";
import { View, StyleSheet, TouchableOpacity, Alert, Platform, ScrollView, KeyboardAvoidingView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as LocalAuth from "expo-local-authentication";
import { Ionicons } from "@expo/vector-icons";
import { TText } from "../../src/components/TText";
import { Input } from "../../src/components/Input";
import { Button } from "../../src/components/Button";
import { SendBidLogo } from "../../src/components/Logo";
import { api, apiError } from "../../src/api";
import { useAuth } from "../../src/store";
import { colors, spacing, radii } from "../../src/theme";
import { useThemedColors } from "../../src/themeContext";
/**
 * Login v4.0 — Dark navy gradient header with logo + "Bon retour parmi nous",
 * white card with rounded corners holding form, teal "Se connecter",
 * separator "OU", biometric option, forgot password link, signup link.
 */
export default function Login() {
  const colors = useThemedColors();
  const router = useRouter();
  const setSession = useAuth((s) => s.setSession);
  const getBio = useAuth((s) => s.getBiometricToken);
  const [identifier, setIdentifier] = useState("client@sendbid.app");
  const [password, setPassword] = useState("Client@123!");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioToken, setBioToken] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const compat = await LocalAuth.hasHardwareAsync();
        const enrolled = await LocalAuth.isEnrolledAsync();
        setBioAvailable(compat && enrolled && Platform.OS !== "web");
      } catch { setBioAvailable(false); }
      const t = await getBio();
      setBioToken(t || null);
    })();
  }, [getBio]);

  // Redirection selon le rôle : admin/super_admin → /admin, partner_admin → /partner,
  // agent_admin (super-agent) → /agent, agent → /paybid, sinon (user) → /(tabs).
  // Spec v7 : pour les utilisateurs CLIENT sans PIN, on force /create-pin
  const routeForRole = (u: any): any => {
    const r = u?.role;
    if (r === "admin" || r === "super_admin") return "/admin";
    if (r === "partner_admin") return "/partner";
    if (r === "agent_admin") return "/agent";
    if (r === "agent") return "/paybid/(tabs)";
    // Client : PIN obligatoire — si pas encore créé, redirection forcée
    if (!u?.has_pin && !u?.pin_hash) return { pathname: "/(auth)/create-pin", params: { user_id: u?.id, skip_otp: "1" } };
    return "/(tabs)";
  };

  const submit = async () => {
    setErr(null); setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { identifier, password });
      await setSession(data.access_token, data.user);
      const target = routeForRole(data.user);
      if (typeof target === "string") {
        router.replace(target);
      } else {
        router.replace(target);
      }
    } catch (e: any) {
      setErr(apiError(e));
    } finally {
      setLoading(false);
    }
  };

  const biometricLogin = async () => {
    if (!bioToken) {
      Alert.alert("Biométrie non configurée", "Connectez-vous une fois avec votre mot de passe puis activez la biométrie dans Paramètres.");
      return;
    }
    try {
      if (Platform.OS !== "web") {
        const r = await LocalAuth.authenticateAsync({ promptMessage: "Authentification SENDBID", fallbackLabel: "Mot de passe" });
        if (!r.success) return;
      }
      const { data } = await api.post("/auth/biometric-login", { biometric_token: bioToken });
      await setSession(data.access_token, data.user);
      const target = routeForRole(data.user);
      router.replace(target);
    } catch (e: any) { setErr(apiError(e)); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#022a6b" }}>
      <LinearGradient colors={["#022a6b", "#052080", "#0F1B40"]} style={styles.header}>
        <SafeAreaView edges={["top"]}>
          <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={22} color="white" />
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
          </View>
          <View style={styles.headerBody}>
            <View style={styles.logoChip}><SendBidLogo size={40} /></View>
            <TText variant="title" weight="extraBold" color="white" style={{ marginTop: spacing.md }}>
              Bon retour parmi nous
            </TText>
            <TText variant="caption" color="rgba(255,255,255,0.8)" style={{ marginTop: 4 }}>
              Connectez-vous pour gérer vos transferts
            </TText>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={styles.card}
          contentContainerStyle={styles.cardInner}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Input
            testID="login-identifier"
            label="Email, téléphone ou ID de profil"
            value={identifier}
            onChangeText={setIdentifier}
            icon="person-outline"
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Input
            testID="login-password"
            label="Mot de passe"
            value={password}
            onChangeText={setPassword}
            icon="lock-closed-outline"
            passwordToggle
            secureTextEntry
          />

          <TouchableOpacity
            testID="login-forgot"
            onPress={() => router.push("/(auth)/forgot-password")}
            style={styles.forgotRow}
          >
            <TText variant="caption" weight="semiBold" color={colors.primary.base}>
              Mot de passe oublié ?
            </TText>
          </TouchableOpacity>

          {err ? <TText variant="caption" color={colors.status.error} style={{ marginBottom: spacing.sm }}>{err}</TText> : null}

          <Button
            testID="login-submit"
            title="Se connecter"
            onPress={submit}
            loading={loading}
            icon="arrow-forward"
            style={{ backgroundColor: "#10B981" }}
          />

          {/* Connexion biométrique — affichée si l'utilisateur a activé Face ID / empreinte */}
          {bioAvailable && bioToken ? (
            <TouchableOpacity
              testID="login-biometric"
              onPress={biometricLogin}
              style={styles.bioBtn}
              activeOpacity={0.85}
            >
              <Ionicons name="finger-print" size={22} color={colors.primary.base} />
              <TText variant="body" weight="extraBold" color={colors.primary.base} style={{ marginLeft: 10 }}>
                Connexion biométrique
              </TText>
            </TouchableOpacity>
          ) : null}

          <View style={styles.signupRow}>
            <TText variant="caption" color={colors.neutrals.textSecondary}>
              Pas encore de compte ?{" "}
            </TText>
            <TouchableOpacity testID="login-go-signup" onPress={() => router.replace("/(auth)/signup")}>
              <TText variant="caption" weight="bold" color={colors.primary.base}>
                S'inscrire
              </TText>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  headerTop: { flexDirection: "row", alignItems: "center", paddingTop: spacing.sm },
  backBtn: {
    width: 36, height: 36, borderRadius: radii.full,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center", justifyContent: "center",
  },
  headerBody: { alignItems: "center", marginTop: spacing.lg },
  logoChip: {
    width: 72, height: 72, borderRadius: radii.xl,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.2)",
  },
  card: {
    flex: 1,
    backgroundColor: colors.neutrals.background,
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    marginTop: -spacing.lg,
  },
  cardInner: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  forgotRow: { alignSelf: "flex-end", marginBottom: spacing.md },
  orRow: { flexDirection: "row", alignItems: "center", marginVertical: spacing.lg },
  orLine: { flex: 1, height: 1, backgroundColor: colors.neutrals.border },
  signupRow: { flexDirection: "row", justifyContent: "center", marginTop: spacing.xl },
  bioBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    marginTop: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: colors.primary.base,
    backgroundColor: colors.overlays.primarySoft,
  },
});
