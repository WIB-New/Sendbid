import React from "react";
import { View, StyleSheet, TouchableOpacity, ScrollView, Platform, Linking } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { TText } from "../src/components/TText";
import { SendBidLogo } from "../src/components/Logo";
import { colors, spacing, radii } from "../src/theme";
import { useTranslation } from "../src/i18n";

/**
 * SENDBID Landing page — Site promotionnel public.
 * Accessible sans authentification via /landing.
 * Design fintech sombre avec sections héro / features / how-it-works / stats /
 * social proof / CTA final / footer.
 */
const FEATURES = [
  { icon: "flash", title: "Transferts instantanés", desc: "Offres en temps réel pour obtenir le meilleur taux en moins de 90 secondes.", color: "#F59E0B" },
  { icon: "shield-checkmark", title: "100% sécurisé", desc: "KYC certifié, conformité AML-CFT, chiffrement bout-en-bout, code HMAC-SHA256.", color: "#10B981" },
  { icon: "globe-outline", title: "50+ pays", desc: "Couverture Afrique, Europe, Asie, Amériques. 20 devises locales supportées.", color: "#3B82F6" },
  { icon: "rocket-outline", title: "Livraison VIP", desc: "Livraison à domicile par un agent, suivi GPS en temps réel.", color: "#8B5CF6" },
  { icon: "cash-outline", title: "Frais transparents", desc: "Affichage clair avant chaque transfert. Aucun frais caché.", color: "#EC4899" },
  { icon: "people-outline", title: "Communauté de payeurs", desc: "500+ agents locaux validés et notés par nos clients.", color: "#0EA5E9" },
];

const STEPS = [
  { n: 1, title: "Inscrivez-vous", desc: "Créez votre compte en 30 secondes avec un email et un numéro." },
  { n: 2, title: "Rechargez votre wallet", desc: "Carte, virement, PayPal, portefeuilles mobiles — plusieurs options." },
  { n: 3, title: "Lancez une offre", desc: "Nos agents locaux enchérissent en temps réel pour obtenir votre virement." },
  { n: 4, title: "Votre bénéficiaire reçoit", desc: "Espèces, virement bancaire, Mobile Money. Livraison instantanée ou VIP." },
];

const STATS = [
  { label: "Transferts réussis", value: "1M+" },
  { label: "Volume annuel", value: "500M€" },
  { label: "Agents vérifiés", value: "500+" },
  { label: "Note moyenne", value: "4.8/5" },
];

