import React, { useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity, Platform, Linking } from "react-native";
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

/**
 * Ouvre une action native depuis l'agent vers le bénéficiaire :
 * - phone     : tel: (déclenche le dialer)
 * - sms       : sms:
 * - whatsapp  : ouvre WhatsApp via deep-link wa.me, fallback navigateur
 * - maps      : itinéraire Google Maps (daddr = adresse OU lat,lng)
 */
const openExternal = async (kind: "phone" | "sms" | "whatsapp" | "maps", target: string) => {
  let url = "";
  if (kind === "phone") url = `tel:${target}`;
  else if (kind === "sms") url = `sms:${target}`;
  else if (kind === "whatsapp") {
    const clean = target.replace(/[^\d+]/g, "");
    url = Platform.OS === "web" ? `https://wa.me/${clean.replace("+", "")}` : `whatsapp://send?phone=${clean.replace("+", "")}`;
  } else if (kind === "maps") {
    const q = encodeURIComponent(target);
    url = Platform.OS === "ios"
      ? `http://maps.apple.com/?daddr=${q}`
      : `https://www.google.com/maps/dir/?api=1&destination=${q}`;
  }
  try {
    const ok = await Linking.canOpenURL(url);
    if (ok) await Linking.openURL(url);
    else if (kind === "whatsapp") await Linking.openURL(`https://wa.me/${target.replace(/[^\d]/g, "")}`);
    else Alert.alert("Impossible d'ouvrir", url);
  } catch {
    Alert.alert("Erreur", "Impossible d'ouvrir cette action");
  }
};

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
          <Row label="Votre commission" value={`+${Number(t.agent_commission || t.fee_total * 0.6 || 0).toFixed(2)} EUR`} />
          <Row label="Statut" value={t.status} />
          <Row label="Code retrait" value={t.withdrawal_code || "—"} />
          <Row label="Téléphone bénéficiaire" value={t.beneficiary?.phone || "—"} />
          {t.beneficiary?.bank_account ? <Row label="Compte bancaire" value={t.beneficiary.bank_account} /> : null}
          {t.beneficiary?.momo_number ? <Row label="Mobile Money" value={`${t.beneficiary.momo_operator} ${t.beneficiary.momo_number}`} /> : null}
        </View>

        {/* === Actions de contact direct avec le bénéficiaire === */}
        {t.beneficiary?.phone ? (
          <View style={styles.contactRow}>
            <TouchableOpacity style={styles.contactBtn} onPress={() => openExternal("phone", t.beneficiary.phone)}>
              <Ionicons name="call" size={22} color="white" />
              <TText variant="label" weight="bold" color="white" style={{ marginTop: 4 }}>Appeler</TText>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.contactBtn, { backgroundColor: "#25D366" }]} onPress={() => openExternal("whatsapp", t.beneficiary.phone)}>
              <Ionicons name="logo-whatsapp" size={22} color="white" />
              <TText variant="label" weight="bold" color="white" style={{ marginTop: 4 }}>WhatsApp</TText>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.contactBtn, { backgroundColor: "#022a6b" }]} onPress={() => router.push(`/chat/${t.id}` as any)}>
              <Ionicons name="chatbubbles" size={22} color="white" />
              <TText variant="label" weight="bold" color="white" style={{ marginTop: 4 }}>Chat</TText>
            </TouchableOpacity>
            {(t.beneficiary?.city || t.beneficiary?.address) ? (
              <TouchableOpacity style={[styles.contactBtn, { backgroundColor: "#F59E0B" }]} onPress={() => openExternal("maps", `${t.beneficiary.address || ""} ${t.beneficiary.city || ""} ${t.destination_country || ""}`.trim())}>
                <Ionicons name="navigate" size={22} color="white" />
                <TText variant="label" weight="bold" color="white" style={{ marginTop: 4 }}>Itinéraire</TText>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
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
  contactRow: { flexDirection: "row", gap: 8, marginBottom: spacing.md },
  contactBtn: { flex: 1, paddingVertical: 12, borderRadius: radii.lg, backgroundColor: paybidColors.primary.base, alignItems: "center" },
});
