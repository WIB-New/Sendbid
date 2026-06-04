import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Modal, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { TText } from "../../../src/components/TText";
import { Input } from "../../../src/components/Input";
import { Button } from "../../../src/components/Button";
import { api, apiError, wsUrl } from "../../../src/api";
import { useAuth } from "../../../src/store";
import { useThemedPaybidColors } from "../../../src/themeContext";
import { paybidColors } from "../../../src/paybidTheme";
import { spacing, radii } from "../../../src/theme";

export default function PaybidAuctions() {
  const paybidColors = useThemedPaybidColors();
  const token = useAuth((s) => s.token);
  const [list, setList] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"all" | "city">("city");
  const [bidOpen, setBidOpen] = useState<any | null>(null);
  const [feePct, setFeePct] = useState("1.50");
  const [eta, setEta] = useState("30");
  const [err, setErr] = useState<string | null>(null);
  const [wsAlive, setWsAlive] = useState(false);
  const [commissionMsg, setCommissionMsg] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const { data } = await api.get("/agent/auctions", { params: { only_same_city: filter === "city" } });
      setList(data || []);
    } catch {}
    setRefreshing(false);
  }, [filter]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // === WebSocket bidirectionnel PAYBID — invitations temps réel ===
  useEffect(() => {
    if (!token) return;
    try {
      const url = wsUrl("/api/ws/agent", token);
      const ws = new WebSocket(url);
      wsRef.current = ws;
      ws.onopen = () => setWsAlive(true);
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.event === "auction_invite" || msg.event === "new_bid" || msg.event === "agent_assigned" || msg.event === "round_started") {
            load();
          }
        } catch {}
      };
      ws.onerror = () => setWsAlive(false);
      ws.onclose = () => setWsAlive(false);
      return () => { try { ws.close(); } catch {} };
    } catch {}
  }, [token, load]);

  const submitBid = async () => {
    setErr(null);
    try {
      // === CAP DUR CÔTÉ CLIENT ===
      // Spec : aucune offre supérieure au taux client (fee_percent du transfert).
      const clientMax = parseFloat(String(bidOpen?.fee_percent ?? 99));
      const proposed = parseFloat(feePct);
      if (isNaN(proposed) || proposed <= 0) {
        setErr("Saisissez un pourcentage valide (> 0).");
        return;
      }
      if (proposed > clientMax) {
        setErr(`Offre invalide : votre proposition (${proposed.toFixed(2)}%) dépasse le maximum client (${clientMax.toFixed(2)}%). Ajustez à ${clientMax.toFixed(2)}% ou moins.`);
        return;
      }
      const { data } = await api.post(`/agent/auctions/${bidOpen.id}/bid`, { transfer_id: bidOpen.id, bid_fee_percent: proposed, eta_minutes: parseInt(eta) });
      const c = data?.commission;
      const msg = c
        ? `Offre envoyée ✓\nFrais client : ${c.client_fee_amount.toFixed(2)}€ (${c.client_fee_pct}%)\nCommission entreprise (20%) : ${c.company_share.toFixed(2)}€\nVotre gain net si sélectionné : ${c.agent_net.toFixed(2)}€`
        : `Frais ${feePct}% · ETA ${eta} min`;
      setCommissionMsg(msg);
      setBidOpen(null); load();
    } catch (e: any) { setErr(apiError(e)); }
  };

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: paybidColors.neutrals.background }}>
      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <TText variant="title" weight="extraBold">Offres en direct</TText>
          <View style={[styles.liveBadge, { backgroundColor: wsAlive ? "#FFA500" : "#94A3B8" }]}>
            <View style={[styles.liveDot, { backgroundColor: wsAlive ? "#FFFFFF" : "#E5E7EB" }]} />
            <TText variant="label" weight="bold" color="white" style={{ marginLeft: 4 }}>{wsAlive ? "LIVE" : "OFFLINE"}</TText>
          </View>
        </View>
        <TText variant="caption" color={paybidColors.neutrals.textSecondary}>Posez votre offre dans la fenêtre de 90s · Synchro temps réel</TText>
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
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 30 }}
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
            {bidOpen ? (
              <View style={{ backgroundColor: "#FEF3C7", borderColor: "#FCD34D", borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: spacing.md }}>
                <TText variant="caption" weight="extraBold" color="#92400E">
                  Plafond client : {Number(bidOpen.fee_percent || 0).toFixed(2)}%
                </TText>
                <TText variant="label" color="#92400E" style={{ marginTop: 2 }}>
                  Votre offre doit être ≤ {Number(bidOpen.fee_percent || 0).toFixed(2)}%. Les offres supérieures sont systématiquement refusées.
                </TText>
              </View>
            ) : null}
            <Input
              label={`Frais (%) — max ${Number(bidOpen?.fee_percent || 0).toFixed(2)}%`}
              value={feePct}
              onChangeText={(v) => {
                const cleaned = v.replace(",", ".").replace(/[^0-9.]/g, "");
                // Bornage en temps réel
                const num = parseFloat(cleaned);
                const maxClient = parseFloat(String(bidOpen?.fee_percent ?? 99));
                if (!isNaN(num) && num > maxClient) {
                  setFeePct(maxClient.toFixed(2));
                  return;
                }
                setFeePct(cleaned);
              }}
              keyboardType="decimal-pad"
              icon="trending-down-outline"
            />
            <Input label="ETA (minutes)" value={eta} onChangeText={setEta} keyboardType="number-pad" icon="time-outline" />
            {err ? <TText color={paybidColors.status.error}>{err}</TText> : null}
            <Button title="Envoyer mon offre" onPress={submitBid} icon="flash" style={{ backgroundColor: paybidColors.primary.base }} />
            <TouchableOpacity onPress={() => setBidOpen(null)} style={{ alignSelf: "center", marginTop: 8 }}><TText color={paybidColors.neutrals.textSecondary}>Annuler</TText></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal de confirmation de commission après dépôt d'offre */}
      <Modal visible={!!commissionMsg} transparent animationType="fade" onRequestClose={() => setCommissionMsg(null)}>
        <View style={styles.modalBg}>
          <View style={[styles.sheet, { borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl }]}>
            <View style={{ alignItems: "center", marginBottom: spacing.md }}>
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: "#FFA500", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="checkmark-circle" size={40} color="white" />
              </View>
              <TText variant="subtitle" weight="extraBold" align="center" style={{ marginTop: 8 }}>Offre envoyée</TText>
            </View>
            <View style={{ backgroundColor: paybidColors.overlays.primarySoft, borderRadius: radii.lg, padding: spacing.md }}>
              <TText variant="caption" weight="bold" color={paybidColors.primary.base} style={{ marginBottom: 6 }}>DÉTAIL DE LA COMMISSION</TText>
              <TText variant="caption" color={paybidColors.neutrals.textPrimary} style={{ lineHeight: 20 }}>{commissionMsg}</TText>
            </View>
            <TText variant="label" color={paybidColors.neutrals.textTertiary} align="center" style={{ marginTop: 8 }}>
              L'attribution finale a lieu à la fin du round selon les autres offres.
            </TText>
            <Button title="J'ai compris" onPress={() => setCommissionMsg(null)} style={{ marginTop: spacing.md, backgroundColor: paybidColors.primary.base }} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { padding: spacing.lg },
  liveBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 4, borderRadius: radii.full },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
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