export default function Landing() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <LinearGradient colors={["#070C24", "#0A1338", "#0F1B40"]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
          {/* Nav */}
          <View style={styles.nav}>
            <SendBidLogo size={36} showText variant="light" />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity onPress={() => router.push("/(auth)/login")} style={styles.navBtn}>
                <TText variant="caption" weight="bold" color="white">Connexion</TText>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push("/(auth)/signup")} style={[styles.navBtn, styles.navBtnPrimary]}>
                <TText variant="caption" weight="extraBold" color="white">Inscription</TText>
              </TouchableOpacity>
            </View>
          </View>

          {/* Audience switcher : Clients / Agents */}
          <View style={styles.audienceSwitch}>
            <View style={[styles.audienceTab, styles.audienceTabActive]}>
              <Ionicons name="person" size={14} color="#0A1338" />
              <TText variant="caption" weight="extraBold" color="#0A1338" style={{ marginLeft: 6 }}>Pour les clients</TText>
            </View>
            <TouchableOpacity onPress={() => router.push("/landing/paybid" as any)} style={styles.audienceTab}>
              <Ionicons name="briefcase" size={14} color="white" />
              <TText variant="caption" weight="bold" color="white" style={{ marginLeft: 6 }}>Pour les agents PAYBID</TText>
            </TouchableOpacity>
          </View>

          {/* Hero */}
          <View style={styles.hero}>
            <View style={styles.heroChip}><Ionicons name="flash" size={12} color="#F59E0B" /><TText variant="label" weight="bold" color="#F59E0B" style={{ marginLeft: 4 }}>NOUVEAU : 250+ pays couverts</TText></View>
            <TText variant="display" weight="extraBold" color="white" align="center" style={{ fontSize: 36, lineHeight: 42 }}>
              Transférez de{"\n"}l'argent en{"\n"}<TText weight="extraBold" color="#5CE1A6" style={{ fontSize: 36 }}>quelques secondes</TText>
            </TText>
            <TText variant="body" color="rgba(255,255,255,0.75)" align="center" style={{ marginTop: spacing.md, lineHeight: 22 }}>
              Grâce aux offres en temps réel, nos agents locaux se concurrencent pour vous offrir le meilleur taux, partout dans le monde.
            </TText>
            <View style={{ gap: 10, marginTop: spacing.lg }}>
              <TouchableOpacity onPress={() => router.push("/(auth)/signup")} style={styles.ctaPrimary}>
                <TText variant="body" weight="extraBold" color="white">Commencer gratuitement</TText>
                <Ionicons name="arrow-forward" size={20} color="white" style={{ marginLeft: 8 }} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push("/landing/paybid" as any)} style={styles.ctaSecondary}>
                <Ionicons name="people" size={20} color="white" style={{ marginRight: 8 }} />
                <TText variant="body" weight="bold" color="white">Devenir agent PAYBID</TText>
              </TouchableOpacity>
            </View>
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            {STATS.map((s) => (
              <View key={s.label} style={styles.stat}>
                <TText variant="title" weight="extraBold" color="#5CE1A6">{s.value}</TText>
                <TText variant="label" color="rgba(255,255,255,0.65)">{s.label}</TText>
              </View>
            ))}
          </View>

          {/* Features */}
          <TText variant="subtitle" weight="extraBold" color="white" align="center" style={{ marginTop: spacing.xxl }}>
            Pourquoi choisir SENDBID ?
          </TText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: spacing.lg, paddingHorizontal: spacing.lg }}>
            {FEATURES.map((f) => (
              <View key={f.title} style={styles.feat}>
                <View style={[styles.featIcon, { backgroundColor: f.color + "22" }]}>
                  <Ionicons name={f.icon as any} size={22} color={f.color} />
                </View>
                <TText variant="body" weight="extraBold" color="white" style={{ marginTop: 8 }}>{f.title}</TText>
                <TText variant="caption" color="rgba(255,255,255,0.7)" style={{ marginTop: 4, lineHeight: 18 }}>{f.desc}</TText>
              </View>
            ))}
          </View>

          {/* How it works */}
          <TText variant="subtitle" weight="extraBold" color="white" align="center" style={{ marginTop: spacing.xxl }}>
            Comment ça marche ?
          </TText>
          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg, gap: 10 }}>
            {STEPS.map((s) => (
              <View key={s.n} style={styles.step}>
                <View style={styles.stepNum}><TText weight="extraBold" color="white">{s.n}</TText></View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <TText variant="body" weight="extraBold" color="white">{s.title}</TText>
                  <TText variant="caption" color="rgba(255,255,255,0.7)">{s.desc}</TText>
                </View>
              </View>
            ))}
          </View>

          {/* CTA final */}
          <LinearGradient colors={["#2D7DFF", "#22C4E8", "#2FDFB0"]} style={styles.ctaCard}>
            <TText variant="title" weight="extraBold" color="white" align="center">Prêt à envoyer ?</TText>
            <TText variant="caption" color="rgba(255,255,255,0.9)" align="center" style={{ marginTop: 4 }}>Rejoignez les 100 000 utilisateurs qui font confiance à SENDBID.</TText>
            <TouchableOpacity onPress={() => router.push("/(auth)/signup")} style={styles.ctaFinalBtn}>
              <TText variant="body" weight="extraBold" color="#0F1B40">Télécharger l'app</TText>
            </TouchableOpacity>
          </LinearGradient>

          {/* Footer */}
          <View style={styles.footer}>
            <TText variant="caption" color="rgba(255,255,255,0.5)" align="center">© 2026 SENDBID SAS • Tous droits réservés</TText>
            <View style={{ flexDirection: "row", justifyContent: "center", gap: 16, marginTop: 8 }}>
              <TouchableOpacity onPress={() => router.push("/legal" as any)}><TText variant="label" color="rgba(255,255,255,0.6)">CGU</TText></TouchableOpacity>
              <TouchableOpacity onPress={() => router.push("/legal" as any)}><TText variant="label" color="rgba(255,255,255,0.6)">Confidentialité</TText></TouchableOpacity>
              <TouchableOpacity onPress={() => Linking.openURL("mailto:contact@sendbid.app")}><TText variant="label" color="rgba(255,255,255,0.6)">Contact</TText></TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  nav: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  navBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.full, backgroundColor: "rgba(255,255,255,0.1)" },
  navBtnPrimary: { backgroundColor: colors.primary.base },
  audienceSwitch: { flexDirection: "row", marginHorizontal: spacing.lg, marginTop: spacing.md, padding: 4, borderRadius: radii.full, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  audienceTab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 9, borderRadius: radii.full },
  audienceTabActive: { backgroundColor: "white" },
  hero: { paddingHorizontal: spacing.lg, alignItems: "center", paddingTop: spacing.xxxl },
  heroChip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 5, borderRadius: radii.full, backgroundColor: "rgba(245,158,11,0.15)", marginBottom: spacing.md },
  ctaPrimary: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: colors.primary.base, paddingVertical: 14, paddingHorizontal: 24, borderRadius: radii.full },
  ctaSecondary: { flexDirection: "row", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", paddingVertical: 14, paddingHorizontal: 24, borderRadius: radii.full },
  statsRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-around", marginTop: spacing.xxl, paddingHorizontal: spacing.md, rowGap: 16 },
  stat: { alignItems: "center", minWidth: "22%" },
  feat: { width: Platform.OS === "web" && typeof window !== "undefined" && window.innerWidth > 600 ? "31%" : "47%", backgroundColor: "rgba(255,255,255,0.06)", padding: 14, borderRadius: radii.xl, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  featIcon: { width: 40, height: 40, borderRadius: radii.full, alignItems: "center", justifyContent: "center" },
  step: { flexDirection: "row", alignItems: "center", padding: 14, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: radii.xl, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  stepNum: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary.base, alignItems: "center", justifyContent: "center" },
  ctaCard: { marginHorizontal: spacing.lg, marginTop: spacing.xxl, padding: spacing.xl, borderRadius: radii.xxl, alignItems: "center" },
  ctaFinalBtn: { backgroundColor: "white", paddingHorizontal: 28, paddingVertical: 14, borderRadius: radii.full, marginTop: spacing.md },
  footer: { paddingHorizontal: spacing.lg, marginTop: spacing.xxl, paddingVertical: spacing.lg, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)" },
});
