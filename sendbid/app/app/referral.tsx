import React, { useEffect, useState } from "react";
import { t, useLocale } from "../src/i18n";
import { View, StyleSheet, ScrollView, TouchableOpacity, Share } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { TText } from "../src/components/TText";
import { Button } from "../src/components/Button";
import { useAuth } from "../src/store";
import { api } from "../src/api";
import { colors, spacing, radii } from "../src/theme";
import { useThemedColors } from "../src/themeContext";
import { useTranslation } from "../../src/i18n";
// Parrainage v4.0 — "39 Referral" : code géant + copier/partager + progress palier + steps
const STEPS = [
  { n: 1, title: "Partagez votre code", desc: "Envoyez-le à vos proches", icon: "share-social-outline" },
  { n: 2, title: "Ils s'inscrivent", desc: "Avec votre code de parrainage", icon: "person-add-outline" },
  { n: 3, title: "Premier transfert", desc: "Ils effectuent un transfert validé", icon: "paper-plane-outline" },
  { n: 4, title: "Vous gagnez", desc: "5 € crédités sur votre Portefeuille", icon: "cash-outline" },
];

export default function Referral() {
  const { t } = useTranslation();
  useLocale((st) => st.locale);
  const colors = useThemedColors();
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const [stats, setStats] = useState<any>({ invited: 0, earned: 0, bonuses: 0 });

  useEffect(() => {
    api.get("/referral").then((r) => setStats(r.data || {})).catch(() => {});
  }, []);

  const code = (user?.referral_code || user?.profile_id || "SENDBID").toUpperCase();
  const milestone = 10;
  const invited = stats.invited || 0;
  const progress = Math.min((invited / milestone) * 100, 100);

  const copy = async () => { await Clipboard.setStringAsync(code); };
  const share = async () => {
    try {
      await Share.share({ message: `Rejoins-moi sur SENDBID avec mon code ${code} — tu recevras 5€ offerts ! https://sendbid.app` });
    } catch {}
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#022a6b" }}>
      <LinearGradient colors={["#022a6b", "#022a6b", "#3A4D8F"]} style={styles.hero}>
        <SafeAreaView edges={["top"]}>
          <View style={styles.heroTop}>
            <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
              <Ionicons name="chevron-back" size={22} color="white" />
            </TouchableOpacity>
            <TText variant="body" weight="extraBold" color="white">Parrainer un proche</TText>
            <View style={{ width: 36 }} />
          </View>
          <View style={styles.heroBody}>
            <Ionicons name="gift" size={52} color="#FCD34D" />
            <TText variant="title" weight="extraBold" color="white" align="center" style={{ marginTop: 10 }}>
              Invitez et gagnez 5 €
            </TText>
            <TText variant="caption" color="rgba(255,255,255,0.8)" align="center">
              Pour chaque ami qui effectue un 1er transfert
            </TText>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView style={styles.card} contentContainerStyle={styles.cardInner} showsVerticalScrollIndicator={false}>
        {/* Giant code */}
        <View style={styles.codeBox}>
          <TText variant="label" weight="extraBold" color={colors.neutrals.textSecondary} style={{ letterSpacing: 1 }}>
            MON CODE DE PARRAINAGE
          </TText>
          <TText variant="display" weight="extraBold" color={colors.primary.base} align="center" style={styles.codeValue}>
            {code}
          </TText>
          <View style={{ flexDirection: "row", gap: 10, marginTop: spacing.md }}>
            <TouchableOpacity testID="ref-copy" onPress={copy} style={styles.smallBtn}>
              <Ionicons name="copy-outline" size={16} color={colors.primary.base} />
              <TText variant="caption" weight="extraBold" color={colors.primary.base} style={{ marginLeft: 6 }}>Copier</TText>
            </TouchableOpacity>
            <TouchableOpacity testID="ref-share" onPress={share} style={[styles.smallBtn, { backgroundColor: colors.primary.base, borderColor: colors.primary.base }]}>
              <Ionicons name="share-social-outline" size={16} color="white" />
              <TText variant="caption" weight="extraBold" color="white" style={{ marginLeft: 6 }}>Partager</TText>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatBox label="Invités" value={invited} color="#022a6b" icon="people-outline" />
          <View style={styles.sep} />
          <StatBox label="Gagnés" value={`${stats.earned || 0} €`} color="#10B981" icon="cash-outline" />
          <View style={styles.sep} />
          <StatBox label="Bonus" value={stats.bonuses || 0} color="#F59E0B" icon="gift-outline" />
        </View>

        {/* Progress bar towards next milestone */}
        <View style={styles.milestoneBox}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
            <TText variant="caption" weight="extraBold">Prochain palier</TText>
            <TText variant="caption" color={colors.primary.base} weight="extraBold">{invited}/{milestone} amis</TText>
          </View>
          <View style={styles.pTrack}>
            <LinearGradient colors={["#10B981", "#059669"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.pFill, { width: `${progress}%` }]} />
          </View>
          <TText variant="label" color={colors.neutrals.textSecondary} style={{ marginTop: 6 }}>
            {milestone - invited} amis restants pour débloquer +20 € bonus
          </TText>
        </View>

        {/* Steps */}
        <View style={styles.stepsBox}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
            <Ionicons name="information-circle" size={16} color="#92400E" />
            <TText variant="caption" weight="extraBold" style={{ marginLeft: 6, color: "#92400E" }}>Comment ça marche ?</TText>
          </View>
          {STEPS.map((s) => (
            <View key={s.n} style={styles.stepRow}>
              <View style={styles.stepNum}>
                <TText weight="extraBold" color="white" variant="caption">{s.n}</TText>
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <TText variant="caption" weight="extraBold">{s.title}</TText>
                <TText variant="label" color={colors.neutrals.textSecondary}>{s.desc}</TText>
              </View>
              <Ionicons name={s.icon as any} size={18} color="#92400E" />
            </View>
          ))}
        </View>

        <Button testID="ref-invite-whatsapp" title="Inviter via WhatsApp" icon="logo-whatsapp" style={{ backgroundColor: "#25D366", marginTop: spacing.lg }} onPress={share} />
      </ScrollView>
    </View>
  );
}

