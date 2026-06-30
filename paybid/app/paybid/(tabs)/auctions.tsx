import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Modal, Animated, Easing } from "react-native";
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

const ROUND_DURATION = 90; // secondes par round

/* ─── Compte à rebours animé ─── */
function Countdown({ seconds, total }: { seconds: number; total: number }) {
  const pct = seconds / total;
  const color = seconds > 30 ? "#10B981" : seconds > 10 ? "#F59E0B" : "#EF4444";
  return (
    <View style={{ alignItems: "center" }}>
      <View style={[cStyles.ring, { borderColor: color }]}>
        <TText variant="title" weight="extraBold" color={color} style={{ fontSize: 22 }}>{seconds}</TText>
        <TText variant="label" color={color} style={{ fontSize: 10 }}>sec</TText>
      </View>
    </View>
  );
}

const cStyles = StyleSheet.create({
  ring: { width: 64, height: 64, borderRadius: 32, borderWidth: 3, alignItems: "center", justifyContent: "center" },
});

export default function PaybidAuctions() {
  const colors = useThemedPaybidColors();
  const token = useAuth((s) => s.token);

  /* ── Liste enchères ── */
  const [list, setList] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"all" | "city">("city");
  const [wsAlive, setWsAlive] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  /* ── File d'attente des popups enchères ── */
  const alertQueue = useRef<any[]>([]);          // enchères en attente
  const [alertAuction, setAlertAuction] = useState<any | null>(null);
  const [alertCountdown, setAlertCountdown] = useState(ROUND_DURATION);
  const [queueCount, setQueueCount] = useState(0); // nb en attente (affiché)
  const alertTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const alertSlide = useRef(new Animated.Value(300)).current;
  const alertBusy = useRef(false); // un popup est-il déjà ouvert ?

  /* ── Modal enchérir (après "Accepter") ── */
  const [bidOpen, setBidOpen] = useState<any | null>(null);
  const [feePct, setFeePct] = useState("1.50");
  const [eta, setEta] = useState("30");
  const [bidErr, setBidErr] = useState<string | null>(null);
  const [bidBusy, setBidBusy] = useState(false);

  /* ── Modal confirmation commission ── */
  const [commissionMsg, setCommissionMsg] = useState<string | null>(null);

  /* ── Alerte surclassé (outbid) ── */
  const [outbidAlert, setOutbidAlert] = useState<{ transferId: string; yourBid: number; newBest: number; transfer: any } | null>(null);

  /* ── Chargement liste ── */
  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const { data } = await api.get("/agent/auctions", { params: { only_same_city: filter === "city" } });
      setList(data || []);
    } catch {}
    setRefreshing(false);
  }, [filter]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  /* ── Afficher le prochain popup de la file ── */
  const showNext = useCallback(() => {
    const next = alertQueue.current.shift();
    setQueueCount(alertQueue.current.length);
    if (!next) { alertBusy.current = false; return; }
    alertBusy.current = true;
    setAlertAuction(next);
    setAlertCountdown(ROUND_DURATION);
    alertSlide.setValue(400);
    Animated.spring(alertSlide, { toValue: 0, useNativeDriver: true, tension: 60, friction: 10 }).start();
  }, [alertSlide]);

  /* ── Ajouter une enchère en file d'attente ── */
  const enqueueAlert = useCallback((auction: any) => {
    // Dédupliquer : ne pas ajouter si déjà dans la file ou affiché
    if (alertQueue.current.some((a: any) => a.id === auction.id)) return;
    setAlertAuction(current => {
      if (current?.id === auction.id) return current;
      return current;
    });
    // Si déjà un popup affiché, mettre en file
    if (alertBusy.current) {
      alertQueue.current.push(auction);
      setQueueCount(alertQueue.current.length);
    } else {
      alertQueue.current = [auction];
      showNext();
    }
  }, [showNext]);

  /* ── Fermer le popup courant et ouvrir le suivant ── */
  const closeAlert = useCallback((skipNext = false) => {
    if (alertTimerRef.current) { clearInterval(alertTimerRef.current); alertTimerRef.current = null; }
    Animated.timing(alertSlide, { toValue: 400, duration: 220, easing: Easing.in(Easing.ease), useNativeDriver: true }).start(() => {
      setAlertAuction(null);
      setAlertCountdown(ROUND_DURATION);
      if (!skipNext) {
        // Délai court avant d'ouvrir le suivant
        setTimeout(() => showNext(), 300);
      } else {
        alertBusy.current = false;
        setQueueCount(alertQueue.current.length);
      }
    });
  }, [alertSlide, showNext]);

  // Alias pour compatibilité (openAlert → enqueueAlert)
  const openAlert = enqueueAlert;

  /* ── Compte à rebours popup (repart à 90s pour chaque nouvelle enchère) ── */
  useEffect(() => {
    if (!alertAuction) return;
    if (alertTimerRef.current) clearInterval(alertTimerRef.current);
    alertTimerRef.current = setInterval(() => {
      setAlertCountdown(prev => {
        if (prev <= 1) { closeAlert(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => { if (alertTimerRef.current) clearInterval(alertTimerRef.current); };
  }, [alertAuction]);

  /* ── WebSocket ── */
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
          if (msg.event === "auction_invite" || msg.event === "round_started") {
            load();
            // Ouvrir popup alerte si on a les données du transfert
            if (msg.transfer) openAlert(msg.transfer);
          }
          if (msg.event === "new_bid") load();
          if (msg.event === "outbid") {
            // L'agent est surclassé sur une enchère où il avait déjà enchéri
            const matched = list.find((t: any) => t.id === msg.transfer_id);
            setOutbidAlert({
              transferId: msg.transfer_id,
              yourBid: msg.your_bid,
              newBest: msg.new_best,
              transfer: matched || null,
            });
            load();
          }
          if (msg.event === "agent_assigned") {
            load();
            setOutbidAlert(null);
            // Si c'est l'enchère en cours dans le popup, fermer
            if (alertAuction && msg.transfer_id === alertAuction.id) closeAlert();
          }
        } catch {}
      };
      ws.onerror = () => setWsAlive(false);
      ws.onclose = () => setWsAlive(false);
      return () => { try { ws.close(); } catch {} };
    } catch {}
  }, [token, load, openAlert, closeAlert, alertAuction]);

  /* ── Soumettre offre ── */
  const submitBid = async () => {
    setBidErr(null);
    setBidBusy(true);
    try {
      const clientMax = parseFloat(String(bidOpen?.fee_percent ?? 99));
      const proposed = parseFloat(feePct);
      if (isNaN(proposed) || proposed <= 0) { setBidErr("Saisissez un pourcentage valide (> 0)."); setBidBusy(false); return; }
      if (proposed > clientMax) { setBidErr(`Max autorisé : ${clientMax.toFixed(2)}%`); setBidBusy(false); return; }
      const { data } = await api.post(`/agent/auctions/${bidOpen.id}/bid`, { transfer_id: bidOpen.id, bid_fee_percent: proposed, eta_minutes: parseInt(eta) });
      const c = data?.commission;
      setCommissionMsg(c
        ? `Frais client : ${c.client_fee_amount?.toFixed(2)}€ (${c.client_fee_pct}%)\nPart entreprise (20%) : ${c.company_share?.toFixed(2)}€\nVotre gain net estimé : +${c.agent_net?.toFixed(2)}€`
        : `Offre ${feePct}% · ETA ${eta} min envoyée ✓`);
      setBidOpen(null);
      closeAlert();
      load();
    } catch (e: any) { setBidErr(apiError(e)); }
    finally { setBidBusy(false); }
  };

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.neutrals.background }}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <TText variant="title" weight="extraBold">Offres en direct</TText>
          <View style={[styles.liveBadge, { backgroundColor: wsAlive ? "#F59E0B" : "#94A3B8" }]}>
            <View style={[styles.liveDot, { backgroundColor: "white" }]} />
            <TText variant="label" weight="bold" color="white" style={{ marginLeft: 4 }}>
              {wsAlive ? "LIVE" : "OFFLINE"}
            </TText>
          </View>
        </View>
        <TText variant="caption" color={colors.neutrals.textSecondary}>
          Fenêtre de {ROUND_DURATION}s par round · Popup automatique à chaque nouvelle enchère
        </TText>
      </View>

      {/* ── Filtres ── */}
      <View style={styles.tabsRow}>
        {[{ k: "city", l: "Ma ville" }, { k: "all", l: "Toutes" }].map((t) => (
          <TouchableOpacity key={t.k} style={[styles.tab, filter === t.k && styles.tabActive]} onPress={() => setFilter(t.k as any)}>
            <TText weight="bold" color={filter === t.k ? "white" : colors.neutrals.textPrimary}>{t.l}</TText>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Liste enchères ── */}
      <FlatList
        data={list}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={paybidColors.primary.base} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="flash-off-outline" size={40} color={colors.neutrals.textTertiary} />
            <TText variant="subtitle" weight="bold" color={colors.neutrals.textSecondary} style={{ marginTop: 12 }}>
              Aucune offre active
            </TText>
            <TText variant="caption" color={colors.neutrals.textTertiary} style={{ marginTop: 4, textAlign: "center" }}>
              Les nouvelles enchères apparaîtront ici{"\n"}et vous serez alerté automatiquement
            </TText>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => {
              setBidOpen(item);
              setFeePct(Math.max(0.1, (item.fee_percent || 2) - 0.5).toFixed(2));
              setBidErr(null);
            }}
            activeOpacity={0.75}
          >
            <View style={styles.cardTop}>
              <View style={styles.flag}>
                <TText weight="extraBold" style={{ fontSize: 18 }}>{item.beneficiary?.full_name?.[0] || "?"}</TText>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <TText weight="extraBold">{item.beneficiary?.full_name || "—"}</TText>
                <TText variant="caption" color={colors.neutrals.textSecondary}>
                  {item.destination_country} · {(item.delivery_mode || "").toUpperCase()}
                  {item.vip_delivery ? " · ⭐ VIP" : ""}
                </TText>
              </View>
              {item.same_city
                ? <View style={styles.cityBadge}><Ionicons name="location" size={12} color="white" /><TText variant="label" weight="bold" color="white" style={{ marginLeft: 4 }}>Ma ville</TText></View>
                : null}
            </View>
            <View style={styles.cardBody}>
              <View>
                <TText variant="label" color={colors.neutrals.textTertiary}>Client envoie</TText>
                <TText variant="title" weight="extraBold" color={paybidColors.primary.base}>
                  {Number(item.send_amount).toFixed(0)} EUR
                </TText>
              </View>
              <Ionicons name="arrow-forward" size={18} color={colors.neutrals.textTertiary} style={{ alignSelf: "center" }} />
              <View style={{ alignItems: "flex-end" }}>
                <TText variant="label" color={colors.neutrals.textTertiary}>Bénéficiaire reçoit</TText>
                <TText variant="title" weight="extraBold">
                  {Number(item.receive_amount).toFixed(0)} {item.destination_currency}
                </TText>
              </View>
            </View>
            <View style={styles.cardFoot}>
              <View style={styles.roundBadge}>
                <TText variant="label" weight="bold" color="#F59E0B">Round {item.auction_round || 1}/5</TText>
              </View>
              <TText variant="caption" color={colors.neutrals.textSecondary}>
                Frais max {(item.fee_percent || 2).toFixed(2)}%
              </TText>
              <TText variant="caption" weight="bold" color={paybidColors.primary.base}>Enchérir →</TText>
            </View>
          </TouchableOpacity>
        )}
      />

      {/* ════════════════════════════════════════════
          BANNIÈRE SURCLASSÉ (outbid)
          ════════════════════════════════════════════ */}
      {outbidAlert && (
        <View style={styles.outbidBanner}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
              <Ionicons name="trending-down" size={16} color="#EF4444" />
              <TText variant="body" weight="extraBold" color="#EF4444" style={{ marginLeft: 6 }}>
                Vous êtes surclassé !
              </TText>
            </View>
            <TText variant="caption" color="#7F1D1D">
              Votre offre : <TText variant="caption" weight="bold" color="#EF4444">{outbidAlert.yourBid.toFixed(2)}%</TText>
              {"  "}·{"  "}
              Meilleure offre actuelle : <TText variant="caption" weight="bold" color="#10B981">{outbidAlert.newBest.toFixed(2)}%</TText>
            </TText>
            <TText variant="label" color="#991B1B" style={{ marginTop: 3 }}>
              Proposez moins de {outbidAlert.newBest.toFixed(2)}% pour reprendre la tête
            </TText>
          </View>
          <View style={{ gap: 8, marginLeft: 10 }}>
            <TouchableOpacity
              style={[styles.alertBtn, { backgroundColor: paybidColors.primary.base, paddingHorizontal: 12 }]}
              onPress={() => {
                const tr = outbidAlert.transfer || list.find((t: any) => t.id === outbidAlert.transferId);
                if (tr) {
                  setBidOpen(tr);
                  setFeePct(Math.max(0.1, outbidAlert.newBest - 0.1).toFixed(2));
                  setBidErr(null);
                }
                setOutbidAlert(null);
              }}
            >
              <Ionicons name="flash" size={14} color="white" />
              <TText variant="label" weight="bold" color="white" style={{ marginLeft: 4 }}>Relancer</TText>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setOutbidAlert(null)} style={{ alignItems: "center" }}>
              <Ionicons name="close" size={16} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ════════════════════════════════════════════
          POPUP ALERTE — nouvelle enchère (slide up)
          ════════════════════════════════════════════ */}
      {alertAuction && (
        <Animated.View style={[styles.alertPopup, { transform: [{ translateY: alertSlide }] }]}>
          {/* Barre de drag */}
          <View style={styles.dragBar} />

          {/* En-tête alerte */}
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.md }}>
            <View style={styles.alertIconWrap}>
              <Ionicons name="flash" size={22} color="white" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <TText weight="extraBold" style={{ fontSize: 16 }}>Nouvelle enchère !</TText>
                {queueCount > 0 && (
                  <View style={styles.queueBadge}>
                    <TText style={{ color: "white", fontSize: 10, fontWeight: "bold" }}>+{queueCount}</TText>
                  </View>
                )}
              </View>
              <TText variant="caption" color={colors.neutrals.textSecondary}>
                {queueCount > 0
                  ? `${queueCount} autre${queueCount > 1 ? "s" : ""} en attente — affichée automatiquement`
                  : "Répondez avant expiration du round"}
              </TText>
            </View>
            <Countdown seconds={alertCountdown} total={ROUND_DURATION} />
          </View>

          {/* Détails transfert */}
          <View style={styles.alertCard}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View>
                <TText variant="caption" color={colors.neutrals.textTertiary}>Bénéficiaire</TText>
                <TText weight="extraBold">{alertAuction.beneficiary?.full_name || "—"}</TText>
                <TText variant="caption" color={colors.neutrals.textSecondary}>
                  {alertAuction.destination_country} · {(alertAuction.delivery_mode || "").toUpperCase()}
                  {alertAuction.vip_delivery ? " · ⭐ VIP" : ""}
                </TText>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <TText variant="caption" color={colors.neutrals.textTertiary}>Montant</TText>
                <TText variant="subtitle" weight="extraBold" color={paybidColors.primary.base}>
                  {Number(alertAuction.send_amount || 0).toFixed(0)} EUR
                </TText>
                <TText variant="caption" color={colors.neutrals.textSecondary}>
                  → {Number(alertAuction.receive_amount || 0).toFixed(0)} {alertAuction.destination_currency}
                </TText>
              </View>
            </View>
            <View style={{ flexDirection: "row", marginTop: 10, gap: 8 }}>
              <View style={styles.roundBadge}>
                <TText variant="label" weight="bold" color="#F59E0B">Round {alertAuction.auction_round || 1}/5</TText>
              </View>
              <View style={[styles.roundBadge, { backgroundColor: "#EEF2FF" }]}>
                <TText variant="label" weight="bold" color="#6366F1">Max {(alertAuction.fee_percent || 2).toFixed(2)}%</TText>
              </View>
              {alertAuction.same_city && (
                <View style={[styles.roundBadge, { backgroundColor: "#D1FAE5" }]}>
                  <TText variant="label" weight="bold" color="#10B981">📍 Ma ville</TText>
                </View>
              )}
            </View>
          </View>

          {/* Explication mécanisme */}
          <View style={styles.mechBox}>
            <Ionicons name="information-circle-outline" size={14} color="#6366F1" />
            <TText variant="label" color="#6366F1" style={{ marginLeft: 6, flex: 1, lineHeight: 18 }}>
              Enchère descendante — proposez un frais{" "}
              <TText variant="label" weight="extraBold" color="#6366F1">
                strictement inférieur à {(alertAuction.fee_percent || 2).toFixed(2)}%
              </TText>
              {" "}pour être sélectionné. Le meilleur prix l'emporte.
            </TText>
          </View>

          {/* Boutons d'action */}
          <View style={{ gap: 8 }}>
            {/* Accepter directement au tarif client */}
            <TouchableOpacity
              style={[styles.alertBtn, { backgroundColor: "#10B981" }]}
              onPress={async () => {
                closeAlert();
                try {
                  const pct = Math.max(0.1, (alertAuction.fee_percent || 2) - 0.01);
                  const { data } = await api.post(`/agent/auctions/${alertAuction.id}/bid`, {
                    transfer_id: alertAuction.id,
                    bid_fee_percent: parseFloat(pct.toFixed(2)),
                    eta_minutes: 30,
                  });
                  const c = data?.commission;
                  setCommissionMsg(c
                    ? `Acceptation directe ✓\nFrais : ${c.client_fee_amount?.toFixed(2)}€\nVotre gain net : +${c.agent_net?.toFixed(2)}€`
                    : "Mission acceptée \u2714");
                  load();
                } catch (e: any) { setBidErr(apiError(e)); }
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="checkmark-circle" size={16} color="white" />
              <TText variant="body" weight="extraBold" color="white" style={{ marginLeft: 6 }}>Accepter au tarif client</TText>
            </TouchableOpacity>

            <View style={styles.alertActions}>
              {/* Négocier (offre inférieure) */}
              <TouchableOpacity
                style={[styles.alertBtn, { backgroundColor: paybidColors.primary.base, flex: 2 }]}
                onPress={() => {
                  setBidOpen(alertAuction);
                  setFeePct(Math.max(0.1, (alertAuction.fee_percent || 2) - 0.5).toFixed(2));
                  setBidErr(null);
                  closeAlert();
                }}
                activeOpacity={0.85}
              >
                <Ionicons name="trending-down" size={16} color="white" />
                <TText variant="body" weight="bold" color="white" style={{ marginLeft: 6 }}>Négocier les frais</TText>
              </TouchableOpacity>

              {/* Passer */}
              <TouchableOpacity
                style={[styles.alertBtn, { backgroundColor: "#FEE2E2", borderWidth: 1.5, borderColor: "#EF4444" }]}
                onPress={() => closeAlert()}
                activeOpacity={0.85}
              >
                <Ionicons name="close-circle-outline" size={16} color="#EF4444" />
                <TText variant="body" weight="bold" color="#EF4444" style={{ marginLeft: 4 }}>Passer</TText>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      )}

      {/* ════════════════════════════════════════════
          MODAL ENCHÉRIR (frais + ETA)
          ════════════════════════════════════════════ */}
      <Modal visible={!!bidOpen} transparent animationType="slide" onRequestClose={() => setBidOpen(null)}>
        <View style={styles.modalBg}>
          <View style={styles.sheet}>
            <View style={styles.dragBar} />

            {/* En-tête */}
            <TText variant="subtitle" weight="extraBold" style={{ marginBottom: 2 }}>Votre offre de frais</TText>
            <TText variant="caption" color={colors.neutrals.textSecondary} style={{ marginBottom: spacing.md }}>
              {bidOpen?.beneficiary?.full_name} · {bidOpen?.destination_country} ·{" "}
              <TText variant="caption" weight="bold" color={paybidColors.primary.base}>
                {Number(bidOpen?.send_amount || 0).toFixed(0)} EUR
              </TText>
            </TText>

            {/* Règle simplifiée */}
            <View style={styles.ruleBox}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                <TText variant="caption" color={colors.neutrals.textSecondary}>Plafond client (max)</TText>
                <TText variant="caption" weight="extraBold" color="#EF4444">
                  {Number(bidOpen?.fee_percent || 0).toFixed(2)}%
                </TText>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <TText variant="caption" color={colors.neutrals.textSecondary}>Votre offre actuelle</TText>
                <TText variant="caption" weight="extraBold" color={paybidColors.primary.base}>
                  {feePct || "—"}%
                </TText>
              </View>
              {/* Gain estimé temps réel */}
              {(() => {
                const pct = parseFloat(feePct);
                const amt = Number(bidOpen?.send_amount || 0);
                if (!isNaN(pct) && pct > 0 && amt > 0) {
                  const gross = amt * pct / 100;
                  const net = gross * 0.8;
                  return (
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: colors.neutrals.border }}>
                      <TText variant="caption" color={colors.neutrals.textSecondary}>Votre gain net estimé</TText>
                      <TText variant="caption" weight="extraBold" color="#10B981">+{net.toFixed(2)} EUR</TText>
                    </View>
                  );
                }
                return null;
              })()}
            </View>

            <Input
              label={`Frais proposés (%) — doit être < ${Number(bidOpen?.fee_percent || 0).toFixed(2)}%`}
              value={feePct}
              onChangeText={(v) => {
                const cleaned = v.replace(",", ".").replace(/[^0-9.]/g, "");
                const num = parseFloat(cleaned);
                const maxClient = parseFloat(String(bidOpen?.fee_percent ?? 99));
                if (!isNaN(num) && num > maxClient) { setFeePct(maxClient.toFixed(2)); return; }
                setFeePct(cleaned);
              }}
              keyboardType="decimal-pad"
              icon="trending-down-outline"
            />
            <Input label="Délai de livraison (minutes)" value={eta} onChangeText={setEta} keyboardType="number-pad" icon="time-outline" />
            {bidErr ? <TText color={paybidColors.status.error} style={{ marginBottom: 8 }}>{bidErr}</TText> : null}

            <Button title="Envoyer mon offre" onPress={submitBid} icon="flash" loading={bidBusy}
              style={{ backgroundColor: paybidColors.primary.base }} />
            <TouchableOpacity onPress={() => setBidOpen(null)} style={{ alignSelf: "center", marginTop: 12 }}>
              <TText color={colors.neutrals.textSecondary}>Annuler</TText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ════════════════════════════════════════════
          MODAL CONFIRMATION COMMISSION
          ════════════════════════════════════════════ */}
      <Modal visible={!!commissionMsg} transparent animationType="fade" onRequestClose={() => setCommissionMsg(null)}>
        <View style={styles.modalBg}>
          <View style={styles.sheet}>
            <View style={{ alignItems: "center", marginBottom: spacing.md }}>
              <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: "#10B981", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="checkmark-circle" size={38} color="white" />
              </View>
              <TText variant="subtitle" weight="extraBold" align="center" style={{ marginTop: 10 }}>Offre envoyée ✓</TText>
            </View>
            <View style={{ backgroundColor: paybidColors.overlays.primarySoft, borderRadius: radii.lg, padding: spacing.md, marginBottom: spacing.md }}>
              <TText variant="caption" weight="bold" color={paybidColors.primary.base} style={{ marginBottom: 6 }}>DÉTAIL COMMISSION ESTIMÉE</TText>
              <TText variant="caption" color={colors.neutrals.textPrimary} style={{ lineHeight: 22 }}>{commissionMsg}</TText>
            </View>
            <TText variant="label" color={colors.neutrals.textTertiary} align="center" style={{ marginBottom: spacing.md }}>
              Attribution finale à la clôture du round selon les offres concurrentes.
            </TText>
            <Button title="Compris" onPress={() => setCommissionMsg(null)} style={{ backgroundColor: paybidColors.primary.base }} />
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  liveBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 5, borderRadius: radii.full },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  tabsRow: { flexDirection: "row", gap: 8, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  tab: { flex: 1, paddingVertical: 10, borderRadius: radii.full, backgroundColor: paybidColors.neutrals.surface, borderWidth: 1.5, borderColor: paybidColors.neutrals.border, alignItems: "center" },
  tabActive: { backgroundColor: paybidColors.primary.base, borderColor: paybidColors.primary.base },

  /* Cards liste */
  card: { backgroundColor: paybidColors.neutrals.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: paybidColors.neutrals.border, padding: spacing.md, marginBottom: 10 },
  cardTop: { flexDirection: "row", alignItems: "center" },
  flag: { width: 44, height: 44, borderRadius: 22, backgroundColor: paybidColors.overlays.primarySoft, alignItems: "center", justifyContent: "center" },
  cityBadge: { flexDirection: "row", alignItems: "center", backgroundColor: paybidColors.primary.base, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radii.full },
  cardBody: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: paybidColors.neutrals.border },
  cardFoot: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: paybidColors.neutrals.border },
  roundBadge: { backgroundColor: "#FEF3C7", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },

  /* Empty */
  empty: { alignItems: "center", paddingTop: 80 },

  /* Popup alerte */
  alertPopup: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "white",
    borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl,
    padding: spacing.lg, paddingBottom: 36,
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 16,
    elevation: 20,
  },
  dragBar: { width: 40, height: 4, borderRadius: 2, backgroundColor: paybidColors.neutrals.border, alignSelf: "center", marginBottom: spacing.md },
  alertIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#F59E0B", alignItems: "center", justifyContent: "center" },
  alertCard: { backgroundColor: paybidColors.neutrals.background, borderRadius: radii.xl, padding: spacing.md, borderWidth: 1, borderColor: paybidColors.neutrals.border, marginBottom: spacing.md },
  alertActions: { flexDirection: "row", gap: 8 },
  alertBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 13, paddingHorizontal: 14, borderRadius: radii.lg },

  /* Modal enchérir */
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "white", borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl, padding: spacing.lg, paddingBottom: 36 },
  capWarning: { flexDirection: "row", alignItems: "flex-start", backgroundColor: "#FEF3C7", borderRadius: radii.lg, padding: 10, marginBottom: spacing.md, borderWidth: 1, borderColor: "#FCD34D" },
  mechBox: { flexDirection: "row", alignItems: "flex-start", backgroundColor: "#EEF2FF", borderRadius: radii.lg, padding: 10, marginBottom: spacing.md, borderWidth: 1, borderColor: "#C7D2FE" },
  queueBadge: { backgroundColor: "#EF4444", borderRadius: 10, minWidth: 20, height: 20, paddingHorizontal: 5, alignItems: "center", justifyContent: "center" },
  outbidBanner: { position: "absolute", bottom: 90, left: spacing.lg, right: spacing.lg, backgroundColor: "#FEF2F2", borderRadius: radii.xl, borderWidth: 1.5, borderColor: "#FCA5A5", padding: spacing.md, flexDirection: "row", alignItems: "center", shadowColor: "#EF4444", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 12 },
  ruleBox: { backgroundColor: paybidColors.neutrals.background, borderRadius: radii.xl, padding: spacing.md, borderWidth: 1, borderColor: paybidColors.neutrals.border, marginBottom: spacing.md },
});
