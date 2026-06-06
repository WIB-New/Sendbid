import React, { useEffect, useMemo, useState } from "react";
import { t, useLocale } from "../../src/i18n";
import { View, StyleSheet, Alert, TouchableOpacity, FlatList, Modal, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../../src/components/Screen";
import { TText } from "../../src/components/TText";
import { Input } from "../../src/components/Input";
import { Button } from "../../src/components/Button";
import { api, apiError } from "../../src/api";
import { colors, spacing, radii } from "../../src/theme";
import { useThemedColors } from "../../src/themeContext";
// v6.4 — Bénéficiaire enrichi : Country/City autocomplete (pas de texte libre),
// IBAN/RIB pour Bank, Opérateur+Téléphone pour MoMo, boutons Relation compacts.
const RELATIONS = ["Famille", "Ami", "Conjoint", "Enfant", "Parent", "Collègue", "Autre"];
const MOMO_OPERATORS = [
  { key: "wave", label: "Wave" },
  { key: "orange_money", label: "Orange Money" },
  { key: "mtn_momo", label: "MTN MoMo" },
  { key: "moov_money", label: "Moov Money" },
  { key: "free_money", label: "Free Money" },
  { key: "airtel_money", label: "Airtel Money" },
  { key: "tigo_pesa", label: "Tigo Pesa" },
  { key: "m_pesa", label: "M-Pesa" },
];
const DELIVERY_MODES = [
  { key: "cash", label: "Espèces", icon: "cash-outline" as const },
  { key: "bank", label: "Virement bancaire", icon: "business-outline" as const },
  { key: "momo", label: "Portefeuille mobile", icon: "phone-portrait-outline" as const },
];

type Corridor = {
  country_code: string;
  country_name: string;
  flag: string;
  capital?: string;
  cities?: string[];
  delivery_modes: string[];
};

export default function AddBeneficiary() {
  useLocale((st) => st.locale);
  const colors = useThemedColors();
  const router = useRouter();
  const [corridors, setCorridors] = useState<Corridor[]>([]);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState<Corridor | null>(null);
  const [city, setCity] = useState<string>("");
  const [address, setAddress] = useState("");
  const [poBox, setPoBox] = useState("");
  const [relation, setRelation] = useState("Famille");
  const [defaultMode, setDefaultMode] = useState<"cash" | "bank" | "momo">("cash");
  // Bank fields
  const [bankName, setBankName] = useState("");
  const [iban, setIban] = useState("");
  const [bicSwift, setBicSwift] = useState("");
  // Mobile money fields
  const [momoOperator, setMomoOperator] = useState<string>("");
  const [momoPhone, setMomoPhone] = useState("");
  // Modals
  const [showCountry, setShowCountry] = useState(false);
  const [showCity, setShowCity] = useState(false);
  const [showOperator, setShowOperator] = useState(false);
  const [searchCountry, setSearchCountry] = useState("");
  const [searchCity, setSearchCity] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get("/corridors").then((r) => {
      const list: Corridor[] = r.data?.corridors || [];
      setCorridors(list);
    }).catch(() => {});
  }, []);

  const cityOptions: string[] = useMemo(() => {
    if (!country) return [];
    const list = country.cities || [];
    return country.capital && !list.includes(country.capital) ? [country.capital, ...list] : list;
  }, [country]);

  const filteredCountries = corridors.filter((c) =>
    !searchCountry || c.country_name.toLowerCase().includes(searchCountry.toLowerCase()) || c.country_code.toLowerCase().includes(searchCountry.toLowerCase())
  );
  const filteredCities = cityOptions.filter((c) => !searchCity || c.toLowerCase().includes(searchCity.toLowerCase()));

  // When country changes, reset city if not in new country, and adjust default mode if not supported
  useEffect(() => {
    if (!country) return;
    if (city && !cityOptions.includes(city)) setCity("");
    if (!country.delivery_modes.includes(defaultMode)) {
      setDefaultMode((country.delivery_modes[0] as any) || "cash");
    }
  }, [country]);

  const submit = async () => {
    if (!firstName || !lastName || !country || !phone) {
      Alert.alert("Champs requis", "Prénom, nom, pays et téléphone sont obligatoires.");
      return;
    }
    if (!city) {
      Alert.alert("Ville requise", "Sélectionnez la ville du bénéficiaire.");
      return;
    }
    if (defaultMode === "bank" && (!iban || !bankName)) {
      Alert.alert("Coordonnées bancaires", "IBAN et nom de la banque sont requis pour un virement bancaire.");
      return;
    }
    if (defaultMode === "momo" && (!momoOperator || !momoPhone)) {
      Alert.alert("Mobile Money", "Opérateur et numéro de téléphone sont requis.");
      return;
    }
    setBusy(true);
    try {
      await api.post("/beneficiaries", {
        full_name: `${firstName} ${lastName}`.trim(),
        first_name: firstName,
        last_name: lastName,
        email: email || undefined,
        phone,
        country: country.country_code,
        city,
        address,
        po_box: poBox,
        relation,
        default_delivery_mode: defaultMode,
        bank_name: defaultMode === "bank" ? bankName : undefined,
        iban: defaultMode === "bank" ? iban : undefined,
        bic_swift: defaultMode === "bank" ? bicSwift : undefined,
        momo_operator: defaultMode === "momo" ? momoOperator : undefined,
        momo_phone: defaultMode === "momo" ? momoPhone : undefined,
      });
      router.back();
    } catch (e: any) {
      Alert.alert("Erreur", apiError(e));
    } finally { setBusy(false); }
  };

  const operatorLabel = MOMO_OPERATORS.find((o) => o.key === momoOperator)?.label || "Sélectionner un opérateur";

  return (
    <Screen title="Nouveau bénéficiaire" back hero>
      <TText variant="caption" color={colors.neutrals.textSecondary} style={{ marginBottom: spacing.md }}>
        Renseignez les informations du bénéficiaire. Pays et ville sont en sélection guidée.
      </TText>

      {/* Identité */}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}><Input testID="ben-first" label="Prénom *" value={firstName} onChangeText={setFirstName} icon="person-outline" /></View>
        <View style={{ flex: 1 }}><Input testID="ben-last" label="Nom *" value={lastName} onChangeText={setLastName} icon="person-outline" /></View>
      </View>
      <Input testID="ben-email" label="Email (optionnel)" value={email} onChangeText={setEmail} icon="mail-outline" keyboardType="email-address" autoCapitalize="none" />
      <Input testID="ben-phone" label="Téléphone *" value={phone} onChangeText={setPhone} icon="call-outline" keyboardType="phone-pad" />

      {/* Pays — autocomplete obligatoire */}
      <TText variant="caption" weight="semiBold" color={colors.neutrals.textSecondary} style={{ marginTop: spacing.sm, marginBottom: 6 }}>Pays *</TText>
      <TouchableOpacity testID="ben-country-pick" style={styles.selector} onPress={() => setShowCountry(true)}>
        {country ? (
          <TText variant="body" weight="semiBold">{country.flag} {country.country_name} ({country.country_code})</TText>
        ) : (
          <TText variant="body" color={colors.neutrals.textTertiary}>Sélectionner un pays</TText>
        )}
        <Ionicons name="chevron-down" size={18} color={colors.neutrals.textSecondary} />
      </TouchableOpacity>

      {/* Ville — autocomplete obligatoire */}
      <TText variant="caption" weight="semiBold" color={colors.neutrals.textSecondary} style={{ marginTop: spacing.sm, marginBottom: 6 }}>Ville *</TText>
      <TouchableOpacity
        testID="ben-city-pick"
        style={[styles.selector, !country && { opacity: 0.5 }]}
        onPress={() => country && setShowCity(true)}
        disabled={!country}
      >
        {city ? (
          <TText variant="body" weight="semiBold">{city}</TText>
        ) : (
          <TText variant="body" color={colors.neutrals.textTertiary}>{country ? "Sélectionner une ville" : "Choisir d'abord un pays"}</TText>
        )}
        <Ionicons name="chevron-down" size={18} color={colors.neutrals.textSecondary} />
      </TouchableOpacity>

      <Input testID="ben-address" label="Adresse (optionnel)" value={address} onChangeText={setAddress} icon="home-outline" multiline />
      <Input testID="ben-pobox" label="Boîte postale (optionnel)" value={poBox} onChangeText={setPoBox} icon="mail-open-outline" />

      {/* Mode de remise par défaut */}
      <TText variant="caption" weight="semiBold" color={colors.neutrals.textSecondary} style={{ marginTop: spacing.sm, marginBottom: 6 }}>Mode de remise par défaut</TText>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {DELIVERY_MODES.map((m) => {
          const supported = !country || country.delivery_modes.includes(m.key);
          const active = defaultMode === m.key && supported;
          return (
            <TouchableOpacity
              key={m.key}
              testID={`ben-mode-${m.key}`}
              disabled={!supported}
              onPress={() => setDefaultMode(m.key as any)}
              style={[styles.modePill, active && styles.modePillActive, !supported && { opacity: 0.4 }]}
            >
              <Ionicons name={m.icon} size={16} color={active ? "white" : colors.primary.base} />
              <TText variant="caption" weight="extraBold" color={active ? "white" : colors.neutrals.textPrimary} style={{ marginLeft: 6 }}>
                {m.label}
              </TText>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Bank fields */}
      {defaultMode === "bank" ? (
        <View style={styles.modeBox}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
            <Ionicons name="business" size={14} color={colors.primary.base} />
            <TText variant="caption" weight="extraBold" color={colors.primary.base} style={{ marginLeft: 6, letterSpacing: 0.5 }}>
              COORDONNÉES BANCAIRES
            </TText>
          </View>
          <Input testID="ben-bank-name" label="Nom de la banque *" value={bankName} onChangeText={setBankName} icon="business-outline" />
          <Input testID="ben-iban" label="IBAN / RIB *" value={iban} onChangeText={(v) => setIban(v.toUpperCase())} icon="card-outline" autoCapitalize="characters" />
          <Input testID="ben-bic" label="BIC / SWIFT (optionnel)" value={bicSwift} onChangeText={(v) => setBicSwift(v.toUpperCase())} icon="key-outline" autoCapitalize="characters" />
        </View>
      ) : null}

      {/* Mobile Money fields */}
      {defaultMode === "momo" ? (
        <View style={styles.modeBox}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
            <Ionicons name="phone-portrait" size={14} color={colors.primary.base} />
            <TText variant="caption" weight="extraBold" color={colors.primary.base} style={{ marginLeft: 6, letterSpacing: 0.5 }}>
              PORTEFEUILLE MOBILE
            </TText>
          </View>
          <TText variant="caption" weight="semiBold" color={colors.neutrals.textSecondary} style={{ marginBottom: 6 }}>Opérateur *</TText>
          <TouchableOpacity testID="ben-momo-operator-pick" style={styles.selector} onPress={() => setShowOperator(true)}>
            <TText variant="body" weight="semiBold" color={momoOperator ? colors.neutrals.textPrimary : colors.neutrals.textTertiary}>
              {operatorLabel}
            </TText>
            <Ionicons name="chevron-down" size={18} color={colors.neutrals.textSecondary} />
          </TouchableOpacity>
          <Input testID="ben-momo-phone" label="Numéro Mobile Money *" value={momoPhone} onChangeText={setMomoPhone} icon="call-outline" keyboardType="phone-pad" />
        </View>
      ) : null}

      {/* Relation — boutons compacts */}
      <TText variant="caption" weight="semiBold" color={colors.neutrals.textSecondary} style={{ marginTop: spacing.sm, marginBottom: 6 }}>Relation</TText>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {RELATIONS.map((r) => {
          const active = relation === r;
          return (
            <TouchableOpacity
              key={r}
              testID={`ben-rel-${r}`}
              onPress={() => setRelation(r)}
              style={[styles.relChip, active && styles.relChipActive]}
            >
              <TText variant="label" weight="extraBold" color={active ? "white" : colors.neutrals.textPrimary}>
                {r}
              </TText>
            </TouchableOpacity>
          );
        })}
      </View>

      <Button testID="ben-add-submit" title="Enregistrer le bénéficiaire" icon="checkmark" onPress={submit} loading={busy} style={{ marginTop: spacing.lg }} />

      {/* Country picker */}
      <Modal visible={showCountry} transparent animationType="slide" onRequestClose={() => setShowCountry(false)}>
        <TouchableOpacity activeOpacity={1} style={styles.modalOverlay} onPress={() => setShowCountry(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalSheetTall}>
            <TText variant="subtitle" weight="extraBold" style={{ marginBottom: 4 }}>Pays bénéficiaire</TText>
            <TText variant="caption" color={colors.neutrals.textSecondary} style={{ marginBottom: 12 }}>
              {corridors.length} pays disponibles
            </TText>
            <Input testID="ben-country-search" value={searchCountry} onChangeText={setSearchCountry} placeholder="Rechercher…" icon="search-outline" />
            <FlatList
              data={filteredCountries}
              keyExtractor={(i) => i.country_code}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  testID={`ben-country-${item.country_code}`}
                  style={styles.modalRow}
                  onPress={() => { setCountry(item); setShowCountry(false); setSearchCountry(""); }}
                >
                  <View style={{ flex: 1 }}>
                    <TText variant="body" weight="semiBold">{item.flag} {item.country_name}</TText>
                    <TText variant="caption" color={colors.neutrals.textSecondary}>
                      {item.capital ? `${item.capital} • ` : ""}{item.delivery_modes.join(" / ")}
                    </TText>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.neutrals.textTertiary} />
                </TouchableOpacity>
              )}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* City picker */}
      <Modal visible={showCity} transparent animationType="slide" onRequestClose={() => setShowCity(false)}>
        <TouchableOpacity activeOpacity={1} style={styles.modalOverlay} onPress={() => setShowCity(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalSheetTall}>
            <TText variant="subtitle" weight="extraBold" style={{ marginBottom: 4 }}>Ville</TText>
            <TText variant="caption" color={colors.neutrals.textSecondary} style={{ marginBottom: 12 }}>
              {country?.country_name} • {cityOptions.length} villes
            </TText>
            <Input testID="ben-city-search" value={searchCity} onChangeText={setSearchCity} placeholder="Rechercher une ville…" icon="search-outline" />
            <FlatList
              data={filteredCities}
              keyExtractor={(i) => i}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <View style={{ padding: spacing.lg, alignItems: "center" }}>
                  <TText color={colors.neutrals.textSecondary}>Aucune ville référencée</TText>
                </View>
              }
              renderItem={({ item }) => (
                <TouchableOpacity testID={`ben-city-${item}`} style={styles.modalRow} onPress={() => { setCity(item); setShowCity(false); setSearchCity(""); }}>
                  <TText variant="body" weight="semiBold">{item}</TText>
                  <Ionicons name="chevron-forward" size={18} color={colors.neutrals.textTertiary} />
                </TouchableOpacity>
              )}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Operator picker */}
      <Modal visible={showOperator} transparent animationType="slide" onRequestClose={() => setShowOperator(false)}>
        <TouchableOpacity activeOpacity={1} style={styles.modalOverlay} onPress={() => setShowOperator(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalSheet}>
            <TText variant="subtitle" weight="extraBold" style={{ marginBottom: 12 }}>Opérateur Mobile Money</TText>
            <ScrollView>
              {MOMO_OPERATORS.map((op) => (
                <TouchableOpacity
                  key={op.key}
                  testID={`ben-momo-${op.key}`}
                  style={styles.modalRow}
                  onPress={() => { setMomoOperator(op.key); setShowOperator(false); }}
                >
                  <TText variant="body" weight="semiBold">{op.label}</TText>
                  <Ionicons name={momoOperator === op.key ? "checkmark-circle" : "ellipse-outline"} size={20} color={momoOperator === op.key ? colors.accent.base : colors.neutrals.textTertiary} />
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
  selector: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: colors.neutrals.surface, borderRadius: radii.xl,
    borderWidth: 1, borderColor: colors.neutrals.border,
    paddingHorizontal: spacing.lg, height: 52,
  },
  modePill: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: colors.neutrals.surface, borderRadius: radii.lg,
    borderWidth: 1.5, borderColor: colors.neutrals.border,
    paddingVertical: 12,
  },
  modePillActive: { backgroundColor: colors.primary.base, borderColor: colors.primary.base },
  modeBox: {
    backgroundColor: colors.overlays.primarySoft,
    borderRadius: radii.xl, padding: spacing.md, marginTop: spacing.md,
    borderWidth: 1, borderColor: colors.neutrals.border,
  },
  relChip: {
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: radii.full, borderWidth: 1, borderColor: colors.neutrals.border,
    backgroundColor: colors.neutrals.surface,
  },
  relChipActive: { backgroundColor: colors.primary.base, borderColor: colors.primary.base },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: colors.neutrals.surface,
    borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl,
    padding: spacing.lg, maxHeight: "70%",
  },
  modalSheetTall: {
    backgroundColor: colors.neutrals.surface,
    borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl,
    padding: spacing.lg, maxHeight: "85%", height: "85%",
  },
  modalRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: 14, borderBottomWidth: 1, borderBottomColor: colors.neutrals.border,
  },
});
