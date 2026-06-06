import React, { useCallback, useState, useMemo } from "react";
import { View, StyleSheet, TouchableOpacity, RefreshControl, FlatList, Modal } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { TText } from "../../src/components/TText";
import { StatusChip } from "../../src/components/StatusChip";
import { api } from "../../src/api";
import { t, useLocale } from "../../src/i18n";
import { colors, spacing, radii, shadows } from "../../src/theme";
import { useThemedColors } from "../../src/themeContext";

const CATEGORIES = [
  { key: "all", labelKey: "transfers.cats.all" },
  { key: "sent", labelKey: "transfers.cats.sent" },
  { key: "received", labelKey: "transfers.cats.received" },
  { key: "in_progress", labelKey: "transfers.cats.inProgress" },
  { key: "done", labelKey: "transfers.cats.done" },
];

const PERIODS = [
  { key: "day", labelKey: "wallet.period.day" },
  { key: "week", labelKey: "wallet.period.week" },
  { key: "month", labelKey: "wallet.period.month" },
  { key: "quarter", labelKey: "wallet.period.quarter" },
];

const IN_PROGRESS = ["DRAFT", "PENDING_PAYMENT", "BIDDING", "AGENT_ASSIGNED", "PROCESSING", "PROCESSING_BANK", "PROCESSING_MOMO", "READY_FOR_PICKUP", "VIP_DELIVERY"];
const DONE = ["COMPLETED", "EXPIRED", "CANCELLED_USER", "FAILED"];

