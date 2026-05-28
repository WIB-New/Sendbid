import React, { useState } from "react";
import { View, StyleSheet, TouchableOpacity, Modal, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../src/components/Screen";
import { TText } from "../src/components/TText";
import { useLocale, setLocale } from "../src/i18n";
import { useAuth } from "../src/store";
import { api } from "../src/api";
import { colors, spacing, radii } from "../src/theme";

const LANGUAGES = [
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "ar", label: "العربية", flag: "🇸🇦" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "it", label: "Italiano", flag: "🇮🇹" },
  { code: "pt", label: "Português", flag: "🇵🇹" },
];
const THEMES = [
  { key: "light", label: "Clair", icon: "sunny-outline" as const },
  { key: "dark", label: "Sombre", icon: "moon-outline" as const },
  { key: "system", label: "Système", icon: "phone-portrait-outline" as const },
];
// Liste complète des devises supportées (EUR + 28 corridors)
const CURRENCIES = [
  "EUR", "USD", "GBP", "CHF", "CAD", "AUD", "JPY", "CNY",
  "XOF", "XAF", "MAD", "TND", "DZD", "EGP", "NGN", "GHS", "KES",
  "ZAR", "RWF", "UGX", "TZS", "ETB", "MWK", "MZN", "AOA", "CDF",
  "SLL", "GMD", "GNF", "MGA", "MUR", "BIF",
];

