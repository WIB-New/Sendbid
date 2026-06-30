import React, { useCallback, useMemo, useState } from "react";
import { View, StyleSheet, FlatList, RefreshControl, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { TText } from "../../../src/components/TText";
import { api } from "../../../src/api";
import { useThemedPaybidColors } from "../../../src/themeContext";
import { paybidColors } from "../../../src/paybidTheme";
import { spacing, radii } from "../../../src/theme";

/* ─── Config filtres ─── */
const FILTERS = [
  {
    key: "active",
    label: "En cours",
    icon: "sync-outline" as const,
    color: "#3B82F6",
    statuses: ["AGENT_ASSIGNED", "PROCESSING", "READY_FOR_PICKUP", "VIP_DELIVERY"],
  },
  {
    key: "done",
    label: "Terminés",
    icon: "checkmark-done-circle-outline" as const,
    color: "#10B981",
    statuses: ["COMPLETED"],
  },
  {
    key: "unanswered",
    label: "Non répondus",
    icon: "time-outline" as const,
    color: "#F59E0B",
    statuses: ["PENDING", "AWAITING_AGENT"],
  },
  {
    key: "declined",
    label: "Déclinés",
    icon: "close-circle-outline" as const,
    color: "#EF4444",
    statuses: ["CANCELLED_USER", "FAILED", "EXPIRED", "CANCELED", "DECLINED"],
  },
  {
    key: "all",
    label: "Tous",
    icon: "list-outline" as const,
    color: "#6366F1",
    statuses: [],
  },
];

/* ─── Statut → meta visuel ─── */
const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  AGENT_ASSIGNED:   { label: "Assigné",         color: "#F59E0B", bg: "#FEF3C7", icon: "hourglass-outline" },
  PROCESSING:       { label: "En cours",         color: "#3B82F6", bg: "#DBEAFE", icon: "sync-outline" },
  READY_FOR_PICKUP: { label: "Prêt retrait",     color: "#F97316", bg: "#FFEDD5", icon: "cube-outline" },
  VIP_DELIVERY:     { label: "Livraison VIP",    color: "#7C3AED", bg: "#EDE9FE", icon: "rocket-outline" },
  COMPLETED:        { label: "Terminé",          color: "#10B981", bg: "#D1FAE5", icon: "checkmark-done-circle" },
  PENDING:          { label: "En attente",       color: "#F59E0B", bg: "#FEF3C7", icon: "time-outline" },
  AWAITING_AGENT:   { label: "Non répondu",      color: "#F59E0B", bg: "#FEF3C7", icon: "alert-circle-outline" },
  CANCELLED_USER:   { label: "Annulé",           color: "#EF4444", bg: "#FEE2E2", icon: "close-circle-outline" },
  FAILED:           { label: "Échoué",           color: "#EF4444", bg: "#FEE2E2", icon: "close-circle-outline" },
  EXPIRED:          { label: "Expiré",           color: "#9CA3AF", bg: "#F3F4F6", icon: "timer-outline" },
  CANCELED:         { label: "Annulé",           color: "#EF4444", bg: "#FEE2E2", icon: "close-circle-outline" },
  DECLINED:         { label: "Décliné",          color: "#EF4444", bg: "#FEE2E2", icon: "thumbs-down-outline" },
};

function statusMeta(s: string) {
  return STATUS_META[s] ?? { label: s, color: "#6B7280", bg: "#F3F4F6", icon: "help-circle-outline" };
}

function fmtDate(iso?: string) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffH = (now.getTime() - d.getTime()) / 3600000;
    if (diffH < 1) return `il y a ${Math.round(diffH * 60)} min`;
    if (diffH < 24) return `il y a ${Math.round(diffH)}h`;
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  } catch { return iso; }
}

function fmtMoney(amount: any, currency?: string) {
  const n = Number(amount);
  if (isNaN(n)) return "—";
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + (currency ? ` ${currency}` : "");
}

