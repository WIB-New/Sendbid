import React, { useState, useEffect } from "react";
import { View, StyleSheet, Modal, TouchableOpacity, Platform, Alert, FlatList } from "react-native";
import { router } from "expo-router";
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
import { getLocalCurrency, getPaymentMethods } from "../../src/currency";
import { useTranslation } from "../../src/i18n";

type Method = "cash" | "bank" | "momo" | "paypal";

export default function Withdraw() {
  const { t } = useTranslation();
  const wallet = useAuth((s) => s.wallet);
  const user = useAuth((s) => s.user);
  const refreshMe = useAuth((s) => s.refreshMe);
  const currency = getLocalCurrency(user?.country, wallet?.currency);
  const availableMethods = getPaymentMethods(user?.country);
  const [method, setMethod] = useState<Method>("cash");
  const [amount, setAmount] = useState("50");
  // pin / state
  const [pin, setPin] = useState("");
  const [pinModal, setPinModal] = useState(false);
  const [qr, setQr] = useState<any>(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [linkedAccounts, setLinkedAccounts] = useState<any[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<any>(null);

  useEffect(() => {
    api.get("/wallet/linked-accounts").then(({ data }) => {
      const list = Array.isArray(data) ? data : [];
      setLinkedAccounts(list);
      // Pré-sélectionner le premier compte actif correspondant à la méthode courante
      const active = list.find((a: any) =>
        method === "momo" ? a.type === "momo" && a.status === "active" :
        method === "bank" ? a.type === "bank" && a.status === "active" :
        method === "paypal" ? a.type === "paypal" && a.status === "active" : false
      );
      setSelectedAccount(active || null);
    }).catch(() => {});
  }, [method]);

  const accountsForMethod = linkedAccounts.filter((a) =>
    method === "momo" ? a.type === "momo" :
    method === "bank" ? a.type === "bank" :
    method === "paypal" ? a.type === "paypal" : false
  );

  const amt = parseFloat(amount || "0");
  const fee = method === "cash"
    ? Math.max(amt * 0.005, amt * 0.01)          // 1% espèces
    : method === "bank"
    ? Math.max(amt * 0.005, amt * 0.015)          // 1.5% banque
    : method === "paypal"
    ? Math.max(amt * 0.005, amt * 0.01)           // 1% paypal
    : Math.max(amt * 0.005, amt * 0.008);         // 0.8% mobile

  const submitCash = async () => {
    setErr(null); setLoading(true);
    try {
      const { data } = await api.post("/wallet/withdraw-qr", { amount: parseFloat(amount), pin });
      setQr(data); setPinModal(false); setPin(""); setShowQrModal(true);
    } catch (e: any) { setErr(apiError(e)); } finally { setLoading(false); }
  };

  const submitOther = async () => {
    setErr(null); setLoading(true);
    try {
      let endpoint = "/wallet/withdraw-qr";
      let payload: any = { amount: parseFloat(amount), pin };
      
      // Use real PayPal Payouts API for PayPal withdrawals
      if (method === "paypal") {
        endpoint = "/payments/paypal/withdraw";
        payload = {
          email: selectedAccount?.identifier,
          amount: parseFloat(amount),
          currency: currency,
        };
      }
      
      const { data } = await api.post(endpoint, payload);
      await refreshMe();
      setPinModal(false); setPin("");
      
      const message = method === "bank"
        ? `Virement de ${amount} ${currency} vers ${selectedAccount?.bank_name || "votre banque"} programmé. Délai 1–2 jours ouvrés.`
        : method === "paypal"
        ? `Transfert de ${amount} ${currency} vers PayPal (${selectedAccount?.identifier}) en cours… Délai 1-3 minutes.`
        : `Transfert de ${amount} ${currency} vers ${selectedAccount?.operator || "portefeuille mobile"} (${selectedAccount?.identifier}) en cours…`;
      
      Alert.alert(
        "Demande enregistrée",
        message,
        [{ text: "OK", onPress: () => router.replace("/(tabs)/wallet") }]
      );
      setQr({ ...data, _hideQr: true });
    } catch (e: any) { 
      setErr(apiError(e));
      Alert.alert("Erreur", apiError(e));
    } finally { setLoading(false); }
  };

  const submit = () => method === "cash" ? submitCash() : submitOther();
  const canSubmit = amt > 0 && (
    method === "cash" ||
    (selectedAccount != null)
  );

  return (
    <Screen title="Retirer de l'argent" back hero>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.md, gap: 8 }}>
        <Ionicons name="location-outline" size={14} color={colors.neutrals.textSecondary} />
        <TText variant="caption" color={colors.neutrals.textSecondary}>
          Pays : <TText variant="caption" weight="bold" color={colors.neutrals.textPrimary}>{user?.country || "–"}</TText>
          {"  |  "}Devise : <TText variant="caption" weight="bold" color={colors.primary.base}>{currency}</TText>
        </TText>
      </View>
      {/* Method selector */}
      <View style={styles.methodsRow}>
        {[
          { key: "cash",   icon: "qr-code-outline",       label: "Espèces" },
          { key: "bank",   icon: "business-outline",      label: "Banque" },
          { key: "momo",   icon: "phone-portrait-outline", label: "Portefeuille mobile" },
          { key: "paypal", icon: "logo-paypal",            label: "PayPal" },
        ].filter((m) => availableMethods.includes(m.key as any))
          .reduce<{key:string;icon:any;label:string}[][]>((rows, item, i) => {
            if (i % 2 === 0) rows.push([]);
            rows[rows.length - 1].push(item);
            return rows;
          }, [])
          .map((row, ri) => (
            <View key={ri} style={styles.methodsLine}>
              {row.map((m) => (
                <MethodChip key={m.key} active={method === m.key} onPress={() => { setMethod(m.key as any); setSelectedAccount(null); }} icon={m.icon} label={m.label} />
              ))}
            </View>
          ))
        }
      </View>

      <View style={styles.info}>
        <Ionicons name="information-circle-outline" size={18} color={colors.primary.base} />
        <TText variant="caption" color={colors.primary.base} style={{ marginLeft: 6, flex: 1 }}>
          {method === "cash"
            ? `Présentez le QR à un agent SENDBID pour recevoir le cash. Frais : ${fee.toFixed(2)} ${currency}. PIN requis.`
            : method === "bank"
            ? `Virement SEPA / international vers votre compte bancaire. Frais : ${fee.toFixed(2)} ${currency}. Délai 1-2 jours ouvrés.`
            : method === "paypal"
            ? `Crédit instantané sur votre compte PayPal. Frais : ${fee.toFixed(2)} ${currency}. Délai 1-3 minutes.`
            : `Crédit sur votre portefeuille mobile (Wave / OM / MTN / Moov). Frais : ${fee.toFixed(2)} ${currency}.`}
        </TText>
      </View>

      <Input testID="withdraw-amount" label={`Montant à retirer (${currency})`} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="Ex: 50" icon="cash-outline" autoFocus />

      {/* Comptes liés pour cette méthode */}
      {method !== "cash" && accountsForMethod.length > 0 ? (
        <View style={{ marginBottom: 12 }}>
          <TText variant="label" weight="extraBold" color={colors.neutrals.textSecondary} style={{ marginBottom: 8, letterSpacing: 0.5 }}>MES COMPTES LIÉS</TText>
          {accountsForMethod.map((acc) => {
            const isPending = acc.status === "pending";
            const isSelected = selectedAccount?.id === acc.id;
            return (
              <TouchableOpacity
                key={acc.id}
                onPress={() => !isPending && setSelectedAccount(isSelected ? null : acc)}
                style={[styles.linkedCard, isSelected && styles.linkedCardActive, isPending && { opacity: 0.55 }]}
                activeOpacity={isPending ? 1 : 0.7}
              >
                <View style={styles.linkedIcon}>
                  <Ionicons
                    name={acc.type === "bank" ? "business-outline" : acc.type === "paypal" ? "logo-paypal" : "phone-portrait-outline"}
                    size={18}
                    color={isSelected ? "white" : colors.primary.base}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <TText variant="body" weight="bold" color={isSelected ? "white" : colors.neutrals.textPrimary}>{acc.label}</TText>
                    {isPending && (
                      <View style={{ backgroundColor: "#FEF3C7", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 99 }}>
                        <TText variant="label" weight="extraBold" color="#92400E">⏳ En attente</TText>
                      </View>
                    )}
                  </View>
                  <TText variant="caption" color={isSelected ? "rgba(255,255,255,0.75)" : colors.neutrals.textSecondary}>
                    {acc.operator ? `${acc.operator} · ` : ""}{acc.identifier}
                  </TText>
                  {isPending && <TText variant="label" color="#92400E">Validation en cours — non utilisable pour le moment</TText>}
                </View>
                {isSelected && <Ionicons name="checkmark-circle" size={20} color="white" />}
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      {/* Aucun compte lié — invitation à en ajouter un */}
      {method !== "cash" && accountsForMethod.length === 0 && !selectedAccount ? (
        <TouchableOpacity
          onPress={() => router.push("/wallet/linked-accounts" as any)}
          style={styles.noAccountBanner}
          activeOpacity={0.8}
        >
          <Ionicons name="wallet-outline" size={22} color={colors.primary.base} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <TText variant="body" weight="extraBold" color={colors.primary.base}>
              {method === "bank" ? "Aucun compte bancaire lié" : method === "paypal" ? "Aucun compte PayPal lié" : "Aucun compte portefeuille mobile lié"}
            </TText>
            <TText variant="caption" color={colors.neutrals.textSecondary} style={{ marginTop: 2 }}>
              Liez d'abord un compte dans vos réglages pour retirer.
            </TText>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.primary.base} />
        </TouchableOpacity>
      ) : null}

      {/* Récapitulatif */}
      <View style={styles.recapBox}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <TText variant="caption" color={colors.neutrals.textSecondary}>Montant</TText>
          <TText weight="semiBold">{amt.toFixed(2)} {currency}</TText>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
          <TText variant="caption" color={colors.neutrals.textSecondary}>Frais</TText>
          <TText weight="semiBold">{fee.toFixed(2)} {currency}</TText>
        </View>
        <View style={{ height: 1, backgroundColor: colors.neutrals.border, marginVertical: 8 }} />
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <TText weight="bold">Total débité</TText>
          <TText weight="extraBold" color={colors.status.error}>{(amt + fee).toFixed(2)} {currency}</TText>
        </View>
      </View>

      {err ? <TText variant="caption" color={colors.status.error} style={{ marginBottom: 8 }}>{err}</TText> : null}
      <Button testID="withdraw-submit" title={method === "cash" ? "Générer le QR de retrait" : "Confirmer le retrait"} icon="lock-closed" onPress={() => setPinModal(true)} disabled={!canSubmit} />

      {/* Modal QR Code centré */}
      <Modal visible={showQrModal} transparent animationType="fade" onRequestClose={() => setShowQrModal(false)}>
        {qr ? (
        <View style={styles.qrModalOverlay}>
          <View style={styles.qrModalBox}>
            <TText variant="subtitle" weight="bold" align="center" style={{ marginBottom: 16 }}>QR Code de retrait</TText>
            <View style={styles.qrBoxCentered}>
              {Platform.OS === "web" ? <Ionicons name="qr-code" size={180} color={colors.neutrals.textPrimary} /> : <QRCode value={qr.qr_token} size={220} />}
            </View>
            <TText variant="title" weight="extraBold" color={colors.status.error} align="center" style={{ marginTop: 16 }}>
              -{qr.amount?.toFixed(2)} {currency}
            </TText>
            <TText variant="caption" color={colors.neutrals.textSecondary} align="center" style={{ marginTop: 4 }}>Valide 15 minutes</TText>
            
            {/* Boutons action */}
            <View style={{ flexDirection: "row", gap: 12, marginTop: 24 }}>
              <TouchableOpacity onPress={() => setShowQrModal(false)} style={[styles.qrBtn, { backgroundColor: colors.neutrals.surface }]}>
                <TText variant="body" weight="bold" color={colors.neutrals.textPrimary}>Fermer</TText>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setShowQrModal(false); setQr(null); setAmount(""); }} style={[styles.qrBtn, { backgroundColor: colors.primary.base }]}>
                <TText variant="body" weight="bold" color="white">🔄 Nouveau retrait</TText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        ) : null}
      </Modal>

      {qr && qr._hideQr ? (
        <View style={styles.successBox}>
          <Ionicons name="checkmark-circle" size={36} color={colors.status.success} />
          <TText variant="title" weight="extraBold" align="center" style={{ marginTop: 8 }}>Demande validée</TText>
        </View>
      ) : null}

      <Modal visible={Boolean(pinModal)} transparent animationType="slide" onRequestClose={() => setPinModal(false)}>
        <View style={styles.modal}>
          <View style={styles.sheet}>
            <TText variant="subtitle" weight="bold" align="center">Saisissez votre PIN</TText>
            <TText variant="caption" color={colors.neutrals.textSecondary} align="center" style={{ marginBottom: spacing.md }}>
              Confirmez le retrait de {amount} {currency} ({method === "cash" ? "espèces (agent)" : method === "bank" ? "compte bancaire" : method === "paypal" ? "PayPal" : "portefeuille mobile"})
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
  methodsRow: { flexDirection: "column", gap: 8, marginVertical: spacing.md },
  methodsLine: { flexDirection: "row", gap: 8 },
  methodChip: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 8, paddingVertical: 13, borderRadius: radii.full, backgroundColor: colors.neutrals.surface, borderWidth: 1.5, borderColor: colors.neutrals.border },
  info: { flexDirection: "row", alignItems: "center", backgroundColor: colors.overlays.primarySoft, padding: spacing.md, borderRadius: radii.lg, marginBottom: spacing.lg },
  opChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.full, backgroundColor: colors.neutrals.surface, borderWidth: 1.5, borderColor: colors.neutrals.border },
  linkedCard: { flexDirection: "row", alignItems: "center", borderRadius: radii.xl, borderWidth: 1.5, borderColor: colors.neutrals.border, backgroundColor: colors.neutrals.surface, padding: spacing.md, marginBottom: 8 },
  noAccountBanner: { flexDirection: "row", alignItems: "center", backgroundColor: colors.overlays.primarySoft, borderRadius: radii.xl, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1.5, borderColor: colors.primary.base + "33" },
  linkedCardActive: { backgroundColor: colors.primary.base, borderColor: colors.primary.base },
  linkedIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(0,20,126,0.08)", alignItems: "center", justifyContent: "center" },
  recapBox: { backgroundColor: colors.neutrals.surface, padding: spacing.md, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.neutrals.border, marginVertical: spacing.md },
  qrBox: { backgroundColor: colors.neutrals.surface, padding: spacing.xl, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.neutrals.border, alignItems: "center", marginTop: spacing.lg },
  qrModalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 20 },
  qrModalBox: { backgroundColor: "white", borderRadius: radii.xxl, padding: spacing.xl, width: "100%", maxWidth: 360, alignItems: "center" },
  qrBoxCentered: { backgroundColor: "white", padding: 16, borderRadius: radii.lg },
  qrBtn: { flex: 1, paddingVertical: 14, borderRadius: radii.full, alignItems: "center", justifyContent: "center" },
  successBox: { alignItems: "center", padding: spacing.xl, backgroundColor: colors.overlays.successSoft, borderRadius: radii.xl, marginTop: spacing.lg },
  modal: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: { backgroundColor: "white", borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl, padding: spacing.lg, paddingBottom: spacing.xl },
});
