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

/**
 * /agent — Panel unique pour les Agents et Super-Agents.
 * Le super-agent gère un réseau de 10 agents minimum. Les agents standards sont
 * redirigés vers l'application PayBID native.
 * Ce panel est réservé au rôle agent_admin (super-agent).
 */
export default function AgentPanel() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const [kpis, setKpis] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { router.replace("/welcome"); return; }
    if (user.role === "admin" || user.role === "super_admin") { router.replace("/admin" as any); return; }
    if (user.role === "partner_admin") { router.replace("/partner" as any); return; }
    if (user.role === "agent") { router.replace("/paybid/(tabs)" as any); return; }
    if (user.role !== "agent_admin") { router.replace("/welcome"); return; }
  }, [user]);

  useEffect(() => {
    api.get("/admin/kpis").then((r) => setKpis(r.data)).catch((e: any) => setErr(e?.response?.data?.detail || "Accès non autorisé"));
  }, []);

  const networkSize = (user as any)?.agents_count || 10;

  const CARDS = [
    { key: "agents",    icon: "people-circle",   color: "#C17043", label: "Mon réseau d'agents", desc: `${networkSize}+ sous-agents`, route: "/admin/agents" },
    { key: "transfers", icon: "swap-horizontal", color: "#994A26", label: "Transferts réseau",   desc: "Vue consolidée", route: "/admin/transfers" },
    { key: "float",     icon: "cash-outline",    color: "#10B981", label: "Float & trésorerie",  desc: "Déclarations consolidées", route: "/admin/reconciliation" },
    { key: "users",     icon: "people",          color: "#8B5CF6", label: "Clients servis",     desc: "Identités & KYC", route: "/admin/users" },
  ];

  return (
    <LinearGradient colors={["#3F1D0F", "#66301A", "#1D0A04"]} style={{ flex: 1 }}>
      <Screen title="Console Super-Agent" back scroll={false}>
        <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
          <View style={styles.roleChip}>
            <Ionicons name="people" size={14} color={"#C17043"} />
            <TText variant="label" weight="bold" color={"#994A26"} style={{ marginLeft: 6 }}>SUPER-AGENT</TText>
          </View>
          <TText variant="title" weight="extraBold" color="white" style={{ marginTop: 8 }}>Bonjour {user?.full_name}</TText>
          <TText variant="caption" color="rgba(255,255,255,0.75)" style={{ marginTop: 2 }}>Réseau de {networkSize} agents sous votre responsabilité</TText>

          {err ? (
            <View style={styles.errBox}>
              <Ionicons name="lock-closed" size={22} color="#EF4444" />
              <TText variant="body" color="#7F1D1D" style={{ marginLeft: 10, flex: 1 }}>{err}</TText>
            </View>
          ) : null}

          <TText variant="label" weight="extraBold" color="rgba(255,255,255,0.7)" style={{ letterSpacing: 1, marginTop: spacing.xl, marginBottom: 8 }}>PERFORMANCE RÉSEAU</TText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            <Kpi label="Agents actifs" value={kpis?.agents?.active ?? "—"} icon="people-circle" tint="#10B981" />
            <Kpi label="Float réseau" value={kpis?.float?.total_declared?.toLocaleString("fr-FR") ?? "—"} icon="cash" tint="#C17043" />
            <Kpi label="Transferts" value={kpis?.transfers?.total ?? "—"} icon="swap-horizontal" tint="#8B5CF6" />
            <Kpi label="Complétés" value={kpis?.transfers?.completed ?? "—"} icon="checkmark-done" tint="#059669" />
            <Kpi label="En cours" value={kpis?.transfers?.in_progress ?? "—"} icon="flash" tint="#F59E0B" />
            <Kpi label="Volume EUR" value={kpis?.transfers?.volume_eur?.toLocaleString("fr-FR") ?? "—"} icon="trending-up" tint="#0EA5E9" />
          </View>

          <TText variant="label" weight="extraBold" color="rgba(255,255,255,0.7)" style={{ letterSpacing: 1, marginTop: spacing.xl, marginBottom: 8 }}>GESTION DU RÉSEAU</TText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {CARDS.map((c) => (
              <TouchableOpacity key={c.key} testID={`agent-card-${c.key}`} onPress={() => router.push(c.route as any)} style={styles.moduleCard}>
                <View style={[styles.moduleIcon, { backgroundColor: c.color + "22" }]}>
                  <Ionicons name={c.icon as any} size={26} color={c.color} />
                </View>
                <TText variant="body" weight="extraBold" style={{ marginTop: 8 }}>{c.label}</TText>
                <TText variant="caption" color={colors.neutrals.textSecondary}>{c.desc}</TText>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity testID="agent-logout" style={styles.logoutBtn} onPress={async () => { await logout(); router.replace("/welcome"); }}>
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
  roleChip: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5, borderRadius: radii.full, backgroundColor: "#F6E1D2" },
  errBox: { flexDirection: "row", alignItems: "center", backgroundColor: "#FEE2E2", padding: spacing.md, borderRadius: radii.lg, marginTop: spacing.md, borderWidth: 1, borderColor: "#FCA5A5" },
  kpi: { width: "31%", backgroundColor: "white", borderRadius: radii.xl, padding: spacing.md, minWidth: 110 },
  kpiIcon: { width: 32, height: 32, borderRadius: radii.full, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  moduleCard: { width: "48%", backgroundColor: "white", borderRadius: radii.xxl, padding: spacing.md, alignItems: "flex-start" },
  moduleIcon: { width: 48, height: 48, borderRadius: radii.full, alignItems: "center", justifyContent: "center" },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#EF4444", paddingVertical: 14, borderRadius: radii.xxl, marginTop: spacing.xl },
});
