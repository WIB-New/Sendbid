import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, Modal, TouchableOpacity, Animated, Platform } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../../src/components/Screen";
import { TText } from "../../src/components/TText";
import { Input } from "../../src/components/Input";
import { Button } from "../../src/components/Button";
import { PINPad } from "../../src/components/PINPad";
import { api, apiError } from "../../src/api";
import { useAuth } from "../../src/store";
import { colors, spacing, radii } from "../../src/theme";
import { getLocalCurrency } from "../../src/currency";
import { useTranslation } from "../../src/i18n";

// Virement P2P gratuit v6.4 — refonte design lisible (hero gradient + cards séparées,
// solde en évidence, contrastes corrects, layout aéré).
export default function P2P() {
  const { t } = useTranslation();
  const wallet = useAuth((s) => s.wallet);
  const user = useAuth((s) => s.user);
  const refreshMe = useAuth((s) => s.refreshMe);
  const params = useLocalSearchParams<{ profile_id?: string; full_name?: string }>();
  const [recipient, setRecipient] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [pin, setPin] = useState("");
  const [pinModal, setPinModal] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<{ amount: number; balance: number; creditedAmount?: number; creditedCurrency?: string; fxRate?: number | null } | null>(null);

  // Pré-remplir si destination (profile_id) passée en paramètre
  useEffect(() => {
    if (params.profile_id) setRecipient(String(params.profile_id));
    if (params.full_name) setRecipientName(String(params.full_name));
  }, [params.profile_id, params.full_name]);

  const balance = wallet?.balance || 0;
  const currency = getLocalCurrency(user?.country, wallet?.currency);
  const sendAmt = parseFloat(amount.replace(",", ".")) || 0;
  const insufficient = sendAmt > balance;
  const canSend = recipient.trim().length >= 3 && sendAmt > 0 && !insufficient;

  // ── Toast noir ──
  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<any>(null);
  const showToast = (msg: string) => {
    setErr(msg);
    toastAnim.setValue(0);
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.delay(2800),
      Animated.timing(toastAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setErr(null));
  };

  const submit = async () => {
    setErr(null);
    setLoading(true);
    try {
      const { data } = await api.post("/wallet/p2p", { recipient_identifier: recipient, amount: sendAmt, note, pin });
      await refreshMe();
      setPinModal(false);
      setPin("");
      setSuccess({
        amount: sendAmt,
        balance: data.new_balance,
        creditedAmount: data.credited_amount,
        creditedCurrency: data.credited_currency,
        fxRate: data.fx_rate ?? null,
      });
    } catch (e: any) {
      showToast(apiError(e));
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setSuccess(null); setRecipient(""); setRecipientName(""); setAmount(""); setNote("");
  };

  return (
    <Screen title="Virement P2P gratuit" back hero scroll={true}>
      {/* Hero card — solde + label */}
      <View style={styles.heroCard}>
        <View style={styles.heroIcon}>
          <Ionicons name="git-compare" size={26} color="white" />
        </View>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <TText variant="caption" weight="extraBold" color="rgba(255,255,255,0.85)" style={{ letterSpacing: 1 }}>
            VIREMENT P2P • GRATUIT • INSTANTANÉ
          </TText>
          <TText variant="title" weight="extraBold" color="white" style={{ marginTop: 2 }}>
            Solde : {balance.toFixed(2)} {currency}
          </TText>
          <TText variant="label" color="rgba(255,255,255,0.85)" style={{ marginTop: 2 }}>
            Envoyez à un autre utilisateur SENDBID — aucun frais.
          </TText>
        </View>
      </View>

      {success ? (
        // Écran de succès
        <View style={styles.successCard}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={48} color="white" />
          </View>
          <TText variant="title" weight="extraBold" align="center" style={{ marginTop: 12 }}>
            Virement effectué !
          </TText>
          <TText variant="body" color={colors.neutrals.textSecondary} align="center" style={{ marginTop: 4 }}>
            {success.amount.toFixed(2)} {currency} envoyés à {recipientName || recipient}
          </TText>
          {success.fxRate && success.creditedCurrency && success.creditedAmount !== undefined ? (
            <View style={styles.fxChip}>
              <Ionicons name="swap-horizontal" size={14} color="#1D4ED8" style={{ marginRight: 6 }} />
              <TText variant="label" weight="semiBold" color="#1D4ED8">
                Reçu : {success.creditedAmount.toFixed(2)} {success.creditedCurrency}
              </TText>
              <TText variant="label" color="#6B7280" style={{ marginLeft: 6 }}>
                (1 {currency} = {success.fxRate.toFixed(6)} {success.creditedCurrency})
              </TText>
            </View>
          ) : null}
          <View style={styles.balanceChip}>
            <TText variant="caption" color="#065F46">Nouveau solde</TText>
            <TText variant="title" weight="extraBold" color="#065F46">{success.balance.toFixed(2)} {currency}</TText>
          </View>
          <Button testID="p2p-new" title="Nouveau virement" icon="add-circle-outline" onPress={reset} variant="outline" style={{ marginTop: spacing.md }} />
        </View>
      ) : (
        <>
          {/* Section destinataire */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHead}>
              <Ionicons name="person" size={16} color={colors.primary.base} />
              <TText variant="caption" weight="extraBold" color={colors.primary.base} style={{ marginLeft: 6, letterSpacing: 0.5 }}>DESTINATAIRE</TText>
            </View>
            {recipientName ? (
              <View style={styles.contactPreview}>
                <View style={styles.avatarSm}><TText weight="extraBold" color="white">{recipientName.charAt(0).toUpperCase()}</TText></View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <TText weight="extraBold">{recipientName}</TText>
                  <TText variant="label" color={colors.neutrals.textSecondary}>ID {recipient}</TText>
                </View>
                <TouchableOpacity onPress={() => { setRecipientName(""); setRecipient(""); }} style={styles.clearChip}>
                  <Ionicons name="close" size={14} color={colors.neutrals.textSecondary} />
                </TouchableOpacity>
              </View>
            ) : (
              <Input
                testID="p2p-recipient"
                label="Email, téléphone ou ID SENDBID"
                value={recipient}
                onChangeText={setRecipient}
                icon="person-outline"
                autoCapitalize="none"
                placeholder="ex: SB123456 ou contact@email.com"
              />
            )}
          </View>

          {/* Section montant */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHead}>
              <Ionicons name="cash" size={16} color={colors.primary.base} />
              <TText variant="caption" weight="extraBold" color={colors.primary.base} style={{ marginLeft: 6, letterSpacing: 0.5 }}>MONTANT À ENVOYER ({currency})</TText>
            </View>
            <Input
              testID="p2p-amount"
              label={`Montant (${currency})`}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              icon="cash-outline"
              placeholder="0.00"
            />
            {insufficient ? (
              <View style={styles.warnInline}>
                <Ionicons name="alert-circle" size={14} color="#991B1B" />
                <TText variant="label" color="#991B1B" style={{ marginLeft: 6 }}>Solde insuffisant. Disponible : {balance.toFixed(2)} {currency}</TText>
              </View>
            ) : null}
            <Input
              testID="p2p-note"
              label="Note ou message (optionnel)"
              value={note}
              onChangeText={setNote}
              icon="create-outline"
              placeholder="ex: Remboursement dîner"
            />
          </View>

          {/* Récapitulatif */}
          {sendAmt > 0 ? (
            <View style={styles.recapCard}>
              <View style={styles.recapRow}>
                <TText variant="caption" color={colors.neutrals.textSecondary}>Montant envoyé</TText>
                <TText weight="extraBold">{sendAmt.toFixed(2)} {currency}</TText>
              </View>
              <View style={styles.recapRow}>
                <TText variant="caption" color={colors.neutrals.textSecondary}>Frais</TText>
                <View style={styles.freeChip}>
                  <Ionicons name="gift" size={10} color="#065F46" />
                  <TText variant="label" weight="extraBold" color="#065F46" style={{ marginLeft: 3 }}>GRATUIT</TText>
                </View>
              </View>
              <View style={[styles.recapRow, { borderTopWidth: 1, borderTopColor: colors.neutrals.border, paddingTop: 10, marginTop: 6 }]}>
                <TText weight="extraBold">Total à débiter</TText>
                <TText weight="extraBold" color={colors.primary.base}>{sendAmt.toFixed(2)} {currency}</TText>
              </View>
            </View>
          ) : null}

          {/* Toast erreur noir */}
          {err ? (
            <Animated.View style={[styles.toast, { opacity: toastAnim, transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }]}>
              <Ionicons name="alert-circle" size={18} color="white" style={{ marginRight: 8 }} />
              <TText variant="label" weight="semiBold" color="white" style={{ flex: 1 }}>{err}</TText>
            </Animated.View>
          ) : null}

          <Button
            testID="p2p-send"
            title={canSend ? `Envoyer ${sendAmt.toFixed(2)} ${currency}` : "Envoyer"}
            icon="paper-plane"
            onPress={() => setPinModal(true)}
            disabled={!canSend}
            style={{ marginTop: spacing.lg }}
          />
        </>
      )}

      <Modal visible={pinModal} transparent animationType="slide" onRequestClose={() => setPinModal(false)}>
        <View style={styles.modal}>
          <View style={styles.sheet}>
            <View style={styles.modalIcon}>
              <Ionicons name="lock-closed" size={26} color="white" />
            </View>
            <TText variant="subtitle" weight="extraBold" align="center" style={{ marginTop: 8 }}>Confirmer avec PIN</TText>
            <TText variant="caption" color={colors.neutrals.textSecondary} align="center" style={{ marginBottom: spacing.md, marginTop: 4 }}>
              Envoi de <TText weight="extraBold">{sendAmt.toFixed(2)} {currency}</TText> à {recipientName || recipient}
            </TText>
            <PINPad pin={pin} onChange={setPin} />
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

const styles = StyleSheet.create({
  heroCard: { flexDirection: "row", alignItems: "center", backgroundColor: colors.primary.base, borderRadius: radii.xxl, padding: spacing.lg, marginBottom: spacing.lg },
  heroIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  sectionCard: { backgroundColor: colors.neutrals.surface, borderRadius: radii.xxl, borderWidth: 1, borderColor: colors.neutrals.border, padding: spacing.md, marginBottom: spacing.md },
  sectionHead: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  contactPreview: { flexDirection: "row", alignItems: "center", backgroundColor: colors.overlays.primarySoft, borderRadius: radii.lg, padding: 12 },
  avatarSm: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary.base, alignItems: "center", justifyContent: "center" },
  clearChip: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.neutrals.surface, alignItems: "center", justifyContent: "center" },
  warnInline: { flexDirection: "row", alignItems: "center", backgroundColor: "#FEE2E2", borderRadius: radii.lg, padding: 8, marginTop: 4, marginBottom: 8 },
  recapCard: { backgroundColor: colors.neutrals.surface, borderRadius: radii.xxl, borderWidth: 1, borderColor: colors.neutrals.border, padding: spacing.md, marginBottom: spacing.sm },
  recapRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 },
  freeChip: { flexDirection: "row", alignItems: "center", backgroundColor: "#D1FAE5", paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.full },
  successCard: { backgroundColor: colors.neutrals.surface, borderRadius: radii.xxl, padding: spacing.xl, alignItems: "center", borderWidth: 1, borderColor: colors.neutrals.border },
  successIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#10B981", alignItems: "center", justifyContent: "center" },
  balanceChip: { backgroundColor: "#D1FAE5", borderRadius: radii.lg, padding: 12, marginTop: spacing.md, alignItems: "center", alignSelf: "stretch" },
  fxChip: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", justifyContent: "center", backgroundColor: "#EFF6FF", borderRadius: radii.lg, paddingHorizontal: 12, paddingVertical: 8, marginTop: 10, alignSelf: "stretch" },
  modal: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: { backgroundColor: "white", borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl, padding: spacing.lg, paddingBottom: spacing.xl },
  modalIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primary.base, alignItems: "center", justifyContent: "center", alignSelf: "center" },
  toast: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#111827", borderRadius: radii.lg,
    paddingHorizontal: 16, paddingVertical: 12,
    marginTop: spacing.md, marginBottom: 4,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 8,
  },
});
