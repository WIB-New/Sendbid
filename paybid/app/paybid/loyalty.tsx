import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { TouchableOpacity } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { TText } from "../../src/components/TText";
import { api } from "../../src/api";
import { useThemedPaybidColors } from "../../src/themeContext";
import { paybidColors } from "../../src/paybidTheme";
import { spacing, radii, shadows } from "../../src/theme";

const LEVELS = [
  { label: "Bronze",   min: 0,   max: 9,   color: "#CD7F32", icon: "ribbon-outline",    perks: ["Accès aux enchères", "Support standard"] },
  { label: "Argent",   min: 10,  max: 49,  color: "#9CA3AF", icon: "shield-outline",    perks: ["Priorité enchères ville", "Support prioritaire"] },
  { label: "Or",       min: 50,  max: 149, color: "#F59E0B", icon: "star-outline",       perks: ["Bonus commissions +5%", "Badge Or visible"] },
  { label: "Platine",  min: 150, max: Infinity, color: "#7C3AED", icon: "diamond-outline", perks: ["Enchères VIP exclusives", "Bonus +10%", "Support dédié"] },
];

function getLevel(count: number) {
  return LEVELS.find(l => count >= l.min && count <= l.max) || LEVELS[0];
}

export default function PaybidLoyalty() {
  const colors = useThemedPaybidColors();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const r = await api.get("/agent/me");
      setData(r.data);
    } catch {}
    setRefreshing(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const count = data?.agent?.transfers_count || 0;
  const level = getLevel(count);
  const next = LEVELS[LEVELS.indexOf(level) + 1];
  const progress = next ? Math.min(1, (count - level.min) / (next.min - level.min)) : 1;

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.neutrals.background }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.neutrals.textPrimary} />
        </TouchableOpacity>
        <TText variant="subtitle" weight="extraBold" style={{ marginLeft: 12 }}>Niveau & Récompenses</TText>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={paybidColors.primary.base} />}
      >
        {/* Carte niveau actuel */}
        <LinearGradient
          colors={[level.color, level.color + "BB"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[styles.heroCard, shadows.lg]}
        >
          <Ionicons name={level.icon as any} size={40} color="white" />
          <TText variant="display" weight="extraBold" color="white" style={{ marginTop: 8 }}>{level.label}</TText>
          <TText variant="caption" color="rgba(255,255,255,0.85)" style={{ marginTop: 4 }}>
            {count} transfert{count > 1 ? "s" : ""} complété{count > 1 ? "s" : ""}
          </TText>

          {/* Barre progression */}
          {next && (
            <View style={{ width: "100%", marginTop: 16 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                <TText variant="label" color="rgba(255,255,255,0.8)">{level.label}</TText>
                <TText variant="label" color="rgba(255,255,255,0.8)">{next.label} ({next.min} transferts)</TText>
              </View>
              <View style={styles.progressBg}>
                <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` as any }]} />
              </View>
              <TText variant="label" color="rgba(255,255,255,0.85)" style={{ marginTop: 6, textAlign: "center" }}>
                {next.min - count} transfert{next.min - count > 1 ? "s" : ""} pour atteindre {next.label}
              </TText>
            </View>
          )}
        </LinearGradient>

        {/* Avantages niveau actuel */}
        <TText variant="label" weight="bold" color={colors.neutrals.textSecondary} style={styles.sectionLabel}>VOS AVANTAGES ACTUELS</TText>
        <View style={styles.card}>
          {level.perks.map((p, i) => (
            <View key={i} style={[styles.perkRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.neutrals.border }]}>
              <Ionicons name="checkmark-circle" size={18} color={level.color} />
              <TText variant="body" weight="semiBold" style={{ marginLeft: 10 }}>{p}</TText>
            </View>
          ))}
        </View>

        {/* Tous les niveaux */}
        <TText variant="label" weight="bold" color={colors.neutrals.textSecondary} style={styles.sectionLabel}>TOUS LES NIVEAUX</TText>
        {LEVELS.map(l => {
          const isActive = l.label === level.label;
          const isPast = LEVELS.indexOf(l) < LEVELS.indexOf(level);
          return (
            <View key={l.label} style={[styles.levelRow, isActive && { borderColor: l.color, borderWidth: 2 }]}>
              <View style={[styles.levelIcon, { backgroundColor: l.color + "22" }]}>
                <Ionicons name={l.icon as any} size={22} color={l.color} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <TText variant="body" weight="extraBold" color={l.color}>{l.label}</TText>
                  {isActive && <View style={[styles.activeBadge, { backgroundColor: l.color }]}><TText style={{ color: "white", fontSize: 9, fontWeight: "bold" }}>ACTUEL</TText></View>}
                  {isPast && <Ionicons name="checkmark-done" size={14} color="#10B981" />}
                </View>
                <TText variant="caption" color={colors.neutrals.textSecondary}>
                  {l.max === Infinity ? `≥ ${l.min}` : `${l.min} – ${l.max}`} transferts
                </TText>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: paybidColors.neutrals.border },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: paybidColors.neutrals.surface, borderWidth: 1, borderColor: paybidColors.neutrals.border, alignItems: "center", justifyContent: "center" },
  heroCard: { borderRadius: radii.xxl, padding: spacing.xl, alignItems: "center" },
  progressBg: { height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.3)", overflow: "hidden" },
  progressFill: { height: 8, borderRadius: 4, backgroundColor: "white" },
  sectionLabel: { marginTop: spacing.lg, marginBottom: 6, letterSpacing: 0.5 },
  card: { backgroundColor: paybidColors.neutrals.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: paybidColors.neutrals.border, overflow: "hidden" },
  perkRow: { flexDirection: "row", alignItems: "center", padding: 14 },
  levelRow: { flexDirection: "row", alignItems: "center", backgroundColor: paybidColors.neutrals.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: paybidColors.neutrals.border, padding: 14, marginBottom: 8 },
  levelIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  activeBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
});
