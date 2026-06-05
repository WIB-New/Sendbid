import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, TouchableOpacity, Modal, FlatList } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../../src/components/Screen";
import { TText } from "../../src/components/TText";
import { Input } from "../../src/components/Input";
import { Button } from "../../src/components/Button";
import { StepIndicator } from "../../src/components/StepIndicator";
import { useDraft } from "../../src/store";
import { colors, spacing, radii } from "../../src/theme";
import { useThemedColors } from "../../src/themeContext";
const PURPOSES: Array<{ key: string; label: string; icon: any }> = [
  { key: "Aide familiale", label: "Aide familiale", icon: "people-outline" },
  { key: "Épargne", label: "Épargne", icon: "wallet-outline" },
  { key: "Éducation", label: "Éducation", icon: "school-outline" },
  { key: "Investissement", label: "Investissement", icon: "trending-up-outline" },
  { key: "Autres", label: "Autres", icon: "ellipsis-horizontal-outline" },
];
const SOURCES: Array<{ key: string; label: string; icon: any }> = [
  { key: "Salaire", label: "Salaire", icon: "briefcase-outline" },
  { key: "Autres revenus", label: "Autres revenus", icon: "cash-outline" },
  { key: "Économies", label: "Économies", icon: "wallet-outline" },
  { key: "Investissements", label: "Investissements", icon: "trending-up-outline" },
  { key: "Emprunts et découverts bancaires", label: "Emprunts / découverts bancaires", icon: "business-outline" },
  { key: "Autre", label: "Autre", icon: "ellipsis-horizontal-outline" },
];

