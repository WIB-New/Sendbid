import React, { useState } from "react";
import { View, StyleSheet, TouchableOpacity, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { TText } from "../../src/components/TText";
import { useThemedPaybidColors } from "../../src/themeContext";
import { paybidColors } from "../../src/paybidTheme";
import { spacing, radii } from "../../src/theme";
import { useLocale, SUPPORTED_LOCALES, LocaleCode } from "../../src/i18n";

const CURRENCIES = [
  { code: "EUR", label: "Euro", flag: "🇪🇺" },
  { code: "XOF", label: "Franc CFA (UEMOA)", flag: "🌍" },
  { code: "XAF", label: "Franc CFA (CEMAC)", flag: "🌍" },
  { code: "GHS", label: "Cedi ghanéen", flag: "🇬🇭" },
  { code: "NGN", label: "Naira nigérian", flag: "🇳🇬" },
  { code: "MAD", label: "Dirham marocain", flag: "🇲🇦" },
  { code: "TND", label: "Dinar tunisien", flag: "🇹🇳" },
  { code: "BRL", label: "Real brésilien", flag: "🇧🇷" },
  { code: "CNY", label: "Yuan chinois", flag: "🇨🇳" },
  { code: "GBP", label: "Livre sterling", flag: "🇬🇧" },
  { code: "USD", label: "Dollar américain", flag: "🇺🇸" },
];

export default function PaybidSettings() {
  const colors = useThemedPaybidColors();
  const router = useRouter();
  const { locale, setLocale } = useLocale();
  const [currency, setCurrency] = useState("XOF");
  const [showLang, setShowLang] = useState(false);
  const [showCurrency, setShowCurrency] = useState(false);

  const currentLang = SUPPORTED_LOCALES.find(l => l.code === locale);
  const currentCurrency = CURRENCIES.find(c => c.code === currency);

  const handleLang = async (code: LocaleCode) => {
    await setLocale(code);
    setShowLang(false);
    if (code === "ar") {
      Alert.alert("Langue changée", "Le mode RTL (arabe) prendra effet au prochain redémarrage de l'app.");
    }
  };

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.neutrals.background }}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.neutrals.textPrimary} />
        </TouchableOpacity>
        <TText variant="subtitle" weight="extraBold" style={{ marginLeft: 12 }}>Paramètres</TText>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>

        {/* ── Langue ── */}
        <TText variant="label" weight="bold" color={colors.neutrals.textSecondary} style={styles.sectionLabel}>LANGUE DE L'APPLICATION</TText>
        <View style={styles.card}>
          <TouchableOpacity style={styles.row} onPress={() => setShowLang(v => !v)} activeOpacity={0.75}>
            <View style={[styles.iconWrap, { backgroundColor: "#EEF2FF" }]}>
              <Ionicons name="language-outline" size={20} color="#6366F1" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <TText variant="body" weight="extraBold">Langue</TText>
              <TText variant="caption" color={colors.neutrals.textSecondary}>
                {currentLang?.flag} {currentLang?.label}
              </TText>
            </View>
            <Ionicons name={showLang ? "chevron-up" : "chevron-down"} size={18} color={colors.neutrals.textTertiary} />
          </TouchableOpacity>

          {showLang && (
            <View style={styles.picker}>
              {SUPPORTED_LOCALES.map(l => (
                <TouchableOpacity
                  key={l.code}
                  style={[styles.pickerRow, locale === l.code && styles.pickerRowActive]}
                  onPress={() => handleLang(l.code)}
                  activeOpacity={0.75}
                >
                  <TText style={{ fontSize: 22 }}>{l.flag}</TText>
                  <TText variant="body" weight={locale === l.code ? "extraBold" : "regular"} style={{ marginLeft: 12, flex: 1 }}>
                    {l.label}
                  </TText>
                  {locale === l.code && <Ionicons name="checkmark-circle" size={20} color={paybidColors.primary.base} />}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* ── Devise locale ── */}
        <TText variant="label" weight="bold" color={colors.neutrals.textSecondary} style={styles.sectionLabel}>DEVISE LOCALE</TText>
        <View style={styles.card}>
          <TouchableOpacity style={styles.row} onPress={() => setShowCurrency(v => !v)} activeOpacity={0.75}>
            <View style={[styles.iconWrap, { backgroundColor: "#D1FAE5" }]}>
              <Ionicons name="cash-outline" size={20} color="#10B981" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <TText variant="body" weight="extraBold">Devise d'affichage</TText>
              <TText variant="caption" color={colors.neutrals.textSecondary}>
                {currentCurrency?.flag} {currentCurrency?.label} ({currentCurrency?.code})
              </TText>
            </View>
            <Ionicons name={showCurrency ? "chevron-up" : "chevron-down"} size={18} color={colors.neutrals.textTertiary} />
          </TouchableOpacity>

          {showCurrency && (
            <View style={styles.picker}>
              {CURRENCIES.map(c => (
                <TouchableOpacity
                  key={c.code}
                  style={[styles.pickerRow, currency === c.code && styles.pickerRowActive]}
                  onPress={() => { setCurrency(c.code); setShowCurrency(false); }}
                  activeOpacity={0.75}
                >
                  <TText style={{ fontSize: 20 }}>{c.flag}</TText>
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <TText variant="body" weight={currency === c.code ? "extraBold" : "regular"}>{c.label}</TText>
                    <TText variant="label" color={colors.neutrals.textTertiary}>{c.code}</TText>
                  </View>
                  {currency === c.code && <Ionicons name="checkmark-circle" size={20} color={paybidColors.primary.base} />}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* ── Sécurité ── */}
        <TText variant="label" weight="bold" color={colors.neutrals.textSecondary} style={styles.sectionLabel}>SÉCURITÉ</TText>
        <View style={styles.card}>
          {[
            { icon: "lock-closed-outline", label: "Changer le PIN", color: "#EF4444", onPress: () => router.push("/paybid/create-pin" as any) },
            { icon: "phone-portrait-outline", label: "Sessions actives", color: "#3B82F6", onPress: () => {} },
          ].map((item, i, arr) => (
            <TouchableOpacity key={item.label} style={[styles.row, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.neutrals.border }]}
              onPress={item.onPress} activeOpacity={0.75}>
              <View style={[styles.iconWrap, { backgroundColor: item.color + "18" }]}>
                <Ionicons name={item.icon as any} size={20} color={item.color} />
              </View>
              <TText variant="body" weight="semiBold" style={{ flex: 1, marginLeft: 12 }}>{item.label}</TText>
              <Ionicons name="chevron-forward" size={18} color={colors.neutrals.textTertiary} />
            </TouchableOpacity>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: paybidColors.neutrals.border },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: paybidColors.neutrals.surface, borderWidth: 1, borderColor: paybidColors.neutrals.border, alignItems: "center", justifyContent: "center" },
  sectionLabel: { marginTop: spacing.lg, marginBottom: 6, letterSpacing: 0.5 },
  card: { backgroundColor: paybidColors.neutrals.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: paybidColors.neutrals.border, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", padding: 14 },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  picker: { borderTopWidth: 1, borderTopColor: paybidColors.neutrals.border, paddingVertical: 4 },
  pickerRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12 },
  pickerRowActive: { backgroundColor: paybidColors.overlays.primarySoft },
});
