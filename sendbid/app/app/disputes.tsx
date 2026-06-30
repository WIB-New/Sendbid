import React, { useCallback, useState } from "react";
import { t, useLocale } from "../src/i18n";
import { View, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
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
// Litiges v4.0 — "34 Litiges" : 3 counters (Ouverts / En cours / Résolus) + accordion liste
const STATUS_COLOR: any = {
  open: { c: "#EF4444", bg: "#FEE2E2", label: "Ouvert" },
  in_review: { c: "#F59E0B", bg: "#FEF3C7", label: "En cours" },
  resolved: { c: "#10B981", bg: "#D1FAE5", label: "Résolu" },
  closed: { c: "#6B7280", bg: "#F3F4F6", label: "Clos" },
};

export default function Disputes() {
  const { t } = useTranslation();
  useLocale((st) => st.locale);
  const colors = useThemedColors();
  const router = useRouter();
  const [list, setList] = useState<any[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { const r = await api.get("/disputes"); setList(r.data || []); } catch {}
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const counts = {
    open: list.filter((d) => d.status === "open").length,
    in_review: list.filter((d) => d.status === "in_review").length,
    resolved: list.filter((d) => d.status === "resolved").length,
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#022a6b" }}>
      <LinearGradient colors={["#7F1D1D", "#991B1B", "#022a6b"]} style={styles.hero}>
        <SafeAreaView edges={["top"]}>
          <View style={styles.heroTop}>
            <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
              <Ionicons name="chevron-back" size={22} color="white" />
            </TouchableOpacity>
            <TText variant="body" weight="extraBold" color="white">Litiges et réclamations</TText>
            <View style={{ width: 36 }} />
          </View>
          <View style={styles.heroBody}>
            <View style={styles.warnBadge}><Ionicons name="warning" size={28} color="white" /></View>
            <TText variant="title" weight="extraBold" color="white" align="center" style={{ marginTop: 10 }}>
              {list.length === 0 ? "Aucun litige ouvert" : `${list.length} réclamation${list.length > 1 ? "s" : ""}`}
            </TText>
            <TText variant="caption" color="rgba(255,255,255,0.8)" align="center">
              Nous garantissons la sécurité de vos transferts
            </TText>
          </View>
          <View style={styles.counterRow}>
            <Counter label="Ouverts" value={counts.open} color="#F87171" />
            <View style={styles.csep} />
            <Counter label="En cours" value={counts.in_review} color="#FCD34D" />
            <View style={styles.csep} />
            <Counter label="Résolus" value={counts.resolved} color="#6EE7B7" />
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView style={styles.card} contentContainerStyle={styles.cardInner} showsVerticalScrollIndicator={false}>
        <Button testID="open-dispute" title="Ouvrir un nouveau litige" icon="add-circle" onPress={() => router.push("/disputes/new" as any)} style={{ backgroundColor: "#EF4444" }} />

        {list.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="shield-checkmark-outline" size={36} color="#10B981" />
            <TText variant="body" weight="extraBold" style={{ marginTop: 10 }}>Tout est en ordre</TText>
            <TText variant="caption" color={colors.neutrals.textSecondary} align="center" style={{ marginTop: 4 }}>
              Vos transferts sont sécurisés. Contactez-nous si nécessaire.
            </TText>
          </View>
        ) : null}

        {list.map((d) => {
          const st = STATUS_COLOR[d.status] || STATUS_COLOR.open;
          const isOpen = open === d.id;
          return (
            <TouchableOpacity key={d.id} onPress={() => setOpen(isOpen ? null : d.id)} style={styles.dCard}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={[styles.statusChip, { backgroundColor: st.bg }]}>
                  <View style={[styles.dot, { backgroundColor: st.c }]} />
                  <TText variant="label" weight="extraBold" color={st.c}>{st.label}</TText>
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <TText variant="body" weight="extraBold" numberOfLines={1}>{d.subject || d.reason || "Litige"}</TText>
                  <TText variant="label" color={colors.neutrals.textSecondary}>
                    Ouvert le {new Date(d.created_at).toLocaleDateString("fr-FR")}
                  </TText>
                </View>
                <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={18} color={colors.neutrals.textTertiary} />
              </View>
              {isOpen ? (
                <View style={{ marginTop: spacing.md }}>
                  <TText variant="caption" color={colors.neutrals.textSecondary}>
                    {d.description || "Aucun détail fourni."}
                  </TText>
                  {d.transfer_id ? (
                    <TouchableOpacity onPress={() => router.push({ pathname: "/transfer/[id]", params: { id: d.transfer_id } })} style={styles.linkRow}>
                      <Ionicons name="link" size={14} color={colors.primary.base} />
                      <TText variant="caption" weight="extraBold" color={colors.primary.base} style={{ marginLeft: 6 }}>
                        Voir le transfert concerné
                      </TText>
                    </TouchableOpacity>
                  ) : null}
                  <Button title="Contacter le support" icon="chatbubbles-outline" variant="outline" onPress={() => router.push("/contact" as any)} style={{ marginTop: 10 }} />
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

function Counter({ label, value, color }: any) {
  return (
    <View style={{ alignItems: "center", paddingHorizontal: 8 }}>
      <TText variant="title" weight="extraBold" color={color}>{value}</TText>
      <TText variant="label" color="rgba(255,255,255,0.85)">{label}</TText>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: spacing.sm },
  iconBtn: { width: 36, height: 36, borderRadius: radii.full, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  heroBody: { alignItems: "center", marginTop: spacing.md },
  warnBadge: { width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  counterRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: spacing.lg, backgroundColor: "rgba(0,0,0,0.2)", padding: spacing.md, borderRadius: radii.xl },
  csep: { width: 1, height: 30, backgroundColor: "rgba(255,255,255,0.2)" },
  card: { flex: 1, backgroundColor: colors.neutrals.background, borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl, marginTop: -spacing.lg },
  cardInner: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  emptyBox: { backgroundColor: colors.neutrals.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.neutrals.border, padding: spacing.xl, alignItems: "center", marginTop: spacing.md },
  dCard: { backgroundColor: colors.neutrals.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.neutrals.border, padding: spacing.md, marginTop: 10 },
  statusChip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 4, borderRadius: radii.full },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 4 },
  linkRow: { flexDirection: "row", alignItems: "center", marginTop: 10 },
});
