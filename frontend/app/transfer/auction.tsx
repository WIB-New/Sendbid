/**
 * Offres en temps réel de nos meilleurs agents — Spec §8.
 * - Bandeau bleu dégradé, Tour [n]/5, icône LIVE, compteur 60s, message dynamique
 * - Animation cursor live + zone de défilement horizontal des offres reçues
 * - Bloc résultat final d'assignation (fond transparent, bordure discrète)
 * - Cas cash standard : compteur 48h, prolongation 7j payante
 * - Cas VIP/EXPRESS : ETA, GPS agent, chat room, mises à jour WS
 * - Actions : Détails du transfert, Aller à l'accueil, Support d'urgence
 */
import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, TouchableOpacity, ScrollView, Alert, Linking, Animated, Easing, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../../src/components/Screen";
import { TText } from "../../src/components/TText";
import { Button } from "../../src/components/Button";
import { api, wsUrl } from "../../src/api";
import { colors, spacing, radii } from "../../src/theme";

const ROUND_DURATION = 60; // Spec §10.2 : 60s par tour (corrige le 90s précédent)

export default function LiveAuction() {
  const { transfer_id } = useLocalSearchParams<{ transfer_id: string }>();
  const router = useRouter();
  const [bids, setBids] = useState<any[]>([]);
  const [secondsLeft, setSecondsLeft] = useState(ROUND_DURATION);
  const [round, setRound] = useState(1);
  const [status, setStatus] = useState("BIDDING");
  const [transfer, setTransfer] = useState<any>(null);
  const [assignedAgent, setAssignedAgent] = useState<any>(null);
  const cursorX = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0.5)).current;

  // === Chargement initial + WebSocket ===
  useEffect(() => {
    if (!transfer_id) return;
    // Snapshot initial : si transfert déjà assigné/expiré, on calque le state directement
    api.get(`/transfers/${transfer_id}`).then(r => {
      const tr = r.data;
      setTransfer(tr);
      const st = String(tr?.status || "").toUpperCase();
      if (st === "AGENT_ASSIGNED" || st === "ASSIGNED" || st === "IN_PROGRESS" || st === "DELIVERED" || st === "COMPLETED") {
        setStatus("ASSIGNED");
        setAssignedAgent(tr?.assigned_agent || tr?.agent || null);
        // Si pas d'objet agent dans la réponse, on récupère via l'endpoint dédié
        if (!(tr?.assigned_agent || tr?.agent) && tr?.agent_id) {
          api.get(`/agents/${tr.agent_id}`).catch(() => null).then((ag) => ag && setAssignedAgent(ag.data));
        }
      } else if (st === "ABSORBED") setStatus("ABSORBED");
      else if (st === "EXPIRED") setStatus("EXPIRED");
      else if (typeof tr?.current_round === "number") setRound(tr.current_round);
    }).catch(() => {});
    api.get(`/transfers/${transfer_id}/bids`).then(r => setBids(r.data || [])).catch(() => {});

    let ws: WebSocket | null = null;
    (async () => {
      const token = await AsyncStorage.getItem("sb_token");
      const url = wsUrl(`/api/ws/auction/${transfer_id}`, token);
      ws = new WebSocket(url);
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.event === "snapshot") setBids(msg.bids || []);
          else if (msg.event === "new_bid") setBids(prev => [...prev.filter(b => b.id !== msg.bid.id), msg.bid].sort((a, b) => a.bid_fee_percent - b.bid_fee_percent));
          else if (msg.event === "round_started") {
            if (typeof msg.round === "number") setRound(msg.round);
            setSecondsLeft(msg.duration_sec || ROUND_DURATION);
          } else if (msg.event === "agent_assigned") {
            setStatus("ASSIGNED");
            api.get(`/transfers/${transfer_id}`).then(r => {
              setTransfer(r.data);
              setAssignedAgent(r.data?.assigned_agent || r.data?.agent || null);
            });
          } else if (msg.event === "auction_expired") setStatus("EXPIRED");
          else if (msg.event === "auction_absorbed") setStatus("ABSORBED");
        } catch {}
      };
    })();
    return () => { ws?.close(); };
  }, [transfer_id]);

  // === Tick countdown ===
  useEffect(() => {
    if (status !== "BIDDING") return;
    const i = setInterval(() => setSecondsLeft(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(i);
  }, [status]);

  // === Animation cursor (ligne live) ===
  useEffect(() => {
    if (status !== "BIDDING") return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(cursorX, { toValue: 1, duration: 1800, easing: Easing.linear, useNativeDriver: false }),
        Animated.timing(cursorX, { toValue: 0, duration: 0, useNativeDriver: false }),
      ]),
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0.5, duration: 800, useNativeDriver: false }),
      ]),
    ).start();
  }, [status]);

  if (!transfer) return <Screen title="Offres en temps réel" back><TText>Chargement…</TText></Screen>;

  const pct = (secondsLeft / ROUND_DURATION) * 100;
  const isCash = transfer.delivery_mode === "cash";
  const isVip = transfer.vip_delivery || transfer.service_level === "vip" || transfer.service_level === "vip_express";

  return (
    <Screen title="Offres en temps réel de nos meilleurs agents" back scroll={false}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxxl }} keyboardShouldPersistTaps="handled">
        {/* ======================= BANNIÈRE LIVE (CTA principal) ======================= */}
        {status === "BIDDING" ? (
          <LinearGradient colors={["#01155F", "#022a6b", "#3D52D5"]} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.banner}>
            <View style={styles.bannerHeader}>
              <View style={styles.tourBadge}>
                <Ionicons name="flash" size={14} color="white" />
                <TText variant="caption" weight="extraBold" color="white" style={{ marginLeft: 6, letterSpacing: 1.2 }}>
                  TOUR {round} / 5
                </TText>
              </View>
              <Animated.View style={[styles.liveBadge, { opacity: pulse }]}>
                <View style={styles.liveDot} />
                <TText variant="caption" weight="extraBold" color="white" style={{ marginLeft: 6, letterSpacing: 1 }}>LIVE</TText>
              </Animated.View>
            </View>

            {/* Compteur 60s proéminent */}
            <View style={styles.countdownRow}>
              <TText weight="extraBold" color="white" style={styles.bigCountdown}>{secondsLeft}</TText>
              <TText variant="body" weight="semiBold" color="rgba(255,255,255,0.85)" style={{ marginLeft: 4, marginBottom: 6 }}>s</TText>
            </View>

            {/* Message dynamique (disparaît dès la 1ère offre) */}
            {bids.length === 0 ? (
              <TText variant="body" weight="semiBold" color="rgba(255,255,255,0.92)" align="center">
                En attente des offres des agents…
              </TText>
            ) : (
              <TText variant="caption" weight="bold" color="rgba(255,255,255,0.92)" align="center">
                {bids.length} offre{bids.length > 1 ? "s" : ""} reçue{bids.length > 1 ? "s" : ""} — la meilleure : {Number(bids[0].bid_fee_percent).toFixed(2)}%
              </TText>
            )}

            {/* Animation cursor / ligne live discrète */}
            <View style={styles.cursorTrack}>
              <Animated.View style={[styles.cursorBar, { left: cursorX.interpolate({ inputRange: [0, 1], outputRange: ["0%", "92%"] }) }]} />
              <View style={[styles.cursorTrackInner, { width: `${pct}%` }]} />
            </View>

            {/* Zone de défilement HORIZONTAL des offres reçues */}
            {bids.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingTop: 14, paddingRight: 8, gap: 8 }}>
                {bids.map((b) => (
                  <View key={b.id} style={styles.bidChip}>
                    <View style={styles.bidChipDot} />
                    <View style={{ marginLeft: 8 }}>
                      <TText variant="label" weight="extraBold" color="white">@{b.agent_profile_id || "agent"}</TText>
                      <TText variant="caption" weight="extraBold" color="#10B981" style={{ marginTop: 2 }}>{Number(b.bid_fee_percent).toFixed(2)}%</TText>
                    </View>
                  </View>
                ))}
              </ScrollView>
            ) : null}
          </LinearGradient>
        ) : null}

        {/* ======================= BLOC RÉSULTAT FINAL D'ASSIGNATION ======================= */}
        {status === "ASSIGNED" && (assignedAgent || transfer.assigned_agent) ? (
          <AssignmentBlock transfer={transfer} agent={assignedAgent || transfer.assigned_agent} router={router} isCash={isCash} isVip={isVip} />
        ) : null}

        {/* ABSORBED / EXPIRED states */}
        {status === "ABSORBED" || status === "EXPIRED" ? (
          <View style={[styles.banner, { backgroundColor: status === "ABSORBED" ? "#0B3D24" : "#3D1414" }]}>
            <Ionicons name={status === "ABSORBED" ? "shield-checkmark" : "alert-circle"} size={36} color="white" style={{ alignSelf: "center" }} />
            <TText variant="subtitle" weight="extraBold" color="white" align="center" style={{ marginTop: 10 }}>
              {status === "ABSORBED" ? "Pris en charge par la plateforme" : "Enchère expirée"}
            </TText>
            <TText variant="caption" color="rgba(255,255,255,0.85)" align="center" style={{ marginTop: 8, lineHeight: 18 }}>
              {status === "ABSORBED"
                ? "Aucun agent disponible dans les frais souhaités — SENDBID prend en charge votre transfert directement. Délai de remise étendu."
                : "Aucun agent n'a accepté votre transfert. Vous pouvez relancer avec des frais plus attractifs ou modifier les paramètres."}
            </TText>
          </View>
        ) : null}

        {/* ======================= ACTIONS SUPPLÉMENTAIRES ======================= */}
        <View style={styles.actions}>
          <Button title="Détails du transfert" icon="document-text-outline" variant="outline"
            onPress={() => router.push({ pathname: "/transfer/[id]" as any, params: { id: transfer.id } })} />
          <TouchableOpacity onPress={() => router.replace("/(tabs)")} style={styles.linkRow}>
            <Ionicons name="home-outline" size={16} color={colors.primary.base} />
            <TText weight="semiBold" color={colors.primary.base} style={{ marginLeft: 6 }}>Aller à l'accueil</TText>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/support" as any)} style={styles.linkRow}>
            <Ionicons name="warning-outline" size={16} color="#EF4444" />
            <TText weight="semiBold" color="#EF4444" style={{ marginLeft: 6 }}>Contacter le support en urgence</TText>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </Screen>
  );
}

