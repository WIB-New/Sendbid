import React, { useState } from "react";
import { Alert, Platform } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "../../src/components/Screen";
import { TText } from "../../src/components/TText";
import { Input } from "../../src/components/Input";
import { Button } from "../../src/components/Button";
import { api, apiError } from "../../src/api";
import { useAuth } from "../../src/store";
import { colors, spacing } from "../../src/theme";
import { useThemedColors } from "../../src/themeContext";
import { useTranslation } from "../../src/i18n";
export default function KycTier1() {
  const { t } = useTranslation();
  const colors = useThemedColors();
  const router = useRouter();
  const refreshMe = useAuth((s) => s.refreshMe);
  const user = useAuth((s) => s.user);
  const [f, setF] = useState({
    full_name: user?.full_name || "",
    date_of_birth: "1990-01-01",
    nationality: "FR",
    address: "",
    city: "",
    country: "FR",
    id_type: "passport",
    id_number: "",
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const submit = async () => {
    setLoading(true);
    setErr(null);
    setOkMsg(null);
    try {
      await api.post("/kyc/tier1", f);
      await refreshMe();
      const msg = "KYC validé — votre niveau est passé à Silver !";
      setOkMsg(msg);
      // Sur web, Alert.alert est silencieux. On affiche un message inline + on revient.
      if (Platform.OS === "web") {
        setTimeout(() => router.back(), 800);
      } else {
        Alert.alert("KYC validé", "Votre niveau est passé à Silver !", [{ text: "OK", onPress: () => router.back() }]);
      }
    } catch (e: any) {
      setErr(apiError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen title="KYC Tier 1" back hero>
      <TText variant="caption" color={colors.neutrals.textSecondary} style={{ marginBottom: spacing.md }}>
        Renseignez vos informations personnelles pour passer en niveau Silver.
      </TText>
      <Input label="Nom complet" value={f.full_name} onChangeText={(v) => setF({ ...f, full_name: v })} icon="person-outline" />
      <Input label="Date de naissance (YYYY-MM-DD)" value={f.date_of_birth} onChangeText={(v) => setF({ ...f, date_of_birth: v })} icon="calendar-outline" />
      <Input label="Nationalité" value={f.nationality} onChangeText={(v) => setF({ ...f, nationality: v })} autoCapitalize="characters" icon="flag-outline" />
      <Input label="Adresse" value={f.address} onChangeText={(v) => setF({ ...f, address: v })} icon="home-outline" />
      <Input label="Ville" value={f.city} onChangeText={(v) => setF({ ...f, city: v })} icon="business-outline" />
      <Input label="Pays" value={f.country} onChangeText={(v) => setF({ ...f, country: v })} autoCapitalize="characters" icon="globe-outline" />
      <Input label="Type pièce (passport / id_card)" value={f.id_type} onChangeText={(v) => setF({ ...f, id_type: v })} icon="card-outline" />
      <Input label="Numéro de pièce" value={f.id_number} onChangeText={(v) => setF({ ...f, id_number: v })} icon="finger-print-outline" />
      {err ? <TText variant="caption" color={colors.status.error} style={{ marginVertical: spacing.sm }}>{err}</TText> : null}
      {okMsg ? <TText variant="caption" color={colors.status.success} weight="bold" align="center" style={{ marginVertical: spacing.sm }}>{okMsg}</TText> : null}
      <Button testID="kyc-tier1-submit" title="Soumettre" onPress={submit} loading={loading} />
    </Screen>
  );
}
