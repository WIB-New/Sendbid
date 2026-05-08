import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, TouchableOpacity, ScrollView, Alert, Dimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../../src/components/Screen";
import { TText } from "../../src/components/TText";
import { api, apiError, wsUrl } from "../../src/api";
import { colors, spacing, radii } from "../../src/theme";

const ROUND_DURATION = 90;

export default function Auction() {
  const { transfer_id } = useLocalSearchParams<{ transfer_id: string }>();
  const router = useRouter();
  const [bids, setBids] = useState<any[]>([]);
  const [secondsLeft, setSecondsLeft] = useState(ROUND_DURATION);
  const [round, setRound] = useState(1);
  const [status, setStatus] = useState("BIDDING");
  const [retrying, setRetrying] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    api.get(`/transfers/${transfer_id}/bids`).then((r) => setBids(r.data || []));
    let ws: WebSocket | null = null;
    (async () => {
      const token = await AsyncStorage.getItem("sb_token");
      const url = wsUrl(`/api/ws/auction/${transfer_id}`, token);
      ws = new WebSocket(url);
      wsRef.current = ws;
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.event === "snapshot") setBids(msg.bids);
          else if (msg.event === "new_bid") setBids((prev) => [...prev.filter((b) => b.id !== msg.bid.id), msg.bid].sort((a, b) => a.bid_fee_percent - b.bid_fee_percent));
          else if (msg.event === "round_started") {
            if (typeof msg.round === "number") setRound(msg.round);
            setSecondsLeft(msg.duration_sec || ROUND_DURATION);
          } else if (msg.event === "agent_assigned") {
            setStatus("AGENT_ASSIGNED");
            router.replace({ pathname: "/transfer/agent-assigned", params: { transfer_id: transfer_id! } });
          } else if (msg.event === "auction_expired") {
            setStatus("EXPIRED");
            setSecondsLeft(0);
          }
        } catch {}
      };
      ws.onerror = () => {};
    })();
    return () => { ws?.close(); };
  }, [transfer_id, router]);

  useEffect(() => {
    if (status !== "BIDDING") return;
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [status]);

  const retry = async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      await api.post(`/transfers/${transfer_id}/retry-auction`);
      setStatus("BIDDING");
      setBids([]);
      setRound(1);
      setSecondsLeft(ROUND_DURATION);
    } catch (e: any) {
      Alert.alert("Erreur", apiError(e));
    } finally { setRetrying(false); }
  };

  const pct = (secondsLeft / ROUND_DURATION) * 100;
  const screenH = Dimensions.get("window").height;
  const tourCardHeight = Math.round(screenH * 0.42); // ≈ moitié d'écran
  const expired = status === "EXPIRED" || (round >= 5 && secondsLeft === 0 && bids.length === 0);

  return (
    <Screen title="Offres en temps réel" back scroll={false}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
        {/* TOUR CTA — moitié d'écran, gradient vert foncé */}
        <LinearGradient
          colors={["#022C22", "#064E3B", "#065F46"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.tourCard, { minHeight: tourCardHeight }]}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={styles.tourBadge}>
              <Ionicons name="flash" size={14} color="white" />
              <TText variant="caption" color="white" weight="extraBold" style={{ marginLeft: 6, letterSpacing: 1.4 }}>
                TOUR {round} / 5
              </TText>
            </View>
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <TText variant="caption" weight="extraBold" color="white" style={{ marginLeft: 6, letterSpacing: 1 }}>LIVE</TText>
            </View>
          </View>

          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", marginVertical: spacing.lg }}>
            <TText weight="extraBold" color="white" style={styles.bigCountdown}>{secondsLeft}s</TText>
            <TText variant="caption" color="rgba(255,255,255,0.85)" weight="semiBold" style={{ marginTop: 4 }}>
              {bids.length === 0 ? "En attente des premières offres…" : `${bids.length} agent${bids.length > 1 ? "s" : ""} en jeu`}
            </TText>
          </View>

          {/* Flux d'offres en temps réel — affiche les 3 derniers messages */}
          {bids.length > 0 ? (
            <View style={styles.feedBox}>
              {[...bids].slice(-3).reverse().map((b, idx) => (
                <View key={b.id} style={[styles.feedRow, idx === 0 && styles.feedRowLatest]}>
                  <View style={styles.feedDot} />
                  <View style={{ marginLeft: 10, flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <TText variant="caption" color="white" numberOfLines={1} style={{ flex: 1 }}>
                      @{b.agent_profile_id || (b.agent_id || "agent").slice(0, 8)}
                    </TText>
                    <TText weight="extraBold" color="white" style={styles.feedAmount}>
                      {Number(b.bid_fee_percent).toFixed(2)}%
                    </TText>
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${pct}%` }]} />
          </View>
        </LinearGradient>

        {/* CTA "Trouver un nouvel agent" — visible si l'enchère a expiré */}
        {expired ? (
          <TouchableOpacity testID="auction-retry" style={styles.retryBtn} onPress={retry} disabled={retrying} activeOpacity={0.85}>
            <Ionicons name="refresh" size={20} color="white" />
            <TText variant="body" weight="extraBold" color="white" style={{ marginLeft: 10 }}>
              {retrying ? "Relance en cours…" : "Trouver un nouvel agent"}
            </TText>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tourCard: {
    borderRadius: radii.xxl,
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  tourBadge: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", backgroundColor: "rgba(16,185,129,0.25)", borderWidth: 1, borderColor: "#10B981", borderRadius: radii.full, paddingHorizontal: 12, paddingVertical: 6 },
  bigCountdown: { fontSize: 96, lineHeight: 100, includeFontPadding: false },
  feedBox: { backgroundColor: "rgba(255,255,255,0.08)", borderRadius: radii.lg, padding: 12 },
  feedRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6, opacity: 0.7 },
  feedRowLatest: { opacity: 1 },
  feedDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#10B981" },
  feedAmount: { fontSize: 22, lineHeight: 26 },
  liveBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(239,68,68,0.95)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: radii.full },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "white" },
  barTrack: { height: 6, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 3, marginTop: spacing.md, overflow: "hidden" },
  barFill: { height: 6, backgroundColor: "#10B981", borderRadius: 3 },
  retryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "#065F46", paddingVertical: 16, borderRadius: radii.xxl,
    marginTop: spacing.lg,
  },
});
