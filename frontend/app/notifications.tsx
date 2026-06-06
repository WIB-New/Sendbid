import React, { useCallback, useState } from "react";
import { t, useLocale } from "../src/i18n";
import { View, FlatList, StyleSheet, TouchableOpacity, RefreshControl, Modal, ScrollView } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../src/components/Screen";
import { TText } from "../src/components/TText";
import { api } from "../src/api";
import { colors, spacing, radii } from "../src/theme";
import { useThemedColors } from "../src/themeContext";
const TYPE_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  info: "information-circle-outline",
  success: "checkmark-circle-outline",
  warning: "alert-circle-outline",
  error: "close-circle-outline",
};
const TYPE_COLOR: Record<string, string> = {
  info: "#3B82F6", success: "#10B981", warning: "#F59E0B", error: "#EF4444",
};

export default function Notifications() {
  useLocale((st) => st.locale);
  const colors = useThemedColors();
  const router = useRouter();
  const [list, setList] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<any>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const { data } = await api.get("/notifications");
      setList(data || []);
    } catch {}
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const markRead = async (id: string) => {
    try { await api.post(`/notifications/${id}/read`); } catch {}
    load();
  };

  const openDetail = async (item: any) => {
    setSelected(item);
    if (!item.read) {
      // Marque comme lu mais ne recharge pas la liste immédiatement
      try { await api.post(`/notifications/${item.id}/read`); } catch {}
    }
  };

  const goAction = () => {
    if (!selected) return;
    const data = selected.data || {};
    setSelected(null);
    // Route selon le type de notification
    if (data.transfer_id) router.push({ pathname: "/transfer/[id]", params: { id: data.transfer_id } });
    else if (data.dispute_id) router.push("/disputes" as any);
    else if (data.kyc_tier !== undefined) router.push("/kyc" as any);
    else if (selected.type === "success" || selected.type === "info") {
      // Généralement rien à faire, on ferme simplement.
    }
    load();
  };

  const readAll = async () => {
    await api.post("/notifications/read-all");
    load();
  };

  return (
    <Screen
      title="Notifications"
      back
      scroll={false}
      right={
        <TouchableOpacity testID="notif-read-all" onPress={readAll}>
          <TText variant="caption" weight="semiBold" color={colors.primary.base}>Tout lire</TText>
        </TouchableOpacity>
      }
    >
      <FlatList
        data={list}
        keyExtractor={(i) => i.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        contentContainerStyle={{ paddingBottom: spacing.xxxl }}
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingVertical: spacing.xxxl }}>
            <Ionicons name="notifications-off-outline" size={40} color={colors.neutrals.textTertiary} />
            <TText color={colors.neutrals.textSecondary} style={{ marginTop: 8 }}>Aucune notification</TText>
          </View>
        }
        renderItem={({ item }) => {
          const tint = TYPE_COLOR[item.type] || colors.primary.base;
          return (
            <TouchableOpacity
              testID={`notif-${item.id}`}
              style={[styles.row, !item.read && { borderColor: tint, borderLeftWidth: 4 }]}
              onPress={() => openDetail(item)}
              activeOpacity={0.85}
            >
              <View style={[styles.icon, { backgroundColor: tint + "1A" }]}>
                <Ionicons name={TYPE_ICON[item.type] || "information-circle-outline"} size={20} color={tint} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <TText variant="body" weight={item.read ? "medium" : "bold"}>{item.title}</TText>
                <TText variant="caption" color={colors.neutrals.textSecondary} numberOfLines={2}>{item.body}</TText>
                <TText variant="label" color={colors.neutrals.textTertiary} style={{ marginTop: 2 }}>
                  {new Date(item.created_at).toLocaleString("fr-FR")}
                </TText>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.neutrals.textTertiary} />
            </TouchableOpacity>
          );
        }}
      />

      {/* Modal détail */}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <TouchableOpacity activeOpacity={1} style={styles.overlay} onPress={() => setSelected(null)}>
          <TouchableOpacity activeOpacity={1} style={styles.sheet}>
            {selected ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.md }}>
                  <View style={[styles.icon, { backgroundColor: (TYPE_COLOR[selected.type] || colors.primary.base) + "1A" }]}>
                    <Ionicons name={TYPE_ICON[selected.type] || "information-circle-outline"} size={22} color={TYPE_COLOR[selected.type] || colors.primary.base} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <TText variant="subtitle" weight="extraBold">{selected.title}</TText>
                    <TText variant="label" color={colors.neutrals.textTertiary}>
                      {new Date(selected.created_at).toLocaleString("fr-FR")}
                    </TText>
                  </View>
                </View>
                <TText variant="body" color={colors.neutrals.textPrimary} style={{ lineHeight: 22 }}>{selected.body}</TText>
                {selected.data && Object.keys(selected.data).length > 0 ? (
                  <View style={{ backgroundColor: colors.neutrals.background, borderRadius: radii.lg, padding: spacing.md, marginTop: spacing.md, borderWidth: 1, borderColor: colors.neutrals.border }}>
                    <TText variant="caption" color={colors.neutrals.textSecondary} weight="extraBold" style={{ letterSpacing: 0.5, marginBottom: 6 }}>DÉTAILS</TText>
                    {Object.entries(selected.data).map(([k, v]) => (
                      <View key={k} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 }}>
                        <TText variant="caption" color={colors.neutrals.textSecondary}>{k}</TText>
                        <TText variant="caption" weight="bold">{String(v)}</TText>
                      </View>
                    ))}
                  </View>
                ) : null}
                {(selected.data?.transfer_id || selected.data?.dispute_id || selected.data?.kyc_tier !== undefined) ? (
                  <TouchableOpacity testID="notif-action" onPress={goAction} style={styles.actionBtn}>
                    <TText weight="bold" color="white">Ouvrir</TText>
                    <Ionicons name="arrow-forward" size={18} color="white" style={{ marginLeft: 6 }} />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity testID="notif-close" onPress={() => setSelected(null)} style={[styles.actionBtn, { backgroundColor: colors.neutrals.border }]}>
                    <TText weight="bold" color={colors.neutrals.textPrimary}>Fermer</TText>
                  </TouchableOpacity>
                )}
              </ScrollView>
            ) : null}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "flex-start",
    backgroundColor: colors.neutrals.surface, padding: 12,
    borderRadius: radii.lg, borderWidth: 1, borderColor: colors.neutrals.border,
    marginBottom: 8,
  },
  icon: {
    width: 40, height: 40, borderRadius: radii.full,
    backgroundColor: colors.overlays.primarySoft,
    alignItems: "center", justifyContent: "center",
  },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "white", borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl, padding: spacing.lg, maxHeight: "75%" },
  actionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: colors.primary.base, paddingVertical: 13, borderRadius: radii.full, marginTop: spacing.lg },
});
