import React, { useEffect, useRef, useState } from "react";
import { t, useLocale } from "../../src/i18n";
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
import { useThemedColors } from "../../src/themeContext";
export default function TransferStep3() {
  const { t } = useTranslation();
  const colors = useThemedColors();
  const router = useRouter();
  const draft = useDraft((s) => s.draft);
  const patchDraft = useDraft((s) => s.patchDraft);
  const refreshMe = useAuth((s) => s.refreshMe);
  const wallet = useAuth((s) => s.wallet);
  const [pinModal, setPinModal] = useState(false);
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Hook placé AVANT le return conditionnel pour respecter rules-of-hooks
  const [knowBen, setKnowBen] = useState<null | boolean>(null);

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
  // "Autres frais" : placeholder réservé pour des frais additionnels futurs
  // (ex: marge de change, frais de réseau, frais bancaires destinataire…).
  // Pour l'instant 0,00 EUR — peut être branché sur draft.other_fees plus tard.
  const otherFees = (draft as any).other_fees ? Number((draft as any).other_fees) : 0;
  // Spec v7 :
  // - VIP    = max(1% du montant, 15€)
  // - VIP+   = max(1,5% du montant, 20€)
  const vipFee = draft.vip_express
    ? Math.max(draft.send_amount * 0.015, 20)
    : draft.vip_delivery
    ? Math.max(draft.send_amount * 0.01, 15)
    : 0;
  const total = draft.send_amount + fee + otherFees + vipFee;
  const insufficient = !!wallet && wallet.balance < total;

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
        // IMPORTANT : fee_percent = uniquement les frais client (PAS de VIP dedans).
        // Le cap des bids agents est basé strictement sur ce pourcentage.
        fee_percent: draft.fee_percent,
        vip_fee_amount: vipFee,
        delivery_mode: draft.delivery_mode,
        beneficiary: draft.beneficiary,
        delivery_details: draft.delivery_details,
        purpose: draft.purpose,
        source_of_funds: draft.source_of_funds,
        vip_delivery: !!draft.vip_delivery,
        vip_express: !!draft.vip_express,
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
    <Screen title={t("transferFlow.recap")} back hero>
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

      <View style={[styles.box, { backgroundColor: "white" }]}>
        <TText variant="caption" weight="extraBold" color={colors.neutrals.textSecondary} style={{ marginBottom: 8, letterSpacing: 0.5 }}>
          DÉTAIL DU TRANSFERT
        </TText>
        <Row label="Montant envoyé" value={`${draft.send_amount.toFixed(2)} EUR`} />
        <Row label={`Frais client (${draft.fee_percent}%)`} value={`${fee.toFixed(2)} EUR`} />
        <Row label="Autres frais" value={`${otherFees.toFixed(2)} EUR`} />
        {draft.vip_express ? (
          <Row label="Service VIP+ (1,5%, min 20€)" value={`${vipFee.toFixed(2)} EUR`} />
        ) : draft.vip_delivery ? (
          <Row label="Service VIP (1%, min 15€)" value={`${vipFee.toFixed(2)} EUR`} />
        ) : (
          <Row label="Service" value="—" />
        )}
        <View style={styles.divider} />
        <Row label="Total à débiter" value={`${total.toFixed(2)} EUR`} bold />
      </View>

      <View style={[styles.box, { backgroundColor: "white" }]}>
        <TText variant="caption" weight="extraBold" color={colors.neutrals.textSecondary} style={{ marginBottom: 6, letterSpacing: 0.5 }}>
          INFORMATIONS COMPLÉMENTAIRES
        </TText>
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
          <View style={{ marginTop: 6 }}>
            <TText variant="caption" color={colors.status.error} style={{ marginBottom: 6 }}>
              Solde insuffisant pour effectuer cette opération.
            </TText>
            <Button testID="recap-recharge" title="Recharger mon portefeuille" icon="add-circle-outline" variant="outline" onPress={() => router.push("/wallet/recharge" as any)} />
          </View>
        ) : null}
      </View>

      {/* Disclaimer "Connaissez-vous bien cette personne ?" */}
      <View style={[styles.box, { backgroundColor: "white", borderColor: colors.neutrals.border }]}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
          <Ionicons name="alert-circle" size={16} color={colors.status.warning ?? "#D97706"} />
          <TText weight="extraBold" color={colors.neutrals.textPrimary} style={{ marginLeft: 6, fontSize: 13 }}>Connaissez-vous bien cette personne ?</TText>
        </View>
        <TText style={{ fontSize: 11, lineHeight: 15 }} color={colors.neutrals.textSecondary}>
          N&apos;envoyez jamais d&apos;argent sans vérifier. Une fois confirmé, le transfert ne peut plus être annulé.
        </TText>
        <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
          <TouchableOpacity testID="know-ben-yes" onPress={() => setKnowBen(true)} style={[{ flex: 2, paddingVertical: 7, borderRadius: 999, alignItems: "center", borderWidth: 1.5 }, knowBen === true ? { backgroundColor: "#10B981", borderColor: "#10B981" } : { borderColor: colors.neutrals.border, backgroundColor: "white" }]}>
            <TText weight="extraBold" style={{ fontSize: 12 }} color={knowBen === true ? "white" : colors.neutrals.textPrimary}>Oui, je la connais</TText>
          </TouchableOpacity>
          <TouchableOpacity testID="know-ben-no" onPress={() => setKnowBen(false)} style={[{ flex: 1, paddingVertical: 7, borderRadius: 999, alignItems: "center", borderWidth: 1.5 }, knowBen === false ? { backgroundColor: "#EF4444", borderColor: "#EF4444" } : { borderColor: colors.neutrals.border, backgroundColor: "white" }]}>
            <TText weight="extraBold" style={{ fontSize: 12 }} color={knowBen === false ? "white" : colors.neutrals.textPrimary}>Non</TText>
          </TouchableOpacity>
        </View>
        {knowBen === false ? (
          <TText variant="caption" color={colors.status.error} style={{ marginTop: 6, fontSize: 11 }}>
            Pour votre sécurité, le transfert ne peut être validé. Veuillez vérifier le bénéficiaire ou annuler.
          </TText>
        ) : null}
      </View>

      <Button
        testID="transfer-confirm"
        title="Valider et payer"
        icon="lock-closed"
        onPress={() => setPinModal(true)}
        disabled={insufficient || knowBen !== true}
        style={{ marginTop: spacing.md, paddingVertical: 12 }}
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
