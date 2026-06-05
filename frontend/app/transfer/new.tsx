import React, { useEffect, useMemo, useState } from "react";
import { View, StyleSheet, TouchableOpacity, Modal, FlatList } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../../src/components/Screen";
import { TText } from "../../src/components/TText";
import { Input } from "../../src/components/Input";
import { Button } from "../../src/components/Button";
import { StepIndicator } from "../../src/components/StepIndicator";
import { api } from "../../src/api";
import { useDraft } from "../../src/store";
import { colors, spacing, radii } from "../../src/theme";
import { useThemedColors } from "../../src/themeContext";

// Modes de livraison — même structure que la page Accueil
const DELIVERY_MODES = [
  { key: "cash", label: "Espèces", icon: "cash-outline" as const },
  { key: "bank", label: "Virement bancaire", icon: "business-outline" as const },
  { key: "momo", label: "Portefeuille mobile", icon: "phone-portrait-outline" as const },
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

  // Saisie bidirectionnelle des montants (identique à Accueil)
  const [sendAmountStr, setSendAmountStr] = useState("100");
  const [receiveAmountStr, setReceiveAmountStr] = useState("");
  const [editing, setEditing] = useState<"send" | "receive">("send");

  const [mode, setMode] = useState("cash");
  const [serviceLevel, setServiceLevel] = useState<"standard" | "vip" | "vip_express">("standard");
  const [search, setSearch] = useState("");
  const [benQuery, setBenQuery] = useState("");
  const [err, setErr] = useState<string | null>(null);

  // Suggestions dynamiques par préfixe nom/prénom (insensible casse)
  const benSuggestions = useMemo(() => {
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
  const benDataMissing = useMemo(() => {
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
    // Charger corridors + bénéficiaires en parallèle
    Promise.all([api.get("/corridors"), api.get("/beneficiaries")])
      .then(([rc, rb]) => {
        const list: Corridor[] = rc.data?.corridors || [];
        const bens = rb.data || [];
        setCorridors(list);
        setBeneficiaries(bens);
        // Pré-sélection si beneficiary_id passé en param
        if (params.beneficiary_id) {
          const found = bens.find((b: any) => b.id === params.beneficiary_id);
          if (found) {
            setSelectedBen(found);
            const c = list.find((x) => x.country_code === found.country);
            if (c) setCountry(c);
            const dm = String(found.default_delivery_mode || "cash").toLowerCase();
            if (["cash", "bank", "momo"].includes(dm)) setMode(dm);
            return;
          }
        }
      })
      .catch(() => {});
  }, [params.beneficiary_id]);

  // Sync bidirectionnelle quand pays / mode change : on bascule selon le côté édité
  useEffect(() => {
    if (!country) return;
    if (editing === "send") {
      const s = parseFloat(sendAmountStr || "0") || 0;
      setReceiveAmountStr((s * country.fx_rate_eur).toFixed(0));
    } else {
      const r = parseFloat(receiveAmountStr || "0") || 0;
      setSendAmountStr(country.fx_rate_eur ? (r / country.fx_rate_eur).toFixed(2) : "0");
    }
    // Si le mode courant n'est pas supporté par ce corridor, fallback
    if (!country.delivery_modes.includes(mode)) {
      setMode(country.delivery_modes[0] || "cash");
    }
    // VIP uniquement pour cash
    if (mode !== "cash" && serviceLevel !== "standard") setServiceLevel("standard");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country, sendAmountStr, receiveAmountStr, editing]);

  const sendAmt = parseFloat(sendAmountStr || "0") || 0;
  const receiveAmt = parseFloat(receiveAmountStr || "0") || 0;
  const supportsVip = mode === "cash" && (!country || country.delivery_modes.includes("cash"));

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
      fx_rate: country.fx_rate_eur,
      fx_fixed: country.fx_fixed,
      delivery_mode: mode,
      vip_delivery: supportsVip && serviceLevel !== "standard",
      service_level: supportsVip ? serviceLevel : "standard",
      beneficiary: selectedBen,
    });
    router.push("/transfer/details");
  };

  const filtered = corridors.filter(
    (c) => !search || c.country_name.toLowerCase().includes(search.toLowerCase()) || c.country_code.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Screen title="Nouveau transfert" back hero>
      <StepIndicator step={1} total={4} />
      <TText variant="caption" color={colors.neutrals.textSecondary} style={{ marginBottom: spacing.md }}>
        Étape 1/4 — Informations principales
      </TText>

      {/* Pays du bénéficiaire */}
      <TText variant="caption" weight="semiBold" color={colors.neutrals.textSecondary} style={{ marginBottom: 6 }}>
        Pays du bénéficiaire
      </TText>
      <TouchableOpacity testID="transfer-country" style={styles.selector} onPress={() => setShowCountry(true)}>
        <TText weight="semiBold">{country ? `${country.flag} ${country.country_name}` : "Sélectionner"}</TText>
        <Ionicons name="chevron-down" size={18} color={colors.neutrals.textSecondary} />
      </TouchableOpacity>

      {/* === Combien voulez-vous envoyer ? — saisie bidirectionnelle === */}
      <TText variant="body" weight="extraBold" style={{ marginTop: spacing.md }}>
        Combien voulez-vous envoyer ?
      </TText>
      <View style={styles.amountsRow}>
        <View style={styles.amountBoxHalf}>
          <TText variant="label" color={colors.neutrals.textSecondary} style={{ marginBottom: 4 }}>
            Vous envoyez
          </TText>
          <View style={styles.amountInner}>
            <Input
              testID="transfer-send"
              value={sendAmountStr}
              onChangeText={(v) => { setEditing("send"); setSendAmountStr(v); }}
              keyboardType="decimal-pad"
              style={{ marginBottom: 0 } as any}
            />
            <View style={styles.currencyChip}>
              <TText variant="caption" weight="extraBold">EUR</TText>
            </View>
          </View>
        </View>

        <View style={styles.amountBoxHalf}>
          <TText variant="label" color={colors.neutrals.textSecondary} style={{ marginBottom: 4 }}>
            Le bénéficiaire reçoit
          </TText>
          <View style={styles.amountInner}>
            <Input
              testID="transfer-receive"
              value={receiveAmountStr}
              onChangeText={(v) => { setEditing("receive"); setReceiveAmountStr(v); }}
              keyboardType="decimal-pad"
              style={{ marginBottom: 0 } as any}
            />
            <View style={styles.currencyChip}>
              <TText variant="caption" weight="extraBold">{country?.currency || "—"}</TText>
            </View>
          </View>
        </View>
      </View>
      <View style={styles.fxBox}>
        <Ionicons name="swap-horizontal" size={14} color={colors.primary.base} />
        <TText variant="caption" weight="semiBold" color={colors.primary.base} style={{ marginLeft: 6 }}>
          {country
            ? `1 EUR = ${country.fx_rate_eur.toFixed(2)} ${country.currency} ${country.fx_fixed ? "• parité fixe" : "• taux variable"}`
            : "Sélectionnez un pays pour afficher le taux"}
        </TText>
      </View>

      {/* === Mode de remise — chips horizontaux === */}
      <TText variant="body" weight="extraBold" style={{ marginTop: spacing.lg }}>
        Comment voulez-vous que le bénéficiaire reçoive l'argent ?
      </TText>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
        {DELIVERY_MODES.map((m) => {
          const supported = !country || country.delivery_modes.includes(m.key);
          const active = mode === m.key && supported;
          return (
            <TouchableOpacity
              key={m.key}
              testID={`transfer-mode-${m.key}`}
              disabled={!supported}
              style={[
                styles.modeChip,
                active && { backgroundColor: colors.primary.base, borderColor: colors.primary.base },
                !supported && { opacity: 0.4 },
              ]}
              onPress={() => setMode(m.key)}
            >
              <Ionicons name={m.icon} size={16} color={active ? "white" : colors.primary.base} />
              <TText variant="label" weight="bold" color={active ? "white" : colors.neutrals.textPrimary} style={{ marginLeft: 4 }}>
                {m.label}
              </TText>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* === Bénéficiaire — recherche dynamique === */}
      <TText variant="body" weight="extraBold" style={{ marginTop: spacing.lg }}>
        À qui voulez-vous envoyer de l'argent ?
      </TText>
      {selectedBen ? (
        <View style={styles.selectedBenRow}>
          <View style={styles.benAvatar}>
            <TText weight="extraBold" color="white">{(selectedBen.full_name || "?").charAt(0).toUpperCase()}</TText>
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <TText variant="body" weight="extraBold">{selectedBen.full_name}</TText>
            <TText variant="caption" color={colors.neutrals.textSecondary}>
              {selectedBen.country}{selectedBen.city ? ` · ${selectedBen.city}` : ""} {selectedBen.relation ? `· ${selectedBen.relation}` : ""}
            </TText>
          </View>
          <TouchableOpacity testID="ben-clear" onPress={() => { setSelectedBen(null); setBenQuery(""); }} style={styles.clearBtn}>
            <Ionicons name="close" size={16} color={colors.neutrals.textSecondary} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ marginTop: 8 }}>
          <Input
            testID="ben-search-input"
            value={benQuery}
            onChangeText={setBenQuery}
            placeholder="Tapez le nom ou prénom du bénéficiaire…"
            icon="search-outline"
            style={{ marginBottom: 0 } as any}
          />
          {benQuery.trim().length > 0 ? (
            <View style={styles.suggestBox}>
              {benSuggestions.length === 0 ? (
                <View style={{ padding: spacing.md }}>
                  <TText variant="caption" color={colors.neutrals.textSecondary} style={{ marginBottom: 8 }}>
                    Aucun bénéficiaire trouvé pour « {benQuery} ».
                  </TText>
                  <TouchableOpacity
                    testID="ben-create-new"
                    style={styles.createBenBtn}
                    onPress={() => router.push({ pathname: "/beneficiaries/add" } as any)}
                  >
                    <Ionicons name="person-add" size={16} color="white" />
                    <TText variant="label" weight="extraBold" color="white" style={{ marginLeft: 6 }}>
                      Créer un bénéficiaire
                    </TText>
                  </TouchableOpacity>
                </View>
              ) : (
                benSuggestions.map((b: any, idx: number) => (
                  <TouchableOpacity
                    key={b.id}
                    testID={`ben-suggest-${b.id}`}
                    onPress={() => { setSelectedBen(b); setBenQuery(""); }}
                    style={[styles.suggestRow, idx < benSuggestions.length - 1 && styles.suggestRowSep]}
                  >
                    <View style={styles.benAvatarSm}>
                      <TText variant="caption" weight="extraBold" color="white">{(b.full_name || "?").charAt(0).toUpperCase()}</TText>
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <TText variant="body" weight="semiBold">{b.full_name}</TText>
                      <TText variant="label" color={colors.neutrals.textSecondary}>
                        {b.country}{b.city ? ` · ${b.city}` : ""}{b.default_delivery_mode ? ` · ${String(b.default_delivery_mode).toUpperCase()}` : ""}
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
        </View>
      )}

      {/* === NIVEAU DE SERVICE — horizontal 3 colonnes (uniquement pour cash) === */}
      {supportsVip ? (
        <View style={{ marginTop: spacing.lg }}>
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
            <TText variant="subtitle" weight="bold">Pays de destination</TText>
            <TText variant="caption" color={colors.neutrals.textSecondary} style={{ marginBottom: 12 }}>
              {corridors.length} pays disponibles
            </TText>
            <Input testID="country-search" value={search} onChangeText={setSearch} placeholder="Rechercher…" icon="search-outline" />
            <FlatList
              data={filtered}
              keyExtractor={(i) => i.country_code}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity testID={`country-${item.country_code}`} style={styles.modalRow} onPress={() => { setCountry(item); setShowCountry(false); setSearch(""); }}>
                  <View style={{ flex: 1 }}>
                    <TText weight="semiBold">{item.flag} {item.country_name}</TText>
                    <TText variant="caption" color={colors.neutrals.textSecondary}>{item.capital || "—"} • {item.currency}</TText>
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
                data={beneficiaries}
                keyExtractor={(i) => i.id}
                renderItem={({ item }) => (
                  <TouchableOpacity testID={`ben-${item.id}`} style={styles.modalRow} onPress={() => { setSelectedBen(item); setShowBenSelect(false); }}>
                    <View>
                      <TText weight="semiBold">{item.full_name}</TText>
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
    backgroundColor: colors.neutrals.background,
    borderRadius: radii.xl, borderWidth: 1, borderColor: colors.neutrals.border,
    paddingHorizontal: spacing.lg, height: 52,
  },
  amountsRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  amountBoxHalf: { flex: 1 },
  amountInner: { flexDirection: "row", alignItems: "center", gap: 6 },
  currencyChip: {
    backgroundColor: colors.overlays.primarySoft, paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: radii.full, marginBottom: 12,
  },
  fxBox: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.overlays.primarySoft, padding: 10,
    borderRadius: radii.lg, marginTop: 4,
  },
  modeChip: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 10, paddingHorizontal: 6, borderRadius: radii.full,
    backgroundColor: colors.neutrals.surface, borderWidth: 1.5, borderColor: colors.neutrals.border,
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
  svcIcon: { width: 40, height: 40, borderRadius: radii.full, alignItems: "center", justifyContent: "center" },
  tagPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radii.full },

  selectedBenRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.overlays.primarySoft, borderRadius: radii.xl,
    borderWidth: 1.5, borderColor: colors.primary.base, padding: 10, marginTop: 8,
  },
  benAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primary.base, alignItems: "center", justifyContent: "center" },
  benAvatarSm: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary.base, alignItems: "center", justifyContent: "center" },
  clearBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.neutrals.surface, alignItems: "center", justifyContent: "center" },
  suggestBox: { backgroundColor: colors.neutrals.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.neutrals.border, marginTop: 6, overflow: "hidden" },
  suggestRow: { flexDirection: "row", alignItems: "center", padding: 10 },
  suggestRowSep: { borderBottomWidth: 1, borderBottomColor: colors.neutrals.border },
  createBenBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: colors.primary.base, paddingVertical: 10, borderRadius: radii.full, alignSelf: "flex-start", paddingHorizontal: 14 },
  linkRow: { flexDirection: "row", alignItems: "center", marginTop: 8, marginLeft: 4 },

  warnBox: { flexDirection: "row", alignItems: "flex-start", backgroundColor: "#FEF3C7", borderWidth: 1, borderColor: "#FCD34D", borderRadius: radii.lg, padding: 10, marginTop: 8 },
  updateInfoBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "white", borderWidth: 1, borderColor: "#FCD34D", borderRadius: radii.full, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5, marginTop: 6 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: colors.neutrals.surface, borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl, padding: spacing.lg, maxHeight: "70%" },
  modalSheetTall: { backgroundColor: colors.neutrals.surface, borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl, padding: spacing.lg, maxHeight: "85%", height: "85%" },
  modalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.neutrals.border },
});
