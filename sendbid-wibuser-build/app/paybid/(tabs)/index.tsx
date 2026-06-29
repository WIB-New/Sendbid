import React, { useCallback, useState, useEffect } from "react";
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Image, Animated, Easing } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { TText } from "../../../src/components/TText";
import { SendBidLogo } from "../../../src/components/Logo";
import { api } from "../../../src/api";
import { useThemedPaybidColors } from "../../../src/themeContext";
import { paybidColors } from "../../../src/paybidTheme";
import { spacing, radii, shadows } from "../../../src/theme";

const SERVICES = [
  { key: "tr",     label: "Mes transferts",       icon: "paper-plane-outline"  as const, route: "/paybid/(tabs)/transfers" },
  { key: "gains",  label: "Mes gains",            icon: "trophy-outline"       as const, route: "/paybid/(tabs)/earnings" },
  { key: "ag",     label: "Mon agence",           icon: "business-outline"     as const, route: "/paybid/float" },
  { key: "scan",   label: "Scanner QR",           icon: "qr-code-outline"      as const, route: "/paybid/scan" },
  { key: "auct",   label: "Offres live",          icon: "flash-outline"        as const, route: "/paybid/(tabs)/auctions" },
  { key: "stats",  label: "Statistiques",         icon: "stats-chart-outline"  as const, route: "/paybid/(tabs)/earnings" },
];