export default function TransferStep2() {
  const colors = useThemedColors();
  const router = useRouter();
  const draft = useDraft((s) => s.draft);
  const patchDraft = useDraft((s) => s.patchDraft);
  const [feePercent, setFeePercent] = useState(2.0);
  const [vipMode, setVipMode] = useState<"none" | "vip" | "vip_express">("none");
  const [purpose, setPurpose] = useState<string>(PURPOSES[0].key);
  const [purposeOther, setPurposeOther] = useState("");
  const [source, setSource] = useState<string>(SOURCES[0].key);
  const [sourceOther, setSourceOther] = useState("");
  const [showPurposePicker, setShowPurposePicker] = useState(false);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
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
          <TText variant="body" weight="bold" style={{ marginBottom: 6 }}>Lieu de remise au bénéficiaire</TText>
          <Input testID="bn-city" label="Ville du bénéficiaire" value={city} onChangeText={setCity} icon="location-outline" />
          <Input testID="bn-address" label="Adresse du bénéficiaire" value={address} onChangeText={setAddress} icon="home-outline" />
          <Input testID="bn-phone" label="Numéro de téléphone du bénéficiaire" value={phone} onChangeText={setPhone} keyboardType="phone-pad" icon="call-outline" />

          <TText variant="body" weight="bold" style={{ marginTop: spacing.sm }}>Frais de votre transfert (%)</TText>
          <TText variant="caption" color={colors.neutrals.textSecondary} style={{ marginBottom: 8 }}>
            Saisissez le pourcentage de frais que vous acceptez de payer (entre 0,5 % et 10 %).
          </TText>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Input
                testID="fee-custom"
                value={String(feePercent)}
                onChangeText={(v) => {
                  // Accepter virgule OU point, max 1 décimale
                  const cleaned = v.replace(",", ".").replace(/[^0-9.]/g, "");
                  const num = parseFloat(cleaned);
                  if (cleaned === "" || isNaN(num)) {
                    setFeePercent(0 as any);
                    return;
                  }
                  // Borner : min 0.5, max 10
                  const bounded = Math.min(10, Math.max(0, num));
                  setFeePercent(bounded);
                }}
                onBlur={() => {
                  // À la sortie du champ, forcer min 0.5
                  if (!feePercent || feePercent < 0.5) setFeePercent(0.5);
                }}
                keyboardType="decimal-pad"
                icon="trending-up-outline"
                placeholder="ex : 2,5"
              />
            </View>
            <View style={styles.pctBadge}>
              <TText variant="title" weight="extraBold" color={colors.primary.base}>%</TText>
            </View>
          </View>
          <View style={styles.feeBox}>
            <TText variant="caption" color={colors.neutrals.textSecondary}>
              Frais à payer : <TText weight="extraBold" color={colors.primary.base}>{(draft.send_amount * (feePercent || 0) / 100).toFixed(2)} EUR</TText>
            </TText>
            <TText variant="label" color={colors.neutrals.textTertiary} style={{ marginTop: 2 }}>
              Plus le % est élevé, plus les agents proposeront rapidement.
            </TText>
          </View>

          {/* Niveau de service VIP — déjà choisi à l'étape 1, affichage en lecture seule v6.4 */}
          {(draft as any).service_level && (draft as any).service_level !== "standard" ? (
            <View style={[styles.vipOption, styles.vipOptionActive, { marginTop: spacing.sm }]}>
              <Ionicons name="checkmark-circle" size={18} color={colors.accent.base} />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <TText variant="caption" weight="semiBold">
                  {(draft as any).service_level === "vip_express" ? "Service VIP+ activé" : "Service VIP activé"}
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

      {/* === Sections compactes : Motif + Origine en grille 2 colonnes === */}
      <View style={{ marginTop: spacing.lg, flexDirection: "row", gap: 10 }}>
        {/* Motif */}
        <View style={{ flex: 1 }}>
          <TText variant="caption" weight="semiBold" color={colors.neutrals.textSecondary} style={{ marginBottom: 6 }}>
            Motif du transfert
          </TText>
          <TouchableOpacity
            testID="purpose-dropdown"
            style={styles.dropdown}
            activeOpacity={0.8}
            onPress={() => setShowPurposePicker(true)}
          >
            <Ionicons name={(PURPOSES.find((p) => p.key === purpose)?.icon) || "list-outline"} size={16} color={colors.primary.base} />
            <TText variant="caption" weight="semiBold" style={{ flex: 1, marginLeft: 8 }} numberOfLines={1}>
              {purpose}
            </TText>
            <Ionicons name="chevron-down" size={16} color={colors.neutrals.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Source */}
        <View style={{ flex: 1 }}>
          <TText variant="caption" weight="semiBold" color={colors.neutrals.textSecondary} style={{ marginBottom: 6 }}>
            Origine des fonds
          </TText>
          <TouchableOpacity
            testID="source-dropdown"
            style={styles.dropdown}
            activeOpacity={0.8}
            onPress={() => setShowSourcePicker(true)}
          >
            <Ionicons name={(SOURCES.find((s) => s.key === source)?.icon) || "list-outline"} size={16} color={colors.primary.base} />
            <TText variant="caption" weight="semiBold" style={{ flex: 1, marginLeft: 8 }} numberOfLines={1}>
              {SOURCES.find((s) => s.key === source)?.label || source}
            </TText>
            <Ionicons name="chevron-down" size={16} color={colors.neutrals.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Champs "Autre" en cas de sélection — apparaissent juste sous la grille */}
      {purpose === "Autres" ? (
        <View style={{ marginTop: 8 }}>
          <Input testID="purpose-other" label="Précisez le motif" value={purposeOther} onChangeText={setPurposeOther} icon="create-outline" />
        </View>
      ) : null}
      {source === "Autre" ? (
        <View style={{ marginTop: 8 }}>
          <Input testID="source-other" label="Précisez l'origine des fonds" value={sourceOther} onChangeText={setSourceOther} icon="create-outline" />
        </View>
      ) : null}

      <View style={{ marginTop: spacing.xl }}>
        <Button testID="transfer-next-2" title="Voir le récapitulatif" onPress={next} icon="arrow-forward" />
      </View>

      {/* === Modal — Motif === */}
      <Modal visible={showPurposePicker} transparent animationType="slide" onRequestClose={() => setShowPurposePicker(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowPurposePicker(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <TText variant="subtitle" weight="extraBold" style={{ marginBottom: 4 }}>Motif du transfert</TText>
            <TText variant="caption" color={colors.neutrals.textSecondary} style={{ marginBottom: spacing.md }}>
              Sélectionnez la raison principale de ce transfert.
            </TText>
            <FlatList
              data={PURPOSES}
              keyExtractor={(i) => i.key}
              renderItem={({ item }) => {
                const active = purpose === item.key;
                return (
                  <TouchableOpacity
                    testID={`purpose-opt-${item.key}`}
                    style={[styles.optionRow, active && styles.optionRowActive]}
                    onPress={() => { setPurpose(item.key); setShowPurposePicker(false); }}
                  >
                    <View style={[styles.optionIcon, active && { backgroundColor: colors.primary.base }]}>
                      <Ionicons name={item.icon} size={18} color={active ? "white" : colors.primary.base} />
                    </View>
                    <TText variant="body" weight={active ? "extraBold" : "semiBold"} style={{ flex: 1, marginLeft: 12 }}>
                      {item.label}
                    </TText>
                    {active ? <Ionicons name="checkmark-circle" size={20} color={colors.primary.base} /> : null}
                  </TouchableOpacity>
                );
              }}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* === Modal — Origine des fonds === */}
      <Modal visible={showSourcePicker} transparent animationType="slide" onRequestClose={() => setShowSourcePicker(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowSourcePicker(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <TText variant="subtitle" weight="extraBold" style={{ marginBottom: 4 }}>Origine des fonds</TText>
            <TText variant="caption" color={colors.neutrals.textSecondary} style={{ marginBottom: spacing.md }}>
              Indiquez la provenance de la somme envoyée (obligatoire pour la conformité AML).
            </TText>
            <FlatList
              data={SOURCES}
              keyExtractor={(i) => i.key}
              renderItem={({ item }) => {
                const active = source === item.key;
                return (
                  <TouchableOpacity
                    testID={`source-opt-${item.key}`}
                    style={[styles.optionRow, active && styles.optionRowActive]}
                    onPress={() => { setSource(item.key); setShowSourcePicker(false); }}
                  >
                    <View style={[styles.optionIcon, active && { backgroundColor: colors.primary.base }]}>
                      <Ionicons name={item.icon} size={18} color={active ? "white" : colors.primary.base} />
                    </View>
                    <TText variant="body" weight={active ? "extraBold" : "semiBold"} style={{ flex: 1, marginLeft: 12 }} numberOfLines={2}>
                      {item.label}
                    </TText>
                    {active ? <Ionicons name="checkmark-circle" size={20} color={colors.primary.base} /> : null}
                  </TouchableOpacity>
                );
              }}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.neutrals.surface, padding: spacing.md, borderRadius: radii.xl,
    borderWidth: 1, borderColor: colors.neutrals.border,
  },
  feeChip: {
    width: 60, height: 56, borderRadius: radii.lg,
    backgroundColor: colors.neutrals.surface,
    borderWidth: 1.5, borderColor: colors.neutrals.border,
    alignItems: "center", justifyContent: "center",
  },
  pctBadge: {
    width: 52, height: 52,
    borderRadius: radii.lg,
    backgroundColor: colors.overlays.primarySoft,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: colors.primary.base,
  },
  feeBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: radii.lg,
    backgroundColor: colors.overlays.primarySoft,
    borderWidth: 1, borderColor: colors.primary.base + "33",
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

  // Dropdown compact (remplace les chips trop encombrants pour Motif / Origine)
  dropdown: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.neutrals.surface,
    borderRadius: radii.lg, borderWidth: 1, borderColor: colors.neutrals.border,
    paddingHorizontal: 12, height: 48,
  },

  // Modal bottom-sheet partagé (purpose + source)
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: colors.neutrals.surface,
    borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl,
    paddingHorizontal: spacing.lg, paddingTop: 8, paddingBottom: spacing.xl,
    maxHeight: "75%",
  },
  modalHandle: {
    alignSelf: "center", width: 40, height: 4,
    borderRadius: 2, backgroundColor: colors.neutrals.border,
    marginBottom: 12,
  },
  optionRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 12, paddingHorizontal: 12,
    borderRadius: radii.lg, marginBottom: 6,
    borderWidth: 1, borderColor: colors.neutrals.border,
    backgroundColor: colors.neutrals.surface,
  },
  optionRowActive: {
    borderColor: colors.primary.base,
    backgroundColor: colors.overlays.primarySoft,
  },
  optionIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.overlays.primarySoft,
    alignItems: "center", justifyContent: "center",
  },
});
