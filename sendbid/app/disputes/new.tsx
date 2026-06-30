import React, { useEffect, useState } from "react";
import { View, StyleSheet, Alert, TouchableOpacity, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../../src/components/Screen";
import { TText } from "../../src/components/TText";
import { Input } from "../../src/components/Input";
import { Button } from "../../src/components/Button";
import { api, apiError } from "../../src/api";
import { colors, spacing, radii } from "../../src/theme";
import { useThemedColors } from "../../src/themeContext";
import { useTranslation } from "../../src/i18n";
const REASONS = [
  { key: "not_received", label: "Fonds non reçus" },
  { key: "wrong_amount", label: "Montant incorrect" },
  { key: "agent_no_show", label: "Agent absent" },
  { key: "delay", label: "Délai dépassé" },
  { key: "fraud", label: "Suspicion de fraude" },
  { key: "other", label: "Autre" },
];

export default function NewDispute() {
  const { t } = useTranslation();
  const colors = useThemedColors();
  const router = useRouter();
  const [transfers, setTransfers] = useState<any[]>([]);
  const [transferId, setTransferId] = useState<string>("");
  const [reason, setReason] = useState<string>("not_received");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get("/transfers").then((r) => setTransfers(r.data || [])).catch(() => {});
  }, []);

  const submit = async () => {
    if (!transferId) { Alert.alert("Transfert requis", "Sélectionnez le transfert concerné."); return; }
    if (description.trim().length < 10) { Alert.alert("Description trop courte", "Décrivez le problème en au moins 10 caractères."); return; }
    setBusy(true);
    try {
      await api.post("/disputes", { transfer_id: transferId, reason, description });
      Alert.alert("Litige ouvert", "Notre équipe vous répondra sous 24h.");
      router.back();
    } catch (e: any) {
      Alert.alert("Erreur", apiError(e));
    } finally { setBusy(false); }
  };

  return (
    <Screen title="Ouvrir un litige" back>
      <TText variant="caption" color={colors.neutrals.textSecondary} style={{ marginBottom: spacing.md }}>
        Sélectionnez le transfert concerné, le motif et décrivez le problème.
      </TText>

      <TText variant="caption" weight="semiBold" color={colors.neutrals.textSecondary} style={{ marginBottom: 6 }}>Transfert concerné</TText>
      <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
        {transfers.length === 0 ? (
          <View style={{ padding: spacing.md, alignItems: "center" }}>
            <TText variant="caption" color={colors.neutrals.textSecondary}>Aucun transfert disponible</TText>
          </View>
        ) : transfers.map((t) => (
          <TouchableOpacity
            key={t.id}
            testID={`disp-tr-${t.id}`}
            onPress={() => setTransferId(t.id)}
            style={[styles.tRow, transferId === t.id && styles.tRowActive]}
          >
            <Ionicons name={transferId === t.id ? "radio-button-on" : "radio-button-off"} size={18} color={colors.primary.base} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <TText variant="caption" weight="bold">#{(t.reference || t.id).slice(-8).toUpperCase()} • {t.beneficiary?.full_name || "—"}</TText>
              <TText variant="label" color={colors.neutrals.textSecondary}>{t.send_amount.toFixed(2)} EUR • {new Date(t.created_at).toLocaleDateString("fr-FR")}</TText>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TText variant="caption" weight="semiBold" color={colors.neutrals.textSecondary} style={{ marginTop: spacing.md, marginBottom: 6 }}>Motif</TText>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {REASONS.map((r) => (
          <TouchableOpacity key={r.key} testID={`disp-reason-${r.key}`} onPress={() => setReason(r.key)} style={[styles.chip, reason === r.key && styles.chipActive]}>
            <TText variant="label" weight="bold" color={reason === r.key ? "white" : colors.neutrals.textPrimary}>{r.label}</TText>
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ marginTop: spacing.md }}>
        <Input label="Description du problème" value={description} onChangeText={setDescription} multiline icon="chatbubble-outline" />
      </View>

      <Button testID="disp-submit" title="Envoyer le litige" icon="send" loading={busy} onPress={submit} style={{ marginTop: spacing.lg, backgroundColor: "#EF4444" }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  tRow: { flexDirection: "row", alignItems: "center", padding: 10, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.neutrals.border, marginBottom: 6, backgroundColor: colors.neutrals.surface },
  tRowActive: { borderColor: colors.primary.base, backgroundColor: colors.overlays.primarySoft },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radii.full, backgroundColor: colors.neutrals.surface, borderWidth: 1, borderColor: colors.neutrals.border },
  chipActive: { backgroundColor: colors.primary.base, borderColor: colors.primary.base },
});
