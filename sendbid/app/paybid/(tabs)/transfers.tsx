import React, { useCallback, useState } from "react";
import { View, StyleSheet, FlatList, RefreshControl, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { TText } from "../../../src/components/TText";
import { Button } from "../../../src/components/Button";
import { api, apiError } from "../../../src/api";
import { paybidColors } from "../../../src/paybidTheme";
import { spacing, radii } from "../../../src/theme";
import { useTranslation } from "../../../src/i18n";

const CATS = [
  { key: "all", label: "Tous" },
  { key: "active", label: "Actifs" },
  { key: "done", label: "Terminés" },
];

export default function PaybidTransfers() {
  const { t } = useTranslation();
  const router = useRouter();
  const [list, setList] = useState<any[]>([]);
  const [cat, setCat] = useState("active");
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const { data } = await api.get("/agent/transfers");
      setList(data || []);
    } catch (e: any) {
      setError(apiError(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = list.filter((t) => {
    if (cat === "all") return true;
    if (cat === "active") return ["AGENT_ASSIGNED", "PROCESSING", "READY_FOR_PICKUP", "VIP_DELIVERY"].includes(t.status);
    return ["COMPLETED", "CANCELLED_USER", "FAILED", "EXPIRED"].includes(t.status);
  });

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
      <View style={{ padding: spacing.lg }}>
        <TText variant="title" weight="extraBold">Mes transferts</TText>
      </View>
      <View style={styles.tabsRow}>
        {CATS.map((c) => (
          <TouchableOpacity key={c.key} onPress={() => setCat(c.key)} style={[styles.tab, cat === c.key && styles.tabActive]}>
            <TText weight="bold" color={cat === c.key ? "white" : paybidColors.neutrals.textPrimary}>{c.label}</TText>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={paybidColors.primary.base} />}
        ListEmptyComponent={<View style={styles.empty}><Ionicons name="paper-plane-outline" size={36} color={paybidColors.neutrals.textTertiary} /><TText color={paybidColors.neutrals.textSecondary} style={{ marginTop: 8 }}>Aucun transfert</TText></View>}
        renderItem={({ item }) => {
          const isVip = item.vip_delivery || item.service_level === "vip" || item.service_level === "vip_express";
          const serviceLabel = item.service_level === "vip_express" ? "VIP EXPRESS" : isVip ? "VIP" : "STANDARD";
          const statusMap: Record<string, { label: string; color: string; icon: string }> = {
            AGENT_ASSIGNED: { label: "Assigné", color: "#2563EB", icon: "checkmark-circle" },
            PROCESSING: { label: "En cours", color: "#7C3AED", icon: "sync" },
            READY_FOR_PICKUP: { label: "Prêt — Retrait", color: "#D97706", icon: "location" },
            VIP_DELIVERY: { label: "Livraison VIP", color: "#7C3AED", icon: "car" },
            COMPLETED: { label: "Terminé", color: "#16A34A", icon: "checkmark-done-circle" },
            CANCELLED_USER: { label: "Annulé", color: "#DC2626", icon: "close-circle" },
            EXPIRED: { label: "Expiré", color: "#94A3B8", icon: "time" },
            FAILED: { label: "Échoué", color: "#DC2626", icon: "alert-circle" },
          };
          const st = statusMap[item.status] || { label: item.status, color: "#94A3B8", icon: "help-circle" };
          const feePct = (item.selected_bid?.bid_fee_percent || item.fee_percent || 0);
          const commission = ((feePct / 100) * (item.send_amount || 0)).toFixed(2);
          const isActive = ["AGENT_ASSIGNED", "PROCESSING", "READY_FOR_PICKUP", "VIP_DELIVERY"].includes(item.status);
          const actionLabel = item.status === "READY_FOR_PICKUP" || item.status === "VIP_DELIVERY" ? "Scanner QR" : item.status === "AGENT_ASSIGNED" ? "Identifier & remettre" : "";

          return (
          <TouchableOpacity style={styles.card} onPress={() => router.push({ pathname: "/paybid/transfer/[id]" as any, params: { id: item.id } })}>
            {/* Header: Statut + Service */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name={st.icon as any} size={16} color={st.color} />
                <TText weight="extraBold" style={{ fontSize: 12, color: st.color }}>{st.label}</TText>
              </View>
              <View style={[styles.serviceBadge, { backgroundColor: isVip ? "#7C3AED" : paybidColors.neutrals.textTertiary }]}>
                <TText style={{ fontSize: 9, color: "white", fontWeight: "800" }}>{serviceLabel}</TText>
              </View>
            </View>

            {/* Bénéficiaire + ville */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
              <View style={{ flex: 1 }}>
                <TText weight="bold" style={{ fontSize: 15 }}>{item.beneficiary?.full_name || "—"}</TText>
                <TText variant="caption" color={paybidColors.neutrals.textSecondary}>{item.beneficiary?.city || item.destination_city || "—"} · {item.destination_country}</TText>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <TText weight="extraBold" style={{ fontSize: 16, color: paybidColors.primary.base }}>{Number(item.receive_amount || 0).toLocaleString("fr-FR")}</TText>
                <TText variant="caption" color={paybidColors.neutrals.textSecondary}>{item.destination_currency || "XOF"}</TText>
              </View>
            </View>

            {/* Infos: commission + date */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
              <View style={styles.commissionChip}>
                <Ionicons name="cash-outline" size={12} color="#16A34A" />
                <TText style={{ fontSize: 11, color: "#16A34A", fontWeight: "700", marginLeft: 4 }}>+{commission} € ({feePct.toFixed(1)}%)</TText>
              </View>
              <TText variant="caption" color={paybidColors.neutrals.textTertiary}>{new Date(item.created_at).toLocaleDateString("fr-FR")}</TText>
            </View>

            {/* Action button pour transferts actifs */}
            {isActive && actionLabel ? (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: st.color }]}
                onPress={() => {
                  if (item.status === "READY_FOR_PICKUP" || item.status === "VIP_DELIVERY") {
                    router.push({ pathname: "/paybid/scan" as any, params: { id: item.id } });
                  } else {
                    router.push({ pathname: "/paybid/transfer/[id]" as any, params: { id: item.id } });
                  }
                }}
              >
                <Ionicons name={item.status === "AGENT_ASSIGNED" ? "play-circle" : "qr-code"} size={14} color="white" />
                <TText style={{ color: "white", fontSize: 12, fontWeight: "700", marginLeft: 6 }}>{actionLabel}</TText>
              </TouchableOpacity>
            ) : null}
          </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.xl },
  tabsRow: { flexDirection: "row", gap: 8, paddingHorizontal: spacing.lg, marginBottom: 8 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: radii.full, backgroundColor: paybidColors.neutrals.surface, borderWidth: 1.5, borderColor: paybidColors.neutrals.border, alignItems: "center" },
  tabActive: { backgroundColor: paybidColors.primary.base, borderColor: paybidColors.primary.base },
  card: { padding: 14, backgroundColor: paybidColors.neutrals.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: paybidColors.neutrals.border, marginBottom: 10 },
  serviceBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.full },
  commissionChip: { flexDirection: "row", alignItems: "center", backgroundColor: "#ECFDF5", paddingHorizontal: 8, paddingVertical: 4, borderRadius: radii.full },
  actionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 12, paddingVertical: 10, borderRadius: radii.md },
  empty: { alignItems: "center", padding: 40 },
});
