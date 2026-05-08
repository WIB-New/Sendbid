import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, Modal, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../../src/components/Screen";
import { TText } from "../../src/components/TText";
import { Button } from "../../src/components/Button";
import { StepIndicator } from "../../src/components/StepIndicator";
import { PINPad } from "../../src/components/PINPad";
import { api, apiError } from "../../src/api";
import { useAuth, useDraft } from "../../src/store";
import { colors, spacing, radii } from "../../src/theme";

export default function TransferStep3() {
  const router = useRouter();
  const draft = useDraft((s) => s.draft);
  const patchDraft = useDraft((s) => s.patchDraft);
  const refreshMe = useAuth((s) => s.refreshMe);
  const wallet = useAuth((s) => s.wallet);
  const [pinModal, setPinModal] = useState(false);
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Sentinel: redirect ONLY on truly cold mount (deep-link / refresh) without a draft.
  const hadDraftRef = useRef(false);
  useEffect(() => { if (draft) hadDraftRef.current = true; }, [draft]);
  useEffect(() => {
    if (!draft && !hadDraftRef.current) router.replace("/transfer/new");
  }, [draft, router]);

  if (!draft) {
    return null;
  }

  const fee = draft.fee_percent ? (draft.send_amount * draft.fee_percent) / 100 : 0;
  const vipFee = draft.vip_express ? (draft.send_amount * 3) / 100 : draft.vip_delivery ? (draft.send_amount * 1.5) / 100 : 0;
  const total = draft.send_amount + fee + vipFee;

  const confirm = async () => {
    if (pin.length !== 6) return;
    setLoading(true);
    setErr(null);
    try {
      const draftRes = await api.post("/transfers/draft", {
        destination_country: draft.destination_country,
        destination_currency: draft.destination_currency,
        send_amount: draft.send_amount,
        receive_amount: draft.receive_amount,
        fx_rate: draft.fx_rate,
        fee_percent: draft.fee_percent + (draft.vip_express ? 3 : draft.vip_delivery ? 1.5 : 0),
        delivery_mode: draft.delivery_mode,
        beneficiary: draft.beneficiary,
        delivery_details: draft.delivery_details,
        purpose: draft.purpose,
        source_of_funds: draft.source_of_funds,
        vip_delivery: !!draft.vip_delivery,
      });
      const confirmed = await api.post("/transfers/confirm", { draft_id: draftRes.data.id, pin });
      await refreshMe();
      patchDraft({ result: confirmed.data });
      setPinModal(false);
      router.replace({ pathname: "/transfer/success", params: { transfer_id: confirmed.data.id } });
    } catch (e: any) {
      setErr(apiError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen title="Récapitulatif" back hero>
      <StepIndicator step={3} total={4} />
      <TText variant="caption" color={colors.neutrals.textSecondary} style={{ marginBottom: spacing.lg }}>
        Étape 3/4 — Vérifiez les informations
      </TText>

      <View style={styles.heroBox}>
        <TText variant="caption" color={colors.neutrals.textSecondary}>
          Le bénéficiaire reçoit
        </TText>
        <TText variant="display" weight="extraBold" color={colors.primary.base}>
          {draft.receive_amount.toFixed(0)} {draft.destination_currency}
        </TText>
        <TText variant="caption" color={colors.neutrals.textSecondary}>
          {draft.beneficiary.full_name} • {draft.destination_country_name || draft.destination_country}
        </TText>
        {/* Spec v6.4 : pour les remises en espèces, afficher la ville du bénéficiaire */}
        {draft.delivery_mode === "cash" && (draft.beneficiary?.city) ? (
          <TText variant="label" weight="extraBold" color={colors.neutrals.textPrimary} style={{ marginTop: 4 }}>
            <Ionicons name="location" size={12} color={colors.primary.base} /> Retrait à {draft.beneficiary.city}
          </TText>
        ) : null}
      </View>

      <View style={styles.box}>
        <Row label="Montant envoyé" value={`${draft.send_amount.toFixed(2)} EUR`} />
        <Row label={`Frais (${draft.fee_percent}%)`} value={`${fee.toFixed(2)} EUR`} />
        {draft.vip_delivery ? <Row label="Service VIP (1.5%)" value={`${vipFee.toFixed(2)} EUR`} /> : null}
        <View style={styles.divider} />
        <Row label="Total à débiter" value={`${total.toFixed(2)} EUR`} bold />
        <Row label="Taux de change" value={`1 EUR = ${draft.fx_rate.toFixed(2)} ${draft.destination_currency}`} />
        <Row label="Mode de remise" value={draft.delivery_mode === "cash" ? "Espèces" : draft.delivery_mode === "bank" ? "Virement bancaire" : draft.delivery_mode === "momo" ? "Portefeuille mobile" : draft.delivery_mode.toUpperCase()} />
        <Row label="Motif" value={draft.purpose} />
      </View>

      <View style={[styles.box, { backgroundColor: colors.overlays.successSoft, borderColor: colors.status.success + "33" }]}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Ionicons name="wallet-outline" size={20} color={colors.status.success} />
          <TText variant="body" weight="semiBold" style={{ marginLeft: 8 }}>
            Solde principal : {wallet?.balance.toFixed(2)} EUR
          </TText>
        </View>
        {wallet && wallet.balance < total ? (
          <TText variant="caption" color={colors.status.error} style={{ marginTop: 4 }}>
            Solde insuffisant. Rechargez votre wallet.
          </TText>
        ) : null}
      </View>

      <Button
        testID="transfer-confirm"
        title="Confirmer puis payer"
        icon="lock-closed"
        onPress={() => setPinModal(true)}
        disabled={!!wallet && wallet.balance < total}
        style={{ marginTop: spacing.lg }}
      />

      <Modal visible={pinModal} transparent animationType="slide" onRequestClose={() => setPinModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <TText variant="subtitle" weight="bold" align="center">Entrez votre PIN</TText>
            <TText variant="caption" color={colors.neutrals.textSecondary} align="center" style={{ marginBottom: spacing.lg }}>
              PIN 6 chiffres requis pour valider le transfert.
            </TText>
            <PINPad pin={pin} onChange={setPin} />
            {err ? <TText variant="caption" color={colors.status.error} align="center" style={{ marginTop: 8 }}>{err}</TText> : null}
            <Button testID="confirm-pin-submit" title="Valider" loading={loading} disabled={pin.length !== 6} onPress={confirm} style={{ marginTop: 16 }} />
            <TouchableOpacity onPress={() => { setPinModal(false); setPin(""); }} style={{ alignItems: "center", marginTop: 12 }}>
              <TText variant="caption" color={colors.neutrals.textSecondary}>Annuler</TText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>
      <TText variant="body" color={colors.neutrals.textSecondary}>{label}</TText>
      <TText variant="body" weight={bold ? "extraBold" : "semiBold"} color={bold ? colors.primary.base : colors.neutrals.textPrimary}>
        {value}
      </TText>
    </View>
  );
}

const styles = StyleSheet.create({
  heroBox: {
    backgroundColor: colors.overlays.primarySoft, padding: spacing.lg,
    borderRadius: radii.xl, alignItems: "center",
  },
  box: {
    backgroundColor: colors.neutrals.surface, padding: spacing.lg,
    borderRadius: radii.xl, borderWidth: 1, borderColor: colors.neutrals.border,
    marginTop: spacing.md,
  },
  divider: { height: 1, backgroundColor: colors.neutrals.border, marginVertical: 8 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: colors.neutrals.surface,
    borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl,
    padding: spacing.lg, paddingBottom: spacing.xl,
  },
});
