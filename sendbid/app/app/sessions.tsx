import React, { useEffect, useState } from "react";
import { View, StyleSheet, Alert, TouchableOpacity, RefreshControl, ScrollView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../src/components/Screen";
import { TText } from "../src/components/TText";
import { api, apiError } from "../src/api";
import { useAuth } from "../src/store";
import { colors, spacing, radii } from "../src/theme";
import { useThemedColors } from "../src/themeContext";
import { useTranslation } from "../../src/i18n";
export default function Sessions() {
  const { t } = useTranslation();
  const colors = useThemedColors();
  const router = useRouter();
  const logout = useAuth((s) => s.logout);
  const [sessions, setSessions] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setRefreshing(true);
    setErr(null);
    try {
      const { data } = await api.get("/sessions");
      setSessions(data || []);
    } catch (e: any) {
      setErr(apiError(e));
    } finally { setRefreshing(false); }
  };
  useEffect(() => { load(); }, []);

  const revokeOne = async (id: string) => {
    try { await api.post("/sessions/revoke", { session_id: id }); await load(); } catch (e: any) { Alert.alert("Erreur", apiError(e)); }
  };

  const logoutAll = () => {
    // v2 — Alert.alert ne fonctionne pas correctement sur web → fallback window.confirm.
    const exec = async () => {
      try { await api.post("/sessions/revoke-all"); } catch {}
      try { await logout(); } catch {}
      // Sur web, force un reload pour effacer tout l'état mémoire.
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.location.replace("/welcome");
      } else {
        router.replace("/welcome");
      }
    };
    if (Platform.OS === "web" && typeof window !== "undefined") {
      if (window.confirm("Toutes vos sessions seront fermées sur tous les appareils. Vous serez aussi déconnecté ici. Continuer ?")) {
        exec();
      }
      return;
    }
    Alert.alert("Tout déconnecter", "Toutes vos sessions seront fermées sur tous les appareils. Vous serez aussi déconnecté ici.", [
      { text: "Annuler", style: "cancel" },
      { text: "Confirmer", style: "destructive", onPress: exec },
    ]);
  };

  const iconFor = (device?: string) => {
    if (!device) return "phone-portrait";
    const d = device.toLowerCase();
    if (d.includes("web") || d.includes("mac") || d.includes("windows") || d.includes("linux")) return "laptop";
    return "phone-portrait";
  };

  const fmt = (iso: string) => {
    try { return new Date(iso).toLocaleString("fr-FR"); } catch { return iso; }
  };

  return (
    <Screen title="Sessions actives" back hero scroll={false}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />} contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
        <TText variant="caption" color={colors.neutrals.textSecondary} style={{ marginBottom: spacing.md }}>
          Gérez vos appareils et navigateurs connectés à votre compte SENDBID.
        </TText>
        {err ? <TText variant="caption" color={colors.status.error} style={{ marginBottom: 8 }}>{err}</TText> : null}

        {sessions.length === 0 && !refreshing ? (
          <View style={{ alignItems: "center", paddingVertical: spacing.xxxl }}>
            <Ionicons name="lock-closed-outline" size={40} color={colors.neutrals.textTertiary} />
            <TText variant="caption" color={colors.neutrals.textSecondary} style={{ marginTop: 8 }}>Aucune session active.</TText>
          </View>
        ) : null}

        {sessions.map((s: any, i: number) => (
          <View key={s.id} style={[styles.row, i < sessions.length - 1 && { marginBottom: 8 }]}>
            <View style={[styles.icon, { backgroundColor: s.kind === "biometric" ? "rgba(139,92,246,0.18)" : colors.overlays.primarySoft }]}>
              <Ionicons name={iconFor(s.device)} size={20} color={s.kind === "biometric" ? "#8B5CF6" : colors.primary.base} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <TText variant="body" weight="semiBold">{s.device || "Appareil inconnu"}</TText>
              <TText variant="caption" color={colors.neutrals.textSecondary} numberOfLines={1}>
                {s.kind === "biometric" ? "Biométrique • " : s.kind === "register" ? "Inscription • " : ""}
                {s.ip || "IP inconnue"} • {fmt(s.last_seen || s.created_at)}
              </TText>
            </View>
            <TouchableOpacity testID={`sess-revoke-${s.id}`} onPress={() => revokeOne(s.id)}>
              <Ionicons name="close-circle-outline" size={22} color="#EF4444" />
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity testID="sessions-logout-all" style={styles.logoutAllRow} onPress={logoutAll}>
          <View style={[styles.icon, { backgroundColor: "rgba(239,68,68,0.12)" }]}>
            <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <TText variant="body" weight="semiBold" color="#EF4444">Déconnecter tous les appareils</TText>
            <TText variant="caption" color={colors.neutrals.textSecondary} style={{ marginTop: 2 }}>Fermer toutes les sessions actives</TText>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.neutrals.textTertiary} />
        </TouchableOpacity>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", padding: 14, backgroundColor: colors.neutrals.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.neutrals.border },
  icon: { width: 40, height: 40, borderRadius: radii.full, alignItems: "center", justifyContent: "center" },
  dangerBox: { backgroundColor: "#FEF2F2", borderRadius: radii.xl, padding: spacing.md, marginTop: spacing.lg, borderWidth: 1, borderColor: "#FCA5A5" },
  dangerBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, backgroundColor: "#EF4444", borderRadius: radii.lg },
  logoutAllRow: { flexDirection: "row", alignItems: "center", padding: 14, marginTop: 8, backgroundColor: colors.neutrals.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.neutrals.border },
});
