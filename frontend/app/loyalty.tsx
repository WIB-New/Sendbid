import React, { useEffect, useState } from "react";
import { t, useLocale } from "../src/i18n";
import { View, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { TText } from "../src/components/TText";
import { useAuth } from "../src/store";
import { api } from "../src/api";
import { colors, spacing, radii } from "../src/theme";
import { useThemedColors } from "../src/themeContext";
// Fidélité v4.0 — "42 Fidélité" : hero gold + grille bénéfices + historique points
const LEVEL_STYLE: any = {
  Bronze: { g: ["#92400E", "#D97706"], icon: "ribbon" },
  Silver: { g: ["#475569", "#94A3B8"], icon: "ribbon" },
  Gold: { g: ["#92400E", "#F59E0B", "#FCD34D"], icon: "trophy" },
  Platinum: { g: ["#4338CA", "#8B5CF6", "#C4B5FD"], icon: "diamond" },
};
const NEXT_LEVEL: any = { Bronze: "Silver", Silver: "Gold", Gold: "Platinum", Platinum: "Platinum" };
const NEXT_POINTS: any = { Bronze: 500, Silver: 2000, Gold: 5000, Platinum: 5000 };

const PERKS = [
  { icon: "pricetag-outline", label: "Frais réduits", value: "-30%", color: "#10B981" },
  { icon: "headset-outline", label: "Support prioritaire", value: "24/7", color: "#022a6b" },
  { icon: "cash-outline", label: "Cashback transferts", value: "2%", color: "#F59E0B" },
  { icon: "flash", label: "Bonus offres", value: "×2", color: "#8B5CF6" },
];

export default function Loyalty() {
  useLocale((st) => st.locale);
  const colors = useThemedColors();
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    api.get("/loyalty/history").then((r) => setHistory(r.data || [])).catch(() => setHistory([]));
  }, []);

  const level = (user?.loyalty_level as string) || "Bronze";
  const points = user?.loyalty_points ?? 0;
  const lvl = LEVEL_STYLE[level];
  const nextLabel = NEXT_LEVEL[level];
  const nextThreshold = NEXT_POINTS[level];
  const progress = Math.min((points / nextThreshold) * 100, 100);

  return (
    <View style={{ flex: 1, backgroundColor: "#022a6b" }}>
      <LinearGradient colors={lvl.g} style={styles.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <SafeAreaView edges={["top"]}>
          <View style={styles.heroTop}>
            <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
              <Ionicons name="chevron-back" size={22} color="white" />
            </TouchableOpacity>
            <TText variant="body" weight="extraBold" color="white">Mon programme</TText>
            <View style={{ width: 36 }} />
          </View>
          <View style={styles.heroBody}>
            <View style={styles.crown}>
              <Ionicons name={lvl.icon} size={56} color="#92400E" />
            </View>
            <TText variant="display" weight="extraBold" color="white" style={{ marginTop: spacing.md, letterSpacing: 2 }}>
              {level.toUpperCase()}
            </TText>
            <TText variant="subtitle" weight="bold" color="white">{points} pts</TText>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
            <TText variant="label" color="rgba(255,255,255,0.85)" style={{ marginTop: 6 }}>
              {level === nextLabel ? "Niveau maximum" : `${nextThreshold - points} pts jusqu'au ${nextLabel}`}
            </TText>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView style={styles.card} contentContainerStyle={styles.cardInner} showsVerticalScrollIndicator={false}>
        <TText variant="label" weight="extraBold" color={colors.neutrals.textSecondary} style={styles.secTitle}>
          VOS AVANTAGES
        </TText>
        <View style={styles.grid}>
          {PERKS.map((p) => (
            <View key={p.label} style={styles.perkCard}>
              <View style={[styles.perkIcon, { backgroundColor: p.color + "1A" }]}>
                <Ionicons name={p.icon as any} size={22} color={p.color} />
              </View>
              <TText variant="title" weight="extraBold" color={p.color} style={{ marginTop: 4 }}>
                {p.value}
              </TText>
              <TText variant="label" weight="semiBold" align="center" color={colors.neutrals.textSecondary}>
                {p.label}
              </TText>
            </View>
          ))}
        </View>

        <TText variant="label" weight="extraBold" color={colors.neutrals.textSecondary} style={styles.secTitle}>
          HISTORIQUE RÉCENT
        </TText>
        <View style={styles.listBox}>
          {history.length === 0 ? (
            <View style={{ padding: spacing.lg, alignItems: "center" }}>
              <Ionicons name="sparkles-outline" size={24} color={colors.neutrals.textTertiary} />
              <TText variant="caption" color={colors.neutrals.textSecondary} style={{ marginTop: 6 }}>Aucun point gagné pour le moment</TText>
            </View>
          ) : history.slice(0, 10).map((h: any, i: number) => (
            <View key={i} style={[styles.hRow, i < history.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.neutrals.border }]}>
              <View style={styles.hDot}><Ionicons name="add" size={14} color="white" /></View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <TText variant="caption" weight="semiBold">{h.label || "Transfert validé"}</TText>
                <TText variant="label" color={colors.neutrals.textTertiary}>
                  {h.created_at ? new Date(h.created_at).toLocaleDateString("fr-FR") : "—"}
                </TText>
              </View>
              <TText variant="caption" weight="extraBold" color="#10B981">+{h.points || 10}</TText>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: spacing.sm },
  iconBtn: { width: 36, height: 36, borderRadius: radii.full, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  heroBody: { alignItems: "center", marginTop: spacing.md },
  crown: { width: 96, height: 96, borderRadius: 48, backgroundColor: "white", alignItems: "center", justifyContent: "center", shadowColor: "#F59E0B", shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
  progressTrack: { width: 240, height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.25)", marginTop: spacing.md, overflow: "hidden" },
  progressFill: { height: 8, borderRadius: 4, backgroundColor: "white" },
  card: { flex: 1, backgroundColor: colors.neutrals.background, borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl, marginTop: -spacing.lg },
  cardInner: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  secTitle: { letterSpacing: 1, marginBottom: 10, marginLeft: 4, marginTop: spacing.md },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  perkCard: { flex: 1, minWidth: "45%", backgroundColor: colors.neutrals.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.neutrals.border, padding: spacing.md, alignItems: "center" },
  perkIcon: { width: 40, height: 40, borderRadius: radii.full, alignItems: "center", justifyContent: "center" },
  listBox: { backgroundColor: colors.neutrals.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.neutrals.border },
  hRow: { flexDirection: "row", alignItems: "center", padding: spacing.md },
  hDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#10B981", alignItems: "center", justifyContent: "center" },
});
