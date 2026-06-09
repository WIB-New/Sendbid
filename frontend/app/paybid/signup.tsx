import React, { useState } from "react";
import { View, StyleSheet, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { TText } from "../../src/components/TText";
import { Input } from "../../src/components/Input";
import { Button } from "../../src/components/Button";
import { api, apiError } from "../../src/api";
import { flagEmoji } from "../../src/utils/dialCodes";
import { useThemedPaybidColors } from "../../src/themeContext";
import { paybidColors } from "../../src/paybidTheme";
import { spacing, radii } from "../../src/theme";

/** PAYBID agent signup — creates a role=agent account. */
export default function PaybidSignup() {
  const paybidColors = useThemedPaybidColors();
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("+221");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("SN");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setErr(null); setLoading(true);
    try {
      await api.post("/agent/signup", {
        full_name: fullName, email, phone, city, country, password,
      });
      router.replace("/paybid/login" as any);
    } catch (e: any) {
      setErr(apiError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: paybidColors.primary.dark }}>
      <LinearGradient colors={[paybidColors.primary.dark, paybidColors.primary.base]} style={styles.hero}>
        <SafeAreaView edges={["top"]}>
          <View style={styles.heroTop}>
            <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
              <Ionicons name="chevron-back" size={22} color="white" />
            </TouchableOpacity>
            <TText variant="body" weight="extraBold" color="white">PAYBID · Inscription</TText>
            <View style={{ width: 36 }} />
          </View>
          <View style={styles.heroBody}>
            <View style={styles.logoChip}>
              <Ionicons name="briefcase" size={36} color="white" />
            </View>
            <TText variant="title" weight="extraBold" color="white" align="center" style={{ marginTop: 12 }}>
              Devenir agent PAYBID
            </TText>
            <TText variant="caption" color="rgba(255,255,255,0.85)" align="center">
              Rejoignez le réseau de payeurs vérifiés
            </TText>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView style={styles.card} contentContainerStyle={styles.cardInner} keyboardShouldPersistTaps="handled">
          <Input label="Nom complet" value={fullName} onChangeText={setFullName} icon="person-outline" />
          <Input label="Email" value={email} onChangeText={setEmail} icon="mail-outline" autoCapitalize="none" keyboardType="email-address" />
          <Input label="Téléphone (E.164)" value={phone} onChangeText={setPhone} icon="call-outline" keyboardType="phone-pad" />
          <Input label="Ville d'activité" value={city} onChangeText={setCity} icon="location-outline" />
          <Input
            label={`Pays ${country ? flagEmoji(country) : ""}`}
            value={country}
            onChangeText={(v) => setCountry(v.toUpperCase())}
            icon="flag-outline"
            autoCapitalize="characters"
            maxLength={2}
            placeholder="Saisissez le code ISO2 du pays (FR, SN, CM…)"
          />
          <Input label="Mot de passe" value={password} onChangeText={setPassword} icon="lock-closed-outline" passwordToggle secureTextEntry />

          {err ? <TText variant="caption" color="#EF4444" style={{ marginVertical: 8 }}>{err}</TText> : null}

          <Button testID="paybid-signup-submit" title="Créer mon compte agent" icon="arrow-forward" onPress={submit} loading={loading} disabled={!fullName || !email || !phone || !city || !password} style={{ backgroundColor: paybidColors.primary.base }} />

          <View style={styles.loginRow}>
            <TText variant="caption">Déjà un compte ?  </TText>
            <TouchableOpacity testID="paybid-go-login" onPress={() => router.replace("/paybid/login" as any)}>
              <TText variant="caption" weight="extraBold" color={paybidColors.primary.base}>Se connecter</TText>
            </TouchableOpacity>
          </View>

          <View style={styles.termsBox}>
            <Ionicons name="shield-checkmark-outline" size={14} color={paybidColors.primary.base} />
            <TText variant="label" color={paybidColors.neutrals.textSecondary} style={{ marginLeft: 6, flex: 1 }}>
              Votre compte sera vérifié sous 24h. KYC agent requis avant la première offre.
            </TText>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: spacing.sm },
  iconBtn: { width: 36, height: 36, borderRadius: radii.full, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  heroBody: { alignItems: "center", marginTop: spacing.md },
  logoChip: { width: 64, height: 64, borderRadius: radii.xl, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" },
  card: { flex: 1, backgroundColor: paybidColors.neutrals.background, borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl, marginTop: -spacing.lg },
  cardInner: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  loginRow: { flexDirection: "row", justifyContent: "center", marginTop: spacing.lg },
  termsBox: { flexDirection: "row", alignItems: "flex-start", marginTop: spacing.lg, padding: spacing.md, backgroundColor: paybidColors.overlays.primarySoft, borderRadius: radii.lg },
});
