import React, { useState } from "react";
import { View, StyleSheet, Switch, TouchableOpacity, Platform, Alert, Modal, ScrollView } from "react-native";
import * as LocalAuth from "expo-local-authentication";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../src/components/Screen";
import { TText } from "../src/components/TText";
import { Card } from "../src/components/Card";
import { api, apiError } from "../src/api";
import { useAuth } from "../src/store";
import { colors, spacing, radii } from "../src/theme";
import { useTranslation, setLocale, SUPPORTED_LOCALES, i18n } from "../src/i18n";

const THEMES = [
  { code: "light", label: "Clair", icon: "sunny-outline" as const },
  { code: "dark", label: "Sombre (bientôt)", icon: "moon-outline" as const, disabled: true },
  { code: "system", label: "Système", icon: "phone-portrait-outline" as const },
];

const CURRENCIES = [
  { code: "EUR", label: "Euro", flag: "🇪🇺" },
  { code: "USD", label: "US Dollar", flag: "🇺🇸" },
  { code: "GBP", label: "British Pound", flag: "🇬🇧" },
  { code: "XOF", label: "Franc CFA UEMOA", flag: "🌍" },
  { code: "XAF", label: "Franc CFA CEMAC", flag: "🌍" },
  { code: "MAD", label: "Dirham marocain", flag: "🇲🇦" },
];

