import React, { useCallback, useState, useMemo, Fragment } from "react";
import * as Clipboard from "expo-clipboard";
import { View, StyleSheet, TouchableOpacity, RefreshControl, FlatList, Modal, Alert } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { TText } from "../../src/components/TText";
import { StatusChip } from "../../src/components/StatusChip";
import { api } from "../../src/api";
import { colors, spacing, radii, shadows } from "../../src/theme";
import { useTranslation } from "../../src/i18n";

const CATEGORIES = [
  { key: "all", label: "Tous" },
  { key: "sent", label: "Envoyés" },
  { key: "received", label: "Reçus" },
  { key: "in_progress", label: "En cours" },
  { key: "done", label: "Terminés" },
];

const PERIODS = [
  { key: "day", label: "Jour" },
  { key: "week", label: "Sem." },
  { key: "month", label: "Mois" },
  { key: "quarter", label: "Trim." },
];

const IN_PROGRESS = ["DRAFT", "PENDING_PAYMENT", "BIDDING", "AGENT_ASSIGNED", "PROCESSING", "PROCESSING_BANK", "PROCESSING_MOMO", "READY_FOR_PICKUP", "VIP_DELIVERY"];
const DONE = ["COMPLETED", "EXPIRED", "CANCELLED_USER", "FAILED"];