export default function PaybidDashboard() {
  const paybidColors = useThemedPaybidColors();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [float, setFloat] = useState<{ balance: number; currency: string } | null>(null);
  const [available, setAvailable] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showBalance, setShowBalance] = useState(true);
  const [pulse] = useState(new Animated.Value(0.4));

  // Animation discrète "live" pour le badge offres
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0.4, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ]),
    ).start();
  }, []);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [{ data: d }, { data: f }] = await Promise.all([
        api.get("/agent/dashboard"),
        api.get("/agent/float").catch(() => ({ data: { items: [] } })),
      ]);
      setData(d);
      setAvailable(d.agent?.available !== false);
      const first = (f.items || [])[0];
      if (first) setFloat({ balance: first.balance || 0, currency: first.currency || "XOF" });
    } catch {}
    setRefreshing(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggleAvail = async () => {
    const next = !available;
    setAvailable(next);
    try { await api.post("/agent/availability", { available: next }); } catch {}
  };

  if (!data) return null;
  const { agent, stats, active_transfers, auctions_preview } = data;
  const unread = (data?.unread_notifs as number) || 0;
  const hasLiveBids = (auctions_preview || []).length > 0;

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: paybidColors.neutrals.background }}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={paybidColors.primary.base} />}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 30 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ===== Header (parité SendBID) ===== */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.avatar} onPress={() => router.push("/paybid/(tabs)/profile")}>
            {agent.avatar_url ? <Image source={{ uri: agent.avatar_url }} style={styles.avatarImg} /> : <Ionicons name="person" size={20} color={paybidColors.primary.base} />}
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <TText variant="caption" color={paybidColors.neutrals.textSecondary}>Bonjour</TText>
            <TText variant="subtitle" weight="extraBold">{(agent.full_name || "Agent").split(" ")[0]} 👋</TText>
            <TText variant="label" color={paybidColors.primary.base} weight="bold" style={{ marginTop: 2 }}>@{agent.profile_id || "PB000000"}</TText>
          </View>
          <SendBidLogo size={32} />
          <TouchableOpacity onPress={() => router.push("/notifications" as any)} style={styles.notifBtn}>
            <Ionicons name="notifications-outline" size={20} color={paybidColors.neutrals.textPrimary} />
            {unread > 0 ? <View style={styles.badge}><TText variant="label" weight="bold" color="white">{unread > 9 ? "9+" : unread}</TText></View> : null}
          </TouchableOpacity>
        </View>

        {/* ===== Caisse Card (v8 — fond MARRON UNI #54280f selon demande utilisateur) ===== */}
        <View style={[styles.heroCard, shadows.lg, { backgroundColor: "#54280f" }]}>
          <View style={styles.heroTopRow}>
            <View style={styles.logoChip}><Ionicons name="business" size={20} color="white" /></View>
            <View style={{ marginLeft: spacing.sm, flex: 1 }}>
              <TText weight="extraBold" color="white" style={styles.heroTitle}>Caisse</TText>
              <TText variant="label" color="rgba(255,255,255,0.85)" numberOfLines={1}>
                {agent.agency_name || `Agence ${agent.city || ""}`}
              </TText>
            </View>
            {/* Toggle dispo */}
            <TouchableOpacity onPress={toggleAvail} style={[styles.statusPill, { backgroundColor: available ? "rgba(255,165,0,0.32)" : "rgba(255,255,255,0.18)" }]}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: available ? "#FFA500" : "#9CA3AF", marginRight: 6 }} />
              <TText variant="label" weight="extraBold" color="white">{available ? "EN LIGNE" : "HORS LIGNE"}</TText>
            </TouchableOpacity>
          </View>

          <View style={styles.balanceLabelRow}>
            <TText variant="label" color="rgba(255,255,255,0.8)">Espèces en caisse</TText>
            <TouchableOpacity onPress={() => setShowBalance(s => !s)} style={styles.eyeBtn}>
              <Ionicons name={showBalance ? "eye" : "eye-off"} size={14} color="white" />
            </TouchableOpacity>
          </View>
          <View style={styles.balanceRow}>
            <TText weight="extraBold" color="white" style={styles.balanceHuge} numberOfLines={1} adjustsFontSizeToFit>
              {showBalance ? (float ? float.balance.toLocaleString("fr-FR") : "—") : "••••••"}
            </TText>
            <TText variant="body" weight="semiBold" color="rgba(255,255,255,0.85)" style={{ marginLeft: 6 }}>
              {float?.currency || "XOF"}
            </TText>
          </View>

          {/* Stats row dans la carte */}
          <View style={styles.kpiRow}>
            <View style={styles.kpiCol}>
              <TText variant="caption" color="rgba(255,255,255,0.75)">Gains 7j</TText>
              <TText weight="extraBold" color="white" style={{ fontSize: 14 }}>{(stats.week_earnings_eur || 0).toFixed(2)} €</TText>
            </View>
            <View style={styles.kpiSep} />
            <View style={styles.kpiCol}>
              <TText variant="caption" color="rgba(255,255,255,0.75)">Terminés 7j</TText>
              <TText weight="extraBold" color="white" style={{ fontSize: 14 }}>{stats.week_completed || 0}</TText>
            </View>
            <View style={styles.kpiSep} />
            <View style={styles.kpiCol}>
              <TText variant="caption" color="rgba(255,255,255,0.75)">Note</TText>
              <TText weight="extraBold" color="white" style={{ fontSize: 14 }}>{stats.rating || "—"} ⭐</TText>
            </View>
          </View>
        </View>

        {/* ===== 4 quick actions — palette HARMONISÉE (item 9) ===== */}
        <View style={styles.quickRow}>
          <QuickAction icon="qr-code" color="#6366F1" label="Scanner" onPress={() => router.push("/paybid/scan" as any)} />
          <QuickAction icon="cash" color="#10B981" label="Déclarer les espèces" onPress={() => router.push("/paybid/cash" as any)} />
          <QuickAction icon="arrow-up-circle" color="#F59E0B" label="Verser au siège" onPress={() => router.push("/paybid/float" as any)} />
          <QuickAction icon="trophy" color="#EC4899" label="Gains" onPress={() => router.push("/paybid/(tabs)/earnings" as any)} />
        </View>

        {/* ===== CTA "Offres en temps réel" — design INCHANGÉ, juste l'icône à gauche passe en MARRON (item 2) ===== */}
        <TouchableOpacity activeOpacity={0.85} onPress={() => router.push("/paybid/(tabs)/auctions" as any)} style={{ marginTop: spacing.xl }}>
          <LinearGradient
            colors={hasLiveBids ? ["#FFA500", "#F59E0B"] : [paybidColors.primary.base, paybidColors.primary.dark]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.liveCta}
          >
            <View style={[styles.liveIconWrap, { backgroundColor: "#54280f" }]}>
              <Ionicons name="flash" size={26} color="white" />
              {hasLiveBids ? (
                <Animated.View style={[styles.liveBlinker, { opacity: pulse }]} />
              ) : null}
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <TText weight="extraBold" color="white">Offres en temps réel</TText>
              <TText variant="caption" color="rgba(255,255,255,0.92)">
                {hasLiveBids ? `${auctions_preview.length} offre(s) ouverte(s) — répondez maintenant` : "Aucune offre ouverte — soyez prêt"}
              </TText>
            </View>
            <View style={styles.liveBadge}>
              <TText variant="label" weight="extraBold" color="white">LIVE</TText>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* ===== Mes dernières missions ===== */}
        <View style={{ marginTop: spacing.xl }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <TText variant="caption" weight="bold" style={{ fontSize: 12 }}>Mes dernières missions</TText>
            <TouchableOpacity onPress={() => router.push("/paybid/(tabs)/transfers" as any)}>
              <TText variant="caption" weight="bold" color={paybidColors.primary.base}>Voir plus</TText>
            </TouchableOpacity>
          </View>
          {active_transfers.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="diamond-outline" size={32} color={paybidColors.neutrals.textTertiary} />
              <TText variant="body" color={paybidColors.neutrals.textSecondary} style={{ marginTop: 6 }}>Aucune mission en cours</TText>
            </View>
          ) : (
            active_transfers.slice(0, 3).map((t: any) => (
              <TouchableOpacity
                key={t.id}
                style={styles.row}
                onPress={() => router.push({ pathname: "/paybid/transfer/[id]" as any, params: { id: t.id } })}
              >
                <View style={[styles.rowIcon, { backgroundColor: paybidColors.overlays.primarySoft }]}>
                  <Ionicons name="paper-plane" size={16} color={paybidColors.primary.base} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <TText weight="semiBold">{t.beneficiary?.full_name || "—"}</TText>
                  <TText variant="label" color={paybidColors.neutrals.textSecondary}>
                    {t.destination_country} · {(t.delivery_mode || "").toUpperCase()}{t.vip_delivery ? " · VIP" : ""}
                  </TText>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <TText weight="bold" color={paybidColors.primary.base}>{Number(t.receive_amount).toFixed(0)} {t.destination_currency}</TText>
                  <TText variant="label" color={paybidColors.neutrals.textTertiary}>Gain ~ {(t.fee_amount || 0).toFixed(2)} €</TText>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* ===== Services (parité SendBID — conteneur brown, items white) ===== */}
        <View style={{ marginTop: spacing.xl }}>
          <TText variant="subtitle" weight="extraBold" style={{ marginBottom: 8 }}>Services</TText>
          <View style={styles.servicesGrid}>
            {SERVICES.map((s) => (
              <TouchableOpacity
                key={s.key}
                onPress={() => router.push(s.route as any)}
                activeOpacity={0.7}
                style={styles.serviceMiniCard}
              >
                <Ionicons name={s.icon} size={20} color="white" />
                <TText variant="label" weight="semiBold" color="white" align="center" style={{ marginTop: 4 }} numberOfLines={2}>{s.label}</TText>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function QuickAction({ icon, color, label, onPress }: any) {
  return (
    <TouchableOpacity style={styles.quickBtn} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.quickIcon, { backgroundColor: color }]}>
        <Ionicons name={icon} size={20} color="white" />
      </View>
      <TText variant="label" weight="semiBold" align="center" style={{ marginTop: 6 }}>{label}</TText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", marginBottom: spacing.md, gap: 8 },
  avatar: { width: 44, height: 44, borderRadius: radii.full, backgroundColor: paybidColors.overlays.primarySoft, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarImg: { width: "100%", height: "100%" },
  notifBtn: { width: 40, height: 40, borderRadius: radii.full, backgroundColor: paybidColors.neutrals.surface, borderWidth: 1, borderColor: paybidColors.neutrals.border, alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", top: 4, right: 4, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: paybidColors.status.error, alignItems: "center", justifyContent: "center" },

  // Hero CAISSE card
  heroCard: { borderRadius: radii.xxl, paddingHorizontal: spacing.md, paddingVertical: spacing.md, overflow: "hidden" },
  heroTopRow: { flexDirection: "row", alignItems: "center" },
  heroTitle: { fontSize: 18, letterSpacing: 0.3 },
  logoChip: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  statusPill: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  balanceLabelRow: { flexDirection: "row", alignItems: "center", marginTop: 10 },
  balanceRow: { flexDirection: "row", alignItems: "baseline", marginTop: 2 },
  balanceHuge: { fontSize: 30, lineHeight: 36, includeFontPadding: false },
  eyeBtn: { marginLeft: 8, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  kpiRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: radii.lg, padding: 10, marginTop: 12 },
  kpiCol: { flex: 1, alignItems: "center" },
  kpiSep: { width: 1, height: 28, backgroundColor: "rgba(255,255,255,0.18)" },

  // Quick actions transparentes
  quickRow: { flexDirection: "row", justifyContent: "space-between", gap: 8, marginTop: spacing.md },
  quickBtn: { flex: 1, alignItems: "center", backgroundColor: "transparent", paddingVertical: 8 },
  quickIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },

  // Live CTA
  liveCta: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: radii.xl, shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  liveIconWrap: { width: 44, height: 44, borderRadius: radii.full, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center" },
  liveBlinker: { position: "absolute", width: 14, height: 14, borderRadius: 7, backgroundColor: "#EF4444", top: -2, right: -2, borderWidth: 2, borderColor: "white" },
  liveBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: "rgba(0,0,0,0.25)", borderWidth: 1, borderColor: "rgba(255,255,255,0.4)" },

  // Mes missions
  row: { flexDirection: "row", alignItems: "center", padding: 10, backgroundColor: paybidColors.neutrals.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: paybidColors.neutrals.border, marginBottom: 8 },
  rowIcon: { width: 36, height: 36, borderRadius: radii.full, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", padding: spacing.lg, backgroundColor: paybidColors.neutrals.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: paybidColors.neutrals.border },

  // Services brown container — fond MARRON UNI #54280f (item 1)
  servicesGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 4, backgroundColor: "#54280f", borderRadius: radii.xl, borderWidth: 1, borderColor: "#3D1C0A", padding: 8 },
  serviceMiniCard: { width: "31.5%", paddingVertical: 8, paddingHorizontal: 4, backgroundColor: "transparent", alignItems: "center", minHeight: 60 },
});
