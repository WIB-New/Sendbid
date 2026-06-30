import React, { useState, useEffect } from "react";
import { View, StyleSheet, TouchableOpacity, Image, Alert, Platform, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { TText } from "../../src/components/TText";
import { useAuth } from "../../src/store";
import { colors, spacing, radii } from "../../src/theme";
import { useTranslation } from "../../src/i18n";
import { api } from "../../src/api";

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

export default function Profile() {
  const router = useRouter();
  const { t } = useTranslation();
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const refreshMe = useAuth((s) => s.refreshMe);
  const [busy, setBusy] = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);
  const [transferCount, setTransferCount] = useState<number | null>(null);
  const [benefCount, setBenefCount] = useState<number | null>(null);

  useFocusEffect(React.useCallback(() => { refreshMe().catch(() => {}); }, [refreshMe]));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatsLoading(true);
      try {
        const [txRes, bnRes] = await Promise.allSettled([
          api.get("/transfers"),
          api.get("/beneficiaries"),
        ]);
        if (!cancelled) {
          if (txRes.status === "fulfilled") setTransferCount(Array.isArray(txRes.value.data) ? txRes.value.data.length : (txRes.value.data?.total ?? txRes.value.data?.transfers?.length ?? 0));
          if (bnRes.status === "fulfilled") setBenefCount(Array.isArray(bnRes.value.data) ? bnRes.value.data.length : (bnRes.value.data?.beneficiaries?.length ?? 0));
        }
      } catch {} finally {
        if (!cancelled) setStatsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!user) return null;

  const onLogout = async () => {
    if (busy) return;
    const exec = async () => {
      setBusy(true);
      try { await logout(); } catch {}
      setBusy(false);
      // hard reset navigation: efface la pile
      router.replace("/welcome");
    };
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && (window as any).confirm(t("profile.logoutConfirmMsg"))) await exec();
      return;
    }
    Alert.alert(t("profile.logoutConfirmTitle"), t("profile.logoutConfirmMsg"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("profile.logoutConfirmBtn"), style: "destructive", onPress: exec },
    ]);
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

  // Vérifier si l'utilisateur est admin
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  // Mes sections — chaque section = 1 ligne cliquable qui ouvre un écran dédié
  const SECTIONS: { title: string; subtitle: string; route: string; icon: any; tint: string }[] = [
    ...(isAdmin ? [{ title: "Administration", subtitle: "Dashboard admin", route: "/admin", icon: "shield", tint: "#EC4899" }] : []),
    { title: t("profile.account"), subtitle: t("profile.kycVerification"), route: "/profile-account", icon: "person-circle", tint: "#3B82F6" },
    { title: t("profile.linkedAccounts"), subtitle: t("profile.linkedAccountsSubtitle"), route: "/wallet/linked-accounts", icon: "wallet-outline", tint: "#10B981" },
    { title: t("profile.settings"), subtitle: t("settings.security"), route: "/profile-settings", icon: "settings", tint: "#8B5CF6" },
    { title: t("profile.loyalty"), subtitle: t("profile.referral"), route: "/profile-loyalty", icon: "trophy", tint: "#F59E0B" },
    { title: t("profile.support"), subtitle: "FAQ", route: "/profile-help", icon: "help-circle", tint: "#10B981" },
    { title: "RGPD", subtitle: t("profile.documents"), route: "/profile-rgpd", icon: "shield-checkmark", tint: "#EF4444" },
  ];

  return (
    <LinearGradient colors={["#00147E", "#3D52D5"]} style={{ flex: 1 }} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}>
      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <TText variant="title" weight="extraBold" color="white">{t("profile.myProfile")}</TText>
          <TouchableOpacity onPress={() => router.push("/settings" as any)} style={styles.iconBtn}>
            <Ionicons name="settings-outline" size={20} color="white" />
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollInner} showsVerticalScrollIndicator={false}>
          {/* User Hero Card */}
          <View style={[styles.userHero, { backgroundColor: "#00147E", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", paddingBottom: 36 }]}>
            {/* Bouton éditer en haut à droite */}
            <TouchableOpacity onPress={() => router.push("/personal-info" as any)} style={[styles.editBtnDark, { alignSelf: "flex-end" }]}>
              <Ionicons name="create-outline" size={20} color="white" />
            </TouchableOpacity>

            {/* Avatar centré */}
            <View style={{ alignItems: "center", marginTop: 2 }}>
              {user.avatar_url ? (
                <Image source={{ uri: user.avatar_url }} style={styles.avatarMid} />
              ) : (
                <View style={[styles.avatarMid, styles.avatarFallbackBig]}>
                  <TText variant="title" weight="extraBold" color="white">{(user.full_name || "?").charAt(0).toUpperCase()}</TText>
                </View>
              )}
            </View>

            {/* Bloc identité centré */}
            <View style={{ alignItems: "center", marginTop: 10 }}>
              {/* 1. Nom complet */}
              <TText variant="subtitle" weight="extraBold" color="white" align="center" numberOfLines={1}>{user.full_name}</TText>
              {/* 2. Email */}
              <TText variant="caption" color="rgba(255,255,255,0.70)" style={{ marginTop: 2 }}>{user.email}</TText>
              {/* 3. Profile ID */}
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
                <Ionicons name="finger-print" size={11} color="rgba(255,255,255,0.55)" />
                <TText variant="caption" color="rgba(255,255,255,0.55)" style={{ marginLeft: 3, letterSpacing: 0.5 }}>{user.profile_id}</TText>
              </View>

              {/* Badges VERIFIED + Gold Level */}
              <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                <View style={styles.badgeVerified}>
                  <Ionicons name="checkmark-circle" size={11} color="white" />
                  <TText variant="label" weight="extraBold" color="white" style={{ marginLeft: 3, letterSpacing: 0.5 }}>{t("profile.verified")}</TText>
                </View>
                <View style={styles.badgeLevel}>
                  <Ionicons name="trophy" size={11} color="#78350F" />
                  <TText variant="label" weight="extraBold" style={{ marginLeft: 3, color: "#78350F" }}>{user.loyalty_level || "Bronze"}</TText>
                </View>
              </View>
            </View>
          </View>

          {/* Bande stats — chevauche le bas de la hero card */}
          <View style={styles.statsBand}>
            <View style={styles.statItem}>
              <TText variant="caption" color={colors.neutrals.textSecondary}>{t("transfers.title")}</TText>
              <TText variant="subtitle" weight="extraBold" color={colors.primary.base} style={{ marginTop: 4 }}>
                {statsLoading ? "–" : (transferCount ?? "0")}
              </TText>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <TText variant="caption" color={colors.neutrals.textSecondary}>{t("profile.beneficiaries")}</TText>
              <TText variant="subtitle" weight="extraBold" color={colors.primary.base} style={{ marginTop: 4 }}>
                {statsLoading ? "–" : (benefCount ?? "0")}
              </TText>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <TText variant="caption" color={colors.neutrals.textSecondary}>{t("profile.memberSince")}</TText>
              <TText variant="subtitle" weight="extraBold" color={colors.primary.base} style={{ marginTop: 4 }}>
                {(user as any).created_at
                  ? new Date((user as any).created_at).toLocaleDateString(undefined, { month: "short", year: "numeric" })
                  : "–"}
              </TText>
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

          {/* Logout big button */}
          <TouchableOpacity testID="profile-logout" style={styles.logoutBtn} onPress={onLogout} disabled={busy}>
            <Ionicons name="log-out-outline" size={22} color="white" />
            <TText variant="body" weight="extraBold" color="white" style={{ marginLeft: 8 }}>{busy ? t("common.loading") : t("common.logout")}</TText>
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
  scrollInner: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  userCard: { backgroundColor: "white", borderRadius: radii.xxl, padding: spacing.lg },
  userHero: { borderRadius: radii.xxl, padding: spacing.md, paddingVertical: 14, marginTop: spacing.sm },
  avatarWrapBig: { position: "relative" },
  avatarBig: { width: 92, height: 92, borderRadius: 46, backgroundColor: "rgba(255,255,255,0.18)" },
  avatarMid: { width: 84, height: 84, borderRadius: 42, backgroundColor: "rgba(255,255,255,0.18)" },
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
  aboutCard: { borderRadius: radii.xxl, padding: spacing.lg, marginTop: spacing.lg, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  aboutLogo: { width: 48, height: 48, borderRadius: radii.lg, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  socialRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: spacing.md },
  socialBtn: { width: 38, height: 38, borderRadius: radii.full, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#EF4444", paddingVertical: 16, borderRadius: radii.xxl, marginTop: spacing.lg },
  badgeVerified: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.full, backgroundColor: "#10B981" },
  badgeLevel: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.full, backgroundColor: "#FCD34D" },
  statsBand: { flexDirection: "row", backgroundColor: "white", borderRadius: radii.xl, marginTop: -28, marginHorizontal: spacing.md, paddingVertical: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 6 },
  statItem: { flex: 1, alignItems: "center", justifyContent: "center" },
  statDivider: { width: 1, backgroundColor: colors.neutrals.border, marginVertical: 4 },
});
