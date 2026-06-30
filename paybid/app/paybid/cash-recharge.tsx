/**
 * /paybid/cash-recharge.tsx — Recharger ma caisse (item 1).
 *
 * Permet à l'agent de demander une recharge de sa caisse auprès du siège.
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
import { formatMoney } from "../../src/utils/money";
import { useTranslation } from "../../src/i18n";

export default function PaybidCashRecharge() {
  const { t } = useTranslation();
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"bank" | "cash" | "momo">("bank");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const n = parseFloat(amount.replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) { Alert.alert("Erreur", "Montant invalide"); return; }
    setBusy(true);
    try {
      await api.post("/agent/cash-recharge", { amount: n, method, note: note.trim() || undefined });
      Alert.alert("Demande envoyée", `Votre demande de recharge de ${formatMoney(n)} a été transmise au siège. Vous serez notifié dès qu'elle est traitée.`, [
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
        <TText variant="title" weight="extraBold" style={{ marginLeft: 6 }}>Recharger ma caisse</TText>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <View style={[styles.brownCard, { backgroundColor: "#54280f" }]}>
          <Ionicons name="add-circle" size={36} color="white" />
          <TText weight="extraBold" color="white" style={{ fontSize: 16, marginTop: 8 }}>Demande de recharge</TText>
          <TText variant="caption" color="rgba(255,255,255,0.85)" style={{ marginTop: 4 }}>
            Votre demande sera validée par le siège.
          </TText>
        </View>

        <View style={styles.formCard}>
          <TText variant="label" weight="extraBold" color={paybidColors.neutrals.textSecondary} style={{ letterSpacing: 0.8, marginBottom: 6 }}>MONTANT</TText>
          <Input label="Montant (en devise locale)" value={amount} onChangeText={setAmount} icon="cash" keyboardType="decimal-pad" placeholder="0,00" />

          <TText variant="label" weight="extraBold" color={paybidColors.neutrals.textSecondary} style={{ letterSpacing: 0.8, marginBottom: 6, marginTop: 12 }}>MÉTHODE DE VERSEMENT</TText>
          <View style={{ gap: 8 }}>
            {([
              { v: "bank" as const, l: "Virement bancaire", i: "business" as const },
              { v: "cash" as const, l: "Dépôt espèces au siège", i: "cash" as const },
              { v: "momo" as const, l: "Mobile Money", i: "phone-portrait" as const },
            ]).map((o) => (
              <TouchableOpacity key={o.v} onPress={() => setMethod(o.v)} style={[styles.methodRow, method === o.v && { borderColor: paybidColors.primary.base, backgroundColor: paybidColors.overlays.primarySoft }]}>
                <Ionicons name={o.i} size={20} color={paybidColors.primary.base} />
                <TText weight="semiBold" style={{ marginLeft: 10, flex: 1 }}>{o.l}</TText>
                {method === o.v ? <Ionicons name="checkmark-circle" size={20} color={paybidColors.primary.base} /> : null}
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ marginTop: 12 }}>
            <Input label="Note (optionnel)" value={note} onChangeText={setNote} icon="document-text" multiline placeholder="Préciser pour quelle raison" />
          </View>

          <Button title="Envoyer la demande" icon="send" loading={busy} disabled={!amount} onPress={submit} style={{ marginTop: 14, backgroundColor: paybidColors.primary.base }} />
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
  methodRow: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: radii.lg, borderWidth: 1, borderColor: paybidColors.neutrals.border, backgroundColor: paybidColors.neutrals.surface },
});
