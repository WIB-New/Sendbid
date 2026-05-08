import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../../src/components/Screen";
import { TText } from "../../src/components/TText";
import { Input } from "../../src/components/Input";
import { Button } from "../../src/components/Button";
import { StepIndicator } from "../../src/components/StepIndicator";
import { useDraft } from "../../src/store";
import { colors, spacing, radii } from "../../src/theme";

const PURPOSES = ["Aide familiale", "Épargne", "Éducation", "Investissement", "Autres"];
const SOURCES = ["Salaire", "Autres revenus", "Économies", "Investissements", "Emprunts et découverts bancaires", "Autre"];

export default function TransferStep2() {
  const router = useRouter();
  const draft = useDraft((s) => s.draft);
  const patchDraft = useDraft((s) => s.patchDraft);
  const [feePercent, setFeePercent] = useState(2.0);
  const [vipMode, setVipMode] = useState<"none" | "vip" | "vip_express">("none");
  const [purpose, setPurpose] = useState(PURPOSES[0]);
  const [purposeOther, setPurposeOther] = useState("");
  const [source, setSource] = useState(SOURCES[0]);
  const [sourceOther, setSourceOther] = useState("");
  const [city, setCity] = useState(draft?.beneficiary?.city || "");
  const [address, setAddress] = useState(draft?.beneficiary?.address || "");
  const [phone, setPhone] = useState(draft?.beneficiary?.phone || "");
  const [bankName, setBankName] = useState(draft?.beneficiary?.bank_name || "");
  const [bankAcc, setBankAcc] = useState(draft?.beneficiary?.bank_account || "");
  const [momoOp, setMomoOp] = useState(draft?.beneficiary?.momo_operator || "");
  const [momoNum, setMomoNum] = useState(draft?.beneficiary?.momo_number || "");

  // Sentinel: redirect ONLY on truly cold mount (deep-link / refresh) without a draft.
  // Once draft has been observed at least once, never auto-redirect again — this prevents
  // races when later screens clear the draft while this screen is still in the stack.
  const hadDraftRef = useRef(false);
  useEffect(() => { if (draft) hadDraftRef.current = true; }, [draft]);
  useEffect(() => {
    if (!draft && !hadDraftRef.current) router.replace("/transfer/new");
  }, [draft, router]);

  if (!draft) {
    return null;
  }

  const next = () => {
    const delivery_details: any = {};
    if (draft.delivery_mode === "cash") Object.assign(delivery_details, { city, address, phone });
    if (draft.delivery_mode === "bank") Object.assign(delivery_details, { bank_name: bankName, bank_account: bankAcc });
    if (draft.delivery_mode === "momo") Object.assign(delivery_details, { momo_operator: momoOp, momo_number: momoNum });
    patchDraft({ fee_percent: feePercent, vip_delivery: !!(draft as any).vip_delivery || (draft as any).service_level === "vip" || (draft as any).service_level === "vip_express", vip_express: (draft as any).service_level === "vip_express", service_level: (draft as any).service_level || "standard", purpose: purpose === "Autres" && purposeOther.trim() ? purposeOther.trim() : purpose, source_of_funds: source === "Autre" && sourceOther.trim() ? sourceOther.trim() : source, delivery_details });
    router.push("/transfer/recap");
  };

  return (
    <Screen title="Détails du transfert" back hero>
      <StepIndicator step={2} total={4} />
      <TText variant="caption" color={colors.neutrals.textSecondary} style={{ marginBottom: spacing.lg }}>
        Étape 2/4 — Détails de la remise
      </TText>

      {/* Cash mode: ville/adresse/tel + frais % saisie + VIP options exclusives */}
      {draft.delivery_mode === "cash" && (
        <View style={styles.box}>
          <TText variant="body" weight="bold" style={{ marginBottom: 8 }}>Lieu de remise au bénéficiaire</TText>
          <Input testID="bn-city" label="Ville du bénéficiaire" value={city} onChangeText={setCity} icon="location-outline" />
          <Input testID="bn-address" label="Adresse du bénéficiaire" value={address} onChangeText={setAddress} icon="home-outline" />
          <Input testID="bn-phone" label="Numéro de téléphone du bénéficiaire" value={phone} onChangeText={setPhone} keyboardType="phone-pad" icon="call-outline" />

          <TText variant="body" weight="bold" style={{ marginTop: spacing.md }}>Frais de votre transfert (%)</TText>
          <TText variant="caption" color={colors.neutrals.textSecondary} style={{ marginBottom: 12 }}>
            Quels frais souhaiteriez-vous payer ?
          </TText>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            {[1, 2, 3, 4, 5].map((v) => (
              <TouchableOpacity
                key={v}
                testID={`fee-${v}`}
                onPress={() => setFeePercent(v)}
                style={[styles.feeChip, feePercent === v && { backgroundColor: colors.primary.base, borderColor: colors.primary.base }]}
              >
                <TText weight="bold" color={feePercent === v ? "white" : colors.neutrals.textPrimary}>{v}%</TText>
              </TouchableOpacity>
            ))}
          </View>
          <TText variant="caption" color={colors.primary.base} style={{ marginTop: 12 }}>
            Frais = {(draft.send_amount * feePercent / 100).toFixed(2)} EUR
          </TText>

          {/* Niveau de service VIP — déjà choisi à l'étape 1, affichage en lecture seule v6.4 */}
          {(draft as any).service_level && (draft as any).service_level !== "standard" ? (
            <View style={[styles.vipOption, styles.vipOptionActive, { marginTop: spacing.md }]}>
              <Ionicons name="checkmark-circle" size={22} color={colors.accent.base} />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <TText variant="body" weight="semiBold">
                  {(draft as any).service_level === "vip_express" ? "Service VIP EXPRESS" : "Service VIP"}
                </TText>
              </View>
            </View>
          ) : null}
        </View>
      )}

      {/* Bank fields */}
      {draft.delivery_mode === "bank" && (
        <View style={styles.box}>
          <TText variant="body" weight="bold" style={{ marginBottom: 8 }}>Coordonnées bancaires</TText>
          <Input testID="bank-name" label="Banque" value={bankName} onChangeText={setBankName} icon="business-outline" />
          <Input testID="bank-account" label="IBAN / Numéro de compte" value={bankAcc} onChangeText={setBankAcc} icon="card-outline" />
        </View>
      )}

      {/* MoMo fields */}
      {draft.delivery_mode === "momo" && (
        <View style={styles.box}>
          <TText variant="body" weight="bold" style={{ marginBottom: 8 }}>Mobile Money</TText>
          <Input testID="momo-op" label="Opérateur (Wave, Orange Money…)" value={momoOp} onChangeText={setMomoOp} icon="phone-portrait-outline" />
          <Input testID="momo-num" label="Numéro" value={momoNum} onChangeText={setMomoNum} keyboardType="phone-pad" icon="call-outline" />
        </View>
      )}

      {/* Purpose */}
      <TText variant="caption" weight="semiBold" color={colors.neutrals.textSecondary} style={{ marginTop: spacing.lg, marginBottom: 8 }}>
        Motif du transfert
      </TText>
      <View style={styles.chipsRow}>
        {PURPOSES.map((p) => (
          <TouchableOpacity key={p} testID={`purpose-${p}`} style={[styles.chip, purpose === p && styles.chipActive]} onPress={() => setPurpose(p)}>
            <TText variant="caption" weight="semiBold" color={purpose === p ? "white" : colors.neutrals.textPrimary}>{p}</TText>
          </TouchableOpacity>
        ))}
      </View>
      {purpose === "Autres" ? (
        <View style={{ marginTop: 8 }}>
          <Input testID="purpose-other" label="Précisez le motif" value={purposeOther} onChangeText={setPurposeOther} icon="create-outline" />
        </View>
      ) : null}

      {/* Source */}
      <TText variant="caption" weight="semiBold" color={colors.neutrals.textSecondary} style={{ marginTop: spacing.lg, marginBottom: 8 }}>
        Origine des fonds
      </TText>
      <View style={styles.chipsRow}>
        {SOURCES.map((p) => (
          <TouchableOpacity key={p} testID={`source-${p}`} style={[styles.chip, source === p && styles.chipActive]} onPress={() => setSource(p)}>
            <TText variant="caption" weight="semiBold" color={source === p ? "white" : colors.neutrals.textPrimary}>{p}</TText>
          </TouchableOpacity>
        ))}
      </View>
      {source === "Autre" ? (
        <View style={{ marginTop: 8 }}>
          <Input testID="source-other" label="Précisez l'origine des fonds" value={sourceOther} onChangeText={setSourceOther} icon="create-outline" />
        </View>
      ) : null}

      <View style={{ marginTop: spacing.xl }}>
        <Button testID="transfer-next-2" title="Voir le récapitulatif" onPress={next} icon="arrow-forward" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.neutrals.surface, padding: spacing.lg, borderRadius: radii.xl,
    borderWidth: 1, borderColor: colors.neutrals.border,
  },
  feeChip: {
    width: 60, height: 56, borderRadius: radii.lg,
    backgroundColor: colors.neutrals.surface,
    borderWidth: 1.5, borderColor: colors.neutrals.border,
    alignItems: "center", justifyContent: "center",
  },
  vipRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.lg },
  vipOption: { flexDirection: "row", alignItems: "flex-start", padding: 12, marginTop: 8, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.neutrals.border, backgroundColor: colors.neutrals.surface },
  vipOptionActive: { borderColor: colors.primary.base, backgroundColor: colors.overlays.primarySoft },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: radii.full,
    backgroundColor: colors.neutrals.surface,
    borderWidth: 1, borderColor: colors.neutrals.border,
    marginRight: 8, marginBottom: 8,
  },
  chipActive: { backgroundColor: colors.primary.base, borderColor: colors.primary.base },
});
