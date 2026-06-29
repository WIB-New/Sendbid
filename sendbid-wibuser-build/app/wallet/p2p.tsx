import React, { useEffect, useState } from "react";
import { t, useLocale } from "../../src/i18n";
import { View, StyleSheet, Modal, TouchableOpacity, Alert, Platform } from "react-native";
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
import { useThemedColors } from "../../src/themeContext";
// Virement P2P gratuit v6.4 — refonte design lisible (hero gradient + cards séparées,
// solde en évidence, contrastes corrects, layout aéré).
export default function P2P() {
  const colors = useThemedColors();
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
  const [success, setSuccess] = useState<{ amount: number; balance: number } | null>(null);

  // Pré-remplir si destination (profile_id) passée en paramètre
  useEffect(() => {
    if (params.profile_id) setRecipient(String(params.profile_id));
    if (params.full_name) setRecipientName(String(params.full_name));
  }, [params.profile_id, params.full_name]);

  const balance = wallet?.balance || 0;
  const sendAmt = parseFloat(amount.replace(",", ".")) || 0;
  const insufficient = sendAmt > balance;
  const canSend = recipient.trim().length >= 3 && sendAmt > 0 && !insufficient;

  const submit = async () => {
    setErr(null);
    setLoading(true);
    try {
      const { data } = await api.post("/wallet/p2p", { recipient_identifier: recipient, amount: sendAmt, note, pin });
      await refreshMe();
      setPinModal(false);
      setPin("");
      setSuccess({ amount: sendAmt, balance: data.new_balance });
    } catch (e: any) {
      setErr(apiError(e));
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
            Solde : {balance.toFixed(2)} €
          </TText>
          <TText variant="label" color="rgba(255,255,255,0.85)" style={{ marginTop: 2 }}>
            Envoyez à un autre utilisateur — aucun frais.
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
            {success.amount.toFixed(2)} € envoyés à {recipientName || recipient}
          </TText>
          <View style={styles.balanceChip}>
            <TText variant="caption" color="#065F46">{t("walletOps.newBalance")}</TText>
            <TText variant="title" weight="extraBold" color="#065F46">{success.balance.toFixed(2)} €</TText>
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
                  <TText variant="label" color={colors.neutrals.textSecondary}>Profil ID {recipient}</TText>
                </View>
                <TouchableOpacity onPress={() => { setRecipientName(""); setRecipient(""); }} style={styles.clearChip}>
                  <Ionicons name="close" size={14} color={colors.neutrals.textSecondary} />
                </TouchableOpacity>
              </View>
            ) : (
              <Input
                testID="p2p-recipient"
                label="Email, téléphone ou Profil ID"
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
              <TText variant="caption" weight="extraBold" color={colors.primary.base} style={{ marginLeft: 6, letterSpacing: 0.5 }}>MONTANT À ENVOYER</TText>
            </View>
            <Input
              testID="p2p-amount"
              label="Montant (EUR)"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              icon="cash-outline"
              placeholder="0.00"
            />
            {insufficient ? (
              <View style={styles.warnInline}>
                <Ionicons name="alert-circle" size={14} color="#991B1B" />
                <TText variant="label" color="#991B1B" style={{ marginLeft: 6 }}>Solde insuffisant. Disponible : {balance.toFixed(2)} €</TText>
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
                <TText weight="extraBold">{sendAmt.toFixed(2)} €</TText>
              </View>
              <View style={styles.recapRow}>
                <TText variant="caption" color={colors.neutrals.textSecondary}>Frais</TText>
                <View style={styles.freeChip}>
                  <Ionicons name="gift" size={10} color="#065F46" />
                  <TText variant="label" weight="extraBold" color="#065F46" style={{ marginLeft: 3 }}>{t("walletOps.free")}</TText>
                </View>
              </View>
              <View style={[styles.recapRow, { borderTopWidth: 1, borderTopColor: colors.neutrals.border, paddingTop: 10, marginTop: 6 }]}>
                <TText weight="extraBold">Total à débiter</TText>
                <TText weight="extraBold" color={colors.primary.base}>{sendAmt.toFixed(2)} €</TText>
              </View>
            </View>
          ) : null}

          {err ? <TText variant="caption" color={colors.status.error} style={{ marginTop: 8, textAlign: "center" }}>{err}</TText> : null}

          <Button
            testID="p2p-send"
            title={canSend ? `Envoyer ${sendAmt.toFixed(2)} €` : "Envoyer"}
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
              Envoi de <TText weight="extraBold">{sendAmt.toFixed(2)} €</TText> à {recipientName || recipient}
            </TText>
            <PINPad pin={pin} onChange={setPin} />
            {err ? <TText variant="caption" color={colors.status.error} align="center" style={{ marginTop: 8 }}>{err}</TText> : null}
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
  modal: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: { backgroundColor: "white", borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl, padding: spacing.lg, paddingBottom: spacing.xl },
  modalIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primary.base, alignItems: "center", justifyContent: "center", alignSelf: "center" },
});
