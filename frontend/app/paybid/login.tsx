import React, { useState } from "react";
import { View, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { TText } from "../../src/components/TText";
import { Input } from "../../src/components/Input";
import { Button } from "../../src/components/Button";
import { SendBidLogo } from "../../src/components/Logo";
import { api, apiError } from "../../src/api";
import { useAuth } from "../../src/store";
import { useThemedPaybidColors } from "../../src/themeContext";
import { paybidColors } from "../../src/paybidTheme";
import { spacing, radii } from "../../src/theme";

export default function PaybidLogin() {
  const paybidColors = useThemedPaybidColors();
  const router = useRouter();
  const setUser = useAuth((s) => s.setUser);
  const setWallet = useAuth((s) => s.setWallet);
  const [email, setEmail] = useState("agent@paybid.app");
  const [password, setPassword] = useState("Agent@123!");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setErr(null); setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { identifier: email, password });
      await AsyncStorage.setItem("sb_token", data.access_token);
      const me = await api.get("/auth/me");
      if (me.data.user.role !== "agent") {
        setErr("Ce compte n'est pas un compte agent PAYBID");
        await AsyncStorage.removeItem("sb_token");
        return;
      }
      await AsyncStorage.setItem("sb_user", JSON.stringify(me.data.user));
      setUser(me.data.user);
      if (me.data.wallet) setWallet(me.data.wallet);
      router.replace("/paybid/(tabs)" as any);
    } catch (e: any) { setErr(apiError(e)); } finally { setLoading(false); }
  };

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient colors={paybidColors.gradients.splash} style={styles.hero}>
        <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
          <View style={styles.heroContent}>
            <View style={styles.logoBox}>
              <SendBidLogo size={64} />
            </View>
            <TText variant="display" weight="extraBold" color="white" align="center" style={{ letterSpacing: 1 }}>PAYBID</TText>
            <TText variant="subtitle" color="rgba(255,255,255,0.92)" align="center">Accept. Deliver. Earn.</TText>
            <TText variant="caption" color="rgba(255,255,255,0.85)" align="center" style={{ marginTop: spacing.md }}>
              L'app agent du réseau SENDBID
            </TText>
          </View>
        </SafeAreaView>
      </LinearGradient>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.formWrap}>
        <SafeAreaView edges={["bottom"]} style={styles.form}>
          <TText variant="subtitle" weight="extraBold" style={{ marginBottom: 4 }}>Connexion agent</TText>
          <TText variant="caption" color={paybidColors.neutrals.textSecondary} style={{ marginBottom: spacing.lg }}>Identifiants fournis par votre superviseur SENDBID.</TText>
          <Input testID="paybid-email" label="Email agent" value={email} onChangeText={setEmail} icon="person-outline" autoCapitalize="none" />
          <Input testID="paybid-password" label="Mot de passe" value={password} onChangeText={setPassword} icon="lock-closed-outline" secureTextEntry />
          {err ? <TText variant="caption" color={paybidColors.status.error}>{err}</TText> : null}
          <View style={{ height: 8 }} />
          <Button testID="paybid-submit" title="Se connecter" loading={loading} onPress={submit} icon="arrow-forward" style={{ backgroundColor: paybidColors.primary.base }} />
          <TouchableOpacity testID="paybid-go-signup" onPress={() => router.push("/paybid/signup" as any)} style={{ alignSelf: "center", marginTop: spacing.md }}>
            <TText variant="caption" color={paybidColors.neutrals.textSecondary}>
              Pas encore agent ? <TText variant="caption" weight="extraBold" color={paybidColors.primary.base}>Créer un compte</TText>
            </TText>
          </TouchableOpacity>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { flex: 1.05 },
  heroContent: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl },
  logoBox: { width: 96, height: 96, borderRadius: radii.xxl, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  formWrap: { flex: 1.2, backgroundColor: paybidColors.neutrals.background },
  form: { padding: spacing.xl },
});