export default function Transfers() {
  useLocale((st) => st.locale);
  const router = useRouter();
  const [cat, setCat] = useState<string>("all");
  const [period, setPeriod] = useState<string>("month");
  const [list, setList] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const { data } = await api.get("/transfers");
      setList(data || []);
    } catch {}
    setRefreshing(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = useMemo(() => {
    let items = list;
    const myId = (typeof window !== "undefined" && (window as any).__SB_USER_ID__) || null;
    if (cat === "in_progress") items = items.filter((t) => IN_PROGRESS.includes(t.status));
    else if (cat === "done") items = items.filter((t) => DONE.includes(t.status));
    else if (cat === "sent") items = items.filter((t) => !t.is_received);
    else if (cat === "received") items = items.filter((t) => t.is_received === true);
    if (period) {
      const days = period === "day" ? 1 : period === "week" ? 7 : period === "month" ? 30 : 90;
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      items = items.filter((t) => new Date(t.created_at).getTime() >= cutoff);
    }
    return items;
  }, [cat, period, list]);

  const inProgressCount = useMemo(() => list.filter((t) => IN_PROGRESS.includes(t.status)).length, [list]);
  const doneCount = useMemo(() => list.filter((t) => DONE.includes(t.status)).length, [list]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.neutrals.background }}>
      {/* === Hero header (imperial blue gradient) === */}
      <LinearGradient colors={["#022a6b", "#052080"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <SafeAreaView edges={["top"]}>
          <View style={styles.heroTop}>
            <View style={{ flex: 1 }}>
              <TText variant="title" weight="extraBold" color="white">{t("transfers.title")}</TText>
            </View>
            <TouchableOpacity testID="transfers-menu" onPress={() => setShowMenu(true)} hitSlop={10} style={styles.iconBtn}>
              <Ionicons name="menu" size={20} color="white" />
            </TouchableOpacity>
          </View>

          {/* Mini stats row */}
          <View style={styles.statsRow}>
            <StatTile label={t("transfers.stats.total")} value={String(list.length)} icon="layers-outline" />
            <StatTile label={t("transfers.stats.inProgress")} value={String(inProgressCount)} icon="flash-outline" tint="#F59E0B" />
            <StatTile label={t("transfers.stats.done")} value={String(doneCount)} icon="checkmark-done-outline" tint="#5CE1A6" />
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* === Segment bar : Tous / Envoyés / Reçus / En cours / Terminés === */}
      <View style={styles.quickWrap}>
        <View style={styles.segRow}>
          {CATEGORIES.map((c) => (
            <TouchableOpacity key={c.key} testID={`tab-${c.key}`} onPress={() => setCat(c.key)} style={[styles.segTab, cat === c.key && styles.segTabActive]}>
              <TText variant="label" weight="bold" color={cat === c.key ? "white" : colors.neutrals.textPrimary}>{t(c.labelKey)}</TText>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* === Content === */}
      <View style={styles.content}>
        {/* Titre + CTA Nouveau transfert */}
        <View style={styles.listHead}>
          <TText variant="caption" weight="bold" color={colors.neutrals.textSecondary} style={{ letterSpacing: 0.3, fontSize: 11 }}>{t("transfers.recent")}</TText>
          <TouchableOpacity testID="transfers-new-cta" onPress={() => router.push("/transfer/new")} style={styles.newCta}>
            <Ionicons name="add-circle" size={16} color={colors.primary.base} />
            <TText variant="caption" weight="extraBold" color={colors.primary.base} style={{ marginLeft: 4 }}>{t("transfers.new")}</TText>
          </TouchableOpacity>
        </View>

        {/* Period filter chips — réplique exacte de la page Portefeuille */}
        <View style={styles.periodRow}>
          {PERIODS.map((p) => (
            <TouchableOpacity key={p.key} testID={`period-${p.key}`} onPress={() => setPeriod(p.key)} style={[styles.pChip, period === p.key && styles.pChipActive]}>
              <TText variant="label" weight="bold" color={period === p.key ? "white" : colors.neutrals.textPrimary}>{t(p.labelKey)}</TText>
            </TouchableOpacity>
          ))}
        </View>

        <FlatList
          data={filtered.slice(0, showAll ? filtered.length : 5)}
          keyExtractor={(i) => i.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.primary.base} />}
          contentContainerStyle={{ paddingBottom: 30 }}
          ListFooterComponent={
            filtered.length > 5 && !showAll ? (
              <TouchableOpacity testID="transfers-show-more" onPress={() => setShowAll(true)} style={styles.showMore}>
                <TText variant="caption" weight="extraBold" color={colors.primary.base}>Voir plus ({filtered.length - 5} transferts)</TText>
                <Ionicons name="chevron-down" size={14} color={colors.primary.base} style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="diamond-outline" size={48} color={colors.neutrals.textTertiary} />
              <TText variant="body" weight="semiBold" color={colors.neutrals.textSecondary} style={{ marginTop: 10 }}>{t("transfers.none")}</TText>
              <TText variant="caption" color={colors.neutrals.textTertiary} align="center" style={{ marginTop: 4 }}>Commencez votre premier transfert en un clic</TText>
              <TouchableOpacity onPress={() => router.push("/transfer/new")} style={styles.emptyCta}>
                <Ionicons name="add" size={18} color="white" />
                <TText weight="bold" color="white" style={{ marginLeft: 6 }}>{t("transfers.new")}</TText>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity testID={`transfer-row-${item.id}`} style={styles.row} onPress={() => router.push({ pathname: "/transfer/[id]", params: { id: item.id } })}>
              <View style={styles.icon}><Ionicons name="diamond" size={18} color={colors.primary.base} /></View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <TText variant="body" weight="semiBold">{item.beneficiary?.full_name || "—"}</TText>
                <TText variant="caption" color={colors.neutrals.textSecondary}>{item.destination_country} • {item.delivery_mode?.toUpperCase()}{item.vip_delivery ? " • VIP" : ""}</TText>
                <View style={{ marginTop: 4 }}><StatusChip status={item.status} /></View>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <TText weight="bold">{item.send_amount.toFixed(2)} EUR</TText>
                <TText variant="caption" color={colors.neutrals.textTertiary}>{item.receive_amount.toFixed(0)} {item.destination_currency}</TText>
              </View>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Floating action menu */}
      <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setShowMenu(false)}>
          <View style={styles.menu}>
            <MenuItem icon="search-outline" label="Vérifier un transfert" onPress={() => { setShowMenu(false); router.push("/verify-transfer" as any); }} />
            <MenuItem icon="document-text-outline" label="Mes reçus" onPress={() => { setShowMenu(false); router.push("/receipts" as any); }} />
            <MenuItem icon="warning-outline" label="Déclarer un litige" onPress={() => { setShowMenu(false); router.push("/disputes/new" as any); }} />
            <MenuItem icon="speedometer-outline" label="Mes limites" onPress={() => { setShowMenu(false); router.push("/limits" as any); }} />
            <MenuItem icon="people-outline" label="Mes bénéficiaires" onPress={() => { setShowMenu(false); router.push("/beneficiaries" as any); }} />
            <MenuItem icon="card-outline" label={t("services.paymentMethods")} onPress={() => { setShowMenu(false); router.push("/payment-methods" as any); }} />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function StatTile({ label, value, icon, tint }: { label: string; value: string; icon: any; tint?: string }) {
  return (
    <View style={styles.stat}>
      <View style={[styles.statIcon, { backgroundColor: (tint || "#5CE1A6") + "22" }]}>
        <Ionicons name={icon} size={16} color={tint || "white"} />
      </View>
      <View style={{ marginLeft: 10 }}>
        <TText variant="caption" color="rgba(255,255,255,0.7)">{label}</TText>
        <TText variant="body" weight="extraBold" color="white">{value}</TText>
      </View>
    </View>
  );
}

function QuickBtn({ icon, label, accent, onPress }: { icon: any; label: string; accent: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.quick} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.quickIcon, { backgroundColor: accent + "18" }]}>
        <Ionicons name={icon} size={22} color={accent} />
      </View>
      <TText variant="caption" weight="bold" align="center" style={{ marginTop: 6 }}>{label}</TText>
    </TouchableOpacity>
  );
}

