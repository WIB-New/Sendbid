import React, { useCallback, useState } from "react";
import { View, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { TText } from "../../src/components/TText";
import { Button } from "../../src/components/Button";
import { useAuth } from "../../src/store";
import { api } from "../../src/api";
import { colors, spacing, radii } from "../../src/theme";
import { useThemedColors } from "../../src/themeContext";
import { useTranslation } from "../../../src/i18n";
// KYC Status v4.0 — "38 KYC Status" : hero gold + progress Tier 1→2→3 + checklist verified
const TIERS = [
  { tier: 0, name: "Basique", limits: "200 €/mois", icon: "person-circle-outline" as const },
  { tier: 1, name: "Bronze", limits: "2 000 €/mois", icon: "ribbon-outline" as const },
  { tier: 2, name: "Gold", limits: "10 000 €/mois", icon: "trophy" as const },
  { tier: 3, name: "Platinum", limits: "Illimité", icon: "diamond" as const },
];

export default function KycHome() {
  const { t } = useTranslation();
  const colors = useThemedColors();
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const [kyc, setKyc] = useState<any>({ tier: 0, status: "none" });

  useFocusEffect(useCallback(() => {
    api.get("/kyc").then((r) => setKyc(r.data)).catch(() => {});
  }, []));

  const myTier = user?.kyc_tier ?? 0;
  const cur = TIERS[myTier];
  const next = TIERS[Math.min(myTier + 1, TIERS.length - 1)];
  const progress = (myTier / 3) * 100;

  const checks = [
    { label: "Email vérifié", verified: true, icon: "mail-outline" as const },
    { label: "Téléphone vérifié", verified: true, icon: "call-outline" as const },
    { label: "Informations personnelles", verified: myTier >= 1, icon: "person-outline" as const },
    { label: "Adresse", verified: myTier >= 1, icon: "home-outline" as const },
    { label: "Pièce d'identité", verified: myTier >= 2, icon: "card-outline" as const },
    { label: "Selfie vidéo (biométrie)", verified: myTier >= 2, icon: "videocam-outline" as const },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: "#022a6b" }}>
      <LinearGradient colors={["#92400E", "#F59E0B", "#FCD34D"]} style={styles.hero}>
        <SafeAreaView edges={["top"]}>
          <View style={styles.heroTop}>
            <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
              <Ionicons name="chevron-back" size={22} color="white" />
            </TouchableOpacity>
            <TText variant="body" weight="extraBold" color="white">Statut KYC</TText>
            <View style={{ width: 36 }} />
          </View>
          <View style={styles.heroBody}>
            <View style={styles.trophyCircle}>
              <Ionicons name={cur.icon} size={52} color="#92400E" />
            </View>
            <TText variant="title" weight="extraBold" color="white" align="center" style={{ marginTop: spacing.md }}>
              {cur.name} {myTier > 0 ? "Validé" : ""}
            </TText>
            <TText variant="caption" color="rgba(255,255,255,0.9)" align="center">
              Plafond {cur.limits}
            </TText>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
            <TText variant="label" color="rgba(255,255,255,0.85)" align="center" style={{ marginTop: 6 }}>
              Tier {myTier}/3 · Prochain palier : {next.name}
            </TText>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView style={styles.card} contentContainerStyle={styles.cardInner} showsVerticalScrollIndicator={false}>
        <TText variant="label" weight="extraBold" color={colors.neutrals.textSecondary} style={styles.secTitle}>
          DÉTAILS DE VÉRIFICATION
        </TText>
        <View style={styles.checklist}>
          {checks.map((c, i) => (
            <View key={c.label} style={[styles.checkRow, i < checks.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.neutrals.border }]}>
              <View style={[styles.checkIcon, { backgroundColor: c.verified ? "#D1FAE5" : colors.overlays.primarySoft }]}>
                <Ionicons name={c.icon} size={18} color={c.verified ? "#059669" : colors.neutrals.textSecondary} />
              </View>
              <TText variant="body" weight="semiBold" style={{ flex: 1, marginLeft: 12 }}>{c.label}</TText>
              <Ionicons name={c.verified ? "checkmark-circle" : "ellipse-outline"} size={20} color={c.verified ? "#10B981" : colors.neutrals.textTertiary} />
            </View>
          ))}
        </View>

        {myTier < 3 ? (
          <View style={{ gap: 10, marginTop: spacing.lg }}>
            {myTier < 1 ? (
              <Button testID="kyc-tier1" title="Passer au Bronze (Tier 1)" icon="ribbon-outline" onPress={() => router.push("/kyc/tier1")} />
            ) : null}
            {myTier < 2 ? (
              <Button testID="kyc-tier2" title="Passer au Gold (Tier 2)" icon="trophy" onPress={() => router.push("/kyc/tier2")} style={{ backgroundColor: "#F59E0B" }} />
            ) : null}
            {myTier === 2 ? (
              <Button testID="kyc-platinum" title="Demander Platinum (KYC entreprise)" icon="diamond" variant="outline" onPress={() => router.push("/support")} />
            ) : null}
          </View>
        ) : (
          <View style={styles.maxBadge}>
            <Ionicons name="diamond" size={24} color="#4338CA" />
            <TText variant="body" weight="extraBold" style={{ marginLeft: 8 }}>Niveau maximum atteint</TText>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: spacing.sm },
  iconBtn: { width: 36, height: 36, borderRadius: radii.full, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  heroBody: { alignItems: "center", marginTop: spacing.md },
  trophyCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: "white", alignItems: "center", justifyContent: "center", shadowColor: "#F59E0B", shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
  progressTrack: { width: 240, height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.25)", marginTop: spacing.md, overflow: "hidden" },
  progressFill: { height: 8, borderRadius: 4, backgroundColor: "white" },
  card: { flex: 1, backgroundColor: colors.neutrals.background, borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl, marginTop: -spacing.lg },
  cardInner: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  secTitle: { letterSpacing: 1, marginBottom: 8, marginLeft: 4 },
  checklist: { backgroundColor: colors.neutrals.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.neutrals.border },
  checkRow: { flexDirection: "row", alignItems: "center", padding: spacing.md },
  checkIcon: { width: 36, height: 36, borderRadius: radii.full, alignItems: "center", justifyContent: "center" },
  maxBadge: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#EDE9FE", padding: spacing.lg, borderRadius: radii.xl, marginTop: spacing.lg },
});
