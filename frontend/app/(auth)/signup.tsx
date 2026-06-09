import React, { useEffect, useState, useMemo } from "react";
import { t, useLocale } from "../../src/i18n";
import { View, TouchableOpacity, Modal, FlatList, TextInput, StyleSheet, Platform, StatusBar } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Screen } from "../../src/components/Screen";
import { TText } from "../../src/components/TText";
import { Input } from "../../src/components/Input";
import { Button } from "../../src/components/Button";
import { api, apiError } from "../../src/api";
import { useAuth } from "../../src/store";
import { colors, spacing, radii } from "../../src/theme";
import { useThemedColors } from "../../src/themeContext";
import { dialToCountry, countryToDial, flagEmoji } from "../../src/utils/dialCodes";

type Country = { country_code: string; country_name: string; flag?: string; currency?: string; cities?: string[]; capital?: string };

export default function SignUp() {
  useLocale((st) => st.locale);
  const colors = useThemedColors();
  const router = useRouter();
  const setSession = useAuth((s) => s.setSession);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  // Téléphone splitté en 2 champs : indicatif + numéro
  const [dialCode, setDialCode] = useState("+");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [country, setCountry] = useState<Country | null>(null);
  const [countryAutoDetected, setCountryAutoDetected] = useState(false);
  const [city, setCity] = useState("");
  const [terms, setTerms] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Téléphone E.164 combiné (pour envoi backend)
  const phone = useMemo(() => {
    const cleanedNum = phoneNumber.replace(/[^0-9]/g, "");
    const cleanedDial = "+" + dialCode.replace(/[^0-9]/g, "");
    return cleanedDial + cleanedNum;
  }, [dialCode, phoneNumber]);

  const [showCountry, setShowCountry] = useState(false);
  const [countries, setCountries] = useState<Country[]>([]);
  const [countrySearch, setCountrySearch] = useState("");

  useEffect(() => {
    api.get("/corridors").then((r) => {
      // L'API renvoie { corridors: [...], count: N } — on extrait le tableau.
      const list: Country[] = Array.isArray(r.data) ? r.data : (r.data?.corridors || []);
      setCountries(list);
    }).catch((e) => {
      console.warn("[signup] corridors load failed", e?.message);
    });
  }, []);

  // === Auto-détection du pays de résidence selon l'indicatif téléphonique ===
  // Tant que l'utilisateur n'a pas manuellement choisi un pays différent,
  // l'indicatif tapé met à jour automatiquement le pays.
  useEffect(() => {
    const cc = dialToCountry(dialCode);
    if (!cc) return;
    // Si le pays auto-détecté = pays déjà sélectionné → rien à faire
    if (country?.country_code === cc) return;
    // Cherche le pays correspondant dans la liste chargée
    const match = countries.find((c) => c.country_code === cc);
    if (match) {
      setCountry(match);
      setCountryAutoDetected(true);
    }
  }, [dialCode, countries]);

  const filteredCountries = useMemo(() => {
    const q = countrySearch.toLowerCase().trim();
    if (!q) return countries;
    return countries.filter((c) => c.country_name?.toLowerCase().includes(q) || c.country_code?.toLowerCase().includes(q));
  }, [countries, countrySearch]);

  const strength = (() => {
    let s = 0;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  })();

  const submit = async () => {
    setErr(null);
    if (!firstName.trim() || !lastName.trim()) {
      setErr("Prénom et nom obligatoires");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setErr("Email invalide");
      return;
    }
    if (!phone.trim() || phone.length < 6) {
      setErr("Numéro de téléphone invalide");
      return;
    }
    if (!country) {
      setErr("Veuillez sélectionner votre pays de résidence");
      return;
    }
    if (!city.trim()) {
      setErr("Veuillez renseigner votre ville");
      return;
    }
    if (password.length < 8) {
      setErr("Mot de passe : 8 caractères minimum");
      return;
    }
    if (password !== confirmPwd) {
      setErr("Les mots de passe ne correspondent pas");
      return;
    }
    if (!terms) {
      setErr("Vous devez accepter les CGU et la politique de confidentialité");
      return;
    }
    setLoading(true);
    try {
      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
      const { data } = await api.post("/auth/register", {
        full_name: fullName,
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        password,
        country: country.country_code,
        city: city.trim(),
        accept_terms: true,
      });
      if (data.token && data.user) {
        await setSession(data.token, data.user);
      }
      // v10 — Spec item 1 : utiliser REPLACE (pas push) pour interdire le retour arrière.
      // La PIN-gate dans _layout.tsx redirigera de toute façon tant que has_pin=false,
      // mais on évite déjà un flash de routing.
      router.replace({
        pathname: "/(auth)/create-pin",
        params: { user_id: data.user_id, skip_otp: "1" },
      });
    } catch (e: any) {
      setErr(apiError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen title={t("auth2.signupTitle")} back>
      <TText variant="title" weight="extraBold" style={{ marginTop: spacing.md }}>
        Rejoignez SENDBID
      </TText>
      <TText variant="body" color={colors.neutrals.textSecondary} style={{ marginBottom: spacing.xl }}>
        Créez votre compte en 60 secondes. Vérifications email & téléphone après création du PIN.
      </TText>

      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Input testID="signup-firstname" label={t("auth2.firstName")} value={firstName} onChangeText={setFirstName} icon="person-outline" />
        </View>
        <View style={{ flex: 1 }}>
          <Input testID="signup-lastname" label={t("auth2.lastName")} value={lastName} onChangeText={setLastName} icon="person-outline" />
        </View>
      </View>

      <Input testID="signup-email" label="Email" value={email} onChangeText={setEmail} icon="mail-outline" keyboardType="email-address" autoCapitalize="none" />

      {/* === Téléphone : indicatif + numéro (2 champs côte à côte) === */}
      <TText variant="label" weight="semiBold" color={colors.neutrals.textSecondary} style={{ marginTop: 4, marginBottom: 6 }}>
        Téléphone
      </TText>
      <View style={styles.phoneRow}>
        <View style={styles.dialField}>
          <Ionicons name="call-outline" size={16} color={colors.neutrals.textSecondary} />
          <TextInput
            testID="signup-dial"
            value={dialCode}
            onChangeText={(v) => {
              // Toujours commencer par "+" — l'utilisateur ne tape que des chiffres ensuite
              const digits = v.replace(/[^0-9]/g, "");
              setDialCode("+" + digits);
            }}
            keyboardType="phone-pad"
            placeholder="+237"
            placeholderTextColor={colors.neutrals.textTertiary}
            style={styles.dialInput}
            maxLength={5}
          />
        </View>
        <View style={styles.numField}>
          <TextInput
            testID="signup-phone"
            value={phoneNumber}
            onChangeText={(v) => setPhoneNumber(v.replace(/[^0-9]/g, ""))}
            keyboardType="phone-pad"
            placeholder="6 12 34 56 78"
            placeholderTextColor={colors.neutrals.textTertiary}
            style={styles.numInput}
          />
        </View>
      </View>
      {countryAutoDetected && country ? (
        <TText variant="label" color={colors.status.success} style={{ marginTop: -8, marginBottom: spacing.md, marginLeft: 4 }}>
          {flagEmoji(country.country_code)} Pays détecté : {country.country_name}
        </TText>
      ) : null}

      {/* Pays de résidence */}
      <TouchableOpacity testID="signup-country" onPress={() => setShowCountry(true)} activeOpacity={0.8}
        style={{ borderWidth: 1, borderColor: colors.neutrals.border, borderRadius: radii.lg, paddingHorizontal: 14, paddingVertical: 14, marginBottom: spacing.md, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Ionicons name="globe-outline" size={20} color={colors.neutrals.textSecondary} />
          <TText style={{ marginLeft: 10 }} color={country ? colors.neutrals.textPrimary : colors.neutrals.textTertiary}>
            {country ? `${country.flag || ""} ${country.country_name} (${country.country_code})` : "Pays de résidence"}
          </TText>
        </View>
        <Ionicons name="chevron-down" size={18} color={colors.neutrals.textSecondary} />
      </TouchableOpacity>

      <Input testID="signup-city" label="Ville" value={city} onChangeText={setCity} icon="location-outline" placeholder="Ex: Paris" />

      <Input testID="signup-password" label={t("auth2.password")} value={password} onChangeText={setPassword} icon="lock-closed-outline" passwordToggle secureTextEntry />
      <Input testID="signup-password-confirm" label="Confirmer le mot de passe" value={confirmPwd} onChangeText={setConfirmPwd} icon="lock-closed-outline" passwordToggle secureTextEntry />

      <View style={{ flexDirection: "row", gap: 4, marginBottom: spacing.sm }}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i < strength ? (strength <= 2 ? colors.status.pending : strength === 3 ? colors.status.info : colors.status.success) : colors.neutrals.border }} />
        ))}
      </View>
      <TText variant="caption" color={colors.neutrals.textTertiary} style={{ marginBottom: spacing.lg }}>
        8+ caractères, majuscule, chiffre & symbole recommandés.
      </TText>

      {/* CGU */}
      <TouchableOpacity testID="signup-terms" onPress={() => setTerms(!terms)} activeOpacity={0.8}
        style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: spacing.lg }}>
        <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: terms ? colors.primary.base : colors.neutrals.border, backgroundColor: terms ? colors.primary.base : "transparent", alignItems: "center", justifyContent: "center", marginTop: 2 }}>
          {terms ? <Ionicons name="checkmark" size={16} color="white" /> : null}
        </View>
        <TText variant="caption" color={colors.neutrals.textSecondary} style={{ flex: 1, marginLeft: 10 }}>
          J&apos;accepte les <TText variant="caption" weight="bold" color={colors.primary.base}>Conditions Générales d&apos;Utilisation</TText> et la <TText variant="caption" weight="bold" color={colors.primary.base}>Politique de Confidentialité</TText>.
        </TText>
      </TouchableOpacity>

      {err ? <TText variant="caption" color={colors.status.error} style={{ marginBottom: spacing.sm }}>{err}</TText> : null}

      <Button testID="signup-submit" title="Créer mon compte" onPress={submit} loading={loading} />

      <View style={{ flexDirection: "row", justifyContent: "center", marginTop: spacing.lg }}>
        <TText variant="caption" color={colors.neutrals.textSecondary}>Déjà un compte ? </TText>
        <TouchableOpacity onPress={() => router.replace("/(auth)/login")}>
          <TText variant="caption" weight="bold" color={colors.primary.base}>Se connecter</TText>
        </TouchableOpacity>
      </View>

      {/* ===== Country picker modal =====
          v3 — Compatible Android edgeToEdge + iOS notch :
          - statusBarTranslucent={true} pour que la modal recouvre la status bar (Android)
          - presentationStyle="fullScreen" pour ne pas être inset par le navigateur natif (iOS)
          - SafeAreaView pour gérer notch + paddingTop dynamique au lieu du 60px fixe
          - FlatList style flex:1 pour s'étendre correctement
          - États vides/chargement pour ne plus afficher d'écran blanc */}
      <Modal
        visible={showCountry}
        animationType="slide"
        onRequestClose={() => setShowCountry(false)}
        statusBarTranslucent={Platform.OS === "android"}
        presentationStyle={Platform.OS === "ios" ? "fullScreen" : undefined}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: "white" }} edges={["top", "bottom", "left", "right"]}>
          {Platform.OS === "android" ? <StatusBar barStyle="dark-content" backgroundColor="white" /> : null}
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12 }}>
            <TouchableOpacity testID="signup-country-close" onPress={() => setShowCountry(false)} style={{ padding: 6 }}>
              <Ionicons name="close" size={26} />
            </TouchableOpacity>
            <TText weight="extraBold" style={{ marginLeft: 8 }}>Sélectionner un pays</TText>
          </View>
          <View style={{ paddingHorizontal: 16, marginBottom: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: colors.neutrals.border, borderRadius: radii.lg, paddingHorizontal: 12 }}>
              <Ionicons name="search" size={18} color={colors.neutrals.textSecondary} />
              <TextInput
                value={countrySearch}
                onChangeText={setCountrySearch}
                placeholder="Rechercher un pays..."
                placeholderTextColor={colors.neutrals.textTertiary}
                style={{ flex: 1, paddingVertical: 12, marginLeft: 8, color: colors.neutrals.textPrimary }}
                autoCorrect={false}
                autoCapitalize="none"
              />
            </View>
          </View>
          <FlatList
            data={filteredCountries}
            style={{ flex: 1 }}
            contentContainerStyle={filteredCountries.length === 0 ? { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 } : { paddingBottom: 24 }}
            keyExtractor={(c) => c.country_code}
            initialNumToRender={20}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={{ alignItems: "center" }}>
                {countries.length === 0 ? (
                  <>
                    <Ionicons name="cloud-offline-outline" size={48} color={colors.neutrals.textTertiary} />
                    <TText variant="body" weight="bold" align="center" style={{ marginTop: 12 }}>
                      Chargement des pays…
                    </TText>
                    <TText variant="caption" color={colors.neutrals.textSecondary} align="center" style={{ marginTop: 4, maxWidth: 260 }}>
                      Si rien ne s&apos;affiche, vérifiez votre connexion Internet et réessayez.
                    </TText>
                    <TouchableOpacity
                      testID="signup-country-retry"
                      onPress={() => {
                        api.get("/corridors").then((r) => {
                          const list: Country[] = Array.isArray(r.data) ? r.data : (r.data?.corridors || []);
                          setCountries(list);
                        }).catch(() => {});
                      }}
                      style={{ marginTop: 16, paddingVertical: 10, paddingHorizontal: 20, borderRadius: radii.full, backgroundColor: colors.primary.base }}
                    >
                      <TText variant="label" weight="bold" color="white">Réessayer</TText>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <Ionicons name="search-outline" size={48} color={colors.neutrals.textTertiary} />
                    <TText variant="body" weight="bold" align="center" style={{ marginTop: 12 }}>
                      Aucun pays trouvé
                    </TText>
                    <TText variant="caption" color={colors.neutrals.textSecondary} align="center" style={{ marginTop: 4 }}>
                      Essayez avec un autre nom (ex : « France », « FR »).
                    </TText>
                  </>
                )}
              </View>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                testID={`signup-country-item-${item.country_code}`}
                onPress={() => { setCountry(item); setShowCountry(false); setCountrySearch(""); setCountryAutoDetected(false); }}
                style={{ paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.neutrals.border, flexDirection: "row", alignItems: "center" }}
              >
                <TText style={{ fontSize: 22 }}>{item.flag || "🌍"}</TText>
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <TText weight="bold">{item.country_name}</TText>
                  <TText variant="caption" color={colors.neutrals.textSecondary}>{item.country_code} • {item.currency || ""}</TText>
                </View>
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>
    </Screen>
  );
}

// Manual handling of country pick (overrides auto-detect)
function pickCountry(setCountry: any, setShow: any, setSearch: any, setAuto: any) {
  return (item: any) => {
    setCountry(item);
    setShow(false);
    setSearch("");
    setAuto(false);
  };
}

const styles = StyleSheet.create({
  phoneRow: { flexDirection: "row", marginBottom: spacing.md, gap: 8 },
  dialField: {
    width: 100,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.neutrals.border,
    borderRadius: radii.lg,
    backgroundColor: colors.neutrals.surface,
  },
  dialInput: {
    flex: 1,
    paddingVertical: 14,
    paddingLeft: 6,
    fontSize: 15,
    fontWeight: "600",
    color: colors.neutrals.textPrimary,
  },
  numField: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.neutrals.border,
    borderRadius: radii.lg,
    backgroundColor: colors.neutrals.surface,
  },
  numInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.neutrals.textPrimary,
  },
});
