/**
 * /paybid/agency/cashin.tsx — Encaissement client (recharger compte d'un client).
 */
import React, { useState } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { TText } from "../../../src/components/TText";
import { Input } from "../../../src/components/Input";
import { Button } from "../../../src/components/Button";
import { api, apiError } from "../../../src/api";
import { paybidColors } from "../../../src/paybidTheme";
import { spacing, radii } from "../../../src/theme";
import { formatMoney } from "../../../src/utils/money";
import { useTranslation } from "../../../../src/i18n";

export default function PaybidAgencyCashin() {
  const { t } = useTranslation();
  const router = useRouter();
  const [clientId, setClientId] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const n = parseFloat(amount.replace(",", "."));
    if (!clientId.trim()) { Alert.alert("Erreur", "Veuillez saisir l'ID du client"); return; }
    if (!Number.isFinite(n) || n <= 0) { Alert.alert("Erreur", "Montant invalide"); return; }
    setBusy(true);
    try {
      await api.post("/agent/agency/cashin", { profile_id: clientId.trim().toUpperCase(), amount: n });
      Alert.alert("Encaissement réussi", `${formatMoney(n)} crédité sur le compte ${clientId.toUpperCase()}.`, [
        { text: "OK", onPress: () => router.back() }
      ]);
    } catch (e: any) {
      Alert.alert("Erreur", apiError(e));
    } finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: paybidColors.neutrals.background }} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={paybidColors.neutrals.textPrimary} />
        </TouchableOpacity>
        <TText variant="title" weight="extraBold" style={{ marginLeft: 6 }}>Encaisser</TText>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <View style={[styles.brownCard, { backgroundColor: "#54280f" }]}>
          <Ionicons name="arrow-down-circle" size={36} color="white" />
          <TText weight="extraBold" color="white" style={{ fontSize: 16, marginTop: 8 }}>Recharger un compte client</TText>
          <TText variant="caption" color="rgba(255,255,255,0.85)" style={{ marginTop: 4 }}>
            Le client donne des espèces, vous créditez son portefeuille.
          </TText>
        </View>
        <View style={styles.formCard}>
          <Input label="ID profil client (ex: SB-ABC123)" value={clientId} onChangeText={setClientId} icon="finger-print" autoCapitalize="characters" />
          <View style={{ marginTop: 10 }}>
            <Input label="Montant reçu en espèces" value={amount} onChangeText={setAmount} icon="cash" keyboardType="decimal-pad" placeholder="0,00" />
          </View>
          <Button title="Valider l'encaissement" icon="checkmark-circle" loading={busy} disabled={!clientId || !amount} onPress={submit} style={{ marginTop: 14, backgroundColor: "#10B981" }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", padding: spacing.lg, paddingBottom: 0 },
  backBtn: { padding: 6 },
  brownCard: { padding: spacing.lg, borderRadius: radii.xxl, marginBottom: spacing.md, alignItems: "flex-start" },
  formCard: { backgroundColor: paybidColors.neutrals.surface, padding: spacing.lg, borderRadius: radii.xl, borderWidth: 1, borderColor: paybidColors.neutrals.border },
});
