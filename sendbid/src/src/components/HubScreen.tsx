import React from "react";
import { View, StyleSheet, TouchableOpacity, Platform, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "./Screen";
import { TText } from "./TText";
import { colors, spacing, radii } from "../theme";

export type HubItem = {
  icon: any;
  label: string;
  description?: string;
  route?: string;
  onPress?: () => void;
  tint?: string;
  danger?: boolean;
};

// Composant générique pour les 5 écrans hub du Profil
export function HubScreen({ title, items, hint }: { title: string; items: HubItem[]; hint?: string }) {
  const router = useRouter();
  return (
    <Screen title={title} back hero>
      {hint ? (
        <View style={styles.hint}>
          <Ionicons name="information-circle" size={14} color={colors.primary.base} />
          <TText variant="caption" color={colors.primary.base} weight="semiBold" style={{ marginLeft: 8, flex: 1 }}>
            {hint}
          </TText>
        </View>
      ) : null}
      <View style={styles.card}>
        {items.map((row, i) => (
          <TouchableOpacity
            key={row.label}
            testID={`hub-${row.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30)}`}
            onPress={() => row.onPress ? row.onPress() : (row.route ? router.push(row.route as any) : null)}
            activeOpacity={0.7}
            style={[styles.row, i < items.length - 1 && styles.rowBorder]}
          >
            <View style={[styles.rowIcon, { backgroundColor: (row.tint || colors.primary.base) + "1A" }]}>
              <Ionicons name={row.icon} size={20} color={row.tint || colors.primary.base} />
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <TText variant="body" weight="semiBold" color={row.danger ? "#EF4444" : undefined}>
                {row.label}
              </TText>
              {row.description ? (
                <TText variant="label" color={colors.neutrals.textSecondary} style={{ marginTop: 2 }}>{row.description}</TText>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.neutrals.textTertiary} />
          </TouchableOpacity>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: { flexDirection: "row", alignItems: "center", backgroundColor: colors.overlays.primarySoft, padding: spacing.md, borderRadius: radii.lg, marginBottom: spacing.md },
  card: { backgroundColor: "white", borderRadius: radii.xxl, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingVertical: 16 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  rowIcon: { width: 40, height: 40, borderRadius: radii.full, alignItems: "center", justifyContent: "center" },
});
