/**
 * /paybid/loan-request.tsx — Demande d'encours / facilité de caisse (item 1).
 */
import React, { useState } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { TText } from "../../src/components/TText";
import { Input } from "../../src/components/Input";
import { Button } from "../../src/components/Button";
import { api, apiError } from "../../src/api";
import { paybidColors } from "../../src/paybidTheme";
import { spacing, radii } from "../../src/theme";
import { useTranslation } from "../../src/i18n";

export default function PaybidLoanRequest() {
  const { t } = useTranslation();
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const n = parseFloat(amount.replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) { Alert.alert("Erreur", "Montant invalide"); return; }
    setBusy(true);
    try {
      await api.post("/agent/loan-request", { amount: n, reason: reason.trim() || undefined });
      Alert.alert("Demande envoyée", "Notre équipe étudiera votre demande sous 48h ouvrées.", [
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
        <TText variant="title" weight="extraBold" style={{ marginLeft: 6 }}>Mon encours</TText>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <View style={[styles.brownCard, { backgroundColor: "#54280f" }]}>
          <Ionicons name="card" size={36} color="white" />
          <TText weight="extraBold" color="white" style={{ fontSize: 16, marginTop: 8 }}>Demande d&apos;encours</TText>
          <TText variant="caption" color="rgba(255,255,255,0.85)" style={{ marginTop: 4 }}>
            Une facilité de caisse vous sera proposée selon votre ancienneté et vos performances.
          </TText>
        </View>
        <View style={styles.formCard}>
          <Input label="Montant demandé" value={amount} onChangeText={setAmount} icon="cash" keyboardType="decimal-pad" placeholder="0,00" />
          <View style={{ marginTop: 10 }}>
            <Input label="Motif (optionnel)" value={reason} onChangeText={setReason} icon="chatbubble" multiline placeholder="Pourquoi cet encours ?" />
          </View>
          <Button title="Soumettre la demande" icon="send" loading={busy} disabled={!amount} onPress={submit} style={{ marginTop: 14, backgroundColor: paybidColors.primary.base }} />
        </View>
        <View style={[styles.infoBox, { backgroundColor: paybidColors.overlays.primarySoft }]}>
          <Ionicons name="information-circle" size={18} color={paybidColors.primary.base} />
          <TText variant="caption" style={{ flex: 1, marginLeft: 8 }} color={paybidColors.neutrals.textSecondary}>
            Les conditions d&apos;éligibilité incluent : 3 mois d&apos;ancienneté minimum, score d&apos;agent supérieur à 4.0, et historique de transferts régulier.
          </TText>
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
  infoBox: { flexDirection: "row", alignItems: "flex-start", padding: 14, borderRadius: radii.lg, marginTop: 12 },
});
