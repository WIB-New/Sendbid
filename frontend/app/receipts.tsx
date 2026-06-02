import React, { useCallback, useState } from "react";
import { View, StyleSheet, TouchableOpacity, RefreshControl, FlatList, Share, Platform, Alert } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../src/components/Screen";
import { TText } from "../src/components/TText";
import { StatusChip } from "../src/components/StatusChip";
import { api } from "../src/api";
import { colors, spacing, radii } from "../src/theme";
import { useThemedColors } from "../src/themeContext";
/**
 * Reçus — Tous les transferts (correspond exactement à toute la liste).
 * Aperçu compact + bouton "Reçu PDF" / "Partager".
 */
export default function Receipts() {
  const colors = useThemedColors();
  const router = useRouter();
  const [list, setList] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const { data } = await api.get("/transfers");
      setList(data || []);
    } catch {}
    setRefreshing(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const shareReceipt = async (t: any) => {
    const ref = `#${(t.reference || t.id).slice(-10).toUpperCase()}`;
    const msg = `Reçu SENDBID\nRéférence : ${ref}\nMontant : ${t.send_amount.toFixed(2)} EUR → ${t.receive_amount.toFixed(0)} ${t.destination_currency}\nBénéficiaire : ${t.beneficiary?.full_name || "—"}\nDate : ${new Date(t.created_at).toLocaleDateString("fr-FR")}\nStatut : ${t.status}`;
    if (Platform.OS === "web") {
      try { (await import("expo-clipboard")).setStringAsync(msg); Alert.alert("Reçu copié", "Le reçu a été copié dans le presse-papiers."); } catch {}
      return;
    }
    try { await Share.share({ message: msg, title: `Reçu ${ref}` }); } catch {}
  };

  return (
    <Screen title="Mes reçus" back hero>
      <TText variant="caption" color={colors.neutrals.textSecondary} style={{ marginBottom: spacing.md }}>
        {list.length} transfert{list.length > 1 ? "s" : ""} au total — Reçu PDF disponible pour chaque opération
      </TText>

      <FlatList
        data={list}
        keyExtractor={(i) => i.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.primary.base} />}
        contentContainerStyle={{ paddingBottom: spacing.xxxl }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="receipt-outline" size={40} color={colors.neutrals.textTertiary} />
            <TText variant="body" color={colors.neutrals.textSecondary} style={{ marginTop: 8 }}>
              Aucun transfert à afficher
            </TText>
          </View>
        }
        renderItem={({ item }) => {
          const ref = `#${(item.reference || item.id).slice(-10).toUpperCase()}`;
          return (
            <View style={styles.row}>
              <TouchableOpacity
                testID={`receipt-${item.id}`}
                style={styles.rowMain}
                onPress={() => router.push({ pathname: "/transfer/[id]", params: { id: item.id } })}
                activeOpacity={0.7}
              >
                <View style={styles.icon}>
                  <Ionicons name="document-text-outline" size={20} color={colors.primary.base} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <TText variant="body" weight="semiBold" numberOfLines={1}>
                    {item.beneficiary?.full_name || "—"}
                  </TText>
                  <TText variant="caption" color={colors.neutrals.textSecondary} numberOfLines={1}>
                    {ref} • {new Date(item.created_at).toLocaleDateString("fr-FR")}
                  </TText>
                  <View style={{ marginTop: 4 }}><StatusChip status={item.status} /></View>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <TText weight="bold">{item.send_amount.toFixed(2)} EUR</TText>
                  <TText variant="caption" color={colors.neutrals.textTertiary}>
                    {item.receive_amount.toFixed(0)} {item.destination_currency}
                  </TText>
                </View>
              </TouchableOpacity>
              <View style={styles.actions}>
                <TouchableOpacity
                  testID={`receipt-share-${item.id}`}
                  onPress={() => shareReceipt(item)}
                  style={styles.actionBtn}
                >
                  <Ionicons name="share-outline" size={16} color={colors.primary.base} />
                  <TText variant="label" weight="bold" color={colors.primary.base} style={{ marginLeft: 4 }}>Partager</TText>
                </TouchableOpacity>
                <TouchableOpacity
                  testID={`receipt-pdf-${item.id}`}
                  onPress={() => router.push({ pathname: "/transfer/receipt", params: { transfer_id: item.id } } as any)}
                  style={[styles.actionBtn, { backgroundColor: colors.primary.base }]}
                >
                  <Ionicons name="download-outline" size={16} color="white" />
                  <TText variant="label" weight="bold" color="white" style={{ marginLeft: 4 }}>Reçu PDF</TText>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.neutrals.surface,
    borderRadius: radii.lg,
    borderWidth: 1, borderColor: colors.neutrals.border,
    marginBottom: 10,
    overflow: "hidden",
  },
  rowMain: { flexDirection: "row", alignItems: "center", padding: 12 },
  icon: {
    width: 40, height: 40, borderRadius: radii.full,
    backgroundColor: colors.overlays.primarySoft,
    alignItems: "center", justifyContent: "center",
  },
  actions: {
    flexDirection: "row", gap: 8,
    paddingHorizontal: 12, paddingBottom: 12, paddingTop: 4,
    borderTopWidth: 1, borderTopColor: colors.neutrals.border,
  },
  actionBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 8, borderRadius: radii.full,
    backgroundColor: colors.overlays.primarySoft,
  },
  empty: { alignItems: "center", paddingVertical: spacing.xxxl },
});