function StatBox({ label, value, color, icon }: any) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <View style={[styles.statIcon, { backgroundColor: color + "1A" }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <TText variant="title" weight="extraBold" color={color} style={{ marginTop: 4 }}>{value}</TText>
      <TText variant="label" color={colors.neutrals.textSecondary}>{label}</TText>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: spacing.sm },
  iconBtn: { width: 36, height: 36, borderRadius: radii.full, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  heroBody: { alignItems: "center", marginTop: spacing.md },
  card: { flex: 1, backgroundColor: colors.neutrals.background, borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl, marginTop: -spacing.lg },
  cardInner: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  codeBox: { backgroundColor: colors.neutrals.surface, borderRadius: radii.xl, borderWidth: 2, borderColor: colors.primary.base, padding: spacing.lg, alignItems: "center" },
  codeValue: { letterSpacing: 4, marginTop: 8 },
  smallBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 8, backgroundColor: "white", borderRadius: radii.full, borderWidth: 1.5, borderColor: colors.primary.base },
  statsRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.neutrals.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.neutrals.border, padding: spacing.md, marginTop: spacing.md },
  sep: { width: 1, height: 40, backgroundColor: colors.neutrals.border },
  statIcon: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  milestoneBox: { backgroundColor: colors.neutrals.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.neutrals.border, padding: spacing.md, marginTop: spacing.md },
  pTrack: { height: 8, borderRadius: 4, backgroundColor: colors.overlays.primarySoft, overflow: "hidden" },
  pFill: { height: 8, borderRadius: 4 },
  stepsBox: { backgroundColor: "#FEF3C7", borderRadius: radii.xl, padding: spacing.md, marginTop: spacing.md, borderWidth: 1, borderColor: "#FDE68A" },
  stepRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
  stepNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#92400E", alignItems: "center", justifyContent: "center" },
});
