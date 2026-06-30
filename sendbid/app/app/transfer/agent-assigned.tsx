import React, { useEffect, useRef, useState } from "react";
import { t, useLocale } from "../../src/i18n";
import { View, StyleSheet, TouchableOpacity, Animated, Easing, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { TText } from "../../src/components/TText";
import { Button } from "../../src/components/Button";
import { api } from "../../src/api";
import { colors, spacing, radii } from "../../src/theme";
import { useThemedColors } from "../../src/themeContext";
import { useTranslation } from "../../../src/i18n";
type Bid = {
  id: string;
  agent_id: string;
  agent_name?: string;
  agent_city?: string;
  agent_rating?: number;
  agent_transfers_count?: number;
  bid_fee_percent: number;
  eta_minutes?: number;
  same_city?: boolean;
};

/**
 * Assignation Agent v4.0 — matches "23 Assignation Agent" wireframe:
 * - "Recherche d'un payeur" animated header
 * - List of "PAYEURS DISPONIBLES" cards (avatar, name, rating, city, ETA, fee)
 * - One card highlighted in green with a "ASSIGNÉ" ribbon once chosen
 * - Explanation of the assignment algorithm in a light yellow info box
 * - "Suivre en direct" CTA
 */
export default function AgentAssigned() {
  const { t } = useTranslation();
  useLocale((st) => st.locale);
  const colors = useThemedColors();
  const { transfer_id } = useLocalSearchParams<{ transfer_id: string }>();
  const router = useRouter();
  const [t, setT] = useState<any>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const pulse = useRef(new Animated.Value(0)).current;

  const load = async () => {
    try {
      const [t1, t2] = await Promise.all([
        api.get(`/transfers/${transfer_id}`),
        api.get(`/transfers/${transfer_id}/bids`),
      ]);
      setT(t1.data);
      setBids(t2.data || []);
    } catch {}
  };
  useEffect(() => { if (transfer_id) load(); }, [transfer_id]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  if (!t) return null;
  const a = t.agent_snapshot || {};
  const assignedId = t.agent_id;
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.1] });

  // Build display list: put the assigned bid first, then sort by fee asc
  const sortedBids = [...bids].sort((b1, b2) => {
    if (b1.agent_id === assignedId) return -1;
    if (b2.agent_id === assignedId) return 1;
    return b1.bid_fee_percent - b2.bid_fee_percent;
  });

  return (
    <View style={{ flex: 1, backgroundColor: "#022a6b" }}>
      <LinearGradient colors={["#022a6b", "#022a6b"]} style={styles.hero}>
        <SafeAreaView edges={["top"]}>
          <View style={styles.heroTopBar}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={22} color="white" />
            </TouchableOpacity>
            <TText variant="body" weight="extraBold" color="white">Prise en charge de votre transfert</TText>
            <View style={{ width: 36 }} />
          </View>
          <View style={styles.heroBody}>
            <View style={styles.radarWrap}>
              <Animated.View style={[styles.radarRing, { transform: [{ scale }], opacity: ringOpacity }]} />
              <Animated.View style={[styles.radarRing, styles.radarRing2, { transform: [{ scale }], opacity: ringOpacity }]} />
              <View style={styles.radarCore}>
                <Ionicons name="radio" size={32} color="white" />
              </View>
            </View>
            <TText variant="title" weight="extraBold" color="white" align="center" style={{ marginTop: spacing.md }}>
              {assignedId ? "Agent assigné !" : "Recherche de payeurs…"}
            </TText>
            <TText variant="caption" color="rgba(255,255,255,0.8)" align="center">
              {assignedId
                ? `${a.full_name || "Agent"} prend votre transfert en charge`
                : `${bids.length} offre${bids.length > 1 ? "s" : ""} reçue${bids.length > 1 ? "s" : ""} — meilleure offre en cours`}
            </TText>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView style={styles.card} contentContainerStyle={styles.cardInner} showsVerticalScrollIndicator={false}>
        <TText variant="label" weight="extraBold" color={colors.neutrals.textSecondary} style={{ letterSpacing: 1, marginBottom: 12 }}>
          INFORMATIONS DE L&apos;AGENT
        </TText>

        {sortedBids.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="hourglass-outline" size={28} color={colors.neutrals.textTertiary} />
            <TText variant="caption" color={colors.neutrals.textSecondary} style={{ marginTop: 8 }}>
              En attente de l&apos;agent assigné…
            </TText>
          </View>
        ) : null}

        {/* Spec v6.4 : n'afficher que l'agent assigné (et pas la liste des offres) */}
        {sortedBids.filter((b: any) => b.agent_id === assignedId).map((b: any) => {
          const isAssigned = true;
          return (
            <View key={b.id} style={[styles.bidRow, isAssigned && styles.bidRowAssigned]}>
              {isAssigned ? (
                <View style={styles.assignedRibbon}>
                  <Ionicons name="checkmark-circle" size={12} color="white" />
                  <TText variant="label" weight="extraBold" color="white" style={{ marginLeft: 4, letterSpacing: 1 }}>
                    ASSIGNÉ
                  </TText>
                </View>
              ) : null}
              <View style={[styles.bidAvatar, isAssigned && { backgroundColor: "#10B981" }]}>
                <TText variant="body" weight="extraBold" color="white">
                  {(b.agent_name || "A").charAt(0).toUpperCase()}
                </TText>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <TText variant="body" weight="extraBold">{b.agent_profile_id || b.agent_id?.slice(0, 8) || "Agent"}</TText>
                <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
                  <Ionicons name="business-outline" size={11} color={colors.neutrals.textSecondary} />
                  <TText variant="label" color={colors.neutrals.textSecondary} style={{ marginLeft: 3 }}>
                    {b.agent_company || b.agent_name || "Agence"}
                  </TText>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
                  <Ionicons name="star" size={12} color="#F59E0B" />
                  <TText variant="label" weight="semiBold" style={{ marginLeft: 2 }}>
                    {(b.agent_rating || 4.8).toFixed(1)}
                  </TText>
                  <TText variant="label" color={colors.neutrals.textTertiary}> · </TText>
                  <Ionicons name="location-outline" size={11} color={colors.neutrals.textTertiary} />
                  <TText variant="label" color={colors.neutrals.textTertiary} style={{ marginLeft: 2 }}>
                    {b.agent_city || "—"}{b.distance_km ? ` · ${Number(b.distance_km).toFixed(1)} km` : ""}
                  </TText>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
                  <Ionicons name="time-outline" size={11} color={colors.neutrals.textSecondary} />
                  <TText variant="label" color={colors.neutrals.textSecondary} style={{ marginLeft: 2 }}>
                    ETA {b.eta_minutes || 30} min · {b.agent_transfers_count || 0} transferts
                  </TText>
                </View>
              </View>
              <View style={styles.feePill}>
                <TText variant="caption" weight="extraBold" color={isAssigned ? "#065F46" : colors.primary.base}>
                  {b.bid_fee_percent.toFixed(2)}%
                </TText>
              </View>
            </View>
          );
        })}

        {/* Algorithm info — bandeau retiré v6.4 selon spécification */}

        {/* Actions */}
        <View style={{ gap: 12, marginTop: spacing.lg }}>
          <Button
            testID="track-live"
            title="Suivre en direct"
            icon="navigate"
            onPress={() => router.replace({ pathname: "/transfer/[id]", params: { id: transfer_id! } })}
          />
          {t.vip_delivery ? (
            <Button
              testID="track-map"
              title="Voir la carte"
              icon="map-outline"
              variant="outline"
              onPress={() => router.push({ pathname: "/transfer/map", params: { transfer_id: transfer_id! } })}
            />
          ) : null}
          <Button
            testID="track-chat"
            title="Chat avec l'agent"
            icon="chatbubbles-outline"
            variant="outline"
            onPress={() => router.push(`/chat/${transfer_id}` as any)}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  heroTopBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: spacing.sm },
  backBtn: { width: 36, height: 36, borderRadius: radii.full, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" },
  heroBody: { alignItems: "center", marginTop: spacing.md },
  radarWrap: { width: 96, height: 96, alignItems: "center", justifyContent: "center" },
  radarCore: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#10B981", alignItems: "center", justifyContent: "center" },
  radarRing: { position: "absolute", width: 96, height: 96, borderRadius: 48, backgroundColor: "#10B981" },
  radarRing2: { width: 80, height: 80, borderRadius: 40 },
  card: {
    flex: 1, backgroundColor: colors.neutrals.background,
    borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl,
    marginTop: -spacing.lg,
  },
  cardInner: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  emptyBox: {
    backgroundColor: colors.neutrals.surface, borderRadius: radii.xl,
    borderWidth: 1, borderColor: colors.neutrals.border,
    alignItems: "center", padding: spacing.xl,
  },
  bidRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.neutrals.surface,
    borderWidth: 1, borderColor: colors.neutrals.border,
    borderRadius: radii.xl,
    padding: spacing.md,
    marginBottom: 10,
    position: "relative",
  },
  bidRowAssigned: { borderColor: "#10B981", borderWidth: 2, backgroundColor: "#E6F8F0" },
  assignedRibbon: {
    position: "absolute", top: -10, right: 12,
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#10B981", paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: radii.full,
  },
  bidAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary.base, alignItems: "center", justifyContent: "center" },
  feePill: {
    backgroundColor: "white", paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: radii.full, borderWidth: 1, borderColor: colors.neutrals.border,
  },
  sameCityChip: {
    backgroundColor: "#D1FAE5", paddingHorizontal: 6, paddingVertical: 1,
    borderRadius: radii.full, marginLeft: 6,
  },
  infoBox: {
    backgroundColor: "#FEF3C7", borderWidth: 1, borderColor: "#FDE68A",
    borderRadius: radii.lg,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
});
