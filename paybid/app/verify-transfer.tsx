import React, { useState } from "react";
import { View, StyleSheet, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "../src/components/Screen";
import { TText } from "../src/components/TText";
import { Input } from "../src/components/Input";
import { Button } from "../src/components/Button";
import { api } from "../src/api";
import { colors, spacing } from "../src/theme";
import { useTranslation } from "../src/i18n";

// Vérifier un transfert — Le client peut entrer une référence pour suivre/vérifier l'état d'un transfert.
export default function VerifyTransfer() {
  const { t } = useTranslation();
  const router = useRouter();
  const [ref, setRef] = useState("");
  const [busy, setBusy] = useState(false);

  const verify = async () => {
    const trimmed = (ref || "").trim();
    if (!trimmed) {
      Alert.alert("Référence requise", "Saisissez la référence ou l'ID du transfert.");
      return;
    }
    setBusy(true);
    try {
      // 1) Try direct GET (en cas de match exact d'ID)
      try {
        const { data } = await api.get(`/transfers/${trimmed}`);
        if (data?.id) {
          router.replace({ pathname: "/transfer/[id]", params: { id: data.id } } as any);
          return;
        }
      } catch {}
      // 2) Sinon chercher dans la liste (par référence terminale)
      const { data } = await api.get("/transfers");
      const found = (data || []).find((t: any) => (t.id === trimmed) || (t.reference && t.reference.toUpperCase().includes(trimmed.toUpperCase())));
      if (found) {
        router.replace({ pathname: "/transfer/[id]", params: { id: found.id } } as any);
      } else {
        Alert.alert("Introuvable", "Aucun transfert trouvé avec cette référence dans votre compte.");
      }
    } catch (e: any) {
      Alert.alert("Erreur", e?.response?.data?.detail || "Vérification impossible");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Vérifier un transfert" back hero>
      <TText variant="caption" color={colors.neutrals.textSecondary} style={{ marginBottom: spacing.lg }}>
        Saisissez la référence (ex : SB-XXXXXX) ou l'identifiant complet du transfert pour consulter son état actuel.
      </TText>
      <Input
        testID="verify-ref"
        label="Référence ou ID"
        value={ref}
        onChangeText={setRef}
        icon="pricetag-outline"
        autoCapitalize="characters"
        placeholder="SB-XXXXXX ou ID complet"
      />
      <Button testID="verify-submit" title="Vérifier" icon="search" onPress={verify} loading={busy} style={{ marginTop: spacing.lg }} />
    </Screen>
  );
}

const styles = StyleSheet.create({});
