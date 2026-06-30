import React, { useCallback, useState } from "react";
import { View, FlatList, StyleSheet, TouchableOpacity, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { TText } from "../../src/components/TText";
import { api } from "../../src/api";
import { useThemedPaybidColors } from "../../src/themeContext";
import { paybidColors } from "../../src/paybidTheme";
import { spacing, radii } from "../../src/theme";

const TYPE_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  info: "information-circle-outline",
  success: "checkmark-circle-outline",
  warning: "alert-circle-outline",
  error: "close-circle-outline",
  auction_invite: "flash-outline",
  agent_assigned: "checkmark-done-circle-outline",
  transfer: "paper-plane-outline",
};
const TYPE_COLOR: Record<string, string> = {
  info: "#3B82F6",
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
  auction_invite: "#F59E0B",
  agent_assigned: "#10B981",
  transfer: "#6366F1",
};

function fmtDate(iso?: string) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffH = (now.getTime() - d.getTime()) / 3600000;
    if (diffH < 1) return `il y a ${Math.round(diffH * 60)} min`;
    if (diffH < 24) return `il y a ${Math.round(diffH)}h`;
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  } catch { return ""; }
}

export default function PaybidNotifications() {
  const colors = useThemedPaybidColors();
  const router = useRouter();
  const [list, setList] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

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
    setList(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllRead = async () => {
    try { await api.post("/notifications/read-all"); } catch {}
    setList(prev => prev.map(n => ({ ...n, read: true })));
  };

  const unread = list.filter(n => !n.read).length;

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.neutrals.background }}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.neutrals.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <TText variant="subtitle" weight="extraBold">Notifications</TText>
          {unread > 0 && (
            <TText variant="caption" color={colors.neutrals.textSecondary}>{unread} non lue{unread > 1 ? "s" : ""}</TText>
          )}
        </View>
        {unread > 0 && (
          <TouchableOpacity onPress={markAllRead} style={styles.readAllBtn}>
            <Ionicons name="checkmark-done-outline" size={16} color={paybidColors.primary.base} />
            <TText variant="label" weight="bold" color={paybidColors.primary.base} style={{ marginLeft: 4 }}>Tout lire</TText>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={list}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={paybidColors.primary.base} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="notifications-off-outline" size={44} color={colors.neutrals.textTertiary} />
            <TText variant="subtitle" weight="bold" color={colors.neutrals.textSecondary} style={{ marginTop: 12 }}>
              Aucune notification
            </TText>
            <TText variant="caption" color={colors.neutrals.textTertiary} style={{ marginTop: 4, textAlign: "center" }}>
              Vous serez alerté ici pour les enchères,{"\n"}missions et mises à jour importantes.
            </TText>
          </View>
        }
        renderItem={({ item }) => {
          const typeKey = item.type || "info";
          const icon = TYPE_ICON[typeKey] ?? "notifications-outline";
          const color = TYPE_COLOR[typeKey] ?? "#6B7280";
          return (
            <TouchableOpacity
              style={[styles.row, !item.read && styles.rowUnread]}
              onPress={() => markRead(item.id)}
              activeOpacity={0.75}
            >
              <View style={[styles.iconWrap, { backgroundColor: color + "18" }]}>
                <Ionicons name={icon} size={20} color={color} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <TText weight={item.read ? "semiBold" : "extraBold"} numberOfLines={1} style={{ fontSize: 14 }}>
                  {item.title || "Notification"}
                </TText>
                <TText variant="caption" color={colors.neutrals.textSecondary} style={{ marginTop: 2 }} numberOfLines={2}>
                  {item.body || item.message || ""}
                </TText>
                <TText variant="label" color={colors.neutrals.textTertiary} style={{ marginTop: 4 }}>
                  {fmtDate(item.created_at)}
                </TText>
              </View>
              {!item.read && <View style={[styles.dot, { backgroundColor: color }]} />}
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: paybidColors.neutrals.border,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: paybidColors.neutrals.surface,
    borderWidth: 1, borderColor: paybidColors.neutrals.border,
    alignItems: "center", justifyContent: "center",
  },
  readAllBtn: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: radii.lg,
    backgroundColor: paybidColors.overlays.primarySoft,
  },
  row: {
    flexDirection: "row", alignItems: "flex-start",
    backgroundColor: paybidColors.neutrals.surface,
    borderRadius: radii.xl, borderWidth: 1,
    borderColor: paybidColors.neutrals.border,
    padding: 12, marginBottom: 8,
  },
  rowUnread: {
    borderColor: paybidColors.primary.base + "44",
    backgroundColor: paybidColors.overlays.primarySoft,
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
  },
  dot: {
    width: 8, height: 8, borderRadius: 4,
    marginLeft: 8, marginTop: 6,
  },
  empty: { alignItems: "center", paddingTop: 80 },
});
