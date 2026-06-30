/**
 * PhoneFieldSplit.tsx — Champ téléphone splitté en (Indicatif + Numéro) avec drapeau.
 *
 * Lot 4 — Cas d'usage : tous les formulaires Sendbid/Paybid demandant un téléphone.
 *
 * Fonctionnement :
 *  - 2 sous-champs côte à côte : sélecteur indicatif (+33 🇫🇷) + numéro local
 *  - Sync bidirectionnel optionnel via les callbacks onCountryAutoFilled / countryHint :
 *      → si parent passe `countryHint="FR"`, on pré-remplit dial=+33 automatiquement
 *      → si l'utilisateur change l'indicatif, on émet onCountryAutoFilled("FR")
 *  - Liste exhaustive des pays via le helper countryToDial / dialToCountry existant
 *  - Sortie : `onChange(fullPhone)` reçoit la concaténation `+<dial><local>` (E.164 compatible)
 *
 * Utilisation type :
 *   <PhoneFieldSplit
 *     value={phone}
 *     onChange={setPhone}
 *     countryHint={country?.country_code}
 *     onCountryAutoFilled={(cc) => setCountry(corridors.find(c => c.country_code === cc))}
 *     label="Numéro de téléphone"
 *   />
 */
import React, { useEffect, useMemo, useState } from "react";
import { View, TextInput, TouchableOpacity, StyleSheet, Modal, FlatList } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TText } from "./TText";
import { countryToDial, dialToCountry, flagEmoji } from "../utils/dialCodes";
import { radii } from "../theme";
import { useThemedColors } from "../themeContext";

// On charge la liste depuis le mapping countryToDial existant.
type Country = { code: string; dial: string; flag: string; name: string };

function buildCountryList(): Country[] {
  // countryToDial est un map { ISO2 -> "+XX" }
  const entries = Object.entries(countryToDial as Record<string, string>);
  return entries
    .map(([code, dial]) => ({ code, dial, flag: flagEmoji(code), name: code }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

export function PhoneFieldSplit({
  value,
  onChange,
  countryHint,
  onCountryAutoFilled,
  label = "Numéro de téléphone",
  placeholder = "Ex: 612345678",
  testID,
}: {
  value: string;
  onChange: (full: string) => void;
  countryHint?: string;            // ISO2 pré-rempli (sync depuis le champ pays)
  onCountryAutoFilled?: (iso: string) => void; // notify back si user change l'indicatif
  label?: string;
  placeholder?: string;
  testID?: string;
}) {
  const colors = useThemedColors();
  const countries = useMemo(buildCountryList, []);
  const [dial, setDial] = useState<string>("");
  const [local, setLocal] = useState<string>("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Sync indicatif <- countryHint (parent change le pays)
  useEffect(() => {
    if (!countryHint) return;
    const next = (countryToDial as any)[countryHint];
    if (next && next !== dial) setDial(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryHint]);

  // Sync valeur globale -> 2 sous-champs (cas init / hydratation)
  useEffect(() => {
    if (!value) return;
    if (value.startsWith("+")) {
      // Trouver l'indicatif le + long matchant
      const match = countries
        .map((c) => c.dial)
        .filter((d) => value.startsWith(d))
        .sort((a, b) => b.length - a.length)[0];
      if (match && match !== dial) {
        setDial(match);
        setLocal(value.slice(match.length));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Émission de la valeur globale + auto-fill pays quand l'utilisateur change l'indicatif
  const emit = (d: string, l: string) => onChange(`${d}${l}`);
  const handleDial = (newDial: string) => {
    setDial(newDial);
    emit(newDial, local);
    const iso = (dialToCountry as any)[newDial];
    if (iso && onCountryAutoFilled) onCountryAutoFilled(iso);
  };
  const handleLocal = (newLocal: string) => {
    const clean = newLocal.replace(/[^\d ]/g, "");
    setLocal(clean);
    emit(dial, clean);
  };

  const currentISO = (dialToCountry as any)[dial] || "";
  const currentFlag = currentISO ? flagEmoji(currentISO) : "🌐";
  const filtered = search.trim()
    ? countries.filter((c) => c.code.includes(search.toUpperCase()) || c.dial.includes(search))
    : countries;

  return (
    <View style={{ marginBottom: 14 }}>
      <TText variant="caption" weight="semiBold" color={colors.neutrals.textSecondary} style={{ marginBottom: 6 }}>
        {label}
      </TText>
      <View style={[styles.row, { borderColor: colors.neutrals.border, backgroundColor: colors.neutrals.surface }]}>
        {/* Sélecteur indicatif */}
        <TouchableOpacity
          testID={testID ? `${testID}-dial` : "phone-dial"}
          onPress={() => setPickerOpen(true)}
          style={[styles.dialBtn, { borderRightColor: colors.neutrals.border }]}
        >
          <TText style={{ fontSize: 18 }}>{currentFlag}</TText>
          <TText weight="bold" style={{ marginLeft: 6, color: colors.neutrals.textPrimary }}>
            {dial || "+?"}
          </TText>
          <Ionicons name="chevron-down" size={14} color={colors.neutrals.textTertiary} style={{ marginLeft: 4 }} />
        </TouchableOpacity>
        {/* Numéro local */}
        <TextInput
          testID={testID ? `${testID}-local` : "phone-local"}
          value={local}
          onChangeText={handleLocal}
          keyboardType="phone-pad"
          placeholder={placeholder}
          placeholderTextColor={colors.neutrals.textTertiary}
          style={[styles.input, { color: colors.neutrals.textPrimary }]}
        />
      </View>

      {/* Modal sélection indicatif */}
      <Modal visible={pickerOpen} animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "white", paddingTop: 50 }}>
          <View style={{ flexDirection: "row", alignItems: "center", padding: 14 }}>
            <TouchableOpacity onPress={() => setPickerOpen(false)} style={{ padding: 6 }}>
              <Ionicons name="close" size={26} />
            </TouchableOpacity>
            <TText weight="extraBold" style={{ marginLeft: 8 }}>Sélectionner un indicatif</TText>
          </View>
          <View style={{ padding: 12 }}>
            <TextInput
              placeholder="Rechercher (ex: FR, +33)…"
              value={search}
              onChangeText={setSearch}
              autoCapitalize="characters"
              style={[styles.input, { borderWidth: 1, borderColor: "#E5E7EB", borderRadius: radii.lg, paddingHorizontal: 12 }]}
            />
          </View>
          <FlatList
            data={filtered}
            keyExtractor={(it) => it.code}
            initialNumToRender={30}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => { handleDial(item.dial); setPickerOpen(false); setSearch(""); }}
                style={{ flexDirection: "row", alignItems: "center", padding: 14, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" }}
              >
                <TText style={{ fontSize: 22 }}>{item.flag}</TText>
                <TText weight="bold" style={{ marginLeft: 12, flex: 1 }}>{item.code}</TText>
                <TText color="#6B7280">{item.dial}</TText>
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: radii.lg, overflow: "hidden" },
  dialBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 14, borderRightWidth: 1, minWidth: 100 },
  input: { flex: 1, paddingHorizontal: 12, paddingVertical: 14, fontSize: 16 },
});

export default PhoneFieldSplit;
