import React, { useCallback, useState, useEffect } from "react";
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Switch, ActivityIndicator, Animated } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { TText } from "../../../src/components/TText";
import { SendBidLogo } from "../../../src/components/Logo";
import { Button } from "../../../src/components/Button";
import { api, apiError } from "../../../src/api";
import { paybidColors, paybidFontFamily } from "../../../src/paybidTheme";
import { spacing, radii, shadows } from "../../../src/theme";
import { useTranslation } from "../../../src/i18n";

const round2 = (n: number) => Math.round(n * 100) / 100;

// Animation shimmer
const Shimmer = () => {
  const translateX = React.useRef(new Animated.Value(-100)).current;
  React.useEffect(() => {
    Animated.loop(
      Animated.timing(translateX, {
        toValue: 400,
        duration: 1500,
        useNativeDriver: true,
      })
    ).start();
  }, []);
  return (
    <Animated.View style={[styles.shimmer, { transform: [{ translateX }] }]} />
  );
};

const SkeletonCard = () => (
  <View style={styles.skeletonCard}>
    <Shimmer />
  </View>
);

const SkeletonRow = () => (
  <View style={styles.skeletonRow}>
    <Shimmer />
  </View>
);

export default function PaybidDashboard() {
  const { t } = useTranslation();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [float, setFloat] = useState<{ balance: number; currency: string } | null>(null);
  const [available, setAvailable] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hideEarnings, setHideEarnings] = useState(false);

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const [{ data: d }, { data: f }] = await Promise.all([
        api.get("/agent/dashboard"),
        api.get("/agent/float").catch(() => ({ data: { items: [] } })),
      ]);
      setData(d);
      setAvailable(d.agent?.available !== false);
      const first = (f.items || [])[0];
      if (first) setFloat({ balance: first.balance || 0, currency: first.currency || "XOF" });
    } catch (e: any) {
      setError(apiError(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggleAvail = async () => {
    const next = !available;
    setAvailable(next);
    try { 
      await api.post("/agent/availability", { available: next }); 
    } catch (e: any) {
      setAvailable(!next); // Rollback on error
      setError("Impossible de changer le statut. Réessayez.");
    }
  };

  // Loading state
  if (loading) {
    return (
      <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: paybidColors.neutrals.background }}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={paybidColors.primary.base} />
          <TText variant="caption" color={paybidColors.neutrals.textSecondary} style={{ marginTop: 16 }}>
            Chargement...
          </TText>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error) {
    return (
      <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: paybidColors.neutrals.background }}>
        <View style={styles.errorContainer}>
          <View style={styles.errorIcon}>
            <Ionicons name="cloud-offline-outline" size={48} color={paybidColors.status.error} />
          </View>
          <TText variant="subtitle" weight="bold" align="center" style={{ marginBottom: 8 }}>
            Erreur de connexion
          </TText>
          <TText variant="caption" color={paybidColors.neutrals.textSecondary} align="center" style={{ marginBottom: 24 }}>
            {error}
          </TText>
          <Button 
            title="Réessayer" 
            icon="refresh-outline" 
            onPress={() => load()} 
            style={{ backgroundColor: paybidColors.primary.base, minWidth: 140 }}
          />
        </View>
      </SafeAreaView>
    );
  }
  const { agent, stats, active_transfers, auctions_preview } = data;

  return (
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: paybidColors.neutrals.background }}>
      <ScrollView 
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(false)} tintColor={paybidColors.primary.base} />} 
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl + 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header card - avec Status et Oeil pour gains */}
        <LinearGradient colors={paybidColors.gradients.main} start={{x:0,y:0}} end={{x:1,y:1}} style={[styles.heroCard, shadows.lg]}>
          <View style={styles.heroTop}>
            <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
              <View style={styles.logoChip}>
                <SendBidLogo size={36} />
              </View>
              <View style={{ marginLeft: 12 }}>
                <TText variant="caption" weight="extraBold" color="white" style={{ letterSpacing: 1, fontFamily: paybidFontFamily.extraBold }}>PAYBID</TText>
                <TText variant="body" color="rgba(255,255,255,0.9)" style={{ fontFamily: paybidFontFamily.medium }}>
                  {agent.full_name}
                </TText>
                <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
                  <Ionicons name="location-outline" size={12} color="rgba(255,255,255,0.7)" />
                  <TText variant="label" color="rgba(255,255,255,0.7)">{agent.city}</TText>
                </View>
              </View>
            </View>
            {/* Status à droite comme avant */}
            <View style={{ alignItems: "flex-end" }}>
              <View style={[styles.statusBadge, { backgroundColor: available ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)" }]}>
                <View style={[styles.statusDotSmall, { backgroundColor: available ? "#10B981" : "#EF4444" }]} />
                <TText variant="label" weight="extraBold" color="white">{available ? "EN LIGNE" : "OFFLINE"}</TText>
              </View>
              <Switch 
                value={available} 
                onValueChange={toggleAvail} 
                thumbColor="white" 
                trackColor={{ true: "rgba(16,185,129,0.6)", false: "rgba(255,255,255,0.3)" }} 
                style={{ marginTop: 8 }}
              />
            </View>
          </View>
          
          {/* Earnings Section avec Oeil */}
          <View style={styles.earningsSection}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <TText variant="caption" color="rgba(255,255,255,0.8)" style={{ fontFamily: paybidFontFamily.medium }}>Gains 7 jours</TText>
              <TouchableOpacity onPress={() => setHideEarnings(!hideEarnings)}>
                <Ionicons name={hideEarnings ? "eye-off-outline" : "eye-outline"} size={20} color="rgba(255,255,255,0.8)" />
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: "row", alignItems: "baseline", marginTop: 4 }}>
              <TText variant="display" weight="extraBold" color="white" style={{ fontFamily: paybidFontFamily.extraBold }}>
                {hideEarnings ? "••••" : stats.week_earnings_eur.toFixed(0)}
              </TText>
              <TText variant="title" weight="bold" color="rgba(255,255,255,0.9)" style={{ marginLeft: 4, fontFamily: paybidFontFamily.bold }}>
                {hideEarnings ? "" : "EUR"}
              </TText>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
              <View style={styles.statPill}>
                <Ionicons name="checkmark-circle" size={12} color="white" />
                <TText variant="label" color="white" style={{ marginLeft: 4 }}>{stats.week_completed} transferts</TText>
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* Stats */}
        <View style={styles.statsRow}>
          <Stat icon="flash-outline" label="Offres ouvertes" value={`${stats.same_city_auctions}/${stats.pending_auctions}`} />
          <Stat icon="paper-plane-outline" label="En cours" value={`${stats.active_count}`} />
          <Stat icon="checkmark-circle-outline" label="Aujourd'hui" value={`${stats.today_completed}`} />
        </View>

        {/* Float card — espèces en caisse */}
        <TouchableOpacity testID="paybid-float-card" activeOpacity={0.85} style={styles.floatCard} onPress={() => router.push("/paybid/float" as any)}>
          <LinearGradient colors={[paybidColors.primary.dark, paybidColors.primary.base]} style={styles.floatInner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <View style={styles.floatIcon}>
              <Ionicons name="cash" size={22} color="white" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <TText variant="caption" color="rgba(255,255,255,0.75)" weight="semiBold">ESPÈCES EN CAISSE</TText>
              <TText variant="title" weight="extraBold" color="white">
                {float ? `${float.balance.toLocaleString("fr-FR")} ${float.currency}` : "— XOF"}
              </TText>
              <TText variant="label" color="rgba(255,255,255,0.7)">Déclarer / Verser au siège</TText>
            </View>
            <Ionicons name="chevron-forward" size={22} color="white" />
          </LinearGradient>
        </TouchableOpacity>

        {/* Active transfers */}
        <SectionHeader title="Transferts en cours" onSeeAll={() => router.push("/paybid/(tabs)/transfers" as any)} />
        {active_transfers.length === 0 ? <Empty label="Aucun transfert en cours" /> : active_transfers.map((t: any) => {
          const isVip = t.vip_delivery || t.service_level === "vip" || t.service_level === "vip_express";
          const svcLabel = t.service_level === "vip_express" ? "VIP EXPRESS" : isVip ? "VIP" : "STANDARD";
          const stColor = t.status === "AGENT_ASSIGNED" ? "#2563EB" : t.status === "READY_FOR_PICKUP" ? "#D97706" : t.status === "VIP_DELIVERY" ? "#7C3AED" : "#2563EB";
          const stLabel = t.status === "AGENT_ASSIGNED" ? "Assigné" : t.status === "PROCESSING" ? "En cours" : t.status === "READY_FOR_PICKUP" ? "Retrait" : t.status === "VIP_DELIVERY" ? "Livraison" : t.status;
          const feePct = (t.selected_bid?.bid_fee_percent || t.fee_percent || 0);
          const commission = ((feePct / 100) * (t.send_amount || 0)).toFixed(2);
          return (
          <TouchableOpacity key={t.id} style={styles.transferCard} onPress={() => router.push({ pathname: "/paybid/transfer/[id]" as any, params: { id: t.id } })}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: stColor }} />
                <TText weight="bold" style={{ fontSize: 11, color: stColor }}>{stLabel}</TText>
              </View>
              <View style={{ backgroundColor: isVip ? "#7C3AED" : paybidColors.neutrals.textTertiary, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 }}>
                <TText style={{ fontSize: 9, color: "white", fontWeight: "800" }}>{svcLabel}</TText>
              </View>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flex: 1 }}>
                <TText weight="bold" style={{ fontSize: 14 }}>{t.beneficiary?.full_name || "—"}</TText>
                <TText variant="caption" color={paybidColors.neutrals.textSecondary}>{t.beneficiary?.city || t.destination_city || "—"} · {t.destination_country}</TText>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <TText weight="extraBold" style={{ fontSize: 15, color: paybidColors.primary.base }}>{Number(t.receive_amount || 0).toLocaleString("fr-FR")}</TText>
                <TText variant="caption" color={paybidColors.neutrals.textSecondary}>{t.destination_currency || "XOF"}</TText>
              </View>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
              <Ionicons name="cash-outline" size={11} color="#16A34A" />
              <TText style={{ fontSize: 10, color: "#16A34A", fontWeight: "700", marginLeft: 4 }}>+{commission} €</TText>
              <View style={{ flex: 1 }} />
              <Ionicons name="chevron-forward" size={14} color={paybidColors.neutrals.textTertiary} />
            </View>
          </TouchableOpacity>
          );
        })}

        {/* Auctions preview */}
        <SectionHeader title="Offres à proximité" onSeeAll={() => router.push("/paybid/(tabs)/transfers" as any)} />
        {auctions_preview.length === 0 ? <Empty label="Aucune offre ouverte" /> : auctions_preview.map((t: any) => {
          const serviceLevel = t.service_level || (t.vip_delivery ? "VIP" : "STANDARD");
          const isVip = serviceLevel !== "STANDARD";
          const commissionEur = t.commission_eur || round2((t.fee_percent || 0) / 100 * (t.send_amount || 0));
          const feePercent = t.fee_percent || 2;
          const createdAt = t.created_at ? new Date(t.created_at) : null;
          const agoMin = createdAt ? Math.max(0, Math.floor((Date.now() - createdAt.getTime()) / 60000)) : 0;
          const agoLabel = agoMin < 1 ? "À l'instant" : agoMin < 60 ? `il y a ${agoMin} min` : `il y a ${Math.floor(agoMin / 60)}h`;
          const roundNum = t.auction_round || 1;
          return (
          <TouchableOpacity key={t.id} style={styles.auctionCard} onPress={() => router.push("/paybid/(tabs)/auctions" as any)}>
            {/* Row 1: Priorité + Statut tour + Badge ville */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View style={[styles.priorityBadge, isVip && { backgroundColor: "#FEF3C7" }]}>
                  <Ionicons name={isVip ? "diamond" : "cube-outline"} size={11} color={isVip ? "#D97706" : paybidColors.neutrals.textSecondary} />
                  <TText variant="label" weight="extraBold" color={isVip ? "#D97706" : paybidColors.neutrals.textSecondary}> {serviceLevel}</TText>
                </View>
                <View style={styles.roundBadge}>
                  <Ionicons name="flash" size={11} color="#F59E0B" />
                  <TText variant="label" weight="bold" color="#F59E0B"> {roundNum}/5</TText>
                </View>
              </View>
              {t.same_city ? (
                <View style={styles.cityBadgeSmall}>
                  <Ionicons name="location" size={11} color="white" />
                  <TText variant="label" weight="bold" color="white"> Ma ville</TText>
                </View>
              ) : (
                <TText variant="label" color={paybidColors.neutrals.textTertiary}>{t.beneficiary?.city || t.destination_country}</TText>
              )}
            </View>

            {/* Row 2: Bénéficiaire + Montant */}
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
              <View style={styles.auctionAvatar}>
                <TText weight="extraBold" color={paybidColors.primary.base}>{(t.beneficiary?.full_name || "?")[0]}</TText>
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <TText weight="bold" style={{ fontSize: 15 }}>{t.beneficiary?.full_name || "—"}</TText>
                <TText variant="caption" color={paybidColors.neutrals.textSecondary}>
                  De : {t.sender_name || "—"}
                </TText>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <TText variant="title" weight="extraBold" color={paybidColors.primary.base}>
                  {Number(t.receive_amount || 0).toLocaleString("fr-FR")} {t.destination_currency || "XOF"}
                </TText>
              </View>
            </View>

            {/* Row 3: Commission + Temps + CTA */}
            <View style={styles.auctionBottom}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <View style={styles.commissionChip}>
                  <Ionicons name="cash-outline" size={13} color="#16A34A" />
                  <TText variant="label" weight="extraBold" color="#16A34A"> {commissionEur.toFixed(2)} €</TText>
                  <TText variant="label" color={paybidColors.neutrals.textTertiary}> ({feePercent.toFixed(1)}%)</TText>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Ionicons name="time-outline" size={13} color={paybidColors.neutrals.textSecondary} />
                  <TText variant="label" color={paybidColors.neutrals.textSecondary}> {agoLabel}</TText>
                </View>
              </View>
              <View style={styles.bidCta}>
                <TText variant="label" weight="extraBold" color="white">PROPOSER</TText>
                <Ionicons name="arrow-forward" size={12} color="white" style={{ marginLeft: 4 }} />
              </View>
            </View>
          </TouchableOpacity>
          );
        })}

        {/* Services agent */}
        <SectionHeader title="Services agent" />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          <ServiceBtn icon="qr-code" label="Scanner" color="#2563EB" onPress={() => router.push("/paybid/scan" as any)} />
          <ServiceBtn icon="arrow-down-circle" label="Recharge client" color="#10B981" onPress={() => router.push("/paybid/scan" as any)} />
          <ServiceBtn icon="arrow-up-circle" label="Retrait client" color="#F59E0B" onPress={() => router.push("/paybid/scan" as any)} />
          <ServiceBtn icon="wallet" label="Caisse" color={paybidColors.primary.base} onPress={() => router.push("/paybid/float" as any)} />
          <ServiceBtn icon="flash" label="Offres" color="#7C3AED" onPress={() => router.push("/paybid/(tabs)/transfers" as any)} />
          <ServiceBtn icon="cash" label="Gains" color="#16A34A" onPress={() => router.push("/paybid/(tabs)/account" as any)} />
          <ServiceBtn icon="arrow-up-circle" label="Retirer" color="#EF4444" onPress={() => router.push("/paybid/cashout" as any)} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ icon, label, value }: any) {
  return (
    <View style={styles.stat}>
      <View style={styles.statIcon}><Ionicons name={icon} size={18} color={paybidColors.primary.base} /></View>
      <TText variant="title" weight="extraBold" color={paybidColors.primary.base}>{value}</TText>
      <TText variant="label" color={paybidColors.neutrals.textSecondary} align="center">{label}</TText>
    </View>
  );
}
function SectionHeader({ title, onSeeAll }: any) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: spacing.xl, marginBottom: 8 }}>
      <TText variant="subtitle" weight="bold">{title}</TText>
      {onSeeAll ? (<TouchableOpacity onPress={onSeeAll}><TText variant="caption" weight="bold" color={paybidColors.primary.base}>Voir plus</TText></TouchableOpacity>) : null}
    </View>
  );
}
function Empty({ label }: any) { return (<View style={styles.empty}><TText color={paybidColors.neutrals.textSecondary}>{label}</TText></View>); }
function ActionBtn({ icon, label, onPress }: any) {
  return (
    <TouchableOpacity style={styles.actionBtn} onPress={onPress}>
      <View style={styles.actionIcon}><Ionicons name={icon} size={20} color={paybidColors.primary.base} /></View>
      <TText variant="caption" weight="bold">{label}</TText>
    </TouchableOpacity>
  );
}
function ServiceBtn({ icon, label, color, onPress }: { icon: string; label: string; color: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.serviceBtn} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.serviceIcon, { backgroundColor: color + "15" }]}>
        <Ionicons name={icon as any} size={22} color={color} />
      </View>
      <TText style={{ fontSize: 10, fontWeight: "700", marginTop: 6, textAlign: "center" }}>{label}</TText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // Loading & Error states
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: paybidColors.neutrals.background },
  errorContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.xl },
  errorIcon: { 
    width: 80, 
    height: 80, 
    borderRadius: radii.full, 
    backgroundColor: "rgba(239,68,68,0.1)", 
    alignItems: "center", 
    justifyContent: "center",
    marginBottom: spacing.lg 
  },
  
  // Skeleton
  skeletonCard: { 
    height: 120, 
    backgroundColor: "#E5E5E5", 
    borderRadius: radii.xxl, 
    marginBottom: spacing.md,
    overflow: "hidden",
    position: "relative"
  },
  skeletonRow: { 
    height: 72, 
    backgroundColor: "#E5E5E5", 
    borderRadius: radii.lg, 
    marginBottom: spacing.md,
    overflow: "hidden"
  },
  shimmer: { 
    position: "absolute", 
    top: 0, 
    left: 0, 
    right: 0, 
    bottom: 0, 
    backgroundColor: "rgba(255,255,255,0.3)", 
    width: 100 
  },
  
  // Status Banner
  statusBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 4, borderRadius: radii.full, gap: 6 },
  statusDotSmall: { width: 6, height: 6, borderRadius: 3 },
  statusBanner: { 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
    marginBottom: spacing.md
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  
  // Hero
  heroCard: { 
    padding: spacing.lg, 
    borderRadius: radii.xxl,
    marginTop: spacing.sm
  },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  logoChip: { 
    width: 56, 
    height: 56, 
    borderRadius: radii.xl, 
    backgroundColor: "rgba(255,255,255,0.2)", 
    alignItems: "center", 
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)"
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.full,
    gap: 4
  },
  earningsSection: { marginTop: spacing.lg },
  statPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.full
  },
  
  // Stats
  statsRow: { flexDirection: "row", gap: 12, marginTop: spacing.lg },
  stat: { 
    flex: 1, 
    padding: spacing.md, 
    backgroundColor: paybidColors.neutrals.surface, 
    borderRadius: radii.xl, 
    borderWidth: 1, 
    borderColor: paybidColors.neutrals.border, 
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2
  },
  statIcon: { width: 40, height: 40, borderRadius: radii.full, backgroundColor: paybidColors.overlays.primarySoft, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  
  // Rows
  row: { 
    flexDirection: "row", 
    alignItems: "center", 
    padding: spacing.md, 
    backgroundColor: paybidColors.neutrals.surface, 
    borderRadius: radii.xl, 
    borderWidth: 1, 
    borderColor: paybidColors.neutrals.border, 
    marginBottom: spacing.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1
  },
  rowIcon: { width: 44, height: 44, borderRadius: radii.full, alignItems: "center", justifyContent: "center" },
  transferCard: {
    padding: spacing.md,
    backgroundColor: paybidColors.neutrals.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: paybidColors.neutrals.border,
    marginBottom: spacing.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  
  // Empty
  empty: { 
    alignItems: "center", 
    padding: spacing.lg, 
    backgroundColor: paybidColors.neutrals.surface, 
    borderRadius: radii.xl, 
    borderWidth: 1, 
    borderColor: paybidColors.neutrals.border,
    borderStyle: "dashed"
  },
  
  // Actions
  actionBtn: { 
    flex: 1, 
    alignItems: "center", 
    padding: spacing.md, 
    backgroundColor: paybidColors.neutrals.surface, 
    borderRadius: radii.xl, 
    borderWidth: 1, 
    borderColor: paybidColors.neutrals.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1
  },
  actionIcon: { width: 44, height: 44, borderRadius: radii.full, backgroundColor: paybidColors.overlays.primarySoft, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  serviceBtn: {
    width: "30%" as any,
    alignItems: "center",
    paddingVertical: spacing.md,
    backgroundColor: paybidColors.neutrals.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: paybidColors.neutrals.border,
  },
  serviceIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  
  // Auction cards
  auctionCard: {
    padding: spacing.md,
    backgroundColor: paybidColors.neutrals.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: paybidColors.neutrals.border,
    marginBottom: spacing.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  roundBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(245,158,11,0.12)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  priorityBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: paybidColors.neutrals.border,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  commissionChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(22,163,74,0.1)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  cityBadgeSmall: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: paybidColors.status.success,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  auctionAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: paybidColors.overlays.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  auctionBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: paybidColors.neutrals.border,
  },
  bidCta: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: paybidColors.primary.base,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
  },

  // Float
  floatCard: { marginTop: spacing.lg, borderRadius: radii.xxl, overflow: "hidden" },
  floatInner: { flexDirection: "row", alignItems: "center", padding: spacing.lg },
  floatIcon: { 
    width: 48, 
    height: 48, 
    borderRadius: radii.full, 
    backgroundColor: "rgba(255,255,255,0.25)", 
    alignItems: "center", 
    justifyContent: "center" 
  },
});
