import React, { useCallback, useState } from "react";
import { View, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Modal, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { TText } from "../../../src/components/TText";
import { Input } from "../../../src/components/Input";
import { Button } from "../../../src/components/Button";
import { api, apiError } from "../../../src/api";
import { paybidColors } from "../../../src/paybidTheme";
import { spacing, radii } from "../../../src/theme";
import { useTranslation } from "../../../src/i18n";

export default function PaybidAuctions() {
  const { t } = useTranslation();
  const [list, setList] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "city">("all");
  const [bidOpen, setBidOpen] = useState<any | null>(null);
  const [feePct, setFeePct] = useState("1.50");
  const [eta, setEta] = useState("30");
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async (showLoading = true) => {
    console.log('[DEBUG] Auctions load started, filter:', filter);
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const { data } = await api.get("/agent/auctions", { params: { only_same_city: filter === "city" } });
      console.log('[DEBUG] Auctions data:', data);
      setList(data || []);
    } catch (e: any) {
      console.log('[DEBUG] Auctions error:', e);
      setError(apiError(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const submitBid = async () => {
    setErr(null);
    try {
      await api.post(`/agent/auctions/${bidOpen.id}/bid`, { transfer_id: bidOpen.id, bid_fee_percent: parseFloat(feePct), eta_minutes: parseInt(eta) });
      Alert.alert("Offre envoyée", `Frais ${feePct}% · ETA ${eta} min`);
      setBidOpen(null); load();
    } catch (e: any) { setErr(apiError(e)); }
  };

  // Loading state
  if (loading) {
    return (
      <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: paybidColors.neutrals.background }}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={paybidColors.primary.base} />
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error) {
    return (
      <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: paybidColors.neutrals.background }}>
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={48} color={paybidColors.status.error} />
          <TText style={{ marginTop: 16, marginBottom: 24 }} color={paybidColors.neutrals.textSecondary}>{error}</TText>
          <Button title="Réessayer" onPress={() => load()} style={{ backgroundColor: paybidColors.primary.base }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: paybidColors.neutrals.background }}>
      <View style={styles.header}>
        <TText variant="title" weight="extraBold">Offres en direct</TText>
        <TText variant="caption" color={paybidColors.neutrals.textSecondary}>Posez votre offre dans la fenêtre de 90s</TText>
      </View>
      <View style={styles.tabsRow}>
        {[{k:"city",l:"Ma ville"},{k:"all",l:"Toutes"}].map((t) => (
          <TouchableOpacity key={t.k} style={[styles.tab, filter === t.k && styles.tabActive]} onPress={() => setFilter(t.k as any)}>
            <TText weight="bold" color={filter === t.k ? "white" : paybidColors.neutrals.textPrimary}>{t.l}</TText>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList
        data={list}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={paybidColors.primary.base} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: paybidColors.overlays.pendingSoft, alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <Ionicons name="flash-off-outline" size={36} color={paybidColors.neutrals.textTertiary} />
            </View>
            <TText weight="bold" style={{ marginBottom: 6 }}>Aucune offre {filter === "city" ? "dans votre ville" : "disponible"}</TText>
            <TText variant="caption" color={paybidColors.neutrals.textSecondary} align="center" style={{ marginBottom: 16, paddingHorizontal: 32 }}>
              {filter === "city"
                ? "Il n'y a pas de transfert en attente d'agent dans votre ville. Essayez \"Toutes\" pour voir les offres ailleurs."
                : "Aucun client n'a initié de transfert espèces pour le moment. Les offres apparaîtront ici dès qu'un transfert sera disponible."}
            </TText>
            {filter === "city" && (
              <TouchableOpacity
                style={{ backgroundColor: paybidColors.primary.base, paddingHorizontal: 24, paddingVertical: 10, borderRadius: radii.full }}
                onPress={() => setFilter("all")}
              >
                <TText weight="bold" color="white">Voir toutes les offres</TText>
              </TouchableOpacity>
            )}
          </View>
        }
        renderItem={({ item }) => {
          const sLevel = item.service_level || (item.vip_delivery ? "VIP" : "STANDARD");
          const isVip = sLevel !== "STANDARD";
          const commEur = item.commission_eur || Math.round((item.fee_percent || 0) / 100 * (item.send_amount || 0) * 100) / 100;
          const feeP = item.fee_percent || 2;
          const cAt = item.created_at ? new Date(item.created_at) : null;
          const mins = cAt ? Math.max(0, Math.floor((Date.now() - cAt.getTime()) / 60000)) : 0;
          const ago = mins < 1 ? "À l'instant" : mins < 60 ? `il y a ${mins} min` : `il y a ${Math.floor(mins / 60)}h`;
          return (
          <TouchableOpacity style={styles.card} onPress={() => { setBidOpen(item); setFeePct(((item.fee_percent || 2) - 0.5).toFixed(2)); }}>
            {/* Row 1: Priorité + Tour + Badge ville */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View style={[styles.priorityBadge, isVip && { backgroundColor: "#FEF3C7" }]}>
                  <Ionicons name={isVip ? "diamond" : "cube-outline"} size={11} color={isVip ? "#D97706" : paybidColors.neutrals.textSecondary} />
                  <TText variant="label" weight="extraBold" color={isVip ? "#D97706" : paybidColors.neutrals.textSecondary}> {sLevel}</TText>
                </View>
                <View style={styles.roundBadge}>
                  <Ionicons name="flash" size={11} color="#F59E0B" />
                  <TText variant="label" weight="bold" color="#F59E0B"> Tour {item.auction_round || 1}/5</TText>
                </View>
              </View>
              {item.same_city ? (
                <View style={styles.cityBadge}><Ionicons name="location" size={12} color="white" /><TText variant="label" weight="bold" color="white" style={{ marginLeft: 4 }}>Ma ville</TText></View>
              ) : (
                <TText variant="label" color={paybidColors.neutrals.textTertiary}>{item.beneficiary?.city || item.destination_country}</TText>
              )}
            </View>

            {/* Row 2: Bénéficiaire + Montant */}
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
              <View style={styles.flag}><TText weight="bold" color={paybidColors.primary.base}>{(item.beneficiary?.full_name || "?")[0]}</TText></View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <TText weight="extraBold">{item.beneficiary?.full_name || "—"}</TText>
                <TText variant="caption" color={paybidColors.neutrals.textSecondary}>De : {item.sender_name || "—"}</TText>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <TText variant="title" weight="extraBold" color={paybidColors.primary.base}>
                  {Number(item.receive_amount || 0).toLocaleString("fr-FR")} {item.destination_currency || "XOF"}
                </TText>
              </View>
            </View>

            {/* Row 3: Commission + Temps + CTA */}
            <View style={styles.cardFoot}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <View style={styles.commissionChip}>
                  <Ionicons name="cash-outline" size={13} color="#16A34A" />
                  <TText variant="label" weight="extraBold" color="#16A34A"> {commEur.toFixed(2)} €</TText>
                  <TText variant="label" color={paybidColors.neutrals.textTertiary}> ({feeP.toFixed(1)}%)</TText>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Ionicons name="time-outline" size={13} color={paybidColors.neutrals.textSecondary} />
                  <TText variant="label" color={paybidColors.neutrals.textSecondary}> {ago}</TText>
                </View>
              </View>
              <TouchableOpacity style={styles.bidBtn}>
                <TText variant="label" weight="extraBold" color="white">PROPOSER</TText>
                <Ionicons name="arrow-forward" size={12} color="white" style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
          );
        }}
      />

      <Modal visible={!!bidOpen} transparent animationType="slide" onRequestClose={() => setBidOpen(null)}>
        <TouchableOpacity style={styles.modalBg} activeOpacity={1} onPress={() => setBidOpen(null)}>
          <View style={styles.sheet}>
            {/* Header */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md }}>
              <TText variant="subtitle" weight="extraBold">Détails de l'offre</TText>
              <TouchableOpacity onPress={() => setBidOpen(null)}>
                <Ionicons name="close-circle" size={28} color={paybidColors.neutrals.textTertiary} />
              </TouchableOpacity>
            </View>

            {/* Détails du transfert */}
            <View style={{ backgroundColor: paybidColors.neutrals.background, borderRadius: radii.lg, padding: spacing.md, marginBottom: spacing.md }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                <TText variant="caption" color={paybidColors.neutrals.textSecondary}>Bénéficiaire</TText>
                <TText weight="bold">{bidOpen?.beneficiary?.full_name || "—"}</TText>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                <TText variant="caption" color={paybidColors.neutrals.textSecondary}>Ville</TText>
                <TText weight="bold">{bidOpen?.beneficiary?.city || bidOpen?.destination_country || "—"}</TText>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                <TText variant="caption" color={paybidColors.neutrals.textSecondary}>Expéditeur</TText>
                <TText weight="bold">{bidOpen?.sender_name || "—"}</TText>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                <TText variant="caption" color={paybidColors.neutrals.textSecondary}>Montant à remettre</TText>
                <TText weight="extraBold" color={paybidColors.primary.base}>{Number(bidOpen?.receive_amount || 0).toLocaleString("fr-FR")} {bidOpen?.destination_currency || "XOF"}</TText>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                <TText variant="caption" color={paybidColors.neutrals.textSecondary}>Mode</TText>
                <TText weight="bold">{bidOpen?.service_level || (bidOpen?.vip_delivery ? "VIP" : "STANDARD")}</TText>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <TText variant="caption" color={paybidColors.neutrals.textSecondary}>Commission offerte</TText>
                <TText weight="extraBold" color="#16A34A">{(bidOpen?.fee_percent || 2).toFixed(2)}% = {(bidOpen?.commission_eur || ((bidOpen?.fee_percent || 0) / 100 * (bidOpen?.send_amount || 0))).toFixed(2)} €</TText>
              </View>
            </View>

            {/* Bouton Accepter directement */}
            <Button
              title={`Accepter — Gagner ${(bidOpen?.fee_percent || 2).toFixed(2)}% (${((bidOpen?.fee_percent || 0) / 100 * (bidOpen?.send_amount || 0)).toFixed(2)} €)`}
              onPress={async () => {
                setErr(null);
                try {
                  await api.post(`/agent/auctions/${bidOpen.id}/accept`);
                  Alert.alert("Offre acceptée !", "Vous êtes assigné à ce transfert. Rendez-vous dans vos missions.");
                  setBidOpen(null); load();
                } catch (e: any) { setErr(apiError(e)); }
              }}
              icon="checkmark-circle"
              style={{ backgroundColor: "#16A34A", marginBottom: spacing.sm }}
            />

            {/* Séparateur OU */}
            <View style={{ flexDirection: "row", alignItems: "center", marginVertical: spacing.sm }}>
              <View style={{ flex: 1, height: 1, backgroundColor: paybidColors.neutrals.border }} />
              <TText variant="caption" color={paybidColors.neutrals.textTertiary} style={{ marginHorizontal: 12 }}>ou proposer moins</TText>
              <View style={{ flex: 1, height: 1, backgroundColor: paybidColors.neutrals.border }} />
            </View>

            {/* Enchère inférieure */}
            <Input label={`Votre taux (< ${(bidOpen?.fee_percent || 2).toFixed(2)}%)`} value={feePct} onChangeText={setFeePct} keyboardType="decimal-pad" icon="trending-down-outline" />
            <Input label="ETA (minutes)" value={eta} onChangeText={setEta} keyboardType="number-pad" icon="time-outline" />
            {err ? <TText color={paybidColors.status.error} style={{ marginBottom: 8 }}>{err}</TText> : null}
            <Button title="Proposer ce taux" onPress={submitBid} icon="flash" style={{ backgroundColor: paybidColors.primary.base }} />
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { padding: spacing.lg },
  tabsRow: { flexDirection: "row", gap: 8, paddingHorizontal: spacing.lg, marginBottom: 8 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: radii.full, backgroundColor: paybidColors.neutrals.surface, borderWidth: 1.5, borderColor: paybidColors.neutrals.border, alignItems: "center" },
  tabActive: { backgroundColor: paybidColors.primary.base, borderColor: paybidColors.primary.base },
  card: { backgroundColor: paybidColors.neutrals.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: paybidColors.neutrals.border, padding: spacing.md, marginBottom: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  flag: { width: 40, height: 40, borderRadius: radii.full, backgroundColor: paybidColors.overlays.primarySoft, alignItems: "center", justifyContent: "center" },
  cityBadge: { flexDirection: "row", alignItems: "center", backgroundColor: paybidColors.status.success, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radii.full },
  priorityBadge: { flexDirection: "row", alignItems: "center", backgroundColor: paybidColors.neutrals.border, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.full },
  roundBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(245,158,11,0.12)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.full },
  commissionChip: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(22,163,74,0.1)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.full },
  bidBtn: { flexDirection: "row", alignItems: "center", backgroundColor: paybidColors.primary.base, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radii.full },
  cardFoot: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: paybidColors.neutrals.border },
  empty: { alignItems: "center", padding: 40 },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "white", borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl, padding: spacing.lg },
});
