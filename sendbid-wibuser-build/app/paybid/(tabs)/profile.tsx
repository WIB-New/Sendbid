/**
 * /paybid/(tabs)/profile.tsx — Profil agent style Sendbid Wise/Revolut (Item 8).
 *
 * Fusion du profil Sendbid + infos métier agent (rating, transfers, badge, agence,
 * KYC tier, disponibilité, modes de remise). Inspiré /app/(tabs)/profile.tsx.
 *
 * Structure :
 *   - LinearGradient PAYBID en fond plein écran (#54280f)
 *   - Hero card (orange) : avatar + nom + ID + chips KYC/Niveau
 *   - Stats agent (rating, transferts, jours actifs)
 *   - Section "Mon agence" : nom, ville, adresse, modes de remise, disponibilité
 *   - Section "Hub" : Compte / Paramètres / Aide
 *   - Sessions actives + déconnexion globale
 *   - À propos PAYBID + socials
 */
import React, { useCallback, useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  Platform,
  ScrollView,
  Linking,
  Switch,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { TText } from "../../../src/components/TText";
import { api } from "../../../src/api";
import { useAuth } from "../../../src/store";
import { AgentLevelBadge } from "../../../src/components/AgentLevelBadge";
// theme hook intentionally not imported here — `paybidColors` is used statically.
import { paybidColors } from "../../../src/paybidTheme";
import { useLocale } from "../../../src/i18n";
import { spacing, radii } from "../../../src/theme";

const SOCIALS: { icon: keyof typeof Ionicons.glyphMap; url: string }[] = [
  { icon: "logo-facebook", url: "https://facebook.com/paybid" },
  { icon: "logo-twitter", url: "https://twitter.com/paybid" },
  { icon: "logo-instagram", url: "https://instagram.com/paybid" },
  { icon: "logo-linkedin", url: "https://linkedin.com/company/paybid" },
];

export default function PaybidProfile() {
  useLocale((s) => s.locale);
  const router = useRouter();
  const logoutStore = useAuth((s) => s.logout);
  const [me, setMe] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [togglingAvail, setTogglingAvail] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.get("/agent/me");
      setMe(r.data);
    } catch {}
  }, []);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onLogout = async () => {
    if (busy) return;
    setBusy(true);
    if (Platform.OS === "web" && typeof window !== "undefined") {
      try {
        window.location.replace("/paybid/login");
      } catch {
        router.replace("/paybid/login" as any);
      }
    } else {
      router.replace("/paybid/login" as any);
    }
    try {
      await logoutStore();
    } catch (e) {
      console.warn("logout err", e);
    }
    setBusy(false);
  };

  const toggleAvailability = async (next: boolean) => {
    if (togglingAvail) return;
    setTogglingAvail(true);
    try {
      await api.post("/agent/availability", { available: next });
      await load();
    } catch (e: any) {
      Alert.alert("Erreur", e?.response?.data?.detail || "Impossible de basculer");
    } finally {
      setTogglingAvail(false);
    }
  };

  if (!me) return null;
  const { user, agent, wallet } = me;

  const KYC: any = {
    0: { l: "Niveau 0", c: "#9CA3AF" },
    1: { l: "Niveau 1", c: "#60A5FA" },
    2: { l: "Niveau 2", c: "#34D399" },
    3: { l: "Niveau 3", c: "#A78BFA" },
  };
  const kyc = KYC[agent?.kyc_tier ?? user?.kyc_tier ?? 2] || KYC[2];

  // Sections "hub" cliquables (analogues à Sendbid)
  const SECTIONS: {
    title: string;
    subtitle: string;
    route: string;
    icon: any;
    tint: string;
  }[] = [
    {
      title: "Mon compte",
      subtitle: "Informations personnelles, ID profil, contact",
      route: "/profile-account",
      icon: "person-circle",
      tint: paybidColors.primary.base,
    },
    {
      title: "Paramètres",
      subtitle: "Langue, thème, notifications, sécurité",
      route: "/profile-settings",
      icon: "settings",
      tint: "#8B5CF6",
    },
    {
      title: "Niveau & récompenses",
      subtitle: "Programme de fidélité agent (Bronze → Platine)",
      route: "/profile-loyalty",
      icon: "trophy",
      tint: "#F59E0B",
    },
    {
      title: "Support",
      subtitle: "Aide, conditions, signaler un problème",
      route: "/profile-help",
      icon: "help-circle",
      tint: "#10B981",
    },
  ];

  return (
    <LinearGradient
      colors={paybidColors.gradients.hero}
      style={{ flex: 1 }}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <TText variant="title" weight="extraBold" color="white">
            Profil
          </TText>
          <TouchableOpacity
            testID="paybid-profile-scan"
            onPress={() => router.push("/paybid/scan" as any)}
            style={styles.iconBtn}
          >
            <Ionicons name="qr-code-outline" size={20} color="white" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollInner}
          showsVerticalScrollIndicator={false}
        >
          {/* ===== Hero card ===== */}
          <View
            style={[
              styles.userHero,
              { backgroundColor: paybidColors.primary.base },
            ]}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={styles.avatarWrapBig}>
                {agent?.avatar_url ? (
                  <Image
                    source={{ uri: agent.avatar_url }}
                    style={styles.avatarBig}
                  />
                ) : (
                  <View
                    style={[styles.avatarBig, styles.avatarFallbackBig]}
                  >
                    <TText
                      variant="display"
                      weight="extraBold"
                      color="white"
                    >
                      {(agent?.full_name || user?.full_name || "?")
                        .charAt(0)
                        .toUpperCase()}
                    </TText>
                  </View>
                )}
                {agent?.available ? (
                  <View style={styles.onlineDot} />
                ) : null}
              </View>
              <View style={{ flex: 1, marginLeft: spacing.lg }}>
                <TText
                  variant="title"
                  weight="extraBold"
                  color="white"
                  numberOfLines={2}
                >
                  {agent?.full_name || user?.full_name}
                </TText>
                <View style={styles.idChip}>
                  <Ionicons name="finger-print" size={10} color="white" />
                  <TText
                    variant="label"
                    weight="extraBold"
                    color="white"
                    style={{ marginLeft: 4, letterSpacing: 0.5 }}
                  >
                    @{user?.profile_id || "PB"}
                  </TText>
                </View>
                <View style={styles.userMeta}>
                  <View style={styles.kycChipDark}>
                    <Ionicons
                      name="shield-checkmark"
                      size={11}
                      color="white"
                    />
                    <TText
                      variant="label"
                      weight="bold"
                      style={{ marginLeft: 4, color: "white" }}
                    >
                      KYC {kyc.l}
                    </TText>
                  </View>
                </View>
              </View>
              <TouchableOpacity
                testID="paybid-profile-edit"
                onPress={() => router.push("/personal-info" as any)}
                style={styles.editBtnDark}
              >
                <Ionicons name="create-outline" size={20} color="white" />
              </TouchableOpacity>
            </View>

            {/* Stats agent en 3 colonnes */}
            <View style={styles.statsRow}>
              <Stat
                icon="star"
                color="#FCD34D"
                value={`${agent?.rating || 0}`}
                label="Note moy."
              />
              <Stat
                icon="checkmark-done"
                color="#A7F3D0"
                value={`${agent?.transfers_count || 0}`}
                label="Transferts"
              />
              <Stat
                icon="time"
                color="#FBCFE8"
                value={`${agent?.days_active || 0}j`}
                label="Ancienneté"
              />
            </View>

            {/* Badge agent */}
            <View style={{ marginTop: 14, alignItems: "center" }}>
              <AgentLevelBadge
                rating={agent?.rating || 0}
                transfersCount={agent?.transfers_count || 0}
              />
            </View>
          </View>

          {/* ===== Disponibilité ===== */}
          <View style={[styles.card, { marginTop: spacing.lg }]}>
            <View style={[styles.row, { paddingVertical: 16 }]}>
              <View
                style={[
                  styles.rowIcon,
                  {
                    backgroundColor:
                      agent?.available !== false
                        ? "rgba(16,185,129,0.15)"
                        : "rgba(239,68,68,0.12)",
                  },
                ]}
              >
                <Ionicons
                  name={
                    agent?.available !== false
                      ? "radio-button-on"
                      : "radio-button-off"
                  }
                  size={20}
                  color={agent?.available !== false ? "#10B981" : "#EF4444"}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <TText variant="body" weight="extraBold">
                  Disponibilité
                </TText>
                <TText
                  variant="caption"
                  color={paybidColors.neutrals.textSecondary}
                  style={{ marginTop: 2 }}
                >
                  {agent?.available !== false
                    ? "En ligne — vous recevez des missions"
                    : "Hors-ligne — aucune nouvelle mission"}
                </TText>
              </View>
              <Switch
                testID="paybid-availability"
                value={agent?.available !== false}
                onValueChange={toggleAvailability}
                disabled={togglingAvail}
                trackColor={{
                  false: "#D1D5DB",
                  true: paybidColors.primary.base,
                }}
                thumbColor="white"
              />
            </View>
          </View>

          {/* ===== Mon agence ===== */}
          <SectionTitle label="MON AGENCE" />
          <View style={styles.card}>
            <DetailRow
              icon="business"
              label="Agence"
              value={(agent as any)?.agency_name || agent?.full_name || "—"}
              tint={paybidColors.primary.base}
            />
            <DetailRow
              icon="location"
              label="Ville"
              value={`${agent?.city || "—"}${agent?.country_code ? " (" + agent.country_code + ")" : ""}`}
              tint="#8B5CF6"
            />
            {agent?.address ? (
              <DetailRow
                icon="map"
                label="Adresse"
                value={agent.address}
                tint="#3B82F6"
              />
            ) : null}
            <DetailRow
              icon="options"
              label="Modes de remise"
              value={(agent?.delivery_modes || [])
                .join(" · ")
                .toUpperCase() || "—"}
              tint="#F59E0B"
            />
            <DetailRow
              icon="cash"
              label="Solde wallet"
              value={`${Number(wallet?.balance || 0).toFixed(2)} ${wallet?.currency || "EUR"}`}
              tint="#10B981"
              last
            />
          </View>

          {/* ===== Hub sections ===== */}
          <SectionTitle label="MON COMPTE" />
          <View style={styles.card}>
            {SECTIONS.map((sec, i) => (
              <TouchableOpacity
                key={sec.title}
                testID={`paybid-hub-${sec.route.replace("/profile-", "")}`}
                onPress={() => router.push(sec.route as any)}
                activeOpacity={0.7}
                style={[
                  styles.row,
                  i < SECTIONS.length - 1 && styles.rowBorder,
                  { paddingVertical: 18 },
                ]}
              >
                <View
                  style={[
                    styles.rowIcon,
                    {
                      backgroundColor: sec.tint + "1A",
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                    },
                  ]}
                >
                  <Ionicons name={sec.icon} size={22} color={sec.tint} />
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <TText variant="body" weight="extraBold">
                    {sec.title}
                  </TText>
                  <TText
                    variant="caption"
                    color={paybidColors.neutrals.textSecondary}
                    style={{ marginTop: 2 }}
                  >
                    {sec.subtitle}
                  </TText>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={paybidColors.neutrals.textTertiary}
                />
              </TouchableOpacity>
            ))}
          </View>

          {/* ===== Sessions ===== */}
          <SectionTitle label="SESSIONS ACTIVES" />
          <View style={styles.card}>
            <View style={[styles.row, { paddingVertical: 16 }]}>
              <View
                style={[
                  styles.rowIcon,
                  { backgroundColor: "rgba(16,185,129,0.18)" },
                ]}
              >
                <Ionicons name="phone-portrait" size={20} color="#10B981" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <TText variant="body" weight="semiBold">
                  Cet appareil
                </TText>
                <TText
                  variant="caption"
                  color={paybidColors.neutrals.textSecondary}
                >
                  {Platform.OS === "web" ? "Web" : Platform.OS} · Actif
                  maintenant
                </TText>
              </View>
              <View style={styles.activeChip}>
                <TText variant="label" weight="bold" color="#10B981">
                  Actif
                </TText>
              </View>
            </View>
            <TouchableOpacity
              testID="paybid-logout-all"
              style={styles.disconnectAllRow}
              onPress={() =>
                Alert.alert(
                  "Se déconnecter de PAYBID",
                  "Voulez-vous vraiment vous déconnecter ?",
                  [
                    { text: "Annuler", style: "cancel" },
                    {
                      text: "Se déconnecter",
                      style: "destructive",
                      onPress: onLogout,
                    },
                  ]
                )
              }
            >
              <View
                style={[
                  styles.rowIcon,
                  { backgroundColor: "rgba(239,68,68,0.12)" },
                ]}
              >
                <Ionicons name="log-out-outline" size={20} color="#EF4444" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <TText variant="body" weight="semiBold" color="#EF4444">
                  Se déconnecter
                </TText>
                <TText
                  variant="caption"
                  color={paybidColors.neutrals.textSecondary}
                  style={{ marginTop: 2 }}
                >
                  Quitter cette session
                </TText>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={paybidColors.neutrals.textTertiary}
              />
            </TouchableOpacity>
          </View>

          {/* ===== About PAYBID ===== */}
          <LinearGradient
            colors={["rgba(255,255,255,0.10)", "rgba(255,255,255,0.04)"]}
            style={styles.aboutCard}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={styles.aboutLogo}>
                <Ionicons name="storefront" size={20} color="white" />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <TText variant="caption" weight="extraBold" color="white">
                  À propos de PAYBID
                </TText>
              </View>
            </View>
            <TText
              color="rgba(255,255,255,0.78)"
              style={{ marginTop: spacing.sm, fontSize: 11, lineHeight: 15 }}
            >
              PAYBID est l&apos;app compagnon des agents partenaires SENDBID. Elle
              vous met en relation avec les expéditeurs et bénéficiaires en
              temps réel pour les remises cash, virements et Mobile Money.
            </TText>
            <View style={styles.socialRow}>
              {SOCIALS.map((s) => (
                <TouchableOpacity
                  key={s.icon}
                  onPress={() => Linking.openURL(s.url)}
                  style={styles.socialBtn}
                >
                  <Ionicons name={s.icon} size={14} color="white" />
                </TouchableOpacity>
              ))}
            </View>
          </LinearGradient>

          {/* ===== Big logout ===== */}
          <TouchableOpacity
            testID="paybid-profile-logout"
            style={styles.logoutBtn}
            onPress={onLogout}
            disabled={busy}
          >
            <Ionicons name="log-out-outline" size={22} color="white" />
            <TText
              variant="body"
              weight="extraBold"
              color="white"
              style={{ marginLeft: 8 }}
            >
              {busy ? "Déconnexion…" : "Se déconnecter"}
            </TText>
          </TouchableOpacity>
          <View style={{ height: spacing.xxxl }} />
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function Stat({ icon, color, value, label }: any) {
  return (
    <View style={statStyles.cell}>
      <View
        style={[statStyles.iconWrap, { backgroundColor: "rgba(0,0,0,0.18)" }]}
      >
        <Ionicons name={icon} size={14} color={color} />
      </View>
      <TText variant="body" weight="extraBold" color="white">
        {value}
      </TText>
      <TText variant="label" color="rgba(255,255,255,0.78)">
        {label}
      </TText>
    </View>
  );
}

