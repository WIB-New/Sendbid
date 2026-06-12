/**
 * /paybid/agency-ops.tsx — Opérations consolidées de l'agence (super-agent only).
 */
import React, { useCallback, useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { TText } from "../../src/components/TText";
import { api } from "../../src/api";
import { paybidColors } from "../../src/paybidTheme";
import { spacing, radii } from "../../src/theme";
import { formatMoney } from "../../src/utils/money";

export default function PaybidAgencyOps() {
  const router = useRouter();
  const [ops, setOps] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const r = await api.get("/agent/agency/operations?limit=100").catch(() => ({ data: [] }));
      setOps(r.data?.items || r.data || []);
    } catch {}
    finally { setRefreshing(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: paybidColors.neutrals.background }} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={paybidColors.neutrals.textPrimary} />
        </TouchableOpacity>
        <TText variant="title" weight="extraBold" style={{ marginLeft: 6 }}>Opérations agence</TText>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}>
        {ops.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={42} color={paybidColors.neutrals.textTertiary} />
            <TText variant="caption" color={paybidColors.neutrals.textSecondary} style={{ marginTop: 8, textAlign: "center" }}>
              Vue consolidée des opérations de tous les agents de votre agence.{"\n"}Bientôt disponible.
            </TText>
          </View>
        ) : ops.map((op: any) => (
          <View key={op.id} style={styles.row}>
            <View style={{ flex: 1 }}>
              <TText weight="semiBold">{op.agent_name || "—"}</TText>
              <TText variant="caption" color={paybidColors.neutrals.textSecondary}>{op.type} · {op.created_at?.slice(0, 16).replace("T", " ")}</TText>
            </View>
            <TText weight="extraBold">{formatMoney(op.amount || 0, op.currency || "EUR")}</TText>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", padding: spacing.lg, paddingBottom: 0 },
  backBtn: { padding: 6 },
  empty: { alignItems: "center", padding: 40 },
  row: { flexDirection: "row", alignItems: "center", padding: 12, backgroundColor: paybidColors.neutrals.surface, borderRadius: radii.lg, marginBottom: 8, borderWidth: 1, borderColor: paybidColors.neutrals.border },
});
