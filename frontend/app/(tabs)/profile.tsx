import React, { useState } from "react";
import { View, StyleSheet, TouchableOpacity, Image, Alert, Platform, ScrollView, Linking } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { TText } from "../../src/components/TText";
import { SendBidLogo } from "../../src/components/Logo";
import { useAuth } from "../../src/store";
import { colors, spacing, radii } from "../../src/theme";
import { useThemedColors } from "../../src/themeContext";

/**
 * Profil v6.0 — Pure Fintech Design (Revolut/Wise/N26 inspired)
 * - Fond plein dégradé sombre (Imperial Blue → Navy Black)
 * - Cartes blanches arrondies (radius 24) flottant sur le gradient
 * - Sections groupées avec titre "chip" pill au-dessus de chaque card
 * - Aucune section Bénéficiaire (gérée via Transfert / Wallet / Services)
 * - Sessions actives en bas avec zone de danger
 * Ce design devient la référence visuelle GLOBALE de l'app.
 */
type Row = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  route?: string;
  tint?: string;
  onPress?: () => void;
  danger?: boolean;
};

const SOCIALS: { icon: keyof typeof Ionicons.glyphMap; url: string }[] = [
  { icon: "logo-facebook", url: "https://facebook.com/sendbid" },
  { icon: "logo-twitter", url: "https://twitter.com/sendbid" },
  { icon: "logo-instagram", url: "https://instagram.com/sendbid" },
  { icon: "logo-linkedin", url: "https://linkedin.com/company/sendbid" },
  { icon: "logo-tiktok", url: "https://tiktok.com/@sendbid" },
  { icon: "logo-snapchat", url: "https://snapchat.com/add/sendbid" },
];

