import React, { useCallback, useState } from "react";
import { View, StyleSheet, TouchableOpacity, ScrollView, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { TText } from "../../src/components/TText";
import { api } from "../../src/api";
import { useThemedPaybidColors } from "../../src/themeContext";
import { paybidColors } from "../../src/paybidTheme";
import { spacing, radii } from "../../src/theme";

function Row({ label, value, icon, color }: { label: string; value: string; icon: any; color: string }) {
  return (
    <View style={styles.row}>
      <View style={[styles.iconWrap, { backgroundColor: color + "18" }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <TText variant="label" color={paybidColors.neutrals.textSecondary}>{label}</TText>
        <TText variant="body" weight="semiBold" style={{ marginTop: 1 }}>{value || "—"}</TText>
      </View>
    </View>
  );
}

export default function PaybidAccountInfo() {
  const colors = useThemedPaybidColors();
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try { const r = await api.get("/agent/me"); setMe(r.data); } catch {}
    setRefreshing(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const { user, agent } = me || {};

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.neutrals.background }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.neutrals.textPrimary} />
        </TouchableOpacity>
        <TText variant="subtitle" weight="extraBold" style={{ marginLeft: 12 }}>Mon compte</TText>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={paybidColors.primary.base} />}
      >
        <TText variant="label" weight="bold" color={colors.neutrals.textSecondary} style={styles.sectionLabel}>IDENTITÉ</TText>
        <View style={styles.card}>
          <Row icon="person-outline" color={paybidColors.primary.base} label="Nom complet" value={agent?.full_name || user?.full_name} />
          <Row icon="finger-print-outline" color="#6366F1" label="ID Profil" value={`@${user?.profile_id || "—"}`} />
          <Row icon="mail-outline" color="#3B82F6" label="Email" value={user?.email} />
          <Row icon="call-outline" color="#10B981" label="Téléphone" value={user?.phone} />
        </View>

        <TText variant="label" weight="bold" color={colors.neutrals.textSecondary} style={styles.sectionLabel}>AGENCE</TText>
        <View style={styles.card}>
          <Row icon="business-outline" color={paybidColors.primary.base} label="Nom de l'agence" value={agent?.agency_name} />
          <Row icon="location-outline" color="#8B5CF6" label="Ville" value={agent?.city} />
          <Row icon="globe-outline" color="#F59E0B" label="Pays" value={agent?.country_code} />
          <Row icon="map-outline" color="#3B82F6" label="Adresse" value={agent?.address} />
        </View>

        <TText variant="label" weight="bold" color={colors.neutrals.textSecondary} style={styles.sectionLabel}>KYC & VÉRIFICATION</TText>
        <View style={styles.card}>
          <Row icon="shield-checkmark-outline" color="#10B981" label="Niveau KYC" value={`Tier ${agent?.kyc_tier ?? user?.kyc_tier ?? "—"}`} />
          <Row icon="document-text-outline" color="#6366F1" label="Statut" value={user?.kyc_status || "—"} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: paybidColors.neutrals.border },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: paybidColors.neutrals.surface, borderWidth: 1, borderColor: paybidColors.neutrals.border, alignItems: "center", justifyContent: "center" },
  sectionLabel: { marginTop: spacing.lg, marginBottom: 6, letterSpacing: 0.5 },
  card: { backgroundColor: paybidColors.neutrals.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: paybidColors.neutrals.border, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", padding: 14, borderBottomWidth: 1, borderBottomColor: paybidColors.neutrals.border },
  iconWrap: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
});
