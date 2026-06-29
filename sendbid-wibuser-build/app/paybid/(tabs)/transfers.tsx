import React, { useCallback, useState } from "react";
import { View, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { TText } from "../../../src/components/TText";
import { api } from "../../../src/api";
import { useThemedPaybidColors } from "../../../src/themeContext";
import { paybidColors } from "../../../src/paybidTheme";
import { spacing, radii } from "../../../src/theme";

const CATS = [
  { key: "all", label: "Tous" },
  { key: "active", label: "Actifs" },
  { key: "done", label: "Terminés" },
];

export default function PaybidTransfers() {
  const paybidColors = useThemedPaybidColors();
  const router = useRouter();
  const [list, setList] = useState<any[]>([]);
  const [cat, setCat] = useState("active");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const { data } = await api.get("/agent/transfers");
      setList(data || []);
    } catch {}
    setRefreshing(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = list.filter((t) => {
    if (cat === "all") return true;
    if (cat === "active") return ["AGENT_ASSIGNED", "PROCESSING", "READY_FOR_PICKUP", "VIP_DELIVERY"].includes(t.status);
    return ["COMPLETED", "CANCELLED_USER", "FAILED", "EXPIRED"].includes(t.status);
  });

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: paybidColors.neutrals.background }}>
      <View style={{ padding: spacing.lg, paddingBottom: 0 }}>
        <TText variant="title" weight="extraBold">Mes transferts</TText>
      </View>

      {/* === ITEM 2 : Section "Offres en temps réel" intégrée en haut de Transferts === */}
      <TouchableOpacity
        testID="auctions-section"
        onPress={() => router.push("/paybid/auctions" as any)}
        activeOpacity={0.85}
        style={styles.auctionsBanner}
      >
        <View style={[styles.icon, { backgroundColor: "#F59E0B" + "22" }]}>
          <Ionicons name="flash" size={22} color="#F59E0B" />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <TText weight="extraBold" color={paybidColors.neutrals.textPrimary}>Offres en temps réel</TText>
          <TText variant="caption" color={paybidColors.neutrals.textSecondary}>
            Voir les enchères ouvertes près de vous et y participer
          </TText>
        </View>
        <Ionicons name="chevron-forward" size={20} color={paybidColors.neutrals.textTertiary} />
      </TouchableOpacity>

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
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 30 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={paybidColors.primary.base} />}
        ListEmptyComponent={<View style={styles.empty}><Ionicons name="paper-plane-outline" size={36} color={paybidColors.neutrals.textTertiary} /><TText color={paybidColors.neutrals.textSecondary} style={{ marginTop: 8 }}>Aucun transfert</TText></View>}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => router.push({ pathname: "/paybid/transfer/[id]" as any, params: { id: item.id } })}>
            <View style={styles.icon}><Ionicons name="paper-plane" size={18} color={paybidColors.primary.base} /></View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <TText weight="semiBold">{item.beneficiary?.full_name || "—"}</TText>
              <TText variant="caption" color={paybidColors.neutrals.textSecondary}>{item.destination_country} · {item.status}</TText>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <TText weight="bold">{Number(item.receive_amount).toFixed(0)} {item.destination_currency}</TText>
              <TText variant="label" color={paybidColors.neutrals.textTertiary}>{new Date(item.created_at).toLocaleDateString("fr-FR")}</TText>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tabsRow: { flexDirection: "row", gap: 8, paddingHorizontal: spacing.lg, marginBottom: 8 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: radii.full, backgroundColor: paybidColors.neutrals.surface, borderWidth: 1.5, borderColor: paybidColors.neutrals.border, alignItems: "center" },
  tabActive: { backgroundColor: paybidColors.primary.base, borderColor: paybidColors.primary.base },
  row: { flexDirection: "row", alignItems: "center", padding: 12, backgroundColor: paybidColors.neutrals.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: paybidColors.neutrals.border, marginBottom: 8 },
  icon: { width: 40, height: 40, borderRadius: radii.full, backgroundColor: paybidColors.overlays.primarySoft, alignItems: "center", justifyContent: "center" },
  auctionsBanner: { flexDirection: "row", alignItems: "center", marginHorizontal: spacing.lg, marginBottom: spacing.md, padding: 14, backgroundColor: paybidColors.neutrals.surface, borderRadius: radii.xl, borderWidth: 1.5, borderColor: "#F59E0B" + "55" },
  empty: { alignItems: "center", padding: 40 },
});