export default function Settings() {
  const { t } = useTranslation();
  const user = useAuth((s) => s.user);
  const refreshMe = useAuth((s) => s.refreshMe);
  const saveBio = useAuth((s) => s.saveBiometricToken);
  const clearBio = useAuth((s) => s.clearBiometricToken);

  const [push, setPush] = useState(user?.notif_prefs?.push ?? true);
  const [emailNotif, setEmailNotif] = useState(user?.notif_prefs?.email ?? true);
  const [smsNotif, setSmsNotif] = useState(user?.notif_prefs?.sms ?? false);
  const [bio, setBio] = useState(!!user?.biometric_enabled);
  const [theme, setThemeLocal] = useState<string>((user as any)?.theme || "light");
  const [currency, setCurrencyLocal] = useState<string>((user as any)?.default_currency || "EUR");
  const [showLang, setShowLang] = useState(false);
  const [showTheme, setShowTheme] = useState(false);
  const [showCur, setShowCur] = useState(false);

  const switchLang = async (code: any) => {
    await setLocale(code);
    try { await api.patch("/profile", { language: code }); } catch {}
    await refreshMe();
    setShowLang(false);
  };

  const switchTheme = async (code: string) => {
    setThemeLocal(code);
    try { await api.patch("/profile", { theme: code }); } catch {}
    await refreshMe();
    setShowTheme(false);
    if (Platform.OS === "web") {
      try { (window as any).alert(`Thème "${code}" enregistré. Le mode sombre sera visible dans une prochaine mise à jour.`); } catch {}
    }
  };

  const switchCurrency = async (code: string) => {
    setCurrencyLocal(code);
    try { await api.patch("/profile", { default_currency: code }); } catch {}
    await refreshMe();
    setShowCur(false);
  };

  const curLang = SUPPORTED_LOCALES.find((l) => l.code === i18n.locale) || SUPPORTED_LOCALES[0];
  const curTheme = THEMES.find((t) => t.code === theme) || THEMES[0];
  const curCurrency = CURRENCIES.find((c) => c.code === currency) || CURRENCIES[0];

  const updatePrefs = async (next: any) => {
    await api.patch("/profile", { notif_prefs: next });
    await refreshMe();
  };

  const toggleBio = async (val: boolean) => {
    if (val) {
      try {
        if (Platform.OS !== "web") {
          const compat = await LocalAuth.hasHardwareAsync();
          const enrolled = await LocalAuth.isEnrolledAsync();
          if (!compat || !enrolled) {
            Alert.alert("Biométrie indisponible", "Configurez Face ID / Touch ID dans les réglages de l'appareil.");
            return;
          }
          const r = await LocalAuth.authenticateAsync({ promptMessage: "Activer la biométrie SENDBID" });
          if (!r.success) return;
        }
        const { data } = await api.post("/auth/biometric-enable");
        await saveBio(data.biometric_token);
        setBio(true);
      } catch (e: any) {
        Alert.alert("Erreur", apiError(e));
      }
    } else {
      await api.post("/auth/biometric-disable");
      await clearBio();
      setBio(false);
    }
    refreshMe();
  };

  return (
    <Screen title="Paramètres" back hero>
      <Card>
        <TText variant="caption" weight="bold" color={colors.neutrals.textSecondary}>SÉCURITÉ</TText>
        <Row label="Connexion biométrique" value={<Switch testID="bio-toggle" value={bio} onValueChange={toggleBio} />} />
      </Card>

      <Card style={{ marginTop: spacing.md }}>
        <TText variant="caption" weight="bold" color={colors.neutrals.textSecondary}>NOTIFICATIONS</TText>
        <Row label="Push" value={<Switch testID="push-toggle" value={push} onValueChange={(v) => { setPush(v); updatePrefs({ push: v, email: emailNotif, sms: smsNotif }); }} />} />
        <Row label="Email" value={<Switch value={emailNotif} onValueChange={(v) => { setEmailNotif(v); updatePrefs({ push, email: v, sms: smsNotif }); }} />} />
        <Row label="SMS" value={<Switch value={smsNotif} onValueChange={(v) => { setSmsNotif(v); updatePrefs({ push, email: emailNotif, sms: v }); }} />} />
      </Card>

      <Card style={{ marginTop: spacing.md }}>
        <TText variant="caption" weight="bold" color={colors.neutrals.textSecondary}>PRÉFÉRENCES</TText>
        <TouchableOpacity testID="settings-lang" activeOpacity={0.7} style={styles.row} onPress={() => setShowLang(true)}>
          <TText variant="body">Langue</TText>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TText variant="caption" color={colors.primary.base} weight="semiBold">{curLang.flag} {curLang.label}</TText>
            <Ionicons name="chevron-forward" size={16} color={colors.neutrals.textTertiary} style={{ marginLeft: 4 }} />
          </View>
        </TouchableOpacity>
        <TouchableOpacity testID="settings-theme" activeOpacity={0.7} style={styles.row} onPress={() => setShowTheme(true)}>
          <TText variant="body">Thème</TText>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TText variant="caption" color={colors.primary.base} weight="semiBold">{curTheme.label}</TText>
            <Ionicons name="chevron-forward" size={16} color={colors.neutrals.textTertiary} style={{ marginLeft: 4 }} />
          </View>
        </TouchableOpacity>
        <TouchableOpacity testID="settings-currency" activeOpacity={0.7} style={styles.row} onPress={() => setShowCur(true)}>
          <TText variant="body">Devise secondaire</TText>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TText variant="caption" color={colors.primary.base} weight="semiBold">{curCurrency.flag} {curCurrency.code}</TText>
            <Ionicons name="chevron-forward" size={16} color={colors.neutrals.textTertiary} style={{ marginLeft: 4 }} />
          </View>
        </TouchableOpacity>
      </Card>

      {/* Modal Langue */}
      <Modal visible={showLang} transparent animationType="slide" onRequestClose={() => setShowLang(false)}>
        <TouchableOpacity activeOpacity={1} style={styles.modalOverlay} onPress={() => setShowLang(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalSheet}>
            <TText variant="subtitle" weight="bold" style={{ marginBottom: 4 }}>Choisir la langue</TText>
            <TText variant="caption" color={colors.neutrals.textSecondary} style={{ marginBottom: 16 }}>L'application sera traduite immédiatement.</TText>
            <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
              {SUPPORTED_LOCALES.map((l) => (
                <TouchableOpacity key={l.code} testID={`lang-opt-${l.code}`} onPress={() => switchLang(l.code)} style={[styles.langRow, l.code === i18n.locale && styles.langRowActive]}>
                  <TText variant="title">{l.flag}</TText>
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <TText weight="semiBold">{l.label}</TText>
                    <TText variant="caption" color={colors.neutrals.textSecondary}>{l.code.toUpperCase()}</TText>
                  </View>
                  {l.code === i18n.locale ? <Ionicons name="checkmark-circle" size={22} color={colors.primary.base} /> : <Ionicons name="chevron-forward" size={18} color={colors.neutrals.textTertiary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Modal Thème */}
      <Modal visible={showTheme} transparent animationType="slide" onRequestClose={() => setShowTheme(false)}>
        <TouchableOpacity activeOpacity={1} style={styles.modalOverlay} onPress={() => setShowTheme(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalSheet}>
            <TText variant="subtitle" weight="bold" style={{ marginBottom: 4 }}>Choisir le thème</TText>
            <TText variant="caption" color={colors.neutrals.textSecondary} style={{ marginBottom: 16 }}>Apparence de l'application. Le mode sombre arrive prochainement.</TText>
            {THEMES.map((t) => (
              <TouchableOpacity key={t.code} testID={`theme-opt-${t.code}`} disabled={t.disabled} onPress={() => !t.disabled && switchTheme(t.code)} style={[styles.langRow, t.code === theme && styles.langRowActive, t.disabled && { opacity: 0.4 }]}>
                <Ionicons name={t.icon} size={22} color={colors.primary.base} />
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <TText weight="semiBold">{t.label}</TText>
                </View>
                {t.code === theme ? <Ionicons name="checkmark-circle" size={22} color={colors.primary.base} /> : <Ionicons name="chevron-forward" size={18} color={colors.neutrals.textTertiary} />}
              </TouchableOpacity>
            ))}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Modal Devise */}
      <Modal visible={showCur} transparent animationType="slide" onRequestClose={() => setShowCur(false)}>
        <TouchableOpacity activeOpacity={1} style={styles.modalOverlay} onPress={() => setShowCur(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalSheet}>
            <TText variant="subtitle" weight="bold" style={{ marginBottom: 4 }}>Devise secondaire</TText>
            <TText variant="caption" color={colors.neutrals.textSecondary} style={{ marginBottom: 16 }}>Devise affichée au second plan en complément de votre devise principale (EUR par défaut).</TText>
            <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
              {CURRENCIES.map((c) => (
                <TouchableOpacity key={c.code} testID={`cur-opt-${c.code}`} onPress={() => switchCurrency(c.code)} style={[styles.langRow, c.code === currency && styles.langRowActive]}>
                  <TText variant="title">{c.flag}</TText>
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <TText weight="semiBold">{c.label}</TText>
                    <TText variant="caption" color={colors.neutrals.textSecondary}>{c.code}</TText>
                  </View>
                  {c.code === currency ? <Ionicons name="checkmark-circle" size={22} color={colors.primary.base} /> : <Ionicons name="chevron-forward" size={18} color={colors.neutrals.textTertiary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <TText variant="body">{label}</TText>
      {value}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.neutrals.border },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: colors.neutrals.surface, borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl, padding: spacing.lg, paddingBottom: spacing.xl },
  langRow: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 12, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.neutrals.border, marginBottom: 8 },
  langRowActive: { backgroundColor: colors.overlays.primarySoft, borderColor: colors.primary.base },
});
