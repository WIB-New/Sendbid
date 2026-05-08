import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Switch } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { TText } from "../../../src/components/TText";
import { SendBidLogo } from "../../../src/components/Logo";
import { api } from "../../../src/api";
import { paybidColors } from "../../../src/paybidTheme";
import { spacing, radii, shadows } from "../../../src/theme";

export default function PaybidDashboard() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [float, setFloat] = useState<{ balance: number; currency: string } | null>(null);
  const [available, setAvailable] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [{ data: d }, { data: f }] = await Promise.all([
        api.get("/agent/dashboard"),
        api.get("/agent/float").catch(() => ({ data: { items: [] } })),
      ]);
      setData(d);
      setAvailable(d.agent?.available !== false);
      const first = (f.items || [])[0];
      if (first) setFloat({ balance: first.balance || 0, currency: first.currency || "XOF" });
    } catch {}
    setRefreshing(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggleAvail = async () => {
    const next = !available;
    setAvailable(next);
    try { await api.post("/agent/availability", { available: next }); } catch {}
  };

  if (!data) return null;
  const { agent, stats, active_transfers, auctions_preview } = data;

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: paybidColors.neutrals.background }}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={paybidColors.primary.base} />} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}>
        {/* Header card */}
        <LinearGradient colors={paybidColors.gradients.main} start={{x:0,y:0}} end={{x:1,y:1}} style={[styles.heroCard, shadows.lg]}>
          <View style={styles.heroTop}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={styles.logoChip}><SendBidLogo size={32} /></View>
              <View style={{ marginLeft: 10 }}>
                <TText variant="caption" weight="extraBold" color="white" style={{ letterSpacing: 1 }}>PAYBID</TText>
                <TText variant="label" color="rgba(255,255,255,0.85)">{agent.full_name} · {agent.city}</TText>
              </View>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: available ? "rgba(16,185,129,0.22)" : "rgba(0,0,0,0.25)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: available ? "#10B981" : "rgba(255,255,255,0.55)", marginRight: 6 }} />
                <TText variant="label" weight="extraBold" color="white">{available ? "EN LIGNE" : "HORS-LIGNE"}</TText>
              </View>
              <Switch value={available} onValueChange={toggleAvail} thumbColor="white" trackColor={{ true: "rgba(16,185,129,0.65)", false: "rgba(255,255,255,0.22)" }} />
            </View>
          </View>
          <View style={{ marginTop: spacing.md }}>
            <TText variant="label" color="rgba(255,255,255,0.8)">Gains 7 jours</TText>
            <TText variant="display" weight="extraBold" color="white">{stats.week_earnings_eur.toFixed(2)} EUR</TText>
            <TText variant="caption" color="rgba(255,255,255,0.8)">{stats.week_completed} transferts terminés · note {stats.rating} ⭐</TText>
          </View>
        </LinearGradient>

        {/* Stats */}
        <View style={styles.statsRow}>
          <Stat icon="flash-outline" label="Offres ouvertes" value={`${stats.same_city_auctions}/${stats.pending_auctions}`} />
          <Stat icon="paper-plane-outline" label="En cours" value={`${stats.active_count}`} />
          <Stat icon="checkmark-circle-outline" label="Aujourd'hui" value={`${stats.today_completed}`} />
        </View>

        {/* Float card — espèces en caisse */}
        <TouchableOpacity testID="paybid-float-card" activeOpacity={0.85} style={styles.floatCard} onPress={() => router.push("/paybid/float" as any)}>
          <LinearGradient colors={[paybidColors.primary.dark, paybidColors.primary.base]} style={styles.floatInner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <View style={styles.floatIcon}>
              <Ionicons name="cash" size={22} color="white" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <TText variant="caption" color="rgba(255,255,255,0.75)" weight="semiBold">ESPÈCES EN CAISSE</TText>
              <TText variant="title" weight="extraBold" color="white">
                {float ? `${float.balance.toLocaleString("fr-FR")} ${float.currency}` : "— XOF"}
              </TText>
              <TText variant="label" color="rgba(255,255,255,0.7)">Déclarer / Verser au siège</TText>
            </View>
            <Ionicons name="chevron-forward" size={22} color="white" />
          </LinearGradient>
        </TouchableOpacity>

        {/* Active transfers */}
        <SectionHeader title="Transferts en cours" onSeeAll={() => router.push("/paybid/(tabs)/transfers" as any)} />
        {active_transfers.length === 0 ? <Empty label="Aucun transfert en cours" /> : active_transfers.map((t: any) => (
          <TouchableOpacity key={t.id} style={styles.row} onPress={() => router.push({ pathname: "/paybid/transfer/[id]" as any, params: { id: t.id } })}>
            <View style={[styles.rowIcon, { backgroundColor: paybidColors.overlays.primarySoft }]}><Ionicons name="paper-plane" size={18} color={paybidColors.primary.base} /></View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <TText weight="semiBold">{t.beneficiary?.full_name || "—"}</TText>
              <TText variant="caption" color={paybidColors.neutrals.textSecondary}>{t.destination_country} · {(t.delivery_mode || "").toUpperCase()}{t.vip_delivery ? " · VIP" : ""}</TText>
            </View>
            <TText weight="bold" color={paybidColors.primary.base}>{Number(t.receive_amount).toFixed(0)} {t.destination_currency}</TText>
          </TouchableOpacity>
        ))}

        {/* Auctions preview */}
        <SectionHeader title="Offres à proximité" onSeeAll={() => router.push("/paybid/(tabs)/auctions" as any)} />
        {auctions_preview.length === 0 ? <Empty label="Aucune offre ouverte" /> : auctions_preview.map((t: any) => (
          <TouchableOpacity key={t.id} style={styles.row} onPress={() => router.push("/paybid/(tabs)/auctions" as any)}>
            <View style={[styles.rowIcon, { backgroundColor: paybidColors.overlays.pendingSoft }]}><Ionicons name="flash" size={18} color={paybidColors.status.pending} /></View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <TText weight="semiBold">{t.beneficiary?.full_name || "—"}</TText>
              <TText variant="caption" color={paybidColors.neutrals.textSecondary}>{t.destination_country} · {(t.delivery_mode || "").toUpperCase()} · Round {t.auction_round || 1}</TText>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <TText weight="bold" color={paybidColors.primary.base}>{Number(t.send_amount).toFixed(0)} EUR</TText>
              <TText variant="label" color={paybidColors.status.pending}>≤ {(t.fee_percent || 2).toFixed(2)}%</TText>
            </View>
          </TouchableOpacity>
        ))}

        {/* Quick actions */}
        <View style={{ flexDirection: "row", gap: 10, marginTop: spacing.lg }}>
          <ActionBtn icon="cash-outline" label="Caisse" onPress={() => router.push("/paybid/float" as any)} />
          <ActionBtn icon="qr-code-outline" label="Scanner" onPress={() => router.push("/paybid/scan" as any)} />
          <ActionBtn icon="flash-outline" label="Offres" onPress={() => router.push("/paybid/(tabs)/auctions" as any)} />
          <ActionBtn icon="cash-outline" label="Gains" onPress={() => router.push("/paybid/(tabs)/earnings" as any)} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ icon, label, value }: any) {
  return (
    <View style={styles.stat}>
      <View style={styles.statIcon}><Ionicons name={icon} size={18} color={paybidColors.primary.base} /></View>
      <TText variant="title" weight="extraBold" color={paybidColors.primary.base}>{value}</TText>
      <TText variant="label" color={paybidColors.neutrals.textSecondary} align="center">{label}</TText>
    </View>
  );
}
function SectionHeader({ title, onSeeAll }: any) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: spacing.xl, marginBottom: 8 }}>
      <TText variant="subtitle" weight="bold">{title}</TText>
      {onSeeAll ? (<TouchableOpacity onPress={onSeeAll}><TText variant="caption" weight="bold" color={paybidColors.primary.base}>Voir plus</TText></TouchableOpacity>) : null}
    </View>
  );
}
function Empty({ label }: any) { return (<View style={styles.empty}><TText color={paybidColors.neutrals.textSecondary}>{label}</TText></View>); }
function ActionBtn({ icon, label, onPress }: any) {
  return (
    <TouchableOpacity style={styles.actionBtn} onPress={onPress}>
      <View style={styles.actionIcon}><Ionicons name={icon} size={20} color={paybidColors.primary.base} /></View>
      <TText variant="caption" weight="bold">{label}</TText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  heroCard: { padding: spacing.lg, borderRadius: radii.xxl },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  logoChip: { width: 44, height: 44, borderRadius: radii.lg, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  statsRow: { flexDirection: "row", gap: 10, marginTop: spacing.md },
  stat: { flex: 1, padding: spacing.md, backgroundColor: paybidColors.neutrals.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: paybidColors.neutrals.border, alignItems: "center" },
  statIcon: { width: 36, height: 36, borderRadius: radii.full, backgroundColor: paybidColors.overlays.primarySoft, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  row: { flexDirection: "row", alignItems: "center", padding: 12, backgroundColor: paybidColors.neutrals.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: paybidColors.neutrals.border, marginBottom: 8 },
  rowIcon: { width: 40, height: 40, borderRadius: radii.full, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", padding: spacing.lg, backgroundColor: paybidColors.neutrals.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: paybidColors.neutrals.border },
  actionBtn: { flex: 1, alignItems: "center", padding: spacing.md, backgroundColor: paybidColors.neutrals.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: paybidColors.neutrals.border },
  actionIcon: { width: 40, height: 40, borderRadius: radii.full, backgroundColor: paybidColors.overlays.primarySoft, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  floatCard: { marginTop: spacing.md, borderRadius: radii.xxl, overflow: "hidden" },
  floatInner: { flexDirection: "row", alignItems: "center", padding: spacing.md },
  floatIcon: { width: 44, height: 44, borderRadius: radii.full, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
});
