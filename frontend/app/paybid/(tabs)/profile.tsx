import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, Image, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { TText } from "../../../src/components/TText";
import { Button } from "../../../src/components/Button";
import { api } from "../../../src/api";
import { useAuth } from "../../../src/store";
import { paybidColors } from "../../../src/paybidTheme";
import { spacing, radii } from "../../../src/theme";

export default function PaybidProfile() {
  const router = useRouter();
  const logoutStore = useAuth((s) => s.logout);
  const [me, setMe] = useState<any>(null);

  const load = useCallback(async () => { try { const r = await api.get("/agent/me"); setMe(r.data); } catch {} }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const logout = async () => {
    Alert.alert("Se déconnecter", "Voulez-vous vraiment quitter PAYBID ?", [
      { text: "Annuler" },
      { text: "Se déconnecter", style: "destructive", onPress: async () => {
        await logoutStore();
        router.replace("/paybid/login" as any);
      }},
    ]);
  };

  if (!me) return null;
  const { user, agent, wallet } = me;
  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: paybidColors.neutrals.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 30 }}>
        <View style={styles.head}>
          <Image source={{ uri: agent.avatar_url }} style={styles.avatar} />
          <TText variant="title" weight="extraBold">{agent.full_name}</TText>
          <TText variant="caption" color={paybidColors.neutrals.textSecondary}>{user.email} · {agent.city}</TText>
          <View style={styles.statsRow}>
            <Stat icon="star" label="Note" value={`${agent.rating} ⭐`} />
            <Stat icon="checkmark-done" label="Transferts" value={`${agent.transfers_count}`} />
            <Stat icon="shield-checkmark" label="KYC" value={`Tier ${agent.kyc_tier || 2}`} />
          </View>
        </View>

        <Section title="Compte">
          <Row icon="wallet-outline" label="Solde wallet" value={`${Number(wallet?.balance || 0).toFixed(2)} ${wallet?.currency || "EUR"}`} />
          <Row icon="id-card-outline" label="ID Profil" value={user.profile_id} />
          <Row icon="call-outline" label="Téléphone" value={user.phone} />
        </Section>

        <Section title="Activité">
          <Row icon="location-outline" label="Adresse" value={agent.address || agent.city} />
          <Row icon="options-outline" label="Modes de remise" value={(agent.delivery_modes || []).join(", ").toUpperCase()} />
          <Row icon="swap-horizontal-outline" label="Disponibilité" value={agent.available !== false ? "En ligne" : "Hors-ligne"} />
        </Section>

        <Button title="Scanner un QR client" icon="qr-code-outline" onPress={() => router.push("/paybid/scan" as any)} style={{ backgroundColor: paybidColors.primary.base, marginTop: spacing.lg }} />
        <Button title="Se déconnecter" icon="log-out-outline" variant="outline" onPress={logout} style={{ marginTop: 10, borderColor: paybidColors.status.error }} textStyle={{ color: paybidColors.status.error } as any} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ icon, label, value }: any) { return (<View style={styles.stat}><Ionicons name={icon} size={18} color={paybidColors.primary.base} /><TText weight="extraBold" style={{ marginTop: 2 }}>{value}</TText><TText variant="label" color={paybidColors.neutrals.textSecondary}>{label}</TText></View>); }
function Section({ title, children }: any) { return (<View style={{ marginTop: spacing.xl }}><TText variant="caption" weight="bold" color={paybidColors.neutrals.textSecondary} style={{ marginBottom: 6 }}>{title.toUpperCase()}</TText><View style={styles.box}>{children}</View></View>); }
function Row({ icon, label, value }: any) { return (<View style={styles.row}><Ionicons name={icon} size={18} color={paybidColors.primary.base} /><TText weight="semiBold" style={{ flex: 1, marginLeft: 10 }}>{label}</TText><TText color={paybidColors.neutrals.textSecondary}>{value}</TText></View>); }

const styles = StyleSheet.create({
  head: { alignItems: "center", padding: spacing.xl, backgroundColor: paybidColors.neutrals.surface, borderRadius: radii.xxl, borderWidth: 1, borderColor: paybidColors.neutrals.border },
  avatar: { width: 80, height: 80, borderRadius: 40, marginBottom: spacing.md },
  statsRow: { flexDirection: "row", gap: 10, marginTop: spacing.md, alignSelf: "stretch" },
  stat: { flex: 1, padding: spacing.md, backgroundColor: paybidColors.overlays.primarySoft, borderRadius: radii.lg, alignItems: "center" },
  box: { backgroundColor: paybidColors.neutrals.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: paybidColors.neutrals.border, padding: spacing.md },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
});
