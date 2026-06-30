/**
 * /paybid/movements.tsx — Liste COMPLÈTE des mouvements de caisse (item 4).
 *
 * Page accessible depuis /paybid/(tabs)/account.tsx via "Voir tout".
 * Permet de consulter TOUS les mouvements (pas seulement les 5 derniers).
 * Chaque ligne est cliquable et ouvre une modale détail.
 */
import React, { useCallback, useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { TText } from "../../src/components/TText";
import { Button } from "../../src/components/Button";
import { api } from "../../src/api";
import { paybidColors } from "../../src/paybidTheme";
import { spacing, radii } from "../../src/theme";
import { formatMoney } from "../../src/utils/money";
import { useTranslation } from "../../src/i18n";

type Movement = {
  id: string;
  type?: string;
  movement_type?: string;
  amount_signed?: number;
  amount?: number;
  currency?: string;
  created_at?: string;
  note?: string;
  reference?: string;
  agent_id?: string;
};

export default function PaybidMovements() {
  const { t } = useTranslation();
  const router = useRouter();
  const [items, setItems] = useState<Movement[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail] = useState<Movement | null>(null);
  const [filter, setFilter] = useState<"all" | "in" | "out">("all");

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const r = await api.get("/agent/float/movements?limit=200");
      setItems(r.data?.items || r.data || []);
    } catch {}
    finally { setRefreshing(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = items.filter((m) => {
    if (filter === "all") return true;
    const sign = Number(m.amount_signed ?? m.amount ?? 0);
    return filter === "in" ? sign >= 0 : sign < 0;
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: paybidColors.neutrals.background }} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={paybidColors.neutrals.textPrimary} />
        </TouchableOpacity>
        <TText variant="title" weight="extraBold" style={{ marginLeft: 6 }}>Mes mouvements</TText>
      </View>

      <View style={styles.filterRow}>
        {(["all", "in", "out"] as const).map((k) => (
          <TouchableOpacity key={k} onPress={() => setFilter(k)} style={[styles.chip, filter === k && { backgroundColor: paybidColors.primary.base, borderColor: paybidColors.primary.base }]}>
            <TText variant="caption" weight="extraBold" color={filter === k ? "white" : paybidColors.neutrals.textPrimary}>
              {k === "all" ? "Tous" : k === "in" ? "Entrées" : "Sorties"}
            </TText>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}>
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="file-tray-outline" size={42} color={paybidColors.neutrals.textTertiary} />
            <TText variant="caption" color={paybidColors.neutrals.textSecondary} style={{ marginTop: 8 }}>Aucun mouvement</TText>
          </View>
        ) : (
          filtered.map((m) => {
            const sign = Number(m.amount_signed ?? m.amount ?? 0);
            return (
              <TouchableOpacity key={m.id} onPress={() => setDetail(m)} style={styles.row} activeOpacity={0.7}>
                <View style={[styles.iconWrap, { backgroundColor: sign >= 0 ? "#ECFDF5" : "#FEF2F2" }]}>
                  <Ionicons name={sign >= 0 ? "arrow-down" : "arrow-up"} size={18} color={sign >= 0 ? "#10B981" : "#EF4444"} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <TText weight="semiBold" style={{ textTransform: "capitalize" }}>
                    {(m.type || m.movement_type || "opération").replace(/_/g, " ")}
                  </TText>
                  <TText variant="caption" color={paybidColors.neutrals.textSecondary}>
                    {m.created_at ? new Date(m.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "—"}
                  </TText>
                </View>
                <TText weight="extraBold" color={sign >= 0 ? "#10B981" : "#EF4444"} style={{ fontSize: 13 }}>
                  {sign >= 0 ? "+" : ""}{formatMoney(Math.abs(sign), m.currency || "XOF")}
                </TText>
                <Ionicons name="chevron-forward" size={14} color={paybidColors.neutrals.textTertiary} style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {detail ? (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <TText weight="extraBold">Détail du mouvement</TText>
              <TouchableOpacity onPress={() => setDetail(null)}>
                <Ionicons name="close" size={22} color={paybidColors.neutrals.textPrimary} />
              </TouchableOpacity>
            </View>
            <View style={[styles.iconWrap, { width: 56, height: 56, borderRadius: 28, alignSelf: "center", marginBottom: 12, backgroundColor: Number(detail.amount_signed ?? 0) >= 0 ? "#ECFDF5" : "#FEF2F2" }]}>
              <Ionicons name={Number(detail.amount_signed ?? 0) >= 0 ? "arrow-down" : "arrow-up"} size={28} color={Number(detail.amount_signed ?? 0) >= 0 ? "#10B981" : "#EF4444"} />
            </View>
            <TText weight="extraBold" align="center" style={{ fontSize: 24 }} color={Number(detail.amount_signed ?? 0) >= 0 ? "#10B981" : "#EF4444"}>
              {Number(detail.amount_signed ?? 0) >= 0 ? "+" : ""}{formatMoney(Math.abs(Number(detail.amount_signed ?? detail.amount ?? 0)), detail.currency || "XOF")}
            </TText>
            <View style={{ marginTop: 16 }}>
              <DetailLine label="Type" value={(detail.type || detail.movement_type || "—").replace(/_/g, " ")} />
              <DetailLine label="Date" value={detail.created_at ? new Date(detail.created_at).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" }) : "—"} />
              <DetailLine label="Devise" value={detail.currency || "—"} />
              {detail.reference ? <DetailLine label="Référence" value={detail.reference} mono /> : null}
              {detail.note ? <DetailLine label="Note" value={detail.note} /> : null}
              <DetailLine label="ID" value={detail.id} mono />
            </View>
            <Button title="Fermer" onPress={() => setDetail(null)} style={{ marginTop: 14, backgroundColor: paybidColors.primary.base }} />
          </View>
        </View>
      ) : null}
    </SafeAreaView>
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
  backBtn: { padding: 6 },
  filterRow: { flexDirection: "row", paddingHorizontal: spacing.lg, marginTop: 10, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: radii.full, borderWidth: 1, borderColor: paybidColors.neutrals.border, backgroundColor: paybidColors.neutrals.surface },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 12, backgroundColor: paybidColors.neutrals.surface, borderRadius: radii.lg, marginBottom: 8, borderWidth: 1, borderColor: paybidColors.neutrals.border },
  iconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", padding: 40 },
  modalOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: spacing.lg, zIndex: 99 },
  modalCard: { width: "100%", maxWidth: 420, backgroundColor: paybidColors.neutrals.surface, borderRadius: radii.xxl, padding: spacing.lg, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 10 },
});