export default function Profile() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const refreshMe = useAuth((s) => s.refreshMe);
  const [busy, setBusy] = useState(false);

  useFocusEffect(React.useCallback(() => { refreshMe().catch(() => {}); }, [refreshMe]));
  if (!user) return null;

  const onLogout = async () => {
    if (busy) return;
    setBusy(true);
    // 1) On navigue IMMÉDIATEMENT vers /welcome — pas d'attente, pas de flash 401 sur l'écran profil.
    if (Platform.OS === "web" && typeof window !== "undefined") {
      try { window.location.replace("/welcome"); } catch { router.replace("/welcome"); }
    } else {
      router.replace("/welcome");
    }
    // 2) Le nettoyage du token et du state arrive ENSUITE en arrière-plan.
    try { await logout(); } catch (e) { console.warn("logout err", e); }
    setBusy(false);
  };

  const KYC = {
    0: { l: "Niveau 0", c: "#9CA3AF", b: "rgba(156,163,175,0.18)" },
    1: { l: "Niveau 1", c: "#60A5FA", b: "rgba(96,165,250,0.18)" },
    2: { l: "Niveau 2", c: "#34D399", b: "rgba(52,211,153,0.18)" },
    3: { l: "Niveau 3", c: "#A78BFA", b: "rgba(167,139,250,0.18)" },
  } as any;
  const kyc = KYC[user.kyc_tier ?? 1] || KYC[1];

  // Type de compte : pour afficher uniquement le bon écran KYC (personne physique vs entreprise)
  const isCorporate = (user as any)?.account_type === "corporate" || (user as any)?.is_corporate === true;

  // Mes sections — RGPD retiré (l'action "Supprimer mon compte" est déplacée dans "Mon compte")
  const SECTIONS: { title: string; subtitle: string; route: string; icon: any; tint: string }[] = [
    { title: "Mon compte", subtitle: "Informations, KYC, suppression de compte", route: "/profile-account", icon: "person-circle", tint: "#3B82F6" },
    { title: "Paramètres", subtitle: "Sécurité, préférences, notifications", route: "/profile-settings", icon: "settings", tint: "#8B5CF6" },
    { title: "Fidélité & Récompenses", subtitle: "Parrainage, programme, évaluations", route: "/profile-loyalty", icon: "trophy", tint: "#F59E0B" },
    { title: "Aide & Support", subtitle: "Contact, FAQ, litiges, ressources", route: "/profile-help", icon: "help-circle", tint: "#10B981" },
  ];

  return (
    <LinearGradient colors={["#022a6b", "#052080"]} style={{ flex: 1 }} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}>
      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <TText variant="title" weight="extraBold" color="white">Profil</TText>
          <TouchableOpacity onPress={() => router.push("/settings" as any)} style={styles.iconBtn}>
            <Ionicons name="settings-outline" size={20} color="white" />
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollInner} showsVerticalScrollIndicator={false}>
          {/* User Hero Card — fond vert unicolore (thème) */}
          <View style={[styles.userHero, { backgroundColor: "#10B981" }]}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={styles.avatarWrapBig}>
                {user.avatar_url ? (
                  <Image source={{ uri: user.avatar_url }} style={styles.avatarBig} />
                ) : (
                  <View style={[styles.avatarBig, styles.avatarFallbackBig]}>
                    <TText variant="display" weight="extraBold" color="white">{(user.full_name || "?").charAt(0).toUpperCase()}</TText>
                  </View>
                )}
              </View>
              <View style={{ flex: 1, marginLeft: spacing.lg }}>
                <TText variant="title" weight="extraBold" color="white" numberOfLines={2}>{user.full_name}</TText>
                <View style={styles.idChip}>
                  <Ionicons name="finger-print" size={10} color="white" />
                  <TText variant="label" weight="extraBold" color="white" style={{ marginLeft: 4, letterSpacing: 0.5 }}>
                    @{user.profile_id}
                  </TText>
                </View>
                <View style={[styles.userMeta, { marginTop: 10 }]}>
                  <View style={[styles.kycChipDark]}>
                    <Ionicons name="shield-checkmark" size={11} color="white" />
                    <TText variant="label" weight="bold" style={{ marginLeft: 4, color: "white" }}>KYC {kyc.l}</TText>
                  </View>
                  <View style={styles.lvlChipDark}>
                    <Ionicons name="trophy" size={11} color="#FCD34D" />
                    <TText variant="label" weight="bold" style={{ marginLeft: 4, color: "white" }}>{user.loyalty_level || "Bronze"}</TText>
                  </View>
                </View>
              </View>
              <TouchableOpacity onPress={() => router.push("/personal-info" as any)} style={styles.editBtnDark}>
                <Ionicons name="create-outline" size={20} color="white" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Sections — Toutes les têtes regroupées dans un seul conteneur cliquable */}
          <View style={[styles.card, { marginTop: spacing.lg }]}>
            {SECTIONS.map((sec, i) => (
              <TouchableOpacity
                key={sec.title}
                testID={`profile-hub-${sec.route.replace("/profile-", "")}`}
                onPress={() => router.push(sec.route as any)}
                activeOpacity={0.7}
                style={[styles.row, i < SECTIONS.length - 1 && styles.rowBorder, { paddingVertical: 18 }]}
              >
                <View style={[styles.rowIcon, { backgroundColor: sec.tint + "1A", width: 44, height: 44, borderRadius: 22 }]}>
                  <Ionicons name={sec.icon} size={22} color={sec.tint} />
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <TText variant="body" weight="extraBold">{sec.title}</TText>
                  <TText variant="caption" color={colors.neutrals.textSecondary} style={{ marginTop: 2 }}>{sec.subtitle}</TText>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.neutrals.textTertiary} />
              </TouchableOpacity>
            ))}
          </View>

          {/* Sessions actives — Zone de danger */}
          <View style={{ marginTop: spacing.lg }}>
            <View style={styles.sectionHead}>
              <TText variant="caption" weight="extraBold" color="rgba(255,255,255,0.65)" style={{ letterSpacing: 0.8 }}>
                SESSIONS ACTIVES
              </TText>
            </View>
            <View style={styles.card}>
              <View style={[styles.row, { paddingVertical: 16 }]}>
                <View style={[styles.rowIcon, { backgroundColor: "rgba(16,185,129,0.18)" }]}>
                  <Ionicons name="phone-portrait" size={20} color="#10B981" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <TText variant="body" weight="semiBold">Cet appareil</TText>
                  <TText variant="caption" color={colors.neutrals.textSecondary}>{Platform.OS === "web" ? "Web" : Platform.OS} • Actif maintenant</TText>
                </View>
                <View style={styles.activeChip}><TText variant="label" weight="bold" color="#10B981">Actif</TText></View>
              </View>
              <TouchableOpacity
                testID="logout-all-devices"
                style={styles.disconnectAllRow}
                onPress={() => Alert.alert("Déconnecter tous les appareils", "Toutes vos sessions actives seront fermées sur tous vos appareils.", [{ text: "Annuler", style: "cancel" }, { text: "Confirmer", style: "destructive", onPress: onLogout }])}
              >
                <View style={[styles.rowIcon, { backgroundColor: "rgba(239,68,68,0.12)" }]}>
                  <Ionicons name="log-out-outline" size={20} color="#EF4444" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <TText variant="body" weight="semiBold" color="#EF4444">Déconnecter tous les appareils</TText>
                  <TText variant="caption" color={colors.neutrals.textSecondary} style={{ marginTop: 2 }}>Fermer toutes les sessions actives</TText>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.neutrals.textTertiary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* À propos card — gradient sombre (texte compact, icônes sociaux réduites) */}
          <LinearGradient colors={["rgba(255,255,255,0.10)", "rgba(255,255,255,0.04)"]} style={styles.aboutCard}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={styles.aboutLogo}><SendBidLogo size={28} /></View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <TText variant="caption" weight="extraBold" color="white">À propos de SENDBID</TText>
              </View>
            </View>
            <TText color="rgba(255,255,255,0.78)" style={{ marginTop: spacing.sm, fontSize: 11, lineHeight: 15 }}>
              Application innovante de transfert d'argent international qui met en relation les expéditeurs avec les agents pour des remises d'argent multimodes, rapides et sécurisées.
            </TText>
            <View style={styles.socialRow}>
              {SOCIALS.map((s) => (
                <TouchableOpacity key={s.icon} onPress={() => Linking.openURL(s.url)} style={styles.socialBtn}>
                  <Ionicons name={s.icon} size={14} color="white" />
                </TouchableOpacity>
              ))}
            </View>
          </LinearGradient>

          {/* Logout big button */}
          <TouchableOpacity testID="profile-logout" style={styles.logoutBtn} onPress={onLogout} disabled={busy}>
            <Ionicons name="log-out-outline" size={22} color="white" />
            <TText variant="body" weight="extraBold" color="white" style={{ marginLeft: 8 }}>{busy ? "Déconnexion…" : "Se déconnecter"}</TText>
          </TouchableOpacity>
          <View style={{ height: spacing.xxxl }} />
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  iconBtn: { width: 40, height: 40, borderRadius: radii.full, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" },
  scrollInner: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: 30 },
  userCard: { backgroundColor: "white", borderRadius: radii.xxl, padding: spacing.lg },
  userHero: { borderRadius: radii.xxl, padding: spacing.xl, marginTop: spacing.sm },
  avatarWrapBig: { position: "relative" },
  avatarBig: { width: 92, height: 92, borderRadius: 46, backgroundColor: "rgba(255,255,255,0.18)" },
  avatarFallbackBig: { alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.18)" },
  idChip: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", backgroundColor: "rgba(0,0,0,0.18)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.full, marginTop: 6 },
  kycChipDark: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.full, backgroundColor: "rgba(255,255,255,0.22)" },
  lvlChipDark: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.full, backgroundColor: "rgba(0,0,0,0.22)" },
  editBtnDark: { width: 40, height: 40, borderRadius: radii.full, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center" },
  userRow: { flexDirection: "row", alignItems: "center" },
  avatarWrap: { position: "relative" },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.primary.base + "22" },
  avatarFallback: { alignItems: "center", justifyContent: "center", backgroundColor: colors.primary.base },
  userMeta: { flexDirection: "row", marginTop: 6, gap: 6 },
  kycChip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.full },
  lvlChip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.full, backgroundColor: "#FEF3C7" },
  editBtn: { width: 36, height: 36, borderRadius: radii.full, backgroundColor: colors.overlays.primarySoft, alignItems: "center", justifyContent: "center" },
  sectionHead: { paddingHorizontal: spacing.sm, marginBottom: 8 },
  card: { backgroundColor: "white", borderRadius: radii.xxl, overflow: "hidden" },
  tocChip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.full, backgroundColor: colors.overlays.primarySoft, borderWidth: 1, borderColor: colors.primary.base + "33" },
  unifiedCard: { paddingTop: 4, paddingBottom: 4 },
  innerSectionHead: { paddingHorizontal: spacing.md, paddingTop: 14, paddingBottom: 8, borderTopWidth: 6, borderTopColor: "#F8FAFC" },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingVertical: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  rowIcon: { width: 36, height: 36, borderRadius: radii.full, alignItems: "center", justifyContent: "center" },
  activeChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.full, backgroundColor: "rgba(16,185,129,0.15)" },
  disconnectAllRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingVertical: 14, borderTopWidth: 1, borderTopColor: "#F1F5F9" },
  dangerZone: { padding: spacing.md, borderTopWidth: 1, borderTopColor: "#FEE2E2", backgroundColor: "#FEF2F2" },
  dangerBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 12, marginTop: 8, backgroundColor: "white", borderRadius: radii.lg, borderWidth: 1, borderColor: "#FCA5A5" },
  aboutCard: { borderRadius: radii.xxl, padding: spacing.md, marginTop: spacing.md, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  aboutLogo: { width: 36, height: 36, borderRadius: radii.lg, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  socialRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: spacing.sm },
  socialBtn: { width: 28, height: 28, borderRadius: radii.full, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#EF4444", paddingVertical: 16, borderRadius: radii.xxl, marginTop: spacing.lg },
});
