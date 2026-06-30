/**
 * /paybid/cash.tsx — Déclarer les espèces & gestion exhaustive de la caisse
 *
 * Conforme à la demande utilisateur (item 3) :
 *   - Calcul/affichage de toutes les informations pertinentes :
 *     • Solde caisse réel
 *     • Crédit (recharges totales)
 *     • Encours (prêts/facilité de caisse actifs)
 *     • Analyse (entrées/sorties du jour, balance nette)
 *   - Historique complet des opérations espèces
 *   - CTA principal : déclarer une nouvelle entrée d'espèces
 */
import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { TText } from "../../src/components/TText";
import { Input } from "../../src/components/Input";
import { Button } from "../../src/components/Button";
import { api, apiError } from "../../src/api";
import { paybidColors } from "../../src/paybidTheme";
import { spacing, radii } from "../../src/theme";
import { formatMoney } from "../../src/utils/money";
import { useTranslation } from "../../../src/i18n";

// Item 9 — Types de mouvements considérés comme "gestion des espèces".
// Tous les autres (commissions, transferts, gains) sont exclus de cette vue.
const CASH_MOVEMENT_TYPES = new Set([
  "declare", "recharge", "cash_recharge",
  "deposit", "withdraw", "agency_cashin", "agency_cashout",
  "cashin", "cashout", "float_topup", "float_payout",
  "verser_siege", "cash_in", "cash_out",
]);

function isCashMovement(t: { type?: string }): boolean {
  const type = (t.type || "").toLowerCase();
  return CASH_MOVEMENT_TYPES.has(type) || type.includes("cash") || type.includes("declare") || type.includes("recharge");
}

type FloatTx = { id: string; type: string; amount: number; currency: string; created_at: string; note?: string };