export default function PreferencesScreen() {
  const locale = useLocale();
  const user = useAuth((s) => s.user);
  const refreshMe = useAuth((s) => s.refreshMe);
  const [theme, setTheme] = useState<string>(((user as any)?.theme as string) || "system");
  const [secondary, setSecondary] = useState<string>(((user as any)?.secondary_currency as string) || "GBP");
  const [openLang, setOpenLang] = useState(false);
  const [openTheme, setOpenTheme] = useState(false);
  const [openCur, setOpenCur] = useState(false);
  const primary = ((user as any)?.default_currency as string) || "EUR";

  const saveTheme = async (k: string) => { setTheme(k); setOpenTheme(false); try { await api.put("/auth/me", { theme: k }); refreshMe(); } catch {} };
  const saveCurrency = async (c: string) => { setSecondary(c); try { await api.put("/auth/me", { secondary_currency: c }); refreshMe(); } catch {} };
  const saveLang = async (l: string) => { setLocale(l); setOpenLang(false); try { await api.put("/auth/me", { language: l }); refreshMe(); } catch {} };

  const currentLang = LANGUAGES.find((l) => l.code === locale) || LANGUAGES[0];
  const currentTheme = THEMES.find((t) => t.key === theme) || THEMES[2];

  return (
    <Screen title="Préférences" back hero>
      <View style={styles.card}>
        {/* LANGUE — menu déroulant */}
        <TouchableOpacity testID="pref-lang-trigger" style={[styles.dropdownRow, styles.rowBorder]} onPress={() => setOpenLang(true)}>
          <View style={[styles.icon, { backgroundColor: "#10B9811A" }]}>
            <Ionicons name="language-outline" size={20} color="#10B981" />
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <TText variant="body" weight="semiBold">Langue</TText>
            <TText variant="label" color={colors.neutrals.textSecondary}>{currentLang.flag} {currentLang.label}</TText>
          </View>
          <Ionicons name="chevron-down" size={18} color={colors.neutrals.textSecondary} />
        </TouchableOpacity>

        {/* THÈME — menu déroulant */}
        <TouchableOpacity testID="pref-theme-trigger" style={[styles.dropdownRow, styles.rowBorder]} onPress={() => setOpenTheme(true)}>
          <View style={[styles.icon, { backgroundColor: "#6B72801A" }]}>
            <Ionicons name="contrast-outline" size={20} color="#6B7280" />
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <TText variant="body" weight="semiBold">Thème</TText>
            <TText variant="label" color={colors.neutrals.textSecondary}>{currentTheme.label}</TText>
          </View>
          <Ionicons name="chevron-down" size={18} color={colors.neutrals.textSecondary} />
        </TouchableOpacity>

        {/* DEVISES */}
        <View style={[styles.row, styles.rowBorder]}>
          <View style={[styles.icon, { backgroundColor: "#10B9811A" }]}>
            <Ionicons name="star" size={20} color="#10B981" />
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <TText variant="body" weight="semiBold">Devise principale</TText>
            <TText variant="label" color={colors.neutrals.textSecondary}>Devise native, non modifiable</TText>
          </View>
          <View style={styles.activePill}>
            <TText variant="label" weight="extraBold" color="white">{primary}</TText>
          </View>
        </View>        <TouchableOpacity testID="pref-cur-trigger" style={styles.dropdownRow} onPress={() => setOpenCur(true)}>
          <View style={[styles.icon, { backgroundColor: "#F59E0B1A" }]}>
            <Ionicons name="add-circle-outline" size={20} color="#F59E0B" />
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <TText variant="body" weight="semiBold">Devise secondaire</TText>
            <TText variant="label" color={colors.neutrals.textSecondary}>Affichée au second plan</TText>
          </View>
          <View style={styles.activePill}>
            <TText variant="label" weight="extraBold" color="white">{secondary}</TText>
          </View>
          <Ionicons name="chevron-down" size={18} color={colors.neutrals.textSecondary} style={{ marginLeft: 6 }} />
        </TouchableOpacity>
      </View>

      {/* Modal sélection DEVISE SECONDAIRE */}
      <Modal visible={openCur} transparent animationType="slide" onRequestClose={() => setOpenCur(false)}>
        <TouchableOpacity activeOpacity={1} style={styles.overlay} onPress={() => setOpenCur(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.sheet}>
            <TText variant="subtitle" weight="extraBold" style={{ marginBottom: 12 }}>Devise secondaire</TText>
            <ScrollView style={{ maxHeight: 400 }}>
              {CURRENCIES.filter((c) => c !== primary).map((c) => (
                <TouchableOpacity key={c} testID={`pref-cur-${c}`} onPress={() => { saveCurrency(c); setOpenCur(false); }} style={styles.optRow}>
                  <Ionicons name="cash-outline" size={20} color={colors.primary.base} style={{ marginRight: 12 }} />
                  <TText variant="body" weight={secondary === c ? "extraBold" : "semiBold"} style={{ flex: 1 }}>{c}</TText>
                  {secondary === c ? <Ionicons name="checkmark-circle" size={22} color="#10B981" /> : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Modal sélection LANGUE */}
      <Modal visible={openLang} transparent animationType="slide" onRequestClose={() => setOpenLang(false)}>
        <TouchableOpacity activeOpacity={1} style={styles.overlay} onPress={() => setOpenLang(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.sheet}>
            <TText variant="subtitle" weight="extraBold" style={{ marginBottom: 12 }}>Langue</TText>
            <ScrollView>
              {LANGUAGES.map((l) => (
                <TouchableOpacity key={l.code} testID={`pref-lang-${l.code}`} onPress={() => saveLang(l.code)} style={styles.optRow}>
                  <TText style={{ fontSize: 22, marginRight: 12 }}>{l.flag}</TText>
                  <TText variant="body" weight={locale === l.code ? "extraBold" : "semiBold"} style={{ flex: 1 }}>{l.label}</TText>
                  {locale === l.code ? <Ionicons name="checkmark-circle" size={22} color="#10B981" /> : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Modal sélection THÈME */}
      <Modal visible={openTheme} transparent animationType="slide" onRequestClose={() => setOpenTheme(false)}>
        <TouchableOpacity activeOpacity={1} style={styles.overlay} onPress={() => setOpenTheme(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.sheet}>
            <TText variant="subtitle" weight="extraBold" style={{ marginBottom: 12 }}>Thème</TText>
            <ScrollView>
              {THEMES.map((t) => (
                <TouchableOpacity key={t.key} testID={`pref-theme-${t.key}`} onPress={() => saveTheme(t.key)} style={styles.optRow}>
                  <View style={[styles.icon, { backgroundColor: "#6B72801A" }]}>
                    <Ionicons name={t.icon} size={20} color="#6B7280" />
                  </View>
                  <TText variant="body" weight={theme === t.key ? "extraBold" : "semiBold"} style={{ flex: 1, marginLeft: 14 }}>{t.label}</TText>
                  {theme === t.key ? <Ionicons name="checkmark-circle" size={22} color="#10B981" /> : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "white", borderRadius: radii.xxl, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingVertical: 14 },
  dropdownRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingVertical: 16 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  activePill: { backgroundColor: "#10B981", paddingHorizontal: 12, paddingVertical: 5, borderRadius: radii.full },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radii.full, borderWidth: 1, borderColor: colors.neutrals.border, backgroundColor: colors.neutrals.surface },
  chipActive: { backgroundColor: "#10B981", borderColor: "#10B981" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "white", borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl, padding: spacing.lg, paddingBottom: spacing.xl, maxHeight: "70%" },
  optRow: { flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
});
