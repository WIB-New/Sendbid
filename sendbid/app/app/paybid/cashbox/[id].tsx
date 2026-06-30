/**
 * /paybid/cashbox/[id].tsx — Détail d'une caisse (super-agent only, item 5).
 *
 * Affiche le solde, les infos, les mouvements et les opérations d'une caisse
 * spécifique (sub-agent) sous la responsabilité du super-agent.
 */
import React, { useCallback, useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { TText } from "../../../src/components/TText";
import { api } from "../../../src/api";
import { paybidColors } from "../../../src/paybidTheme";
import { spacing, radii } from "../../../src/theme";
import { formatMoney } from "../../../src/utils/money";
import { useTranslation } from "../../../../src/i18n";

export default function CashboxDetail() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setRefreshing(true);
    setErr(null);
    try {
      const r = await api.get(`/agent/agency/cashboxes/${id}`);
      setData(r.data);
    } catch (e: any) {
      setErr(e?.response?.data?.detail || "Impossible de charger la caisse");
    } finally { setRefreshing(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const cb = data?.cashbox;
  const floats = data?.floats || [];
  const movements = data?.movements || [];
  const totalBalance = floats.reduce((acc: number, f: any) => acc + Number(f.balance || 0), 0);
  const currency = floats[0]?.currency || "XOF";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: paybidColors.neutrals.background }} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={paybidColors.neutrals.textPrimary} />
        </TouchableOpacity>
        <TText variant="title" weight="extraBold" style={{ marginLeft: 6, flex: 1 }} numberOfLines={1}>
          {cb ? (cb.full_name || `Caisse ${id?.slice(-4).toUpperCase()}`) : "Caisse"}
        </TText>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}>
        {err ? (
          <View style={styles.errorBox}><TText color="#EF4444">{err}</TText></View>
        ) : !cb ? (
          <View style={styles.empty}><TText variant="caption" color={paybidColors.neutrals.textSecondary}>Chargement…</TText></View>
        ) : (
          <>
            {/* Solde caisse — marron */}
            <View style={[styles.balanceCard, { backgroundColor: "#54280f" }]}>
              <TText variant="caption" weight="bold" color="rgba(255,255,255,0.78)" style={{ letterSpacing: 1 }}>SOLDE CAISSE</TText>
              <TText weight="extraBold" color="white" style={{ fontSize: 28, marginTop: 4 }} adjustsFontSizeToFit numberOfLines={1}>
                {formatMoney(totalBalance, currency)}
              </TText>
              <TText variant="caption" color="rgba(255,255,255,0.78)" style={{ marginTop: 4 }}>
                {cb.available ? "🟢 En ligne" : "🔴 Hors ligne"} · {cb.city || "—"} · ID {cb.profile_id || cb.id?.slice(-8)}
              </TText>
            </View>

            {/* Infos */}
            <TText variant="body" weight="extraBold" style={{ marginTop: spacing.lg, marginBottom: 8 }}>Informations</TText>
            <View style={styles.card}>
              <Info label="Responsable" value={cb.full_name || "—"} />
              <Info label="ID profil" value={cb.profile_id || cb.id} />
              <Info label="Ville" value={cb.city || "—"} />
              <Info label="Pays" value={cb.country || "—"} />
              <Info label="Téléphone" value={cb.phone || "—"} />
              <Info label="Email" value={cb.email || "—"} last />
            </View>

            {/* Mouvements */}
            <TText variant="body" weight="extraBold" style={{ marginTop: spacing.lg, marginBottom: 8 }}>
              Mouvements ({movements.length})
            </TText>
            {movements.length === 0 ? (
              <View style={styles.empty}><TText variant="caption" color={paybidColors.neutrals.textTertiary}>Aucun mouvement</TText></View>
            ) : movements.map((m: any) => {
              const sign = Number(m.amount_signed || m.amount || 0);
              return (
                <View key={m.id} style={styles.movRow}>
                  <View style={[styles.movIcon, { backgroundColor: sign >= 0 ? "#ECFDF5" : "#FEF2F2" }]}>
                    <Ionicons name={sign >= 0 ? "arrow-down" : "arrow-up"} size={16} color={sign >= 0 ? "#10B981" : "#EF4444"} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <TText weight="semiBold" style={{ textTransform: "capitalize", fontSize: 13 }}>
                      {(m.type || "—").replace(/_/g, " ")}
                    </TText>
                    <TText variant="caption" color={paybidColors.neutrals.textSecondary}>
                      {m.created_at?.slice(0, 16).replace("T", " ")}
                    </TText>
                  </View>
                  <TText weight="extraBold" color={sign >= 0 ? "#10B981" : "#EF4444"} style={{ fontSize: 12 }}>
                    {sign >= 0 ? "+" : ""}{formatMoney(Math.abs(sign), m.currency || currency)}
                  </TText>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Info({ label, value, last }: any) {
  return (
    <View style={[styles.infoRow, !last && styles.infoBorder]}>
      <TText variant="caption" color={paybidColors.neutrals.textSecondary}>{label}</TText>
      <TText weight="semiBold" style={{ marginLeft: 8, textAlign: "right", flex: 1 }} numberOfLines={2}>{value}</TText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", padding: spacing.lg, paddingBottom: 0 },
  backBtn: { padding: 6 },
  balanceCard: { padding: spacing.lg, borderRadius: radii.xxl },
  card: { backgroundColor: paybidColors.neutrals.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: paybidColors.neutrals.border, overflow: "hidden" },
  infoRow: { flexDirection: "row", padding: 14, alignItems: "center" },
  infoBorder: { borderBottomWidth: 1, borderBottomColor: paybidColors.neutrals.border },
  movRow: { flexDirection: "row", alignItems: "center", padding: 10, backgroundColor: paybidColors.neutrals.surface, borderRadius: radii.lg, marginBottom: 6, borderWidth: 1, borderColor: paybidColors.neutrals.border },
  movIcon: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", padding: 24 },
  errorBox: { padding: 16, borderRadius: radii.lg, backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA" },
});
