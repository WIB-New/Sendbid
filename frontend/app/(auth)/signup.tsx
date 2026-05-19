import React, { useEffect, useState, useMemo } from "react";
import { View, TouchableOpacity, Modal, FlatList, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Screen } from "../../src/components/Screen";
import { TText } from "../../src/components/TText";
import { Input } from "../../src/components/Input";
import { Button } from "../../src/components/Button";
import { api, apiError } from "../../src/api";
import { useAuth } from "../../src/store";
import { colors, spacing, radii } from "../../src/theme";

type Country = { country_code: string; country_name: string; flag?: string; currency?: string; cities?: string[]; capital?: string };

export default function SignUp() {
  const router = useRouter();
  const setSession = useAuth((s) => s.setSession);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [country, setCountry] = useState<Country | null>(null);
  const [city, setCity] = useState("");
  const [terms, setTerms] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [showCountry, setShowCountry] = useState(false);
  const [countries, setCountries] = useState<Country[]>([]);
  const [countrySearch, setCountrySearch] = useState("");

  useEffect(() => {
    api.get("/corridors").then((r) => setCountries(r.data || [])).catch(() => {});
  }, []);

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
      router.push({
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
    <Screen title="Créer un compte" back>
      <TText variant="title" weight="extraBold" style={{ marginTop: spacing.md }}>
        Rejoignez SENDBID
      </TText>
      <TText variant="body" color={colors.neutrals.textSecondary} style={{ marginBottom: spacing.xl }}>
        Créez votre compte en 60 secondes. Vérifications email & téléphone après création du PIN.
      </TText>

      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Input testID="signup-firstname" label="Prénom" value={firstName} onChangeText={setFirstName} icon="person-outline" />
        </View>
        <View style={{ flex: 1 }}>
          <Input testID="signup-lastname" label="Nom" value={lastName} onChangeText={setLastName} icon="person-outline" />
        </View>
      </View>

      <Input testID="signup-email" label="Email" value={email} onChangeText={setEmail} icon="mail-outline" keyboardType="email-address" autoCapitalize="none" />
      <Input testID="signup-phone" label="Téléphone (avec indicatif)" value={phone} onChangeText={setPhone} icon="call-outline" keyboardType="phone-pad" placeholder="+33..." />

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

      <Input testID="signup-password" label="Mot de passe" value={password} onChangeText={setPassword} icon="lock-closed-outline" passwordToggle secureTextEntry />
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
          J'accepte les <TText variant="caption" weight="bold" color={colors.primary.base}>Conditions Générales d'Utilisation</TText> et la <TText variant="caption" weight="bold" color={colors.primary.base}>Politique de Confidentialité</TText>.
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

      {/* Country picker modal */}
      <Modal visible={showCountry} animationType="slide" onRequestClose={() => setShowCountry(false)}>
        <View style={{ flex: 1, backgroundColor: "white", paddingTop: 60 }}>
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, marginBottom: 12 }}>
            <TouchableOpacity onPress={() => setShowCountry(false)} style={{ padding: 6 }}>
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
                style={{ flex: 1, paddingVertical: 12, marginLeft: 8 }}
              />
            </View>
          </View>
          <FlatList
            data={filteredCountries}
            keyExtractor={(c) => c.country_code}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => { setCountry(item); setShowCountry(false); setCountrySearch(""); }}
                style={{ paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.neutrals.border, flexDirection: "row", alignItems: "center" }}>
                <TText style={{ fontSize: 22 }}>{item.flag || "🌍"}</TText>
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <TText weight="bold">{item.country_name}</TText>
                  <TText variant="caption" color={colors.neutrals.textSecondary}>{item.country_code} • {item.currency || ""}</TText>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </Screen>
  );
}