function MenuItem({ icon, label, onPress }: { icon: any; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <Ionicons name={icon} size={16} color={colors.primary.base} />
      <TText variant="caption" weight="semiBold" style={{ marginLeft: 8 }}>{label}</TText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: spacing.lg, paddingTop: 4, paddingBottom: spacing.xxl, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  heroTop: { flexDirection: "row", alignItems: "center", marginTop: spacing.sm },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" },
  statsRow: { flexDirection: "row", gap: 8, marginTop: spacing.lg },
  stat: { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.10)", borderRadius: radii.lg, padding: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  statIcon: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },

  quickWrap: { paddingHorizontal: spacing.lg, marginTop: -spacing.xl, zIndex: 2 },
  quickRow: { flexDirection: "row", gap: 8, backgroundColor: colors.neutrals.surface, padding: 10, borderRadius: radii.xxl, ...shadows.md },
  quick: { flex: 1, alignItems: "center", paddingVertical: 8 },
  quickIcon: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },

  content: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  listHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  newCta: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.full, backgroundColor: colors.overlays.primarySoft },
  showMore: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 12, marginTop: 6, backgroundColor: colors.neutrals.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.neutrals.border },
  segRow: { flexDirection: "row", gap: 4, backgroundColor: colors.neutrals.surface, padding: 4, borderRadius: radii.full, ...shadows.md },
  segTab: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: radii.full },
  segTabActive: { backgroundColor: colors.primary.base },
  tabsRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: radii.full, backgroundColor: colors.neutrals.surface, borderWidth: 1, borderColor: colors.neutrals.border, alignItems: "center" },
  tabActive: { backgroundColor: colors.primary.base, borderColor: colors.primary.base },
  periodRow: { flexDirection: "row", gap: 6, marginBottom: 10, paddingHorizontal: 4 },
  pChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radii.full, borderWidth: 1, borderColor: colors.neutrals.border, backgroundColor: colors.neutrals.surface },
  pChipActive: { backgroundColor: colors.primary.base, borderColor: colors.primary.base },
  row: { flexDirection: "row", alignItems: "center", padding: 12, backgroundColor: colors.neutrals.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.neutrals.border, marginBottom: 8 },
  icon: { width: 40, height: 40, borderRadius: radii.full, backgroundColor: colors.overlays.primarySoft, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", paddingVertical: spacing.xxxl, paddingHorizontal: spacing.lg },
  emptyCta: { marginTop: spacing.lg, flexDirection: "row", alignItems: "center", backgroundColor: colors.primary.base, paddingHorizontal: 18, paddingVertical: 11, borderRadius: radii.full },

  menuOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-start", alignItems: "flex-end", paddingTop: 80, paddingRight: 12 },
  menu: { backgroundColor: "white", borderRadius: radii.xl, padding: 4, minWidth: 210, elevation: 6 },
  menuItem: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 8 },
});
