import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, RefreshControl, FlatList, ActivityIndicator, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { TText } from "../../../src/components/TText";
import { Button } from "../../../src/components/Button";
import { api, apiError } from "../../../src/api";
import { paybidColors } from "../../../src/paybidTheme";
import { spacing, radii, shadows } from "../../../src/theme";
import { useTranslation } from "../../../src/i18n";

export default function PaybidEarnings() {
  const { t } = useTranslation();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [balanceVisible, setBalanceVisible] = useState(false);

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try { 
      const r = await api.get("/agent/earnings", { params: { days: 30 } }); 
      setData(r.data); 
    } catch (e: any) {
      setError(apiError(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Loading state
  if (loading) {
    return (
      <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: paybidColors.neutrals.background }}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={paybidColors.primary.base} />
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error) {
    return (
      <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: paybidColors.neutrals.background }}>
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={48} color={paybidColors.status.error} />
          <TText style={{ marginTop: 16, marginBottom: 24 }} color={paybidColors.neutrals.textSecondary}>{error}</TText>
          <Button title="Réessayer" onPress={() => load()} style={{ backgroundColor: paybidColors.primary.base }} />
        </View>
      </SafeAreaView>
    );
  }

  if (!data) return null;

  return (
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: paybidColors.neutrals.background }}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={paybidColors.primary.base} />} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}>
        <LinearGradient colors={paybidColors.gradients.earnings} start={{x:0,y:0}} end={{x:1,y:1}} style={[styles.hero, shadows.lg]}>
          <Ionicons name="trending-up" size={28} color="white" />
          <TText variant="caption" color="rgba(255,255,255,0.85)" style={{ marginTop: 8 }}>Vos gains des {data.period_days} derniers jours</TText>
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
            <TText variant="display" weight="extraBold" color="white">
              {balanceVisible ? `${Number(data.total_eur).toFixed(2)} EUR` : "•••••• EUR"}
            </TText>
            <TouchableOpacity onPress={() => setBalanceVisible(!balanceVisible)} style={{ marginLeft: 12, padding: 6 }}>
              <Ionicons name={balanceVisible ? "eye-off" : "eye"} size={22} color="rgba(255,255,255,0.9)" />
            </TouchableOpacity>
          </View>
          <TText variant="caption" color="rgba(255,255,255,0.85)">{data.transactions.length} transferts encaissés</TText>
        </LinearGradient>
        <Button
          title="Retirer mes gains"
          icon="arrow-up-circle"
          onPress={() => router.push("/paybid/cashout" as any)}
          style={{ backgroundColor: paybidColors.primary.base, marginTop: spacing.md }}
        />
        <TText variant="subtitle" weight="bold" style={{ marginTop: spacing.xl, marginBottom: 8 }}>Historique</TText>
        {data.transactions.length === 0 ? <View style={styles.empty}><TText color={paybidColors.neutrals.textSecondary}>Aucun gain pour l'instant</TText></View> : data.transactions.map((t: any) => (
          <View key={t.id} style={styles.row}>
            <View style={styles.icon}><Ionicons name="cash" size={18} color={paybidColors.primary.base} /></View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <TText weight="semiBold">{t.counterparty}</TText>
              <TText variant="caption" color={paybidColors.neutrals.textSecondary}>{t.note || "—"} · {new Date(t.created_at).toLocaleDateString("fr-FR")}</TText>
            </View>
            <TText weight="extraBold" color={paybidColors.status.success}>+{Number(t.amount).toFixed(2)} EUR</TText>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.xl },
  hero: { padding: spacing.xl, borderRadius: radii.xxl, alignItems: "flex-start" },
  row: { flexDirection: "row", alignItems: "center", padding: 12, backgroundColor: paybidColors.neutrals.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: paybidColors.neutrals.border, marginBottom: 8 },
  icon: { width: 40, height: 40, borderRadius: radii.full, backgroundColor: paybidColors.overlays.primarySoft, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", padding: 40, backgroundColor: paybidColors.neutrals.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: paybidColors.neutrals.border },
});
