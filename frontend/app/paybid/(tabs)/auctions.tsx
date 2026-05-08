import React, { useCallback, useState } from "react";
import { View, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Modal, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { TText } from "../../../src/components/TText";
import { Input } from "../../../src/components/Input";
import { Button } from "../../../src/components/Button";
import { api, apiError } from "../../../src/api";
import { paybidColors } from "../../../src/paybidTheme";
import { spacing, radii } from "../../../src/theme";

export default function PaybidAuctions() {
  const [list, setList] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"all" | "city">("city");
  const [bidOpen, setBidOpen] = useState<any | null>(null);
  const [feePct, setFeePct] = useState("1.50");
  const [eta, setEta] = useState("30");
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const { data } = await api.get("/agent/auctions", { params: { only_same_city: filter === "city" } });
      setList(data || []);
    } catch {}
    setRefreshing(false);
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

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: paybidColors.neutrals.background }}>
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
        ListEmptyComponent={<View style={styles.empty}><Ionicons name="flash-off-outline" size={36} color={paybidColors.neutrals.textTertiary} /><TText color={paybidColors.neutrals.textSecondary} style={{ marginTop: 8 }}>Aucune offre pour le moment</TText></View>}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => { setBidOpen(item); setFeePct(((item.fee_percent || 2) - 0.5).toFixed(2)); }}>
            <View style={styles.cardTop}>
              <View style={styles.flag}><TText weight="bold">{item.beneficiary?.full_name?.[0] || "?"}</TText></View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <TText weight="extraBold">{item.beneficiary?.full_name || "—"}</TText>
                <TText variant="caption" color={paybidColors.neutrals.textSecondary}>{item.destination_country} · {(item.delivery_mode || "").toUpperCase()}{item.vip_delivery ? " · VIP" : ""}</TText>
              </View>
              {item.same_city ? <View style={styles.cityBadge}><Ionicons name="location" size={12} color="white" /><TText variant="label" weight="bold" color="white" style={{ marginLeft: 4 }}>Ma ville</TText></View> : null}
            </View>
            <View style={styles.cardBody}>
              <View>
                <TText variant="label" color={paybidColors.neutrals.textTertiary}>Le client envoie</TText>
                <TText variant="title" weight="extraBold" color={paybidColors.primary.base}>{Number(item.send_amount).toFixed(0)} EUR</TText>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <TText variant="label" color={paybidColors.neutrals.textTertiary}>Le bénéficiaire reçoit</TText>
                <TText variant="title" weight="extraBold">{Number(item.receive_amount).toFixed(0)} {item.destination_currency}</TText>
              </View>
            </View>
            <View style={styles.cardFoot}>
              <TText variant="caption" color={paybidColors.neutrals.textSecondary}>Round {item.auction_round || 1}/5 · Frais max {(item.fee_percent || 2).toFixed(2)}%</TText>
              <TText variant="caption" weight="bold" color={paybidColors.primary.base}>Enchérir →</TText>
            </View>
          </TouchableOpacity>
        )}
      />

      <Modal visible={!!bidOpen} transparent animationType="slide" onRequestClose={() => setBidOpen(null)}>
        <View style={styles.modalBg}>
          <View style={styles.sheet}>
            <TText variant="subtitle" weight="extraBold" style={{ marginBottom: 4 }}>Enchérir</TText>
            <TText variant="caption" color={paybidColors.neutrals.textSecondary} style={{ marginBottom: spacing.md }}>{bidOpen?.beneficiary?.full_name} · {bidOpen?.destination_country} · {Number(bidOpen?.send_amount || 0).toFixed(0)} EUR</TText>
            <Input label="Frais (%) — votre marge" value={feePct} onChangeText={setFeePct} keyboardType="decimal-pad" icon="trending-down-outline" />
            <Input label="ETA (minutes)" value={eta} onChangeText={setEta} keyboardType="number-pad" icon="time-outline" />
            {err ? <TText color={paybidColors.status.error}>{err}</TText> : null}
            <Button title="Envoyer mon offre" onPress={submitBid} icon="flash" style={{ backgroundColor: paybidColors.primary.base }} />
            <TouchableOpacity onPress={() => setBidOpen(null)} style={{ alignSelf: "center", marginTop: 8 }}><TText color={paybidColors.neutrals.textSecondary}>Annuler</TText></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { padding: spacing.lg },
  tabsRow: { flexDirection: "row", gap: 8, paddingHorizontal: spacing.lg, marginBottom: 8 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: radii.full, backgroundColor: paybidColors.neutrals.surface, borderWidth: 1.5, borderColor: paybidColors.neutrals.border, alignItems: "center" },
  tabActive: { backgroundColor: paybidColors.primary.base, borderColor: paybidColors.primary.base },
  card: { backgroundColor: paybidColors.neutrals.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: paybidColors.neutrals.border, padding: spacing.md, marginBottom: 10 },
  cardTop: { flexDirection: "row", alignItems: "center" },
  flag: { width: 40, height: 40, borderRadius: radii.full, backgroundColor: paybidColors.overlays.primarySoft, alignItems: "center", justifyContent: "center" },
  cityBadge: { flexDirection: "row", alignItems: "center", backgroundColor: paybidColors.primary.base, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radii.full },
  cardBody: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: paybidColors.neutrals.border },
  cardFoot: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: paybidColors.neutrals.border },
  empty: { alignItems: "center", padding: 40 },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "white", borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl, padding: spacing.lg },
});
