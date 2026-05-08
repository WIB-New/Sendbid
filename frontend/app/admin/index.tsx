import React, { useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../../src/components/Screen";
import { TText } from "../../src/components/TText";
import { api } from "../../src/api";
import { useAuth } from "../../src/store";
import { colors, spacing, radii } from "../../src/theme";

/**
 * Admin Dashboard — panel web RÉSERVÉ aux rôles `admin` et `super_admin`.
 * Les partner_admin sont redirigés vers /partner, les agent_admin vers /agent.
 * Le super-admin a les mêmes modules que l'admin + indicateur de niveau supérieur.
 */
export default function AdminDashboard() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const [kpis, setKpis] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  // Redirection par rôle : seuls admin / super_admin restent sur ce panel
  useEffect(() => {
    if (!user) { router.replace("/welcome"); return; }
    if (user.role === "partner_admin") { router.replace("/partner" as any); return; }
    if (user.role === "agent_admin") { router.replace("/agent" as any); return; }
    if (user.role !== "admin" && user.role !== "super_admin") { router.replace("/welcome"); return; }
  }, [user]);

  useEffect(() => {
    api.get("/admin/kpis").then((r) => setKpis(r.data)).catch((e: any) => setErr(e?.response?.data?.detail || "Accès non autorisé"));
  }, []);

  const isSuper = user?.role === "super_admin";
  const role = isSuper ? "Super-Administrateur" : "Administrateur";

  const CARDS = [
    { key: "agents", icon: "people-circle", color: "#3B82F6", label: "Agents & réseau", route: "/admin/agents", desc: "Modération, activation, float" },
    { key: "transfers", icon: "swap-horizontal", color: "#10B981", label: "Transferts", route: "/admin/transfers", desc: "Supervision 360°" },
    { key: "users", icon: "people", color: "#8B5CF6", label: "Utilisateurs", route: "/admin/users", desc: "Clients, rôles, KYC" },
    { key: "reco", icon: "calculator", color: "#F59E0B", label: "Rapprochement", route: "/admin/reconciliation", desc: "Float & règlements" },
    ...(isSuper ? [
      { key: "settings", icon: "construct", color: "#EF4444", label: "Système", route: "/admin/reconciliation", desc: "Config & corridors" },
      { key: "audit", icon: "document-text", color: "#0EA5E9", label: "Audit trail", route: "/admin/users", desc: "Journal des actions" },
    ] : []),
  ];

  return (
    <LinearGradient colors={["#0A1338", "#0F1B40", "#070C24"]} style={{ flex: 1 }}>
      <Screen title="Console d'administration" back scroll={false}>
        <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
          <View style={styles.roleChip}>
            <Ionicons name="shield-checkmark" size={14} color={colors.primary.base} />
            <TText variant="label" weight="bold" color={colors.primary.base} style={{ marginLeft: 6 }}>RÔLE : {role.toUpperCase()}</TText>
          </View>

          {err ? (
            <View style={styles.errBox}>
              <Ionicons name="lock-closed" size={22} color="#EF4444" />
              <TText variant="body" color="#7F1D1D" style={{ marginLeft: 10, flex: 1 }}>{err}</TText>
            </View>
          ) : null}

          {/* KPIs hero */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: spacing.md }}>
            <Kpi label="Utilisateurs" value={kpis?.users?.total ?? "—"} icon="people" tint="#3B82F6" />
            <Kpi label="Agents actifs" value={kpis?.agents?.active ?? "—"} icon="people-circle" tint="#10B981" />
            <Kpi label="Agents en attente" value={kpis?.agents?.pending ?? "—"} icon="hourglass" tint="#F59E0B" />
            <Kpi label="Transferts" value={kpis?.transfers?.total ?? "—"} icon="swap-horizontal" tint="#8B5CF6" />
            <Kpi label="En cours" value={kpis?.transfers?.in_progress ?? "—"} icon="flash" tint="#EC4899" />
            <Kpi label="Volume EUR" value={kpis?.transfers?.volume_eur?.toLocaleString("fr-FR") ?? "—"} icon="trending-up" tint="#0EA5E9" />
          </View>

          {/* Navigation cards */}
          <TText variant="label" weight="extraBold" color="rgba(255,255,255,0.7)" style={{ letterSpacing: 1, marginTop: spacing.xl, marginBottom: 8 }}>MODULES</TText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {CARDS.map((c) => (
              <TouchableOpacity key={c.key} testID={`admin-card-${c.key}`} onPress={() => router.push(c.route as any)} style={styles.moduleCard}>
                <View style={[styles.moduleIcon, { backgroundColor: c.color + "22" }]}>
                  <Ionicons name={c.icon as any} size={26} color={c.color} />
                </View>
                <TText variant="body" weight="extraBold" style={{ marginTop: 8 }}>{c.label}</TText>
                <TText variant="caption" color={colors.neutrals.textSecondary}>Ouvrir</TText>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity testID="admin-logout" style={styles.logoutBtn} onPress={async () => { await logout(); router.replace("/welcome"); }}>
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
  roleChip: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5, borderRadius: radii.full, backgroundColor: colors.overlays.primarySoft },
  errBox: { flexDirection: "row", alignItems: "center", backgroundColor: "#FEE2E2", padding: spacing.md, borderRadius: radii.lg, marginTop: spacing.md, borderWidth: 1, borderColor: "#FCA5A5" },
  kpi: { width: "31%", backgroundColor: "white", borderRadius: radii.xl, padding: spacing.md, minWidth: 110 },
  kpiIcon: { width: 32, height: 32, borderRadius: radii.full, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  moduleCard: { width: "48%", backgroundColor: "white", borderRadius: radii.xxl, padding: spacing.md, alignItems: "flex-start" },
  moduleIcon: { width: 48, height: 48, borderRadius: radii.full, alignItems: "center", justifyContent: "center" },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#EF4444", paddingVertical: 14, borderRadius: radii.xxl, marginTop: spacing.xl },
});
