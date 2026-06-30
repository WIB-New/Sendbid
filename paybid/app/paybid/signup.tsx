import React, { useState } from "react";
import { View, StyleSheet, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Modal, FlatList } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { TText } from "../../src/components/TText";
import { Input } from "../../src/components/Input";
import { Button } from "../../src/components/Button";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, apiError } from "../../src/api";
import { useAuth } from "../../src/store";
import { paybidColors } from "../../src/paybidTheme";
import { spacing, radii } from "../../src/theme";
import { useTranslation } from "../../src/i18n";

/** PAYBID agent signup — creates a role=agent account. */
export default function PaybidSignup() {
  const { t } = useTranslation();
  const router = useRouter();
  const setUser = useAuth((s) => s.setUser);
  const setWallet = useAuth((s) => s.setWallet);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [phoneLocal, setPhoneLocal] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [countryPickerOpen, setCountryPickerOpen] = useState(false);

  const COUNTRIES = [
    { iso: "CM", name: "Cameroun", code: "+237", flag: "🇨🇲" },
    { iso: "SN", name: "Sénégal", code: "+221", flag: "🇸🇳" },
    { iso: "CI", name: "Côte d'Ivoire", code: "+225", flag: "🇨🇮" },
    { iso: "CD", name: "RD Congo", code: "+243", flag: "🇨🇩" },
    { iso: "CG", name: "Congo-Brazzaville", code: "+242", flag: "🇨🇬" },
    { iso: "GA", name: "Gabon", code: "+241", flag: "🇬🇦" },
    { iso: "TG", name: "Togo", code: "+228", flag: "🇹🇬" },
    { iso: "BJ", name: "Bénin", code: "+229", flag: "🇧🇯" },
    { iso: "ML", name: "Mali", code: "+223", flag: "🇲🇱" },
    { iso: "GN", name: "Guinée", code: "+224", flag: "🇬🇳" },
    { iso: "GW", name: "Guinée-Bissau", code: "+245", flag: "🇬🇼" },
    { iso: "GQ", name: "Guinée équatoriale", code: "+240", flag: "🇬🇶" },
    { iso: "BF", name: "Burkina Faso", code: "+226", flag: "🇧🇫" },
    { iso: "NE", name: "Niger", code: "+227", flag: "🇳🇪" },
    { iso: "TD", name: "Tchad", code: "+235", flag: "🇹🇩" },
    { iso: "CF", name: "Centrafrique", code: "+236", flag: "🇨🇫" },
    { iso: "MG", name: "Madagascar", code: "+261", flag: "🇲🇬" },
    { iso: "KM", name: "Comores", code: "+269", flag: "🇰🇲" },
    { iso: "MR", name: "Mauritanie", code: "+222", flag: "🇲🇷" },
    { iso: "DJ", name: "Djibouti", code: "+253", flag: "🇩🇯" },
    { iso: "RW", name: "Rwanda", code: "+250", flag: "🇷🇼" },
    { iso: "BI", name: "Burundi", code: "+257", flag: "🇧🇮" },
    { iso: "MA", name: "Maroc", code: "+212", flag: "🇲🇦" },
    { iso: "TN", name: "Tunisie", code: "+216", flag: "🇹🇳" },
    { iso: "DZ", name: "Algérie", code: "+213", flag: "🇩🇿" },
    { iso: "NG", name: "Nigeria", code: "+234", flag: "🇳🇬" },
    { iso: "GH", name: "Ghana", code: "+233", flag: "🇬🇭" },
    { iso: "KE", name: "Kenya", code: "+254", flag: "🇰🇪" },
    { iso: "TZ", name: "Tanzanie", code: "+255", flag: "🇹🇿" },
    { iso: "UG", name: "Ouganda", code: "+256", flag: "🇺🇬" },
    { iso: "ZA", name: "Afrique du Sud", code: "+27", flag: "🇿🇦" },
    { iso: "ET", name: "Éthiopie", code: "+251", flag: "🇪🇹" },
    { iso: "MZ", name: "Mozambique", code: "+258", flag: "🇲🇿" },
    { iso: "AO", name: "Angola", code: "+244", flag: "🇦🇴" },
    { iso: "FR", name: "France", code: "+33", flag: "🇫🇷" },
    { iso: "BE", name: "Belgique", code: "+32", flag: "🇧🇪" },
    { iso: "CH", name: "Suisse", code: "+41", flag: "🇨🇭" },
    { iso: "DE", name: "Allemagne", code: "+49", flag: "🇩🇪" },
    { iso: "GB", name: "Royaume-Uni", code: "+44", flag: "🇬🇧" },
    { iso: "US", name: "États-Unis", code: "+1", flag: "🇺🇸" },
    { iso: "CA", name: "Canada", code: "+1", flag: "🇨🇦" },
    { iso: "IT", name: "Italie", code: "+39", flag: "🇮🇹" },
    { iso: "ES", name: "Espagne", code: "+34", flag: "🇪🇸" },
    { iso: "PT", name: "Portugal", code: "+351", flag: "🇵🇹" },
  ];

  const selectCountry = (c: typeof COUNTRIES[0]) => {
    setCountry(c.iso);
    setCountryCode(c.code);
    setCountryPickerOpen(false);
  };

  const phone = countryCode ? `${countryCode}${phoneLocal.replace(/^0+/, "")}` : phoneLocal;
  const selectedCountry = COUNTRIES.find(c => c.iso === country) || null;

  const submit = async () => {
    if (password !== confirmPassword) {
      setErr("Les mots de passe ne correspondent pas");
      return;
    }
    if (password.length < 8) {
      setErr("Le mot de passe doit contenir au moins 8 caractères");
      return;
    }
    if (!phoneLocal || phoneLocal.length < 6) {
      setErr("Numéro de téléphone invalide");
      return;
    }
    setErr(null); setLoading(true);
    try {
      await api.post("/agent/signup", {
        full_name: fullName, email, phone, city, country, password,
      });
      // Auto-login après inscription
      const { data } = await api.post("/auth/login", { identifier: email, password, role: "agent" });
      await AsyncStorage.setItem("sb_token", data.access_token);
      await AsyncStorage.setItem("sb_user", JSON.stringify(data.user));
      setUser(data.user);
      // Récupérer wallet
      try {
        const me = await api.get("/auth/me");
        if (me.data.wallet) setWallet(me.data.wallet);
      } catch {}
      // Rediriger vers création du code PIN
      router.replace("/paybid/create-pin" as any);
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

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }} keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}>
        <ScrollView style={styles.card} contentContainerStyle={styles.cardInner} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false}>
          <Input label="Nom complet" value={fullName} onChangeText={setFullName} icon="person-outline"
            labelColor={paybidColors.neutrals.textSecondary}
            boxStyle={{ backgroundColor: paybidColors.neutrals.surface, borderColor: paybidColors.neutrals.border }}
            placeholderTextColor={paybidColors.neutrals.textTertiary}
            style={{ color: paybidColors.neutrals.textPrimary }}
          />
          <Input label="Email" value={email} onChangeText={setEmail} icon="mail-outline" autoCapitalize="none" keyboardType="email-address"
            labelColor={paybidColors.neutrals.textSecondary}
            boxStyle={{ backgroundColor: paybidColors.neutrals.surface, borderColor: paybidColors.neutrals.border }}
            placeholderTextColor={paybidColors.neutrals.textTertiary}
            style={{ color: paybidColors.neutrals.textPrimary }}
          />
          <TText variant="caption" weight="bold" color={paybidColors.neutrals.textSecondary} style={{ marginBottom: 4, marginTop: 4 }}>Pays</TText>
          <TouchableOpacity style={styles.countryPicker} onPress={() => setCountryPickerOpen(true)} activeOpacity={0.7}>
            {selectedCountry ? (
              <>
                <TText style={{ fontSize: 18 }}>{selectedCountry.flag}</TText>
                <TText weight="semiBold" color={paybidColors.neutrals.textPrimary} style={{ flex: 1, marginLeft: 10, fontSize: 14 }}>{selectedCountry.name}</TText>
                <TText variant="caption" color={paybidColors.neutrals.textTertiary}>{selectedCountry.code}</TText>
              </>
            ) : (
              <>
                <Ionicons name="globe-outline" size={20} color={paybidColors.neutrals.textTertiary} />
                <TText color={paybidColors.neutrals.textTertiary} style={{ flex: 1, marginLeft: 10, fontSize: 14 }}>Sélectionnez votre pays</TText>
              </>
            )}
            <Ionicons name="chevron-down" size={16} color={paybidColors.neutrals.textTertiary} style={{ marginLeft: 6 }} />
          </TouchableOpacity>
          <Input label="Ville d'activité" value={city} onChangeText={setCity} icon="location-outline" placeholder="Douala, Yaoundé..."
            labelColor={paybidColors.neutrals.textSecondary}
            boxStyle={{ backgroundColor: paybidColors.neutrals.surface, borderColor: paybidColors.neutrals.border }}
            placeholderTextColor={paybidColors.neutrals.textTertiary}
            style={{ color: paybidColors.neutrals.textPrimary }}
          />
          <TText variant="caption" weight="bold" color={paybidColors.neutrals.textSecondary} style={{ marginBottom: 4, marginTop: 4 }}>Téléphone</TText>
          <View style={styles.phoneRow}>
            <View style={styles.codeSelector}>
              {selectedCountry ? (
                <>
                  <TText style={{ fontSize: 14 }}>{selectedCountry.flag}</TText>
                  <TText weight="bold" color={paybidColors.neutrals.textPrimary} style={{ fontSize: 13, marginLeft: 4 }}>{countryCode}</TText>
                </>
              ) : (
                <TText variant="caption" color={paybidColors.neutrals.textTertiary}>---</TText>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Input label="" value={phoneLocal} onChangeText={setPhoneLocal} icon="call-outline" keyboardType="phone-pad" placeholder="6XX XXX XXX"
                labelColor={paybidColors.neutrals.textSecondary}
                boxStyle={{ backgroundColor: paybidColors.neutrals.surface, borderColor: paybidColors.neutrals.border }}
                placeholderTextColor={paybidColors.neutrals.textTertiary}
                style={{ color: paybidColors.neutrals.textPrimary }}
              />
            </View>
          </View>
          <Input label="Mot de passe (min. 8 caractères)" value={password} onChangeText={setPassword} icon="lock-closed-outline" passwordToggle secureTextEntry
            labelColor={paybidColors.neutrals.textSecondary}
            boxStyle={{ backgroundColor: paybidColors.neutrals.surface, borderColor: paybidColors.neutrals.border }}
            placeholderTextColor={paybidColors.neutrals.textTertiary}
            style={{ color: paybidColors.neutrals.textPrimary }}
          />
          <Input label="Confirmer le mot de passe" value={confirmPassword} onChangeText={setConfirmPassword} icon="lock-closed-outline" passwordToggle secureTextEntry
            labelColor={paybidColors.neutrals.textSecondary}
            boxStyle={{ backgroundColor: paybidColors.neutrals.surface, borderColor: paybidColors.neutrals.border }}
            placeholderTextColor={paybidColors.neutrals.textTertiary}
            style={{ color: paybidColors.neutrals.textPrimary }}
          />
          {password && confirmPassword && password !== confirmPassword ? (
            <TText variant="caption" color="#EF4444" style={{ marginTop: -4, marginBottom: 4 }}>Les mots de passe ne correspondent pas</TText>
          ) : null}

          {err ? <TText variant="caption" color="#EF4444" style={{ marginVertical: 8 }}>{err}</TText> : null}

          <Button testID="paybid-signup-submit" title="Créer mon compte agent" icon="arrow-forward" onPress={submit} loading={loading} disabled={!fullName || !email || !phoneLocal || !city || !country || !password || !confirmPassword || password !== confirmPassword} style={{ backgroundColor: paybidColors.primary.base }} />

          <View style={styles.loginRow}>
            <TText variant="caption" color={paybidColors.neutrals.textSecondary}>Déjà un compte ?  </TText>
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

      {/* Modal sélection pays */}
      <Modal visible={countryPickerOpen} transparent animationType="slide" onRequestClose={() => setCountryPickerOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <TText weight="extraBold" color={paybidColors.neutrals.textPrimary} style={{ fontSize: 16 }}>Sélectionnez votre pays</TText>
              <TouchableOpacity onPress={() => setCountryPickerOpen(false)}>
                <Ionicons name="close-circle" size={28} color={paybidColors.neutrals.textTertiary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={COUNTRIES}
              keyExtractor={(item) => item.iso}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.countryRow, item.iso === country && styles.countryRowActive]}
                  onPress={() => selectCountry(item)}
                  activeOpacity={0.7}
                >
                  <TText style={{ fontSize: 20 }}>{item.flag}</TText>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <TText weight="semiBold" color={paybidColors.neutrals.textPrimary}>{item.name}</TText>
                    <TText variant="caption" color={paybidColors.neutrals.textSecondary}>{item.code}</TText>
                  </View>
                  {item.iso === country ? <Ionicons name="checkmark-circle" size={22} color={paybidColors.primary.base} /> : null}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
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
  cardInner: { padding: spacing.lg, paddingBottom: 120 },
  loginRow: { flexDirection: "row", justifyContent: "center", marginTop: spacing.lg },
  termsBox: { flexDirection: "row", alignItems: "flex-start", marginTop: spacing.lg, padding: spacing.md, backgroundColor: paybidColors.overlays.primarySoft, borderRadius: radii.lg },
  phoneRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  codeSelector: { flexDirection: "row", alignItems: "center", backgroundColor: paybidColors.neutrals.surface, borderWidth: 1, borderColor: paybidColors.neutrals.border, borderRadius: radii.lg, paddingHorizontal: 12, paddingVertical: 14, minWidth: 90 },
  countryPicker: { flexDirection: "row", alignItems: "center", backgroundColor: paybidColors.neutrals.surface, borderWidth: 1, borderColor: paybidColors.neutrals.border, borderRadius: radii.lg, paddingHorizontal: 14, paddingVertical: 14, marginBottom: 8 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: "white", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: 40, maxHeight: "70%" },
  countryRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 8, borderRadius: radii.lg },
  countryRowActive: { backgroundColor: paybidColors.overlays.primarySoft },
});
