import React, { useEffect, useState } from "react";
import { View, StyleSheet, TouchableOpacity, Alert, RefreshControl, FlatList, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../../src/components/Screen";
import { TText } from "../../src/components/TText";
import { StatusChip } from "../../src/components/StatusChip";
import { api, apiError } from "../../src/api";
import { colors, spacing, radii } from "../../src/theme";
import { useThemedColors } from "../../src/themeContext";
import { useTranslation } from "../../src/i18n";
const STATUSES = [
  { k: "all", l: "Tous" },
  { k: "BIDDING", l: "Offre" },
  { k: "AGENT_ASSIGNED", l: "Assigné" },
  { k: "PROCESSING", l: "En cours" },
  { k: "COMPLETED", l: "Terminés" },
  { k: "FAILED", l: "Échec" },
];

export default function AdminTransfers() {
  const { t } = useTranslation();
  const colors = useThemedColors();
  const [items, setItems] = useState<any[]>([]);
  const [status, setStatus] = useState("all");
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<any>(null);

  const load = async () => {
    setRefreshing(true);
    try {
      const params: any = { limit: 100 };
      if (status !== "all") params.status = status;
      const { data } = await api.get("/admin/transfers", { params });
      setItems(data.items || []);
    } catch (e: any) { Alert.alert("Erreur", apiError(e)); }
    setRefreshing(false);
  };
  useEffect(() => { load(); }, [status]);

  return (
    <Screen title="Transferts" back scroll={false}>
      <View style={styles.chipRow}>
        {STATUSES.map((s) => (
          <TouchableOpacity key={s.k} onPress={() => setStatus(s.k)} style={[styles.chip, status === s.k && styles.chipActive]}>
            <TText variant="label" weight="bold" color={status === s.k ? "white" : colors.neutrals.textPrimary}>{s.l}</TText>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        ListEmptyComponent={<View style={{ alignItems: "center", padding: spacing.xxxl }}><TText color={colors.neutrals.textSecondary}>Aucun transfert</TText></View>}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => setSelected(item)} style={styles.row}>
            <View style={styles.icon}><Ionicons name="swap-horizontal" size={18} color={colors.primary.base} /></View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <TText weight="semiBold">{item.destination_country} • {(item.delivery_mode || "").toUpperCase()}{item.vip_delivery ? " • VIP" : ""}</TText>
              <TText variant="caption" color={colors.neutrals.textSecondary}>Bénéficiaire : {item.beneficiary?.full_name || "\u2014"}</TText>
              <View style={{ marginTop: 4 }}><StatusChip status={item.status} /></View>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <TText weight="extraBold">{Number(item.send_amount || 0).toFixed(2)} EUR</TText>
              <TText variant="caption" color={colors.neutrals.textTertiary}>{Number(item.receive_amount || 0).toFixed(0)} {item.destination_currency}</TText>
            </View>
          </TouchableOpacity>
        )}
      />

      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <TouchableOpacity activeOpacity={1} style={styles.overlay} onPress={() => setSelected(null)}>
          <TouchableOpacity activeOpacity={1} style={styles.sheet}>
            {selected ? (
              <>
                <TText variant="subtitle" weight="extraBold">Transfert {selected.id.slice(0, 8)}\u2026</TText>
                <View style={{ marginTop: spacing.md, gap: 4 }}>
                  <KV l="Statut" v={selected.status} />
                  <KV l="Montant envoi" v={`${Number(selected.send_amount || 0).toFixed(2)} EUR`} />
                  <KV l="Montant reçu" v={`${Number(selected.receive_amount || 0).toFixed(0)} ${selected.destination_currency}`} />
                  <KV l="Frais" v={`${Number(selected.fee_amount || 0).toFixed(2)} EUR (${Number(selected.fee_percent || 0).toFixed(2)}%)`} />
                  <KV l="Destination" v={selected.destination_country} />
                  <KV l="Livraison" v={(selected.delivery_mode || "\u2014").toUpperCase()} />
                  <KV l="VIP" v={selected.vip_delivery ? "Oui" : "Non"} />
                  <KV l="Bénéficiaire" v={selected.beneficiary?.full_name || "\u2014"} />
                  <KV l="Agent" v={selected.winning_agent_id ? selected.winning_agent_id.slice(0, 8) + "\u2026" : "\u2014"} />
                  <KV l="Créé le" v={new Date(selected.created_at).toLocaleString("fr-FR")} />
                </View>
              </>
            ) : null}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </Screen>
  );
}

function KV({ l, v }: { l: string; v: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 }}>
      <TText variant="caption" color={colors.neutrals.textSecondary}>{l}</TText>
      <TText variant="caption" weight="bold">{v}</TText>
    </View>
  );
}

const styles = StyleSheet.create({
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: spacing.md },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radii.full, backgroundColor: colors.neutrals.surface, borderWidth: 1, borderColor: colors.neutrals.border },
  chipActive: { backgroundColor: colors.primary.base, borderColor: colors.primary.base },
  row: { flexDirection: "row", alignItems: "center", padding: 12, backgroundColor: colors.neutrals.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.neutrals.border, marginBottom: 8 },
  icon: { width: 40, height: 40, borderRadius: radii.full, backgroundColor: colors.overlays.primarySoft, alignItems: "center", justifyContent: "center" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "white", borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl, padding: spacing.lg },
});