// === Bloc résultat assignation ===
function AssignmentBlock({ transfer, agent, router, isCash, isVip }: any) {
  const [remaining48, setRemaining48] = useState(0);
  useEffect(() => {
    if (!isCash || isVip) return;
    const deadline = new Date(transfer.created_at || Date.now()).getTime() + 48 * 3600 * 1000;
    const i = setInterval(() => setRemaining48(deadline - Date.now()), 1000);
    return () => clearInterval(i);
  }, [transfer.created_at, isCash, isVip]);

  const fmtCount = (ms: number) => {
    if (ms <= 0) return "00h:00m:00s";
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${String(h).padStart(2,"0")}h:${String(m).padStart(2,"0")}m:${String(s).padStart(2,"0")}s`;
  };
  const callAgent = () => {
    const ph = agent?.phone || transfer?.agent_phone;
    if (!ph) return;
    if (Platform.OS === "web") (window as any).open?.(`tel:${ph}`);
    else Linking.openURL(`tel:${ph}`);
  };

  return (
    <View style={styles.assignBlock}>
      <View style={styles.assignTopRow}>
        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.overlays.primarySoft, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="checkmark-circle" size={24} color="#10B981" />
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <TText variant="label" color={colors.neutrals.textSecondary} style={{ letterSpacing: 0.3 }}>VOTRE TRANSFERT A ÉTÉ CONFIÉ À</TText>
          <TText variant="subtitle" weight="extraBold">@{agent?.profile_id || agent?.id?.slice(0, 8) || "agent"}</TText>
        </View>
      </View>

      <View style={{ marginTop: 14, gap: 8 }}>
        <Row label="Frais à payer" value={`${(transfer.fee_amount || 0).toFixed(2)} EUR (${(transfer.fee_percent || 0).toFixed(2)}%)`} icon="cash-outline" />
        <Row label="Agence" value={agent?.agency_name || "—"} icon="business-outline" />
        <Row label="Adresse" value={agent?.agency_address || "—"} icon="location-outline" />
        <Row label="Ville" value={`${agent?.city || ""}${agent?.country_code ? ` · ${agent.country_code}` : ""}`} icon="navigate-outline" />
        <Row label="Responsable" value={agent?.full_name || "—"} icon="person-outline" />
        <Row label="Téléphone" value={agent?.phone || "—"} icon="call-outline" last />
      </View>

      <TouchableOpacity onPress={callAgent} style={styles.callBtn}>
        <Ionicons name="call" size={18} color="white" />
        <TText weight="extraBold" color="white" style={{ marginLeft: 8 }}>Appeler l'agent</TText>
      </TouchableOpacity>

      {/* Cas retrait standard cash */}
      {isCash && !isVip ? (
        <View style={styles.subBlock}>
          <TText variant="caption" weight="extraBold" color={colors.neutrals.textSecondary} style={{ letterSpacing: 0.5, marginBottom: 8 }}>
            RETRAIT EN AGENCE
          </TText>
          <Row label="Montant à retirer" value={`${Number(transfer.receive_amount).toLocaleString("fr-FR")} ${transfer.destination_currency}`} icon="wallet-outline" />
          <Row label="Statut" value="Disponible · paiement confirmé" tint="#10B981" icon="checkmark-circle-outline" />
          <Row label="Délai de retrait" value={fmtCount(remaining48)} tint="#F59E0B" icon="time-outline" />
          <View style={styles.reminderBox}>
            <Ionicons name="notifications-outline" size={14} color="#3B82F6" />
            <TText variant="label" color={colors.neutrals.textSecondary} style={{ marginLeft: 8, flex: 1 }}>
              Rappels automatiques toutes les 12h envoyés à l'expéditeur et au bénéficiaire.
            </TText>
          </View>
          <Button title="Prolonger jusqu'à 7 jours (payant)" icon="time" variant="outline" size="small" style={{ marginTop: 10 }}
            onPress={() => router.push({ pathname: "/transfer/extend" as any, params: { transfer_id: transfer.id } })} />
        </View>
      ) : null}

      {/* Cas VIP / VIP EXPRESS */}
      {isVip ? (
        <View style={styles.subBlock}>
          <TText variant="caption" weight="extraBold" color={colors.neutrals.textSecondary} style={{ letterSpacing: 0.5, marginBottom: 8 }}>
            REMISE VIP {transfer.service_level === "vip_express" ? "EXPRESS" : ""}
          </TText>
          <Row label="Montant à remettre" value={`${Number(transfer.receive_amount).toLocaleString("fr-FR")} ${transfer.destination_currency}`} icon="wallet-outline" />
          <Row label="ETA" value={transfer.vip_eta_minutes ? `${transfer.vip_eta_minutes} min` : (transfer.service_level === "vip_express" ? "1h–2h" : "1h–4h")} tint="#F59E0B" icon="speedometer-outline" />
          <Row label="Position GPS agent" value={agent?.lat && agent?.lng ? `${Number(agent.lat).toFixed(4)} · ${Number(agent.lng).toFixed(4)}` : "Autorisation requise"} icon="navigate-circle-outline" />
          <View style={styles.reminderBox}>
            <Ionicons name="flash" size={14} color="#F59E0B" />
            <TText variant="label" color={colors.neutrals.textSecondary} style={{ marginLeft: 8, flex: 1 }}>
              Mises à jour temps réel via WebSocket — notifications push à chaque changement d'étape.
            </TText>
          </View>
          <Button title="Suivre sur la carte" icon="map" variant="outline" size="small" style={{ marginTop: 10 }}
            onPress={() => router.push({ pathname: "/transfer/map" as any, params: { transfer_id: transfer.id } })} />
          <Button title="Chat avec l'agent" icon="chatbubble-ellipses" size="small" style={{ marginTop: 8 }}
            onPress={() => router.push({ pathname: "/transfer/chat" as any, params: { transfer_id: transfer.id } })} />
        </View>
      ) : null}
    </View>
  );
}

function Row({ label, value, tint, icon, last }: any) {
  return (
    <View style={[styles.row, !last && styles.rowSep]}>
      {icon ? <Ionicons name={icon} size={16} color={colors.neutrals.textSecondary} style={{ marginRight: 8 }} /> : null}
      <TText variant="label" color={colors.neutrals.textSecondary} style={{ flex: 1 }}>{label}</TText>
      <TText variant="caption" weight="extraBold" color={tint || colors.neutrals.textPrimary}>{value}</TText>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { borderRadius: radii.xxl, padding: spacing.lg, marginTop: spacing.sm, overflow: "hidden", shadowColor: "#022a6b", shadowOpacity: 0.3, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  bannerHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  tourBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(16,185,129,0.25)", borderWidth: 1, borderColor: "#10B981", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  liveBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(239,68,68,0.92)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "white" },
  countdownRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "center", marginTop: 18, marginBottom: 6 },
  bigCountdown: { fontSize: 72, lineHeight: 78, includeFontPadding: false },
  cursorTrack: { height: 5, backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 3, marginTop: 16, position: "relative", overflow: "hidden" },
  cursorTrackInner: { height: 5, backgroundColor: "rgba(16,185,129,0.9)", borderRadius: 3 },
  cursorBar: { position: "absolute", top: -3, width: 12, height: 12, borderRadius: 6, backgroundColor: "#10B981", shadowColor: "#10B981", shadowOpacity: 0.7, shadowRadius: 6 },
  bidChip: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", borderRadius: radii.lg, paddingHorizontal: 12, paddingVertical: 8, minWidth: 120 },
  bidChipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#10B981" },

  assignBlock: { borderWidth: 1, borderColor: colors.neutrals.border, borderRadius: radii.xxl, padding: spacing.lg, marginTop: spacing.md, backgroundColor: "transparent" },
  assignTopRow: { flexDirection: "row", alignItems: "center" },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
  rowSep: { borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.04)" },
  callBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#10B981", paddingVertical: 12, borderRadius: 999, marginTop: 14 },
  subBlock: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.neutrals.border },
  reminderBox: { flexDirection: "row", alignItems: "center", backgroundColor: colors.overlays.infoSoft, padding: 10, borderRadius: radii.lg, marginTop: 8 },

  actions: { marginTop: spacing.xl, gap: 10 },
  linkRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 8 },
});