export default function DeclareCashScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [data, setData] = useState<any>({ balance: 0, currency: "EUR", float_account: null });
  const [hist, setHist] = useState<FloatTx[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showDeclareForm, setShowDeclareForm] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  // v9 — Détail du mouvement sélectionné (item 8 — clic sur chaque mouvement)
  const [detail, setDetail] = useState<FloatTx | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [floatR, movR] = await Promise.all([
        api.get("/agent/float"),
        api.get("/agent/float/movements?limit=50"),
      ]);
      // Le backend renvoie { items: [{ currency, balance, loan_balance? }, ...] }
      const items = floatR.data?.items || [];
      const main = items[0] || { balance: 0, currency: "XOF" };
      setData({ balance: main.balance, currency: main.currency, float_account: main });
      // Item 9 — Vue "gestion des espèces" : filtrer pour ne garder QUE les mouvements
      // liés au cash. Les commissions/transferts/gains sont exclus.
      const movs = (movR.data?.items || []).filter((m: any) => isCashMovement(m));
      setHist(movs.map((m: any) => ({
        id: m.id || m._id || String(Math.random()),
        type: m.type || m.movement_type || "operation",
        amount: m.amount_signed ?? m.amount ?? 0,
        currency: m.currency || main.currency,
        created_at: m.created_at,
        note: m.reason || m.note,
      })));
    } catch {}
    finally { setRefreshing(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Calculs analytiques
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayHist = hist.filter((t) => new Date(t.created_at) >= today);
  const entriesToday = todayHist.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const exitsToday = todayHist.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const netToday = entriesToday - exitsToday;
  const totalCredits = hist.filter((t) => ["declare", "recharge", "cashin"].includes(t.type)).reduce((s, t) => s + Math.abs(t.amount), 0);
  const totalEncours = Number(data?.float_account?.loan_balance || 0); // facilité caisse

  const submitDeclaration = async () => {
    const v = parseFloat((amount || "").replace(",", "."));
    if (!v || v <= 0) { Alert.alert("Montant invalide"); return; }
    setBusy(true);
    try {
      await api.post("/agent/float/declare", { amount: v, note });
      setAmount(""); setNote(""); setShowDeclareForm(false);
      await load();
      Alert.alert("Espèces déclarées", `${v.toFixed(2)} ${data.currency} ajoutés à votre caisse.`);
    } catch (e: any) {
      Alert.alert("Erreur", apiError(e));
    } finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: paybidColors.neutrals.background }} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={paybidColors.neutrals.textPrimary} />
        </TouchableOpacity>
        <TText variant="title" weight="extraBold">Déclarer les espèces</TText>
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />} contentContainerStyle={{ padding: spacing.lg }}>
        {/* Solde caisse — fond MARRON UNI #54280f (item 9 — was orange in older builds) */}
        <View style={[styles.balanceCard, { backgroundColor: "#54280f" }]}>
          <TText variant="caption" weight="bold" color="rgba(255,255,255,0.78)" style={{ letterSpacing: 1 }}>FLOAT DISPONIBLE — CAISSE</TText>
          <TText weight="extraBold" color="white" style={{ fontSize: 26, marginTop: 4 }} adjustsFontSizeToFit numberOfLines={1}>
            {formatMoney(data.balance || 0, data.currency || "EUR")}
          </TText>
          <TText variant="caption" color="rgba(255,255,255,0.78)">Espèces disponibles en caisse</TText>
        </View>

        {/* 4 KPIs analytiques — taille icône & police réduites (item 9) */}
        <View style={styles.kpiGrid}>
          <KpiBox icon="arrow-down-circle" color="#10B981" label="Entrées (jour)" value={formatMoney(entriesToday, data.currency, { withCurrency: false })} />
          <KpiBox icon="arrow-up-circle" color="#EF4444" label="Sorties (jour)" value={formatMoney(exitsToday, data.currency, { withCurrency: false })} />
          <KpiBox icon="trending-up" color="#F59E0B" label="Net du jour" value={`${netToday >= 0 ? "+" : "-"}${formatMoney(Math.abs(netToday), data.currency, { withCurrency: false })}`} />
          <KpiBox icon="card" color="#022a6b" label="Encours" value={formatMoney(totalEncours, data.currency, { withCurrency: false })} />
        </View>

        {/* Crédit total */}
        <View style={styles.summaryRow}>
          <TText variant="caption" weight="bold" color={paybidColors.neutrals.textSecondary}>Crédit total reçu</TText>
          <TText weight="extraBold">{formatMoney(totalCredits, data.currency)}</TText>
        </View>

        {/* CTA déclaration */}
        {!showDeclareForm ? (
          <TouchableOpacity activeOpacity={0.85} onPress={() => setShowDeclareForm(true)}>
            <LinearGradient colors={["#10B981", "#059669"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.declareCta}>
              <Ionicons name="add-circle" size={26} color="white" />
              <TText weight="extraBold" color="white" style={{ marginLeft: 10, fontSize: 13 }}>Déclarer une nouvelle entrée d&apos;espèces</TText>
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <View style={styles.formCard}>
            <TText variant="body" weight="extraBold" style={{ marginBottom: 8 }}>Nouvelle déclaration</TText>
            <Input
              testID="cash-amount"
              placeholder="Montant (EUR)"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              icon="cash-outline"
            />
            <Input
              testID="cash-note"
              placeholder="Note (origine des fonds, optionnel)"
              value={note}
              onChangeText={setNote}
              icon="document-text-outline"
            />
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              <Button testID="cash-cancel" title="Annuler" variant="outline" onPress={() => { setShowDeclareForm(false); setAmount(""); setNote(""); }} style={{ flex: 1 }} />
              <Button testID="cash-submit" title="Valider" onPress={submitDeclaration} loading={busy} style={{ flex: 1 }} />
            </View>
          </View>
        )}

        {/* Historique */}
        <View style={{ marginTop: spacing.xl }}>
          <TText variant="body" weight="extraBold" style={{ marginBottom: 8 }}>Historique des mouvements espèces</TText>
          {hist.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="document-outline" size={48} color={paybidColors.neutrals.textTertiary} />
              <TText variant="caption" color={paybidColors.neutrals.textSecondary} style={{ marginTop: 8 }}>Aucun mouvement enregistré</TText>
            </View>
          ) : hist.map((t) => (
            <TouchableOpacity key={t.id} onPress={() => setDetail(t)} style={styles.histRow} activeOpacity={0.7}>
              <View style={[styles.histIcon, { backgroundColor: t.amount >= 0 ? "#ECFDF5" : "#FEF2F2" }]}>
                <Ionicons name={t.amount >= 0 ? "arrow-down" : "arrow-up"} size={18} color={t.amount >= 0 ? "#10B981" : "#EF4444"} />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <TText weight="semiBold" style={{ textTransform: "capitalize" }}>{(t.type || "opération").replace(/_/g, " ")}</TText>
                <TText variant="caption" color={paybidColors.neutrals.textSecondary}>
                  {new Date(t.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                </TText>
                {t.note ? <TText variant="caption" color={paybidColors.neutrals.textTertiary} style={{ marginTop: 2 }}>{t.note}</TText> : null}
              </View>
              <TText weight="extraBold" color={t.amount >= 0 ? "#10B981" : "#EF4444"}>
                {t.amount >= 0 ? "+" : ""}{t.amount.toFixed(2)} {t.currency}
              </TText>
              <Ionicons name="chevron-forward" size={16} color={paybidColors.neutrals.textTertiary} style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Modale détail mouvement — v9 (item 8) */}
      {detail ? (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <TText variant="body" weight="extraBold">Détail du mouvement</TText>
              <TouchableOpacity onPress={() => setDetail(null)} style={{ padding: 4 }}>
                <Ionicons name="close" size={22} color={paybidColors.neutrals.textPrimary} />
              </TouchableOpacity>
            </View>
            <View style={[styles.detailIcon, { backgroundColor: detail.amount >= 0 ? "#ECFDF5" : "#FEF2F2", alignSelf: "center", marginBottom: 12 }]}>
              <Ionicons name={detail.amount >= 0 ? "arrow-down" : "arrow-up"} size={28} color={detail.amount >= 0 ? "#10B981" : "#EF4444"} />
            </View>
            <TText weight="extraBold" align="center" style={{ fontSize: 28 }} color={detail.amount >= 0 ? "#10B981" : "#EF4444"}>
              {detail.amount >= 0 ? "+" : ""}{detail.amount.toFixed(2)} {detail.currency}
            </TText>
            <View style={{ marginTop: 18 }}>
              <DetailLine label="Type" value={(detail.type || "—").replace(/_/g, " ")} />
              <DetailLine label="Date" value={new Date(detail.created_at).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })} />
              <DetailLine label="Devise" value={detail.currency || "—"} />
              {detail.note ? <DetailLine label="Note" value={detail.note} /> : null}
              <DetailLine label="ID" value={detail.id} mono />
            </View>
            <Button testID="cash-detail-close" title="Fermer" onPress={() => setDetail(null)} style={{ marginTop: 14, backgroundColor: paybidColors.primary.base }} />
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function KpiBox({ icon, color, label, value }: any) {
  return (
    <View style={styles.kpiBox}>
      <Ionicons name={icon} size={20} color={color} />
      <TText variant="caption" color={paybidColors.neutrals.textSecondary} style={{ marginTop: 4 }}>{label}</TText>
      <TText weight="extraBold" style={{ marginTop: 2 }}>{value}</TText>
    </View>
  );
}

function DetailLine({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: paybidColors.neutrals.border }}>
      <TText variant="caption" color={paybidColors.neutrals.textSecondary}>{label}</TText>
      <TText weight="semiBold" style={[{ flexShrink: 1, textAlign: "right", marginLeft: 8 }, mono ? { fontVariant: ["tabular-nums"] } : null]} numberOfLines={2}>{value}</TText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", padding: spacing.lg, paddingBottom: 0 },
  backBtn: { padding: 6, marginRight: 8 },
  balanceCard: { padding: spacing.lg, borderRadius: radii.xxl, marginBottom: spacing.md },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4, marginBottom: spacing.md },
  kpiBox: { width: "50%", paddingHorizontal: 4, marginBottom: 8 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: paybidColors.neutrals.surface, padding: 14, borderRadius: radii.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: paybidColors.neutrals.border },
  declareCta: { flexDirection: "row", alignItems: "center", padding: 16, borderRadius: radii.xl },
  formCard: { backgroundColor: paybidColors.neutrals.surface, padding: spacing.lg, borderRadius: radii.xl, borderWidth: 1, borderColor: paybidColors.neutrals.border, marginBottom: spacing.md },
  histRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 12, backgroundColor: paybidColors.neutrals.surface, borderRadius: radii.lg, marginBottom: 8, borderWidth: 1, borderColor: paybidColors.neutrals.border },
  histIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  detailIcon: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", padding: 40 },
  // Modale détail mouvement (v9)
  modalOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center", padding: spacing.lg, zIndex: 99 },
  modalCard: { width: "100%", maxWidth: 420, backgroundColor: paybidColors.neutrals.surface, borderRadius: radii.xxl, padding: spacing.lg, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 10 },
});
