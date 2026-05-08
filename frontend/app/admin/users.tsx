import React, { useEffect, useState } from "react";
import { View, StyleSheet, TouchableOpacity, Alert, RefreshControl, FlatList, TextInput, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../../src/components/Screen";
import { TText } from "../../src/components/TText";
import { api, apiError } from "../../src/api";
import { colors, spacing, radii } from "../../src/theme";

export default function AdminUsers() {
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<any>(null);

  const load = async () => {
    setRefreshing(true);
    try {
      const params: any = { limit: 100 };
      if (search.trim().length >= 2) params.search = search.trim();
      const { data } = await api.get("/admin/users", { params });
      setItems(data.items || []);
    } catch (e: any) { Alert.alert("Erreur", apiError(e)); }
    setRefreshing(false);
  };
  useEffect(() => { load(); }, []);

  return (
    <Screen title="Utilisateurs" back scroll={false}>
      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color={colors.neutrals.textSecondary} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={load}
          placeholder="Rechercher par email, nom, téléphone\u2026"
          placeholderTextColor={colors.neutrals.textTertiary}
          style={styles.searchInput}
          returnKeyType="search"
        />
        <TouchableOpacity onPress={load} style={styles.searchBtn}><TText color="white" weight="bold">OK</TText></TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        ListEmptyComponent={<View style={{ alignItems: "center", padding: spacing.xxxl }}><TText color={colors.neutrals.textSecondary}>Aucun utilisateur</TText></View>}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => setSelected(item)} style={styles.row}>
            <View style={styles.avatar}><Ionicons name="person" size={18} color="white" /></View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <TText weight="semiBold">{item.full_name || "\u2014"}</TText>
              <TText variant="caption" color={colors.neutrals.textSecondary}>{item.email} \u00b7 {item.phone || "\u2014"}</TText>
              <TText variant="label" color={colors.neutrals.textTertiary}>
                ID {item.profile_id || "\u2014"} \u00b7 KYC {item.kyc_status || "\u2014"} \u00b7 Tier {item.kyc_tier ?? 0}
              </TText>
            </View>
            <View style={[styles.roleChip, { backgroundColor: colors.overlays.primarySoft }]}>
              <TText variant="label" weight="bold" color={colors.primary.base}>{(item.role || "user").toUpperCase()}</TText>
            </View>
          </TouchableOpacity>
        )}
      />

      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <TouchableOpacity activeOpacity={1} style={styles.overlay} onPress={() => setSelected(null)}>
          <TouchableOpacity activeOpacity={1} style={styles.sheet}>
            {selected ? (
              <>
                <TText variant="subtitle" weight="extraBold">{selected.full_name}</TText>
                <TText variant="caption" color={colors.neutrals.textSecondary}>{selected.email}</TText>
                <View style={{ marginTop: spacing.md, gap: 4 }}>
                  <KV l="Profile ID" v={selected.profile_id || "\u2014"} />
                  <KV l="Téléphone" v={selected.phone || "\u2014"} />
                  <KV l="Rôle" v={(selected.role || "user").toUpperCase()} />
                  <KV l="KYC" v={`${selected.kyc_status || "\u2014"} (Tier ${selected.kyc_tier ?? 0})`} />
                  <KV l="Email vérifié" v={selected.email_verified ? "Oui" : "Non"} />
                  <KV l="Téléphone vérifié" v={selected.phone_verified ? "Oui" : "Non"} />
                  <KV l="Loyauté" v={`${selected.loyalty_level || "\u2014"} \u00b7 ${selected.loyalty_points ?? 0} pts`} />
                  <KV l="Langue" v={selected.language || "fr"} />
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
  searchRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.neutrals.surface, borderRadius: radii.full, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.neutrals.border, marginBottom: spacing.md },
  searchInput: { flex: 1, paddingVertical: 10, paddingHorizontal: 8, color: colors.neutrals.textPrimary },
  searchBtn: { backgroundColor: colors.primary.base, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radii.full },
  row: { flexDirection: "row", alignItems: "center", padding: 12, backgroundColor: colors.neutrals.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.neutrals.border, marginBottom: 8 },
  avatar: { width: 40, height: 40, borderRadius: radii.full, backgroundColor: colors.primary.base, alignItems: "center", justifyContent: "center" },
  roleChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.full },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "white", borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl, padding: spacing.lg },
});
