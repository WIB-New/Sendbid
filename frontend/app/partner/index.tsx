import React, { useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../../src/components/Screen";
import { TText } from "../../src/components/TText";
import { api } from "../../src/api";
import { useAuth } from "../../src/store";
import { colors, spacing, radii } from "../../src/theme";
import { useThemedColors } from "../../src/themeContext";
/**
 * /partner — Panel unique pour les Partenaires (responsables de zone).
 * Ils gèrent tous les acteurs de la distribution et du commercial dans leur zone.
 * Back-office orienté : agents de la zone, transferts de la zone, commissions, règlements.
 */
export default function PartnerPanel() {
  const colors = useThemedColors();
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const [kpis, setKpis] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { router.replace("/welcome"); return; }
    if (user.role === "admin" || user.role === "super_admin") { router.replace("/admin" as any); return; }
    if (user.role === "agent_admin") { router.replace("/agent" as any); return; }
    if (user.role !== "partner_admin") { router.replace("/welcome"); return; }
  }, [user]);

  useEffect(() => {
    api.get("/admin/kpis").then((r) => setKpis(r.data)).catch((e: any) => setErr(e?.response?.data?.detail || "Accès non autorisé"));
  }, []);

  const zone = (user as any)?.zone || "Zone Afrique de l'Ouest";

  const CARDS = [
    { key: "agents",    icon: "people-circle",    color: "#3B82F6", label: "Agents de la zone",      desc: "Réseau de distribution", route: "/admin/agents" },
    { key: "transfers", icon: "swap-horizontal",  color: "#10B981", label: "Transferts de la zone",  desc: "Supervision opérationnelle", route: "/admin/transfers" },
    { key: "users",     icon: "people",           color: "#8B5CF6", label: "Clients de la zone",     desc: "Identités & KYC", route: "/admin/users" },
    { key: "reco",      icon: "cash-outline",     color: "#F59E0B", label: "Commissions & règlements", desc: "Répartition zone", route: "/admin/reconciliation" },
  ];

  return (
    <LinearGradient colors={["#0A1338", "#0F1B40", "#070C24"]} style={{ flex: 1 }}>
      <Screen title="Console Partenaire" back scroll={false}>
        <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
          <View style={styles.roleChip}>
            <Ionicons name="briefcase" size={14} color={"#3B82F6"} />
            <TText variant="label" weight="bold" color={"#3B82F6"} style={{ marginLeft: 6 }}>PARTENAIRE</TText>
          </View>
          <TText variant="title" weight="extraBold" color="white" style={{ marginTop: 8 }}>Bonjour {user?.full_name}</TText>
          <TText variant="caption" color="rgba(255,255,255,0.75)" style={{ marginTop: 2 }}>« {zone} » • Responsable de zone</TText>

          {err ? (
            <View style={styles.errBox}>
              <Ionicons name="lock-closed" size={22} color="#EF4444" />
              <TText variant="body" color="#7F1D1D" style={{ marginLeft: 10, flex: 1 }}>{err}</TText>
            </View>
          ) : null}

          <TText variant="label" weight="extraBold" color="rgba(255,255,255,0.7)" style={{ letterSpacing: 1, marginTop: spacing.xl, marginBottom: 8 }}>APERÇU DE VOTRE ZONE</TText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            <Kpi label="Agents actifs" value={kpis?.agents?.active ?? "—"} icon="people-circle" tint="#10B981" />
            <Kpi label="Agents en attente" value={kpis?.agents?.pending ?? "—"} icon="hourglass" tint="#F59E0B" />
            <Kpi label="Transferts" value={kpis?.transfers?.total ?? "—"} icon="swap-horizontal" tint="#3B82F6" />
            <Kpi label="Volume EUR" value={kpis?.transfers?.volume_eur?.toLocaleString("fr-FR") ?? "—"} icon="trending-up" tint="#0EA5E9" />
            <Kpi label="Commission estimée" value={kpis?.transfers?.volume_eur ? (kpis.transfers.volume_eur * 0.005).toFixed(2) : "—"} icon="wallet" tint="#8B5CF6" />
            <Kpi label="Float déclaré" value={kpis?.float?.total_declared?.toLocaleString("fr-FR") ?? "—"} icon="cash" tint="#EF4444" />
          </View>

          <TText variant="label" weight="extraBold" color="rgba(255,255,255,0.7)" style={{ letterSpacing: 1, marginTop: spacing.xl, marginBottom: 8 }}>MODULES DE GESTION</TText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {CARDS.map((c) => (
              <TouchableOpacity key={c.key} testID={`partner-card-${c.key}`} onPress={() => router.push(c.route as any)} style={styles.moduleCard}>
                <View style={[styles.moduleIcon, { backgroundColor: c.color + "22" }]}>
                  <Ionicons name={c.icon as any} size={26} color={c.color} />
                </View>
                <TText variant="body" weight="extraBold" style={{ marginTop: 8 }}>{c.label}</TText>
                <TText variant="caption" color={colors.neutrals.textSecondary}>{c.desc}</TText>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity testID="partner-logout" style={styles.logoutBtn} onPress={async () => { await logout(); router.replace("/welcome"); }}>
            <Ionicons name="log-out-outline" size={20} color="white" />
            <TText variant="body" weight="bold" color="white" style={{ marginLeft: 8 }}>Se déconnecter</TText>
          </TouchableOpacity>
        </ScrollView>
      </Screen>
    </LinearGradient>
  );
}

function Kpi({ label, value, icon, tint }: any) {
  return (
    <View style={styles.kpi}>
      <View style={[styles.kpiIcon, { backgroundColor: tint + "22" }]}><Ionicons name={icon} size={18} color={tint} /></View>
      <TText variant="caption" color={colors.neutrals.textSecondary}>{label}</TText>
      <TText variant="subtitle" weight="extraBold">{value}</TText>
    </View>
  );
}

const styles = StyleSheet.create({
  roleChip: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5, borderRadius: radii.full, backgroundColor: "#DBEAFE" },
  errBox: { flexDirection: "row", alignItems: "center", backgroundColor: "#FEE2E2", padding: spacing.md, borderRadius: radii.lg, marginTop: spacing.md, borderWidth: 1, borderColor: "#FCA5A5" },
  kpi: { width: "31%", backgroundColor: "white", borderRadius: radii.xl, padding: spacing.md, minWidth: 110 },
  kpiIcon: { width: 32, height: 32, borderRadius: radii.full, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  moduleCard: { width: "48%", backgroundColor: "white", borderRadius: radii.xxl, padding: spacing.md, alignItems: "flex-start" },
  moduleIcon: { width: 48, height: 48, borderRadius: radii.full, alignItems: "center", justifyContent: "center" },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#EF4444", paddingVertical: 14, borderRadius: radii.xxl, marginTop: spacing.xl },
});
