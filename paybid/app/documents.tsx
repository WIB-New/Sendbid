import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../src/components/Screen";
import { TText } from "../src/components/TText";
import { Card } from "../src/components/Card";
import { colors, spacing, radii } from "../src/theme";
import { useTranslation } from "../src/i18n";

const DOCS = [
  { name: "Conditions générales", icon: "document-text-outline" },
  { name: "Politique de confidentialité", icon: "shield-checkmark-outline" },
  { name: "Mentions légales", icon: "library-outline" },
  { name: "Politique de remboursement", icon: "return-down-back-outline" },
  { name: "Charte AML-CFT", icon: "lock-closed-outline" },
];

export default function Documents() {
  const { t } = useTranslation();
  return (
    <Screen title="Documents" back>
      <Card>
        <TText variant="caption" color={colors.neutrals.textSecondary}>
          Téléchargez vos documents légaux et reçus depuis l'écran de chaque transfert.
        </TText>
      </Card>
      <View style={{ marginTop: spacing.md }}>
        {DOCS.map((d) => (
          <TouchableOpacity key={d.name} style={styles.row}>
            <View style={styles.icon}><Ionicons name={d.icon as any} size={20} color={colors.primary.base} /></View>
            <TText weight="semiBold" style={{ flex: 1, marginLeft: 12 }}>{d.name}</TText>
            <Ionicons name="chevron-forward" size={18} color={colors.neutrals.textTertiary} />
          </TouchableOpacity>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", padding: 12, backgroundColor: colors.neutrals.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.neutrals.border, marginBottom: 8 },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.overlays.primarySoft, alignItems: "center", justifyContent: "center" },
});
