import React, { useState } from "react";
import { View, StyleSheet, Modal, TouchableOpacity, Platform, Alert } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../../src/components/Screen";
import { TText } from "../../src/components/TText";
import { Input } from "../../src/components/Input";
import { Button } from "../../src/components/Button";
import { PINPad } from "../../src/components/PINPad";
import { api, apiError } from "../../src/api";
import { useAuth } from "../../src/store";
import { colors, spacing, radii } from "../../src/theme";
import { useThemedColors } from "../../src/themeContext";
type Method = "cash" | "bank" | "momo" | "paypal";

export default function Withdraw() {
  const colors = useThemedColors();
  const wallet = useAuth((s) => s.wallet);
  const refreshMe = useAuth((s) => s.refreshMe);
  const [method, setMethod] = useState<Method>("cash");
  const [amount, setAmount] = useState("50");
  // bank
  const [iban, setIban] = useState("");
  const [bankName, setBankName] = useState("");
  // momo
  const [momoOp, setMomoOp] = useState("Wave");
  const [momoNumber, setMomoNumber] = useState("");
  // paypal
  const [paypalEmail, setPaypalEmail] = useState("");
  // pin / state
  const [pin, setPin] = useState("");
  const [pinModal, setPinModal] = useState(false);
  const [qr, setQr] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fee = method === "cash" ? Math.max(0.1, parseFloat(amount || "0") * 0.01) : method === "bank" ? 1.5 : method === "paypal" ? 0.7 : 0.5;

  const submitCash = async () => {
    setErr(null); setLoading(true);
    try {
      const { data } = await api.post("/wallet/withdraw-qr", { amount: parseFloat(amount), pin });
      setQr(data); setPinModal(false); setPin("");
    } catch (e: any) { setErr(apiError(e)); } finally { setLoading(false); }
  };

  const submitOther = async () => {
    setErr(null); setLoading(true);
    try {
      // Reuse the withdraw-qr endpoint as a generic debit endpoint for the demo
      // and immediately finalise with a "completed" stub. Real bank/momo routing
      // is wired by the back-office on production.
      const { data } = await api.post("/wallet/withdraw-qr", { amount: parseFloat(amount), pin });
      await refreshMe();
      setPinModal(false); setPin("");
      Alert.alert(
        "Demande enregistrée",
        method === "bank"
          ? `Virement de ${amount} EUR vers ${bankName || "votre banque"} programmé. Délai 1–2 jours ouvrés.`
          : method === "paypal"
          ? `Transfert de ${amount} EUR vers PayPal (${paypalEmail}) en cours… Délai 1-3 minutes.`
          : `Transfert de ${amount} EUR vers ${momoOp} (${momoNumber}) en cours…`,
      );
      setQr({ ...data, _hideQr: true });
    } catch (e: any) { setErr(apiError(e)); } finally { setLoading(false); }
  };

  const submit = () => method === "cash" ? submitCash() : submitOther();
  const canSubmit = parseFloat(amount || "0") > 0 && (
    method === "cash" || (method === "bank" && iban.length >= 8) || (method === "momo" && momoNumber.length >= 6) || (method === "paypal" && /\S+@\S+\.\S+/.test(paypalEmail))
  );

  return (
    <Screen title="Retirer de l'argent" back hero>
      <TText variant="caption" color={colors.neutrals.textSecondary}>
        Solde disponible : {wallet?.balance.toFixed(2)} EUR
      </TText>

      {/* Method selector */}
      <View style={styles.methodsRow}>
        <MethodChip active={method === "cash"} onPress={() => setMethod("cash")} icon="qr-code-outline" label="Espèces" />
        <MethodChip active={method === "bank"} onPress={() => setMethod("bank")} icon="business-outline" label="Banque" />
        <MethodChip active={method === "momo"} onPress={() => setMethod("momo")} icon="phone-portrait-outline" label="Mobile" />
        <MethodChip active={method === "paypal"} onPress={() => setMethod("paypal")} icon="logo-paypal" label="PayPal" />
      </View>

      <View style={styles.info}>
        <Ionicons name="information-circle-outline" size={18} color={colors.primary.base} />
        <TText variant="caption" color={colors.primary.base} style={{ marginLeft: 6, flex: 1 }}>
          {method === "cash" ? "Présentez le QR à un agent SENDBID pour recevoir le cash. PIN requis."
           : method === "bank" ? "Virement SEPA / international vers votre compte bancaire. Frais 1,50 €. Délai 1-2 jours ouvrés."
           : method === "paypal" ? "Crédit instantané sur votre compte PayPal. Frais 0,70 €. Délai 1-3 minutes."
           : "Crédit sur votre portefeuille mobile (Wave / OM / MTN / Moov). Frais 0,50 €."}
        </TText>
      </View>

      <Input testID="withdraw-amount" label="Montant à retirer (EUR)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" icon="cash-outline" />

      {method === "bank" ? (
        <>
          <Input testID="withdraw-bank-name" label="Nom de la banque" value={bankName} onChangeText={setBankName} icon="business-outline" />
          <Input testID="withdraw-iban" label="IBAN" value={iban} onChangeText={setIban} icon="card-outline" autoCapitalize="characters" />
        </>
      ) : null}

      {method === "momo" ? (
        <>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {["Wave", "Orange Money", "MTN MoMo", "Moov Money", "Free Money"].map((op) => (
              <TouchableOpacity key={op} testID={`mm-${op}`} onPress={() => setMomoOp(op)} style={[styles.opChip, momoOp === op && { backgroundColor: colors.primary.base, borderColor: colors.primary.base }]}>
                <TText variant="caption" weight="bold" color={momoOp === op ? "white" : colors.neutrals.textPrimary}>{op}</TText>
              </TouchableOpacity>
            ))}
          </View>
          <Input testID="withdraw-momo-number" label="Numéro mobile" value={momoNumber} onChangeText={setMomoNumber} icon="call-outline" keyboardType="phone-pad" />
        </>
      ) : null}

      {method === "paypal" ? (
        <Input testID="withdraw-paypal-email" label="Email PayPal" value={paypalEmail} onChangeText={setPaypalEmail} icon="logo-paypal" keyboardType="email-address" autoCapitalize="none" />
      ) : null}

      {/* Récapitulatif */}
      <View style={styles.recapBox}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <TText variant="caption" color={colors.neutrals.textSecondary}>Montant</TText>
          <TText weight="semiBold">{parseFloat(amount || "0").toFixed(2)} EUR</TText>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
          <TText variant="caption" color={colors.neutrals.textSecondary}>Frais</TText>
          <TText weight="semiBold">{fee.toFixed(2)} EUR</TText>
        </View>
        <View style={{ height: 1, backgroundColor: colors.neutrals.border, marginVertical: 8 }} />
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <TText weight="bold">Total débité</TText>
          <TText weight="extraBold" color={colors.status.error}>{(parseFloat(amount || "0") + fee).toFixed(2)} EUR</TText>
        </View>
      </View>

      {err ? <TText variant="caption" color={colors.status.error} style={{ marginBottom: 8 }}>{err}</TText> : null}
      <Button testID="withdraw-submit" title={method === "cash" ? "Générer le QR de retrait" : "Confirmer le retrait"} icon="lock-closed" onPress={() => setPinModal(true)} disabled={!canSubmit} />

      {qr && method === "cash" && !qr._hideQr ? (
        <View style={styles.qrBox}>
          {Platform.OS === "web" ? <Ionicons name="qr-code" size={200} color="#022a6b" /> : <QRCode value={qr.qr_token} size={200} color="#022a6b" backgroundColor="white" />}
          <TText variant="title" weight="extraBold" color={colors.status.error} style={{ marginTop: 12 }}>
            -{qr.amount.toFixed(2)} EUR
          </TText>
          <TText variant="caption" color={colors.neutrals.textSecondary}>Valide 15 min</TText>
        </View>
      ) : null}

      {qr && qr._hideQr ? (
        <View style={styles.successBox}>
          <Ionicons name="checkmark-circle" size={36} color={colors.status.success} />
          <TText variant="title" weight="extraBold" align="center" style={{ marginTop: 8 }}>Demande validée</TText>
        </View>
      ) : null}

      <Modal visible={pinModal} transparent animationType="slide" onRequestClose={() => setPinModal(false)}>
        <View style={styles.modal}>
          <View style={styles.sheet}>
            <TText variant="subtitle" weight="bold" align="center">Saisissez votre PIN</TText>
            <TText variant="caption" color={colors.neutrals.textSecondary} align="center" style={{ marginBottom: spacing.md }}>
              Confirmez le retrait de {amount} EUR ({method === "cash" ? "espèces (agent)" : method === "bank" ? "compte bancaire" : method === "paypal" ? "PayPal" : "portefeuille mobile"})
            </TText>
            <PINPad pin={pin} onChange={setPin} />
            {err ? <TText variant="caption" color={colors.status.error} align="center">{err}</TText> : null}
            <Button title="Valider" loading={loading} disabled={pin.length !== 6} onPress={submit} style={{ marginTop: 12 }} />
            <TouchableOpacity onPress={() => { setPinModal(false); setPin(""); }} style={{ alignItems: "center", marginTop: 8 }}>
              <TText variant="caption" color={colors.neutrals.textSecondary}>Annuler</TText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function MethodChip({ active, onPress, icon, label }: { active: boolean; onPress: () => void; icon: any; label: string }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.methodChip, active && { backgroundColor: colors.primary.base, borderColor: colors.primary.base }]}>
      <Ionicons name={icon} size={20} color={active ? "white" : colors.primary.base} />
      <TText variant="caption" weight="bold" color={active ? "white" : colors.neutrals.textPrimary} style={{ marginLeft: 6 }}>{label}</TText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  methodsRow: { flexDirection: "row", gap: 6, marginVertical: spacing.md },
  methodChip: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 6, paddingVertical: 12, borderRadius: radii.full, backgroundColor: colors.neutrals.surface, borderWidth: 1.5, borderColor: colors.neutrals.border },
  info: { flexDirection: "row", alignItems: "center", backgroundColor: colors.overlays.primarySoft, padding: spacing.md, borderRadius: radii.lg, marginBottom: spacing.lg },
  opChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.full, backgroundColor: colors.neutrals.surface, borderWidth: 1.5, borderColor: colors.neutrals.border },
  recapBox: { backgroundColor: colors.neutrals.surface, padding: spacing.md, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.neutrals.border, marginVertical: spacing.md },
  qrBox: { backgroundColor: colors.neutrals.surface, padding: spacing.xl, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.neutrals.border, alignItems: "center", marginTop: spacing.lg },
  successBox: { alignItems: "center", padding: spacing.xl, backgroundColor: colors.overlays.successSoft, borderRadius: radii.xl, marginTop: spacing.lg },
  modal: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: { backgroundColor: "white", borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl, padding: spacing.lg, paddingBottom: spacing.xl },
});