/* ─── Card transfert ─── */
function TransferCard({ item, onPress }: { item: any; onPress: () => void }) {
  const meta = statusMeta(item.status);
  const isActive = ["AGENT_ASSIGNED", "PROCESSING", "READY_FOR_PICKUP", "VIP_DELIVERY"].includes(item.status);
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      {/* Ligne 1 : icône + bénéficiaire + montant */}
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={[styles.cardIcon, { backgroundColor: meta.bg }]}>
          <Ionicons name={meta.icon} size={18} color={meta.color} />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <TText weight="extraBold" numberOfLines={1} style={{ fontSize: 15 }}>
            {item.beneficiary?.full_name || item.beneficiary_name || "—"}
          </TText>
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2, gap: 6 }}>
            <TText variant="caption" color={paybidColors.neutrals.textSecondary} numberOfLines={1}>
              {item.destination_country || "—"}
            </TText>
            {item.destination_city ? (
              <>
                <View style={styles.dot} />
                <TText variant="caption" color={paybidColors.neutrals.textSecondary} numberOfLines={1}>
                  {item.destination_city}
                </TText>
              </>
            ) : null}
          </View>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <TText weight="extraBold" color={meta.color} style={{ fontSize: 15 }}>
            {fmtMoney(item.receive_amount, item.destination_currency)}
          </TText>
          <TText variant="label" color={paybidColors.neutrals.textTertiary} style={{ marginTop: 2 }}>
            {fmtDate(item.created_at)}
          </TText>
        </View>
      </View>

      {/* Ligne 2 : badge statut + code retrait + flèche */}
      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6, gap: 6 }}>
        <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
          <TText variant="label" weight="bold" color={meta.color}>{meta.label}</TText>
        </View>
        {item.withdrawal_code && (
          <View style={styles.codeBadge}>
            <Ionicons name="key-outline" size={11} color="#6366F1" />
            <TText variant="label" weight="bold" color="#6366F1" style={{ marginLeft: 4 }}>
              #{item.withdrawal_code}
            </TText>
          </View>
        )}
        {item.send_amount && (
          <TText variant="label" color={paybidColors.neutrals.textTertiary} style={{ flex: 1, textAlign: "right" }}>
            Envoyé : {fmtMoney(item.send_amount, item.send_currency || "EUR")}
          </TText>
        )}
        {isActive && (
          <Ionicons name="chevron-forward" size={14} color={meta.color} />
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function PaybidTransfers() {
  const colors = useThemedPaybidColors();
  const router = useRouter();
  const [list, setList] = useState<any[]>([]);
  const [filter, setFilter] = useState("active");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const { data } = await api.get("/agent/transfers");
      setList(Array.isArray(data) ? data : data?.items || []);
    } catch {}
    setRefreshing(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  /* Compter par filtre */
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    FILTERS.forEach(f => {
      c[f.key] = f.key === "all"
        ? list.length
        : list.filter(t => f.statuses.includes(t.status)).length;
    });
    return c;
  }, [list]);

  const filtered = useMemo(() => {
    const f = FILTERS.find(f => f.key === filter)!;
    if (f.key === "all") return list;
    return list.filter(t => f.statuses.includes(t.status));
  }, [list, filter]);

  const activeFilter = FILTERS.find(f => f.key === filter)!;

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.neutrals.background }}>

      {/* ── Header + filtres (bloc unique sans espace) ── */}
      <View style={{ paddingTop: spacing.md }}>
        <View style={{ paddingHorizontal: spacing.lg, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <TText variant="title" weight="extraBold">Mes transferts</TText>
          <TouchableOpacity
            onPress={() => router.push("/paybid/(tabs)/auctions" as any)}
            style={styles.liveChip}
          >
            <Ionicons name="flash" size={13} color="#F59E0B" />
            <TText variant="label" weight="extraBold" color="#F59E0B" style={{ marginLeft: 4 }}>Offres live</TText>
          </TouchableOpacity>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ height: 46 }}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, alignItems: "center" }}
        >
        {FILTERS.map((f, idx) => {
          const active = filter === f.key;
          const count = counts[f.key] || 0;
          const isLast = idx === FILTERS.length - 1;
          return (
            <TouchableOpacity
              key={f.key}
              onPress={() => setFilter(f.key)}
              activeOpacity={0.75}
              style={[
                styles.filterChip,
                { marginRight: isLast ? 0 : 8 },
                active
                  ? { backgroundColor: f.color, borderColor: f.color }
                  : { backgroundColor: colors.neutrals.surface, borderColor: colors.neutrals.border },
              ]}
            >
              <Ionicons name={f.icon} size={14} color={active ? "white" : f.color} />
              <TText
                variant="label"
                weight="bold"
                color={active ? "white" : colors.neutrals.textPrimary}
                style={{ marginLeft: 5, flexShrink: 0 }}
                numberOfLines={1}
              >
                {f.label}
              </TText>
              {count > 0 && (
                <View style={[styles.countBadge, { backgroundColor: active ? "rgba(255,255,255,0.3)" : f.color + "22" }]}>
                  <TText variant="label" weight="extraBold" color={active ? "white" : f.color} style={{ fontSize: 10 }}>
                    {count}
                  </TText>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      </View>

      {/* ── Liste ── */}
      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 30 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={paybidColors.primary.base} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: activeFilter.color + "18" }]}>
              <Ionicons name={activeFilter.icon} size={32} color={activeFilter.color} />
            </View>
            <TText variant="subtitle" weight="bold" style={{ marginTop: 14 }}>
              Aucun transfert
            </TText>
            <TText variant="caption" color={colors.neutrals.textSecondary} style={{ marginTop: 6, textAlign: "center" }}>
              Aucune mission dans la catégorie "{activeFilter.label}"
            </TText>
          </View>
        }
        renderItem={({ item }) => (
          <TransferCard
            item={item}
            onPress={() => router.push({ pathname: "/paybid/transfer/[id]" as any, params: { id: item.id } })}
          />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  /* Chip live dans le header */
  liveChip: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#FEF3C7", borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: "#F59E0B55",
  },

  /* Filtres */
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
  },
  countBadge: {
    marginLeft: 6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },

  /* Cards */
  card: {
    backgroundColor: paybidColors.neutrals.surface,
    borderRadius: radii.xl, borderWidth: 1,
    borderColor: paybidColors.neutrals.border,
    padding: 11, marginBottom: 7,
  },
  cardIcon: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: paybidColors.neutrals.textTertiary },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  codeBadge: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#EEF2FF", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
  },

  /* Empty */
  empty: { alignItems: "center", paddingVertical: 60, paddingHorizontal: 40 },
  emptyIcon: { width: 68, height: 68, borderRadius: 34, alignItems: "center", justifyContent: "center" },
});
