import React, { useEffect, useState } from "react";
import { View, StyleSheet, TouchableOpacity, ScrollView, Modal, FlatList } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../../src/components/Screen";
import { TText } from "../../src/components/TText";
import { Input } from "../../src/components/Input";
import { Button } from "../../src/components/Button";
import { StepIndicator } from "../../src/components/StepIndicator";
import { api, apiError } from "../../src/api";
import { useDraft } from "../../src/store";
import { colors, spacing, radii } from "../../src/theme";
import { useThemedColors } from "../../src/themeContext";
// v6 — TOUS les modes sont toujours activés (le bug v5 désactivait bank/momo selon corridor)
const MODES = [
  { key: "cash", label: "Espèces", icon: "cash-outline" as const, desc: "Retrait en agence avec code", corridorScoped: false },
  { key: "bank", label: "Virement bancaire", icon: "business-outline" as const, desc: "Vers compte bancaire du bénéficiaire", corridorScoped: false },
  { key: "momo", label: "Portefeuille mobile", icon: "phone-portrait-outline" as const, desc: "Wave, Orange Money, MTN MoMo, Moov…", corridorScoped: false },
];

type Corridor = {
  country_code: string;
  country_name: string;
  currency: string;
  flag: string;
  fx_rate_eur: number;
  fx_margin_percent: number;
  fx_fixed: boolean;
  fee_percent_min: number;
  fee_percent_max: number;
  delivery_modes: string[];
  agents_count: number;
  capital?: string;
  cities?: string[];
};

