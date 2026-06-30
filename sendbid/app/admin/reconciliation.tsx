import React, { useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, RefreshControl, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../../src/components/Screen";
import { TText } from "../../src/components/TText";
import { api, apiError } from "../../src/api";
import { colors, spacing, radii } from "../../src/theme";
import { useThemedColors } from "../../src/themeContext";
import { useTranslation } from "../../src/i18n";
const TYPE_LABEL: Record<string, string> = {
  declare: "Déclarations float",
  cashin: "Encaissements",
  payout: "Décaissements",
  settlement: "Versements reçus",
  adjustment: "Ajustements",
};
const TYPE_COLOR: Record<string, string> = {
  declare: "#3B82F6",
  cashin: "#10B981",
  payout: "#EF4444",
  settlement: "#F59E0B",
  adjustment: "#8B5CF6",
};

export default function AdminReco() {
  const { t } = useTranslation();
  const colors = useThemedColors();
  const [items, setItems] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [kpis, setKpis] = useState<any>(null);

  const load = async () => {
    setRefreshing(true);
    try {
      const [{ data: reco }, { data: k }] = await Promise.all([
        api.get("/admin/reconciliation"),
        api.get("/admin/kpis"),
      ]);
      setItems(reco.movements || []);
      setKpis(k);
    } catch (e: any) { Alert.alert("Erreur", apiError(e)); }
    setRefreshing(false);
  };
  useEffect(() => { load(); }, []);

  const byType: Record<string, { total: number; count: number }> = {};
  const byCurrency: Record<string, number> = {};
  items.forEach((x) => {
    const t = x.type || "other";
    byType[t] = byType[t] || { total: 0, count: 0 };
    byType[t].total += x.total || 0;
    byType[t].count += x.count || 0;
    const c = x.currency || "EUR";
    byCurrency[c] = (byCurrency[c] || 0) + (x.total || 0);
  });

  return (
    <Screen title="Rapprochement" back>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />} contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
        {/* KPIs globales */}
        {kpis ? (
          <View style={styles.kpiBox}>
            <TText variant="caption" weight="extraBold" color={colors.neutrals.textSecondary} style={{ letterSpacing: 1 }}>VUE D&apos;ENSEMBLE</TText>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
              <KpiCard icon="cash" tint="#10B981" label="Volume transferts" value={`${Number(kpis?.transfers?.volume_eur || 0).toLocaleString("fr-FR")} \u20ac`} />
              <KpiCard icon="wallet" tint="#3B82F6" label="Float déclaré" value={`${Number(kpis?.float?.total_declared || 0).toLocaleString("fr-FR")} \u20ac`} />
              <KpiCard icon="swap-horizontal" tint="#8B5CF6" label="Transferts totaux" value={String(kpis?.transfers?.total || 0)} />
              <KpiCard icon="checkmark-done" tint="#059669" label="Complétés" value={String(kpis?.transfers?.completed || 0)} />
            </View>
          </View>
        ) : null}

        {/* Par type */}
        <TText variant="caption" weight="extraBold" color={colors.neutrals.textSecondary} style={{ letterSpacing: 1, marginTop: spacing.xl, marginBottom: 8 }}>PAR TYPE DE MOUVEMENT</TText>
        <View style={styles.list}>
          {Object.keys(byType).length === 0 ? (
            <View style={{ padding: spacing.lg, alignItems: "center" }}><TText color={colors.neutrals.textSecondary}>Aucun mouvement</TText></View>
          ) : (
            Object.entries(byType).map(([t, v], idx, arr) => (
              <View key={t} style={[styles.listItem, idx < arr.length - 1 && styles.listDivider]}>
                <View style={[styles.itemIcon, { backgroundColor: (TYPE_COLOR[t] || colors.primary.base) + "22" }]}>
                  <Ionicons name="trending-up" size={18} color={TYPE_COLOR[t] || colors.primary.base} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <TText weight="semiBold">{TYPE_LABEL[t] || t}</TText>
                  <TText variant="caption" color={colors.neutrals.textSecondary}>{v.count} mouvement(s)</TText>
                </View>
                <TText weight="extraBold" color={v.total >= 0 ? colors.status.success : colors.status.error}>
                  {v.total >= 0 ? "+" : ""}{Number(v.total).toLocaleString("fr-FR")}
                </TText>
              </View>
            ))
          )}
        </View>

        {/* Par devise */}
        {Object.keys(byCurrency).length > 0 ? (
          <>
            <TText variant="caption" weight="extraBold" color={colors.neutrals.textSecondary} style={{ letterSpacing: 1, marginTop: spacing.xl, marginBottom: 8 }}>PAR DEVISE</TText>
            <View style={styles.list}>
              {Object.entries(byCurrency).map(([c, total], idx, arr) => (
                <View key={c} style={[styles.listItem, idx < arr.length - 1 && styles.listDivider]}>
                  <View style={[styles.itemIcon, { backgroundColor: colors.overlays.primarySoft }]}>
                    <Ionicons name="logo-usd" size={18} color={colors.primary.base} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <TText weight="semiBold">{c}</TText>
                  </View>
                  <TText weight="extraBold">{Number(total).toLocaleString("fr-FR")}</TText>
                </View>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function KpiCard({ icon, tint, label, value }: any) {
  return (
    <View style={styles.kpi}>
      <View style={[styles.kpiIcon, { backgroundColor: tint + "22" }]}><Ionicons name={icon} size={18} color={tint} /></View>
      <TText variant="caption" color={colors.neutrals.textSecondary}>{label}</TText>
      <TText variant="subtitle" weight="extraBold">{value}</TText>
    </View>
  );
}

const styles = StyleSheet.create({
  kpiBox: { backgroundColor: colors.neutrals.surface, borderRadius: radii.xl, padding: spacing.md, borderWidth: 1, borderColor: colors.neutrals.border },
  kpi: { width: "47%", backgroundColor: colors.neutrals.background, borderRadius: radii.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.neutrals.border },
  kpiIcon: { width: 30, height: 30, borderRadius: radii.full, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  list: { backgroundColor: colors.neutrals.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.neutrals.border, overflow: "hidden" },
  listItem: { flexDirection: "row", alignItems: "center", padding: 12 },
  listDivider: { borderBottomWidth: 1, borderBottomColor: colors.neutrals.border },
  itemIcon: { width: 34, height: 34, borderRadius: radii.full, alignItems: "center", justifyContent: "center" },
});
