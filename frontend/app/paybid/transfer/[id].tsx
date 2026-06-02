import React, { useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { TText } from "../../../src/components/TText";
import { Input } from "../../../src/components/Input";
import { Button } from "../../../src/components/Button";
import { api, apiError } from "../../../src/api";
import { useThemedPaybidColors } from "../../../src/themeContext";
import { paybidColors } from "../../../src/paybidTheme";
import { spacing, radii } from "../../../src/theme";

export default function PaybidTransferDetail() {
  const paybidColors = useThemedPaybidColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [t, setT] = useState<any>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => { try { const r = await api.get(`/transfers/${id}`); setT(r.data); } catch {} };
  useEffect(() => { load(); }, [id]);

  const start = async () => {
    setBusy(true);
    try { await api.post(`/agent/transfers/${id}/start`, {}); await load(); } catch (e: any) { Alert.alert("Erreur", apiError(e)); } finally { setBusy(false); }
  };
  const complete = async () => {
    setBusy(true); setErr(null);
    try {
      const { data } = await api.post(`/agent/transfers/${id}/complete`, { code });
      Alert.alert("Transfert terminé", `Vous avez gagné +${data.earned_eur.toFixed(2)} EUR`);
      router.back();
    } catch (e: any) { setErr(apiError(e)); } finally { setBusy(false); }
  };

  if (!t) return null;
  const canStart = ["AGENT_ASSIGNED"].includes(t.status);
  const canComplete = ["PROCESSING", "READY_FOR_PICKUP", "VIP_DELIVERY"].includes(t.status);

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: paybidColors.neutrals.background }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={paybidColors.neutrals.textPrimary} /></TouchableOpacity>
        <TText variant="title" weight="extraBold" style={{ flex: 1, marginLeft: 8 }}>Transfert</TText>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}>
        <View style={styles.box}>
          <TText variant="caption" color={paybidColors.neutrals.textSecondary}>Bénéficiaire</TText>
          <TText variant="title" weight="extraBold">{t.beneficiary?.full_name || "—"}</TText>
          <TText variant="caption" color={paybidColors.neutrals.textSecondary}>{t.destination_country} · {(t.delivery_mode || "").toUpperCase()}{t.vip_delivery ? " · VIP" : ""}</TText>
        </View>
        <View style={styles.box}>
          <Row label="Montant à remettre" value={`${Number(t.receive_amount).toFixed(0)} ${t.destination_currency}`} bold />
          <Row label="Statut" value={t.status} />
          <Row label="Code retrait" value={t.withdrawal_code || "—"} />
          <Row label="Téléphone bénéficiaire" value={t.beneficiary?.phone || "—"} />
          {t.beneficiary?.bank_account ? <Row label="Compte bancaire" value={t.beneficiary.bank_account} /> : null}
          {t.beneficiary?.momo_number ? <Row label="Mobile Money" value={`${t.beneficiary.momo_operator} ${t.beneficiary.momo_number}`} /> : null}
        </View>
        {canStart ? (
          <Button title="Démarrer la livraison" icon="play" onPress={start} loading={busy} style={{ backgroundColor: paybidColors.primary.base, marginTop: spacing.lg }} />
        ) : null}
        {canComplete ? (
          <View style={styles.box}>
            <TText weight="bold" style={{ marginBottom: 6 }}>Confirmer la remise</TText>
            <Input label="Code à 10 chiffres du client" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={10} icon="keypad-outline" />
            {err ? <TText color={paybidColors.status.error}>{err}</TText> : null}
            <Button title="Valider et encaisser" icon="checkmark" onPress={complete} loading={busy} disabled={code.length < 6} style={{ backgroundColor: paybidColors.status.success }} />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value, bold }: any) { return (<View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}><TText variant="caption" color={paybidColors.neutrals.textSecondary}>{label}</TText><TText weight={bold ? "extraBold" : "semiBold"} color={bold ? paybidColors.primary.base : paybidColors.neutrals.textPrimary}>{value}</TText></View>); }

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", padding: spacing.lg },
  box: { backgroundColor: paybidColors.neutrals.surface, padding: spacing.lg, borderRadius: radii.xl, borderWidth: 1, borderColor: paybidColors.neutrals.border, marginBottom: spacing.md },
});