export default function Transfers() {
  const { t } = useTranslation();
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
      <LinearGradient colors={["#00147E", "#3D52D5"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <SafeAreaView edges={["top"]}>
          <View style={styles.heroTop}>
            <View style={{ flex: 1 }}>
              <TText variant="title" weight="extraBold" color="white">Mes transferts</TText>
            </View>
            <TouchableOpacity testID="transfers-menu" onPress={() => setShowMenu(true)} hitSlop={10} style={styles.iconBtn}>
              <Ionicons name="menu" size={20} color="white" />
            </TouchableOpacity>
          </View>

          {/* Mini stats row */}
          <View style={styles.statsRow}>
            <StatTile label="Total" value={String(list.length)} icon="layers-outline" />
            <StatTile label="En cours" value={String(inProgressCount)} icon="flash-outline" tint="#F59E0B" />
            <StatTile label="Terminés" value={String(doneCount)} icon="checkmark-done-outline" tint="#5CE1A6" />
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* === Segment bar : Tous / Envoyés / Reçus / En cours / Terminés === */}
      <View style={styles.quickWrap}>
        <View style={styles.segRow}>
          {CATEGORIES.map((c) => (
            <TouchableOpacity key={c.key} testID={`tab-${c.key}`} onPress={() => setCat(c.key)} style={[styles.segTab, cat === c.key && styles.segTabActive]}>
              <TText variant="label" weight="bold" color={cat === c.key ? "white" : colors.neutrals.textPrimary}>{c.label}</TText>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* === Content === */}
      <View style={styles.content}>
        {/* Titre */}
        <View style={styles.listHead}>
          <TText variant="caption" weight="extraBold" color={colors.neutrals.textSecondary} style={{ letterSpacing: 1 }}>TRANSFERTS RÉCENTS</TText>
        </View>

        {/* Period filter chips — réplique exacte de la page Portefeuille */}
        <View style={styles.periodRow}>
          {PERIODS.map((p) => (
            <TouchableOpacity key={p.key} testID={`period-${p.key}`} onPress={() => setPeriod(p.key)} style={[styles.pChip, period === p.key && styles.pChipActive]}>
              <TText variant="label" weight="bold" color={period === p.key ? "white" : colors.neutrals.textPrimary}>{p.label}</TText>
            </TouchableOpacity>
          ))}
        </View>

        <TransferGroupedList
          transfers={filtered}
          showAll={showAll}
          onShowAll={() => setShowAll(true)}
          onRefresh={load}
          refreshing={refreshing}
          onPress={(id) => router.push({ pathname: "/transfer/[id]", params: { id } })}
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
            <MenuItem icon="card-outline" label="Moyens de paiement" onPress={() => { setShowMenu(false); router.push("/payment-methods" as any); }} />
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

function TransferGroupedList({ transfers, showAll, onShowAll, onRefresh, refreshing, onPress }: {
  transfers: any[]; showAll: boolean; onShowAll: () => void;
  onRefresh: () => void; refreshing: boolean; onPress: (id: string) => void;
}) {
  const STATUS_LABELS: Record<string, string> = {
    DRAFT: "Brouillon", BIDDING: "Enchères", AGENT_ASSIGNED: "Assigné",
    PROCESSING: "En transit", PROCESSING_BANK: "En transit", PROCESSING_MOMO: "En transit",
    READY_FOR_PICKUP: "Prêt", IN_DELIVERY: "En remise", VIP_DELIVERY: "VIP",
    COMPLETED: "Livré", EXPIRED: "Expiré", CANCELLED_USER: "Annulé", FAILED: "Échoué",
  };

  const todayStr = new Date().toDateString();
  const yesterdayStr = new Date(Date.now() - 86400000).toDateString();

  function dateLabel(dateStr: string): string {
    const d = new Date(dateStr);
    const ds = d.toDateString();
    if (ds === todayStr) return "AUJOURD'HUI";
    if (ds === yesterdayStr) return "HIER";
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" }).toUpperCase();
  }

  const visible = showAll ? transfers : transfers.slice(0, 5);

  // Grouper par label de date
  const groups: { label: string; items: any[] }[] = [];
  for (const item of visible) {
    const label = dateLabel(item.created_at);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }

  if (transfers.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="diamond-outline" size={48} color={colors.neutrals.textTertiary} />
        <TText variant="body" weight="semiBold" color={colors.neutrals.textSecondary} style={{ marginTop: 10 }}>Aucun transfert</TText>
        <TText variant="caption" color={colors.neutrals.textTertiary} align="center" style={{ marginTop: 4 }}>Commencez votre premier transfert en un clic</TText>
      </View>
    );
  }

  return (
    <FlatList
      data={groups}
      keyExtractor={(g) => g.label}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary.base} />}
      contentContainerStyle={{ paddingBottom: spacing.xxxl }}
      ListFooterComponent={
        transfers.length > 5 && !showAll ? (
          <TouchableOpacity testID="transfers-show-more" onPress={onShowAll} style={styles.showMore}>
            <TText variant="caption" weight="extraBold" color={colors.primary.base}>Voir {transfers.length - 5} transferts de plus</TText>
            <Ionicons name="chevron-forward" size={14} color={colors.primary.base} style={{ marginLeft: 4 }} />
          </TouchableOpacity>
        ) : null
      }
      renderItem={({ item: group }) => (
        <Fragment key={group.label}>
          {/* En-tête de groupe date */}
          <TText variant="label" weight="extraBold" color={colors.neutrals.textSecondary}
            style={{ letterSpacing: 1, marginTop: 14, marginBottom: 6, paddingHorizontal: 2 }}>
            {group.label}
          </TText>
          {group.items.map((item) => {
            const statusLabel = STATUS_LABELS[item.status] || item.status;
            const date = new Date(item.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
            const rawAmount = Number(item.send_amount) || 0;
            const isPositive = item.is_received === true || rawAmount < 0;
            const amount = isPositive
              ? `+${Math.abs(rawAmount).toLocaleString("fr-FR")} ${item.sender_currency || "EUR"}`
              : `−${rawAmount.toLocaleString("fr-FR")} ${item.sender_currency || "EUR"}`;
            const amountColor = isPositive ? colors.status.success : colors.status.error;
            const isCashPending = item.is_received && item.delivery_mode === "cash" && item.status !== "COMPLETED" && item.withdrawal_code;
            return (
              <TouchableOpacity key={item.id} testID={`transfer-row-${item.id}`}
                style={[styles.row, item.is_received && { borderColor: colors.status.success + "55", borderWidth: 1.5 }]}
                onPress={() => onPress(item.id)}>

                {/* Avatar / icône */}
                <View style={[styles.avatar, item.is_received && { backgroundColor: colors.status.success + "22" }]}>
                  {item.is_received
                    ? <Ionicons name="arrow-down-circle" size={22} color={colors.status.success} />
                    : <TText weight="extraBold" color="#4B5563" style={{ fontSize: 14, letterSpacing: 0.5 }}>
                        {(item.beneficiary?.full_name || "? ?").split(" ").filter(Boolean).slice(0, 2).map((w: string) => w[0].toUpperCase()).join("")}
                      </TText>
                  }
                </View>

                {/* Infos centre */}
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <TText variant="body" weight="semiBold" numberOfLines={1} style={{ flex: 1 }}>
                      {item.is_received ? (item.user_name || item.beneficiary?.full_name || "Expéditeur") : (item.beneficiary?.full_name || "—")}
                    </TText>
                    {item.is_received && (
                      <View style={styles.receivedBadge}>
                        <TText variant="label" weight="extraBold" color="white">REÇU</TText>
                      </View>
                    )}
                  </View>
                  <TText variant="caption" color={colors.neutrals.textSecondary} style={{ marginTop: 2 }}>
                    {statusLabel} · {item.destination_country}
                  </TText>
                  {/* Code de retrait visible directement si transfert reçu en espèces en attente */}
                  {isCashPending && (
                    <TouchableOpacity
                      style={styles.codeStrip}
                      onPress={async () => {
                        await Clipboard.setStringAsync(item.withdrawal_code);
                        Alert.alert("Copié !", `Code ${item.withdrawal_code} copié dans le presse-papier.`);
                      }}
                    >
                      <Ionicons name="key-outline" size={13} color="#065F46" />
                      <TText variant="label" weight="extraBold" color="#065F46" style={{ marginLeft: 4 }}>
                        Code : {item.withdrawal_code}
                      </TText>
                      <Ionicons name="copy-outline" size={13} color="#065F46" style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Montant + date alignés à droite */}
                <View style={{ alignItems: "flex-end", marginLeft: 8, flexShrink: 0 }}>
                  <TText variant="body" weight="extraBold" color={amountColor}>
                    {item.is_received
                      ? `+${Number(item.receive_amount || 0).toLocaleString("fr-FR")} ${item.destination_currency || ""}`
                      : amount}
                  </TText>
                  <TText variant="label" color={colors.neutrals.textTertiary} style={{ marginTop: 2 }}>{date}</TText>
                </View>
              </TouchableOpacity>
            );
          })}
        </Fragment>
      )}
    />
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
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#E5E7EB", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  empty: { alignItems: "center", paddingVertical: spacing.xxxl, paddingHorizontal: spacing.lg },
  emptyCta: { marginTop: spacing.lg, flexDirection: "row", alignItems: "center", backgroundColor: colors.primary.base, paddingHorizontal: 18, paddingVertical: 11, borderRadius: radii.full },

  menuOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-start", alignItems: "flex-end", paddingTop: 80, paddingRight: 12 },
  menu: { backgroundColor: "white", borderRadius: radii.xl, padding: 4, minWidth: 210, elevation: 6 },
  menuItem: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 8 },
  receivedBadge: { backgroundColor: colors.status.success, borderRadius: radii.full, paddingHorizontal: 6, paddingVertical: 2 },
  codeStrip: { flexDirection: "row", alignItems: "center", marginTop: 4, backgroundColor: "#D1FAE5", borderRadius: radii.md, paddingHorizontal: 8, paddingVertical: 4, alignSelf: "flex-start" },
});