export default function TransferStep1() {
  const colors = useThemedColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ beneficiary_id?: string }>();
  const setDraft = useDraft((s) => s.setDraft);
  const [corridors, setCorridors] = useState<Corridor[]>([]);
  const [country, setCountry] = useState<Corridor | null>(null);
  const [showCountry, setShowCountry] = useState(false);
  const [showBenSelect, setShowBenSelect] = useState(false);
  const [beneficiaries, setBeneficiaries] = useState<any[]>([]);
  const [selectedBen, setSelectedBen] = useState<any>(null);
  const [amount, setAmount] = useState("100");
  const [mode, setMode] = useState("cash");
  const [vipDelivery, setVipDelivery] = useState(false);
  // Niveau de service: "standard" | "vip" | "vip_express"
  const [serviceLevel, setServiceLevel] = useState<"standard" | "vip" | "vip_express">("standard");
  const [rate, setRate] = useState(1);
  const [search, setSearch] = useState("");
  const [benQuery, setBenQuery] = useState("");
  const [err, setErr] = useState<string | null>(null);

  // Suggestions dynamiques par préfixe nom/prénom (insensible casse)
  const benSuggestions = React.useMemo(() => {
    const q = (benQuery || "").trim().toLowerCase();
    if (!q) return [] as any[];
    return beneficiaries
      .filter((b: any) => {
        const name = String(b.full_name || "").toLowerCase();
        const first = String(b.first_name || "").toLowerCase();
        const last = String(b.last_name || "").toLowerCase();
        return name.includes(q) || first.startsWith(q) || last.startsWith(q);
      })
      .slice(0, 8);
  }, [benQuery, beneficiaries]);

  // Vérifier si les données du bénéficiaire correspondent au mode choisi
  const benDataMissing = React.useMemo(() => {
    if (!selectedBen) return null;
    if (mode === "bank") {
      const hasBank = selectedBen.iban || selectedBen.bank_account;
      if (!hasBank) return "Coordonnées bancaires manquantes (IBAN/RIB) pour un virement bancaire.";
    }
    if (mode === "momo") {
      const hasMomo = (selectedBen.momo_phone || selectedBen.momo_number) && selectedBen.momo_operator;
      if (!hasMomo) return "Opérateur Mobile Money et numéro manquants pour un transfert vers portefeuille mobile.";
    }
    if (mode === "cash") {
      if (!selectedBen.phone) return "Numéro de téléphone manquant — requis pour notifier le bénéficiaire du retrait en agence.";
    }
    return null;
  }, [selectedBen, mode]);

  useEffect(() => {
    // Charger corridors + bénéficiaires en parallèle pour éviter le flash "Afghanistan"
    Promise.all([api.get("/corridors"), api.get("/beneficiaries")])
      .then(([rc, rb]) => {
        const list: Corridor[] = rc.data?.corridors || [];
        const bens = rb.data || [];
        setCorridors(list);
        setBeneficiaries(bens);
        // TRANSFERT.5 — Pré-sélection du bénéficiaire si beneficiary_id passé en paramètre
        if (params.beneficiary_id) {
          const found = bens.find((b: any) => b.id === params.beneficiary_id);
          if (found) {
            setSelectedBen(found);
            const c = list.find((x) => x.country_code === found.country);
            // Fixer le pays du bénéficiaire si trouvé (sinon laisser vide — l'utilisateur choisira)
            if (c) setCountry(c);
            // Mode par défaut du bénéficiaire (cash/bank/momo)
            const dm = String(found.default_delivery_mode || "cash").toLowerCase();
            if (["cash", "bank", "momo"].includes(dm)) setMode(dm);
            return;
          }
        }
        // Pas de présélection automatique d'un pays — le client choisit lui-même
      })
      .catch(() => {});
  }, [params.beneficiary_id]);

  useEffect(() => {
    if (!country) return;
    setRate(country.fx_rate_eur || 1);
    // If selected mode isn't supported in this corridor, switch to first available
    if (!country.delivery_modes.includes(mode)) {
      setMode(country.delivery_modes[0] || "cash");
    }
    // VIP options only available for cash delivery
    if (mode !== "cash" && serviceLevel !== "standard") setServiceLevel("standard");
  }, [country]);

  const sendAmt = parseFloat(amount || "0");
  const receiveAmt = sendAmt * rate;
  const supportsVip = mode === "cash" && country?.delivery_modes.includes("cash");
  // Frais service additionnel
  const VIP_FEE = 2; // VIP : 2€ si lieu différent (estimé)
  const VIP_EXPRESS_FEE = 5; // VIP Express : 5€ premium

  const next = () => {
    setErr(null);
    if (!country) return setErr("Sélectionnez un pays");
    if (sendAmt <= 0) return setErr("Montant invalide");
    if (!selectedBen) return setErr("Sélectionnez un bénéficiaire");
    if (!country.delivery_modes.includes(mode)) {
      return setErr(`Mode "${mode}" indisponible pour ${country.country_name}`);
    }
    setDraft({
      destination_country: country.country_code,
      destination_country_name: country.country_name,
      destination_currency: country.currency,
      send_amount: sendAmt,
      receive_amount: receiveAmt,
      fx_rate: rate,
      fx_fixed: country.fx_fixed,
      delivery_mode: mode,
      vip_delivery: supportsVip && serviceLevel !== "standard",
      service_level: supportsVip ? serviceLevel : "standard",
      beneficiary: selectedBen,
    });
    router.push("/transfer/details");
  };

  return (
    <Screen title="Nouveau transfert" back hero>
      <StepIndicator step={1} total={4} />
      <TText variant="caption" color={colors.neutrals.textSecondary} style={{ marginBottom: spacing.md }}>
        Étape 1/4 — Informations principales
      </TText>

      {/* Country */}
      <TText variant="caption" weight="semiBold" color={colors.neutrals.textSecondary} style={{ marginBottom: 6 }}>
        Pays du bénéficiaire
      </TText>
      <TouchableOpacity testID="transfer-country" style={styles.selector} onPress={() => setShowCountry(true)}>
        <TText variant="body" weight="semiBold" color={country ? colors.neutrals.textPrimary : colors.neutrals.textTertiary}>
          {country ? `${country.flag} ${country.country_name}` : "Sélectionner un pays"}
        </TText>
        <Ionicons name="chevron-down" size={18} color={colors.neutrals.textSecondary} />
      </TouchableOpacity>

      {/* Amount */}
      <View style={{ marginTop: spacing.md }}>
        <Input
          testID="transfer-amount"
          label={`Montant à envoyer (EUR)`}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          icon="cash-outline"
        />
      </View>
      <View style={styles.fxBox}>
        <TText variant="caption" color={colors.neutrals.textSecondary}>
          Le bénéficiaire reçoit
        </TText>
        <TText variant="title" weight="extraBold" color={colors.primary.base}>
          {receiveAmt.toFixed(0)} {country?.currency}
        </TText>
        <TText variant="caption" color={colors.neutrals.textTertiary}>
          1 EUR = {rate.toFixed(2)} {country?.currency}
          {country?.fx_fixed ? "  •  parité fixe" : "  •  taux variable"}
        </TText>
      </View>

      {/* Mode — only show modes supported by the corridor */}
      <TText variant="caption" weight="semiBold" color={colors.neutrals.textSecondary} style={{ marginTop: spacing.lg, marginBottom: 8 }}>
        Mode de remise
      </TText>
      {MODES.map((m) => {
        const supported = !m.corridorScoped || !country || country.delivery_modes.includes(m.key);
        return (
          <TouchableOpacity
            key={m.key}
            testID={`transfer-mode-${m.key}`}
            disabled={!supported}
            style={[
              styles.modeRow,
              mode === m.key && supported && { borderColor: colors.primary.base, backgroundColor: colors.overlays.primarySoft },
              !supported && { opacity: 0.4 },
            ]}
            onPress={() => supported && setMode(m.key)}
          >
            <View style={[styles.modeIcon, mode === m.key && supported && { backgroundColor: colors.primary.base }]}>
              <Ionicons name={m.icon} size={20} color={mode === m.key && supported ? "white" : colors.primary.base} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <TText variant="body" weight="bold">{m.label}</TText>
              <TText variant="caption" color={colors.neutrals.textSecondary}>
                {supported ? m.desc : "Indisponible dans ce pays"}
              </TText>
            </View>
            {mode === m.key && supported ? <Ionicons name="checkmark-circle" size={22} color={colors.accent.base} /> : null}
          </TouchableOpacity>
        );
      })}

      {/* VIP service level — horizontal layout 3 colonnes */}
      {supportsVip ? (
        <View style={{ marginTop: spacing.md }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
            <Ionicons name="rocket-outline" size={14} color="#F59E0B" />
            <TText variant="caption" weight="extraBold" color={colors.neutrals.textSecondary} style={{ marginLeft: 6, letterSpacing: 0.5 }}>
              NIVEAU DE SERVICE
            </TText>
          </View>

          <View style={{ flexDirection: "row", gap: 8 }}>
            {/* Standard */}
            <TouchableOpacity
              testID="service-standard"
              style={[styles.svcCard, serviceLevel === "standard" && styles.svcCardActiveGreen]}
              onPress={() => setServiceLevel("standard")}
              activeOpacity={0.85}
            >
              <View style={[styles.svcIcon, { backgroundColor: serviceLevel === "standard" ? "#10B981" : "#10B98122" }]}>
                <Ionicons name="checkmark-circle" size={18} color={serviceLevel === "standard" ? "white" : "#10B981"} />
              </View>
              <TText variant="caption" weight="extraBold" align="center" style={{ marginTop: 6 }}>Standard</TText>
              <View style={[styles.tagPill, { backgroundColor: "#D1FAE5", marginTop: 4 }]}>
                <TText variant="label" weight="extraBold" color="#065F46">GRATUIT</TText>
              </View>
              <TText variant="label" align="center" color={colors.neutrals.textSecondary} style={{ marginTop: 4, fontSize: 10, lineHeight: 13 }}>
                Retrait en agence
              </TText>
            </TouchableOpacity>

            {/* VIP */}
            <TouchableOpacity
              testID="service-vip"
              style={[styles.svcCard, serviceLevel === "vip" && styles.svcCardActiveOrange]}
              onPress={() => setServiceLevel("vip")}
              activeOpacity={0.85}
            >
              <View style={[styles.svcIcon, { backgroundColor: serviceLevel === "vip" ? "#F59E0B" : "#F59E0B22" }]}>
                <Ionicons name="flash" size={18} color={serviceLevel === "vip" ? "white" : "#F59E0B"} />
              </View>
              <TText variant="caption" weight="extraBold" align="center" style={{ marginTop: 6 }}>VIP</TText>
              <View style={[styles.tagPill, { backgroundColor: "#FEF3C7", marginTop: 4 }]}>
                <TText variant="label" weight="extraBold" color="#92400E">1-4h</TText>
              </View>
              <TText variant="label" align="center" color={colors.neutrals.textSecondary} style={{ marginTop: 4, fontSize: 10, lineHeight: 13 }}>
                Rapide{"\n"}1%, min. 15€
              </TText>
            </TouchableOpacity>

            {/* VIP+ */}
            <TouchableOpacity
              testID="service-vip-express"
              style={[styles.svcCard, serviceLevel === "vip_express" && styles.svcCardActiveOrange]}
              onPress={() => setServiceLevel("vip_express")}
              activeOpacity={0.85}
            >
              <View style={[styles.svcIcon, { backgroundColor: serviceLevel === "vip_express" ? "#EA580C" : "#EA580C22" }]}>
                <Ionicons name="rocket" size={18} color={serviceLevel === "vip_express" ? "white" : "#EA580C"} />
              </View>
              <TText variant="caption" weight="extraBold" align="center" style={{ marginTop: 6 }}>VIP+</TText>
              <View style={[styles.tagPill, { backgroundColor: "#FFEDD5", marginTop: 4 }]}>
                <TText variant="label" weight="extraBold" color="#9A3412">1-2h</TText>
              </View>
              <TText variant="label" align="center" color={colors.neutrals.textSecondary} style={{ marginTop: 4, fontSize: 10, lineHeight: 13 }}>
                Ultra rapide{"\n"}1,5%, min. 20€
              </TText>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/* Beneficiary — dynamic autocomplete by name */}
      <TText variant="caption" weight="semiBold" color={colors.neutrals.textSecondary} style={{ marginTop: spacing.lg, marginBottom: 6 }}>
        Bénéficiaire
      </TText>

      {selectedBen ? (
        // Vue compacte : bénéficiaire sélectionné
        <View style={[styles.selectedBenRow]}>
          <View style={styles.benAvatar}>
            <TText weight="extraBold" color="white">{selectedBen.full_name.charAt(0).toUpperCase()}</TText>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <TText variant="body" weight="extraBold">{selectedBen.full_name}</TText>
            <TText variant="caption" color={colors.neutrals.textSecondary}>
              {selectedBen.country} {selectedBen.city ? `· ${selectedBen.city}` : ""} {selectedBen.relation ? `· ${selectedBen.relation}` : ""}
            </TText>
          </View>
          <TouchableOpacity testID="ben-clear" onPress={() => { setSelectedBen(null); setBenQuery(""); }} style={styles.clearBtn}>
            <Ionicons name="close" size={16} color={colors.neutrals.textSecondary} />
          </TouchableOpacity>
        </View>
      ) : (
        // Vue saisie : autocomplete dynamique
        <>
          <Input
            testID="ben-search-input"
            value={benQuery}
            onChangeText={setBenQuery}
            placeholder="Saisir le nom ou le prénom du bénéficiaire…"
            icon="search-outline"
          />
          {benQuery.trim().length > 0 ? (
            <View style={styles.suggestBox}>
              {benSuggestions.length === 0 ? (
                <View style={{ padding: spacing.md }}>
                  <TText variant="caption" color={colors.neutrals.textSecondary} style={{ marginBottom: 8 }}>
                    Aucun bénéficiaire trouvé pour « {benQuery} ».
                  </TText>
                  <TouchableOpacity testID="ben-create-new" style={styles.createNewBtn} onPress={() => router.push({ pathname: "/beneficiaries/add" } as any)}>
                    <Ionicons name="person-add" size={16} color="white" />
                    <TText variant="label" weight="extraBold" color="white" style={{ marginLeft: 6 }}>
                      Créer un nouveau bénéficiaire
                    </TText>
                  </TouchableOpacity>
                </View>
              ) : (
                benSuggestions.map((b: any, idx: number) => (
                  <TouchableOpacity
                    key={b.id}
                    testID={`ben-suggest-${b.id}`}
                    onPress={() => { setSelectedBen(b); setBenQuery(""); }}
                    style={[styles.suggestRow, idx < benSuggestions.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.neutrals.border }]}
                  >
                    <View style={styles.benAvatarSm}>
                      <TText variant="caption" weight="extraBold" color="white">{b.full_name.charAt(0).toUpperCase()}</TText>
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <TText variant="body" weight="semiBold">{b.full_name}</TText>
                      <TText variant="label" color={colors.neutrals.textSecondary}>
                        {b.country} {b.city ? `· ${b.city}` : ""} {b.default_delivery_mode ? `· ${String(b.default_delivery_mode).toUpperCase()}` : ""}
                      </TText>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.neutrals.textTertiary} />
                  </TouchableOpacity>
                ))
              )}
            </View>
          ) : (
            <TouchableOpacity testID="ben-pick-list" style={styles.linkRow} onPress={() => setShowBenSelect(true)}>
              <Ionicons name="people-outline" size={16} color={colors.primary.base} />
              <TText variant="caption" weight="extraBold" color={colors.primary.base} style={{ marginLeft: 6 }}>
                Voir tous mes bénéficiaires ({beneficiaries.length})
              </TText>
            </TouchableOpacity>
          )}
        </>
      )}

      {/* Avertissement données insuffisantes pour le mode choisi */}
      {selectedBen && benDataMissing ? (
        <View style={styles.warnBox}>
          <Ionicons name="alert-circle" size={18} color="#92400E" />
          <View style={{ flex: 1, marginLeft: 8 }}>
            <TText variant="caption" weight="extraBold" color="#92400E">Informations incomplètes</TText>
            <TText variant="label" color="#92400E" style={{ marginTop: 2 }}>
              {benDataMissing}
            </TText>
            <TouchableOpacity testID="ben-update-info" style={styles.updateInfoBtn} onPress={() => router.push({ pathname: "/beneficiaries/add", params: { edit_id: selectedBen.id } } as any)}>
              <Ionicons name="create-outline" size={14} color="#92400E" />
              <TText variant="label" weight="extraBold" color="#92400E" style={{ marginLeft: 4 }}>
                Mettre à jour les informations
              </TText>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {err ? <TText variant="caption" color={colors.status.error} style={{ marginTop: 8 }}>{err}</TText> : null}

      <View style={{ marginTop: spacing.xl }}>
        <Button testID="transfer-next-1" title="Continuer" onPress={next} icon="arrow-forward" />
      </View>

      {/* Country picker modal */}
      <Modal visible={showCountry} transparent animationType="slide" onRequestClose={() => setShowCountry(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowCountry(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalSheetTall}>
            <TText variant="subtitle" weight="bold" style={{ marginBottom: 4 }}>Pays bénéficiaires</TText>
            <TText variant="caption" color={colors.neutrals.textSecondary} style={{ marginBottom: 12 }}>
              {corridors.length} pays disponibles
            </TText>
            <Input
              testID="country-search"
              value={search}
              onChangeText={setSearch}
              placeholder="Rechercher un pays…"
              icon="search-outline"
            />
            <FlatList
              data={corridors.filter((c) => !search || c.country_name.toLowerCase().includes(search.toLowerCase()) || c.country_code.toLowerCase().includes(search.toLowerCase()))}
              keyExtractor={(i) => i.country_code}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity testID={`country-${item.country_code}`} style={styles.modalRow} onPress={() => { setCountry(item); setShowCountry(false); setSearch(""); }}>
                  <View style={{ flex: 1 }}>
                    <TText variant="body" weight="semiBold">{item.flag} {item.country_name}</TText>
                    <TText variant="caption" color={colors.neutrals.textSecondary}>
                      {item.capital ? `${item.capital} • ` : ""}{item.currency} • {item.delivery_modes.join(" / ")}
                    </TText>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.neutrals.textTertiary} />
                </TouchableOpacity>
              )}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Beneficiary picker modal */}
      <Modal visible={showBenSelect} transparent animationType="slide" onRequestClose={() => setShowBenSelect(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowBenSelect(false)}>
          <View style={styles.modalSheet}>
            <TText variant="subtitle" weight="bold" style={{ marginBottom: 12 }}>Bénéficiaires</TText>
            {beneficiaries.length === 0 ? (
              <View style={{ padding: spacing.lg, alignItems: "center" }}>
                <TText color={colors.neutrals.textSecondary}>Aucun bénéficiaire enregistré</TText>
                <Button title="Ajouter" variant="outline" style={{ marginTop: 12 }} onPress={() => { setShowBenSelect(false); router.push("/beneficiaries"); }} />
              </View>
            ) : (
              <FlatList
                data={beneficiaries.filter((b) => !country || b.country === country.country_code || true)}
                keyExtractor={(i) => i.id}
                renderItem={({ item }) => (
                  <TouchableOpacity testID={`ben-${item.id}`} style={styles.modalRow} onPress={() => { setSelectedBen(item); setShowBenSelect(false); }}>
                    <View>
                      <TText variant="body" weight="semiBold">{item.full_name}</TText>
                      <TText variant="caption" color={colors.neutrals.textSecondary}>{item.country} • {item.relation || "—"}</TText>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.neutrals.textTertiary} />
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  selector: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: colors.neutrals.surface, borderRadius: radii.xl,
    borderWidth: 1, borderColor: colors.neutrals.border,
    paddingHorizontal: spacing.lg, height: 56,
  },
  fxBox: {
    backgroundColor: colors.overlays.primarySoft, padding: spacing.lg,
    borderRadius: radii.xl, marginTop: 4,
  },
  modeRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.neutrals.surface, padding: 14,
    borderRadius: radii.lg, borderWidth: 1.5, borderColor: colors.neutrals.border,
    marginBottom: 8,
  },
  modeIcon: {
    width: 44, height: 44, borderRadius: radii.full,
    backgroundColor: colors.overlays.primarySoft,
    alignItems: "center", justifyContent: "center",
  },
  vipRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.neutrals.surface, padding: 14,
    borderRadius: radii.lg, borderWidth: 1.5, borderColor: colors.neutrals.border,
    marginTop: 8,
  },
  svcRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.neutrals.surface, padding: 14,
    borderRadius: radii.lg, borderWidth: 1.5, borderColor: colors.neutrals.border,
    marginBottom: 8,
  },
  svcCard: {
    flex: 1,
    backgroundColor: colors.neutrals.surface,
    paddingVertical: 12, paddingHorizontal: 8,
    borderRadius: radii.lg, borderWidth: 1.5, borderColor: colors.neutrals.border,
    alignItems: "center", justifyContent: "flex-start",
    minHeight: 120,
  },
  svcCardActiveGreen: { borderColor: "#10B981", backgroundColor: "rgba(16,185,129,0.06)" },
  svcCardActiveOrange: { borderColor: "#F59E0B", backgroundColor: "rgba(245,158,11,0.06)" },
  svcRowActiveGreen: { borderColor: "#10B981", backgroundColor: "rgba(16,185,129,0.06)" },
  svcRowActiveOrange: { borderColor: "#F59E0B", backgroundColor: "rgba(245,158,11,0.06)" },
  svcIcon: {
    width: 40, height: 40, borderRadius: radii.full,
    alignItems: "center", justifyContent: "center",
  },
  tagPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radii.full },
  selectedBenRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.overlays.primarySoft, borderRadius: radii.xl, borderWidth: 1.5, borderColor: colors.primary.base, padding: 12 },
  benAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primary.base, alignItems: "center", justifyContent: "center" },
  benAvatarSm: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary.base, alignItems: "center", justifyContent: "center" },
  clearBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.neutrals.surface, alignItems: "center", justifyContent: "center" },
  suggestBox: { backgroundColor: colors.neutrals.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.neutrals.border, marginTop: 6, overflow: "hidden" },
  suggestRow: { flexDirection: "row", alignItems: "center", padding: 10 },
  createNewBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: colors.primary.base, paddingVertical: 10, borderRadius: radii.full, alignSelf: "flex-start", paddingHorizontal: 14 },
  linkRow: { flexDirection: "row", alignItems: "center", marginTop: 8, marginLeft: 4 },
  warnBox: { flexDirection: "row", alignItems: "flex-start", backgroundColor: "#FEF3C7", borderWidth: 1, borderColor: "#FCD34D", borderRadius: radii.lg, padding: 10, marginTop: 8 },
  updateInfoBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "white", borderWidth: 1, borderColor: "#FCD34D", borderRadius: radii.full, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5, marginTop: 6 },
  toggle: {
    width: 44, height: 26, borderRadius: 13,
    backgroundColor: colors.neutrals.border, padding: 3, justifyContent: "center",
  },
  toggleDot: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: "white",
  },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: colors.neutrals.surface,
    borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl,
    padding: spacing.lg, maxHeight: "70%",
  },
  modalSheetTall: {
    backgroundColor: colors.neutrals.surface,
    borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl,
    padding: spacing.lg, maxHeight: "85%", height: "85%",
  },
  modalRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: 14, borderBottomWidth: 1, borderBottomColor: colors.neutrals.border,
  },
});
