import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { TText } from "../src/components/TText";
import { Button } from "../src/components/Button";
import { api } from "../src/api";
import { colors, spacing, radii } from "../src/theme";
import { useThemedColors } from "../src/themeContext";
import { useTranslation } from "../../src/i18n";
// Transferts programmés v4.0 — "33 Programmés" : header navy + liste calendaires + badge fréquence
const FREQ_LABEL: any = { weekly: "Hebdomadaire", monthly: "Mensuel", biweekly: "Bi-mensuel", once: "Une fois" };

export default function Scheduled() {
  const { t } = useTranslation();
  const colors = useThemedColors();
  const router = useRouter();
  const [list, setList] = useState<any[]>([]);

  const load = useCallback(async () => {
    try { const r = await api.get("/scheduled-transfers"); setList(r.data || []); } catch {}
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const cancel = (s: any) => {
    Alert.alert("Arrêter", `Arrêter le transfert programmé vers ${s.beneficiary_name || "—"} ?`, [
      { text: "Annuler" },
      { text: "Arrêter", style: "destructive", onPress: async () => { try { await api.delete(`/scheduled-transfers/${s.id}`); load(); } catch {} } },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#022a6b" }}>
      <LinearGradient colors={["#022a6b", "#022a6b"]} style={styles.hero}>
        <SafeAreaView edges={["top"]}>
          <View style={styles.heroTop}>
            <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
              <Ionicons name="chevron-back" size={22} color="white" />
            </TouchableOpacity>
            <TText variant="body" weight="extraBold" color="white">Transferts programmés</TText>
            <TouchableOpacity onPress={() => router.push("/transfer/new" as any)} style={styles.iconBtn}>
              <Ionicons name="add" size={20} color="white" />
            </TouchableOpacity>
          </View>
          <View style={styles.heroBody}>
            <Ionicons name="calendar" size={36} color="white" />
            <TText variant="title" weight="extraBold" color="white" style={{ marginTop: 8 }}>
              {list.length} transfert{list.length > 1 ? "s" : ""} actif{list.length > 1 ? "s" : ""}
            </TText>
            <TText variant="caption" color="rgba(255,255,255,0.8)">Programmez vos envois récurrents</TText>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView style={styles.card} contentContainerStyle={styles.cardInner} showsVerticalScrollIndicator={false}>
        {list.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="calendar-outline" size={36} color={colors.neutrals.textTertiary} />
            <TText variant="body" weight="extraBold" style={{ marginTop: 10 }}>Aucun transfert programmé</TText>
            <TText variant="caption" color={colors.neutrals.textSecondary} align="center" style={{ marginTop: 4, paddingHorizontal: spacing.lg }}>
              Programmez des envois récurrents pour aider votre famille chaque mois.
            </TText>
            <Button title="Créer un transfert programmé" icon="add" onPress={() => router.push("/transfer/new" as any)} style={{ marginTop: spacing.lg, width: "100%" }} />
          </View>
        ) : list.map((s) => (
          <View key={s.id} style={styles.sCard}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={styles.sAvatar}>
                <TText variant="body" weight="extraBold" color="white">{(s.beneficiary_name || "?").charAt(0).toUpperCase()}</TText>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <TText variant="body" weight="extraBold">{s.beneficiary_name || "Bénéficiaire"}</TText>
                <TText variant="label" color={colors.neutrals.textSecondary}>{s.destination_country} · {String(s.delivery_mode || "cash").toUpperCase()}</TText>
              </View>
              <View style={styles.freqChip}>
                <Ionicons name="sync" size={10} color={colors.primary.base} />
                <TText variant="label" weight="extraBold" color={colors.primary.base} style={{ marginLeft: 3 }}>
                  {FREQ_LABEL[s.frequency] || s.frequency}
                </TText>
              </View>
            </View>
            <View style={styles.sDivider} />
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View>
                <TText variant="label" color={colors.neutrals.textTertiary}>PROCHAIN ENVOI</TText>
                <TText variant="caption" weight="extraBold">
                  {s.next_run_at ? new Date(s.next_run_at).toLocaleDateString("fr-FR") : "—"}
                </TText>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <TText variant="label" color={colors.neutrals.textTertiary}>MONTANT</TText>
                <TText variant="body" weight="extraBold" color={colors.primary.base}>
                  {Number(s.amount || 0).toFixed(0)} {s.source_currency || "EUR"}
                </TText>
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 8, marginTop: spacing.md }}>
              <Button title="Pause" icon="pause" variant="outline" style={{ flex: 1 }} onPress={() => Alert.alert("Mise en pause", "Fonctionnalité bientôt disponible")} />
              <Button title="Arrêter" icon="close" variant="ghost" style={{ flex: 1 }} textStyle={{ color: "#EF4444" } as any} onPress={() => cancel(s)} />
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: spacing.sm },
  iconBtn: { width: 36, height: 36, borderRadius: radii.full, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" },
  heroBody: { alignItems: "center", marginTop: spacing.md },
  card: { flex: 1, backgroundColor: colors.neutrals.background, borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl, marginTop: -spacing.lg },
  cardInner: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  emptyBox: { backgroundColor: colors.neutrals.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.neutrals.border, padding: spacing.xl, alignItems: "center" },
  sCard: { backgroundColor: colors.neutrals.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.neutrals.border, padding: spacing.md, marginBottom: 12 },
  sAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary.base, alignItems: "center", justifyContent: "center" },
  freqChip: { flexDirection: "row", alignItems: "center", backgroundColor: colors.overlays.primarySoft, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radii.full },
  sDivider: { height: 1, backgroundColor: colors.neutrals.border, marginVertical: spacing.md },
});
