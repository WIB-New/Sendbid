import React from "react";
import { View, StyleSheet, TouchableOpacity, ScrollView, Linking } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { TText } from "../../src/components/TText";
import { spacing, radii } from "../../src/theme";

const BENEFITS = [
  { icon: "cash", title: "Commissions jusqu'à 5%", desc: "Offres 1-5%. Plus vous êtes compétitif, plus vous gagnez de transferts.", color: "#F59E0B" },
  { icon: "time-outline", title: "Flexibilité totale", desc: "Travaillez quand vous voulez. Activez/désactivez votre disponibilité.", color: "#10B981" },
  { icon: "people-outline", title: "Gagnez en visibilité", desc: "Votre commerce devient un point de retrait SENDBID.", color: "#3B82F6" },
  { icon: "shield-checkmark", title: "Paiements sécurisés", desc: "Rapprochement automatisé chaque fin de journée. Aucun impayé.", color: "#8B5CF6" },
];

const TYPES = [
  { icon: "business", title: "Agent propre", desc: "Rattaché directement au siège SENDBID. Commissions directes et formation complète.", color: "#C17043" },
  { icon: "briefcase", title: "Partenaire", desc: "Votre enseigne, nos services. Intégrez SENDBID à votre commerce existant.", color: "#994A26" },
  { icon: "people", title: "Super-agent", desc: "Gérez un réseau de sous-agents sur votre zone. Marge de délégation.", color: "#66301A" },
];

export default function LandingPaybid() {
  const router = useRouter();
  return (
    <LinearGradient colors={["#3F1D0F", "#66301A", "#1D0A04"]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
          {/* Nav */}
          <View style={styles.nav}>
            <TouchableOpacity onPress={() => router.push("/landing" as any)} style={styles.back}><Ionicons name="chevron-back" size={20} color="white" /></TouchableOpacity>
            <TText variant="title" weight="extraBold" color="white">PAYBID</TText>
            <View style={{ width: 40 }} />
          </View>

          {/* Audience switcher : Clients / Agents */}
          <View style={styles.audienceSwitch}>
            <TouchableOpacity onPress={() => router.push("/landing" as any)} style={styles.audienceTab}>
              <Ionicons name="person" size={14} color="white" />
              <TText variant="caption" weight="bold" color="white" style={{ marginLeft: 6 }}>Pour les clients</TText>
            </TouchableOpacity>
            <View style={[styles.audienceTab, styles.audienceTabActive]}>
              <Ionicons name="briefcase" size={14} color="#3F1D0F" />
              <TText variant="caption" weight="extraBold" color="#3F1D0F" style={{ marginLeft: 6 }}>Pour les agents PAYBID</TText>
            </View>
          </View>

          {/* Hero */}
          <View style={styles.hero}>
            <View style={styles.heroChip}>
              <Ionicons name="trending-up" size={12} color="#FBBF24" />
              <TText variant="label" weight="bold" color="#FBBF24" style={{ marginLeft: 4 }}>DEVENEZ AGENT PAYBID</TText>
            </View>
            <TText variant="display" weight="extraBold" color="white" align="center" style={{ fontSize: 34, lineHeight: 40 }}>
              Faites{"\n"}fructifier votre{"\n"}<TText weight="extraBold" color="#FBBF24" style={{ fontSize: 34 }}>commerce</TText>
            </TText>
            <TText variant="body" color="rgba(255,255,255,0.75)" align="center" style={{ marginTop: spacing.md, lineHeight: 22 }}>
              Devenez point de retrait SENDBID, gagnez des commissions attractives et développez votre clientèle.
            </TText>
            <TouchableOpacity onPress={() => router.push("/paybid/signup" as any)} style={styles.cta}>
              <TText variant="body" weight="extraBold" color="white">S'inscrire comme agent</TText>
              <Ionicons name="arrow-forward" size={20} color="white" style={{ marginLeft: 8 }} />
            </TouchableOpacity>
          </View>

          {/* Types */}
          <TText variant="subtitle" weight="extraBold" color="white" align="center" style={{ marginTop: spacing.xxl }}>
            3 manières de rejoindre
          </TText>
          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg, gap: 10 }}>
            {TYPES.map((t) => (
              <View key={t.title} style={styles.typeCard}>
                <View style={[styles.typeIcon, { backgroundColor: t.color + "33" }]}>
                  <Ionicons name={t.icon as any} size={24} color={t.color} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <TText variant="body" weight="extraBold" color="white">{t.title}</TText>
                  <TText variant="caption" color="rgba(255,255,255,0.7)">{t.desc}</TText>
                </View>
              </View>
            ))}
          </View>

          {/* Benefits */}
          <TText variant="subtitle" weight="extraBold" color="white" align="center" style={{ marginTop: spacing.xxl }}>
            Pourquoi devenir agent ?
          </TText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: spacing.lg, paddingHorizontal: spacing.lg }}>
            {BENEFITS.map((b) => (
              <View key={b.title} style={styles.benefit}>
                <View style={[styles.benefitIcon, { backgroundColor: b.color + "22" }]}>
                  <Ionicons name={b.icon as any} size={22} color={b.color} />
                </View>
                <TText variant="body" weight="extraBold" color="white" style={{ marginTop: 8 }}>{b.title}</TText>
                <TText variant="caption" color="rgba(255,255,255,0.7)" style={{ marginTop: 4, lineHeight: 18 }}>{b.desc}</TText>
              </View>
            ))}
          </View>

          {/* CTA final */}
          <LinearGradient colors={["#C17043", "#994A26", "#66301A"]} style={styles.ctaCard}>
            <TText variant="title" weight="extraBold" color="white" align="center">Rejoignez 500+ agents</TText>
            <TText variant="caption" color="rgba(255,255,255,0.9)" align="center" style={{ marginTop: 4 }}>Inscription en 2 minutes. Validation sous 48h.</TText>
            <TouchableOpacity onPress={() => router.push("/paybid/signup" as any)} style={styles.ctaFinalBtn}>
              <TText variant="body" weight="extraBold" color="#66301A">Démarrer maintenant</TText>
            </TouchableOpacity>
          </LinearGradient>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  back: { width: 40, height: 40, borderRadius: radii.full, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  audienceSwitch: { flexDirection: "row", marginHorizontal: spacing.lg, marginTop: 4, padding: 4, borderRadius: radii.full, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  audienceTab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 9, borderRadius: radii.full },
  audienceTabActive: { backgroundColor: "white" },
  hero: { paddingHorizontal: spacing.lg, alignItems: "center", paddingTop: spacing.xl },
  heroChip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 5, borderRadius: radii.full, backgroundColor: "rgba(251,191,36,0.15)", marginBottom: spacing.md },
  cta: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#994A26", paddingVertical: 14, paddingHorizontal: 24, borderRadius: radii.full, marginTop: spacing.lg },
  typeCard: { flexDirection: "row", alignItems: "center", padding: 14, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: radii.xl, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  typeIcon: { width: 44, height: 44, borderRadius: radii.full, alignItems: "center", justifyContent: "center" },
  benefit: { width: "48%", backgroundColor: "rgba(255,255,255,0.06)", padding: 14, borderRadius: radii.xl, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  benefitIcon: { width: 40, height: 40, borderRadius: radii.full, alignItems: "center", justifyContent: "center" },
  ctaCard: { marginHorizontal: spacing.lg, marginTop: spacing.xxl, padding: spacing.xl, borderRadius: radii.xxl, alignItems: "center" },
  ctaFinalBtn: { backgroundColor: "white", paddingHorizontal: 28, paddingVertical: 14, borderRadius: radii.full, marginTop: spacing.md },
});
