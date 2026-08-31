import React, { useEffect, useState } from "react";
import { View, StyleSheet, TouchableOpacity, Alert, RefreshControl, FlatList, Modal, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../../src/components/Screen";
import { TText } from "../../src/components/TText";
import { Button } from "../../src/components/Button";
import { api, apiError } from "../../src/api";
import { colors, spacing, radii } from "../../src/theme";
import { useThemedColors } from "../../src/themeContext";
import { useTranslation } from "../../src/i18n";
import { useToast } from "../../src/components/Toast";

export default function AdminAgents() {
  const { t } = useTranslation();
  const colors = useThemedColors();
  const [items, setItems] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<any>(null);
  const toast = useToast();

  const load = async () => {
    setRefreshing(true);
    try {
      const params: any = {};
      if (statusFilter !== "all") params.status = statusFilter;
      const { data } = await api.get("/admin/agents", { params });
      setItems(data.items || []);
    } catch (e: any) { toast.error({ title: "Erreur", message: apiError(e) }); }
    setRefreshing(false);
  };
  useEffect(() => { load(); }, [statusFilter]);

  const moderate = async (action: string) => {
    if (!selected) return;
    const confirm = Platform.OS === "web" ? (typeof window !== "undefined" && (window as any).confirm(`Confirmer l'action "${action}" ?`)) : true;
    if (!confirm) return;
    try {
      await api.post("/admin/agents/moderate", { agent_id: selected.id, action });
      setSelected(null);
      await load();
    } catch (e: any) { toast.error({ title: "Erreur", message: apiError(e) }); }
  };

  const STATUSES = [
    { k: "all", l: "Tous" },
    { k: "pending_verification", l: "En attente" },
    { k: "approved", l: "Approuvés" },
    { k: "suspended", l: "Suspendus" },
    { k: "rejected", l: "Rejetés" },
  ];

  return (
    <Screen title="Gestion des agents" back scroll={false}>
      <View style={styles.chipRow}>
        {STATUSES.map((s) => (
          <TouchableOpacity key={s.k} onPress={() => setStatusFilter(s.k)} style={[styles.chip, statusFilter === s.k && styles.chipActive]}>
            <TText variant="label" weight="bold" color={statusFilter === s.k ? "white" : colors.neutrals.textPrimary}>{s.l}</TText>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        ListEmptyComponent={<View style={{ alignItems: "center", padding: spacing.xxxl }}><TText color={colors.neutrals.textSecondary}>Aucun agent</TText></View>}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => setSelected(item)} style={styles.row}>
            <View style={styles.avatar}><Ionicons name="person" size={20} color="white" /></View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <TText weight="semiBold">{item.full_name}</TText>
              <TText variant="caption" color={colors.neutrals.textSecondary}>{item.city} • {item.country} • {item.agent_type || "own"}</TText>
              <TText variant="label" color={colors.neutrals.textTertiary}>Note {item.rating?.toFixed(1) || "—"} • {item.total_transfers || 0} transferts</TText>
            </View>
            <View style={[styles.statusChip, { backgroundColor: statusColor(item.status) + "22" }]}>
              <TText variant="label" weight="bold" style={{ color: statusColor(item.status) }}>
                {(item.status || "—").replace("_", " ").slice(0, 14)}
              </TText>
            </View>
          </TouchableOpacity>
        )}
      />

      {/* Detail modal */}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <TouchableOpacity activeOpacity={1} style={styles.overlay} onPress={() => setSelected(null)}>
          <TouchableOpacity activeOpacity={1} style={styles.sheet}>
            {selected ? (
              <>
                <TText variant="subtitle" weight="extraBold">{selected.full_name}</TText>
                <TText variant="caption" color={colors.neutrals.textSecondary}>{selected.email || "—"} • {selected.phone || "—"}</TText>
                <View style={{ marginTop: spacing.md, gap: 4 }}>
                  <TText variant="caption"><TText weight="bold">Type :</TText> {selected.agent_type}</TText>
                  <TText variant="caption"><TText weight="bold">Ville :</TText> {selected.city}, {selected.country}</TText>
                  <TText variant="caption"><TText weight="bold">Statut :</TText> {selected.status}</TText>
                  <TText variant="caption"><TText weight="bold">Transferts :</TText> {selected.total_transfers || 0}</TText>
                  {selected.legal_name ? <TText variant="caption"><TText weight="bold">Raison sociale :</TText> {selected.legal_name}</TText> : null}
                  {selected.registration_number ? <TText variant="caption"><TText weight="bold">SIRET/RCS :</TText> {selected.registration_number}</TText> : null}
                </View>
                <View style={{ flexDirection: "row", gap: 8, marginTop: spacing.lg }}>
                  {selected.status !== "approved" ? <Button title="Approuver" icon="checkmark" onPress={() => moderate("approve")} style={{ flex: 1, backgroundColor: "#10B981" }} /> : null}
                  {selected.status !== "suspended" ? <Button title="Suspendre" icon="pause" variant="outline" onPress={() => moderate("suspend")} style={{ flex: 1 }} /> : null}
                  {selected.status !== "rejected" ? <Button title="Rejeter" icon="close" onPress={() => moderate("reject")} style={{ flex: 1, backgroundColor: "#EF4444" }} /> : null}
                </View>
              </>
            ) : null}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </Screen>
  );
}

function statusColor(s: string): string {
  if (s === "approved") return "#10B981";
  if (s === "pending_verification") return "#F59E0B";
  if (s === "suspended") return "#8B5CF6";
  if (s === "rejected") return "#EF4444";
  return "#6B7280";
}

const styles = StyleSheet.create({
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: spacing.md },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radii.full, backgroundColor: colors.neutrals.surface, borderWidth: 1, borderColor: colors.neutrals.border },
  chipActive: { backgroundColor: colors.primary.base, borderColor: colors.primary.base },
  row: { flexDirection: "row", alignItems: "center", padding: 12, backgroundColor: colors.neutrals.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.neutrals.border, marginBottom: 8 },
  avatar: { width: 40, height: 40, borderRadius: radii.full, backgroundColor: colors.primary.base, alignItems: "center", justifyContent: "center" },
  statusChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.full },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "white", borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl, padding: spacing.lg },
});
