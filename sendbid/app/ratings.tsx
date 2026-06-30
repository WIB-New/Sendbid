import React, { useEffect, useState } from "react";
import { View, StyleSheet, FlatList, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../src/components/Screen";
import { TText } from "../src/components/TText";
import { api } from "../src/api";
import { colors, spacing, radii } from "../src/theme";
import { useTranslation } from "../src/i18n";

/**
 * Évaluations — liste des agents ayant servi le client + notes/commentaires.
 * Données mockées si l'endpoint n'est pas déployé (MOCKED fallback).
 */
export default function Ratings() {
  const { t } = useTranslation();
  const [items, setItems] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setRefreshing(true);
    try {
      const { data } = await api.get("/ratings").catch(() => ({ data: null }));
      if (data && Array.isArray(data)) {
        setItems(data);
      } else {
        // MOCKED — liste d'évaluations de démo
        setItems([
          { id: "r1", agent_name: "Mamadou D.", country: "Sénégal", rating: 5, comment: "Rapide et professionnel. 10/10 !", date: "2026-04-28" },
          { id: "r2", agent_name: "Aminata K.", country: "Côte d'Ivoire", rating: 4, comment: "Très pro, un peu d'attente.", date: "2026-04-12" },
          { id: "r3", agent_name: "Jean-Baptiste", country: "Cameroun", rating: 5, comment: "Parfait, communication excellente.", date: "2026-03-30" },
        ]);
      }
    } catch {}
    setRefreshing(false);
  };
  useEffect(() => { load(); }, []);

  return (
    <Screen title="Évaluations" back hero>
      <TText variant="caption" color={colors.neutrals.textSecondary} style={{ marginBottom: spacing.md }}>
        Retrouvez ici les notes et commentaires que vous avez laissés après chaque transfert.
      </TText>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        scrollEnabled={false}
        ListEmptyComponent={
          <View style={{ alignItems: "center", padding: spacing.xxxl }}>
            <Ionicons name="star-outline" size={48} color={colors.neutrals.textTertiary} />
            <TText color={colors.neutrals.textSecondary} style={{ marginTop: 8 }}>Aucune évaluation</TText>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.avatar}>
                <Ionicons name="person" size={18} color="white" />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <TText weight="semiBold">{item.agent_name}</TText>
                <TText variant="caption" color={colors.neutrals.textSecondary}>{item.country} • {item.date}</TText>
              </View>
              <View style={{ flexDirection: "row" }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Ionicons key={n} name={n <= (item.rating || 0) ? "star" : "star-outline"} size={14} color="#F59E0B" />
                ))}
              </View>
            </View>
            {item.comment ? (
              <TText variant="caption" color={colors.neutrals.textPrimary} style={{ marginTop: 8, fontStyle: "italic" }}>« {item.comment} »</TText>
            ) : null}
          </View>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.neutrals.surface, padding: spacing.md, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.neutrals.border, marginBottom: 10 },
  row: { flexDirection: "row", alignItems: "center" },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary.base, alignItems: "center", justifyContent: "center" },
});