function SectionTitle({ label }: { label: string }) {
  return (
    <View style={{ paddingHorizontal: spacing.sm, marginTop: spacing.lg, marginBottom: 8 }}>
      <TText
        variant="caption"
        weight="extraBold"
        color="rgba(255,255,255,0.7)"
        style={{ letterSpacing: 0.8 }}
      >
        {label}
      </TText>
    </View>
  );
}

function DetailRow({ icon, label, value, tint, last }: any) {
  return (
    <View
      style={[
        styles.row,
        !last && styles.rowBorder,
        { paddingVertical: 14 },
      ]}
    >
      <View
        style={[
          styles.rowIcon,
          { backgroundColor: (tint || "#022a6b") + "1A" },
        ]}
      >
        <Ionicons name={icon} size={18} color={tint || "#022a6b"} />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <TText variant="caption" color={paybidColors.neutrals.textSecondary}>
          {label}
        </TText>
        <TText variant="body" weight="semiBold" style={{ marginTop: 2 }}>
          {value}
        </TText>
      </View>
    </View>
  );
}

const statStyles = StyleSheet.create({
  cell: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.15)",
    paddingVertical: 10,
    borderRadius: radii.lg,
    gap: 2,
  },
  iconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
});

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  scrollInner: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: 30,
  },
  userHero: {
    borderRadius: radii.xxl,
    padding: spacing.xl,
    marginTop: spacing.sm,
  },
  avatarWrapBig: { position: "relative" },
  avatarBig: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  avatarFallbackBig: {
    alignItems: "center",
    justifyContent: "center",
  },
  onlineDot: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#10B981",
    borderWidth: 3,
    borderColor: paybidColors.primary.base,
  },
  idChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(0,0,0,0.22)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
    marginTop: 6,
  },
  userMeta: {
    flexDirection: "row",
    marginTop: 10,
    gap: 6,
  },
  kycChipDark: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  editBtnDark: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: spacing.lg,
  },
  card: {
    backgroundColor: "white",
    borderRadius: radii.xxl,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
  },
  activeChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    backgroundColor: "rgba(16,185,129,0.15)",
  },
  disconnectAllRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  aboutCard: {
    borderRadius: radii.xxl,
    padding: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  aboutLogo: {
    width: 36,
    height: 36,
    borderRadius: radii.lg,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  socialRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: spacing.sm,
  },
  socialBtn: {
    width: 28,
    height: 28,
    borderRadius: radii.full,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EF4444",
    paddingVertical: 16,
    borderRadius: radii.xxl,
    marginTop: spacing.lg,
  },
});
