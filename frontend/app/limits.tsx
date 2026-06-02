import React from "react";
import { View, StyleSheet, Platform, Alert, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../src/components/Screen";
import { TText } from "../src/components/TText";
import { Card } from "../src/components/Card";
import { useAuth } from "../src/store";
import { api } from "../src/api";
import { colors, spacing, radii } from "../src/theme";
import { useThemedColors } from "../src/themeContext";
const TIERS = [
  {
    tier: 0, label: "Non vérifié", color: colors.neutrals.textSecondary, icon: "person-outline" as const,
    monthly: 200, perTx: 100, daily: 200,
    note: "Compte non vérifié — limites minimales",
  },
  {
    tier: 1, label: "Bronze (KYC Tier 1)", color: "#CD7F32", icon: "ribbon-outline" as const,
    monthly: 500, perTx: 200, daily: 500,
    note: "Auto-déclaration validée instantanément",
  },
  {
    tier: 2, label: "Gold (KYC Tier 2)", color: colors.accent.base, icon: "shield-checkmark-outline" as const,
    monthly: 10000, perTx: 5000, daily: 10000,
    note: "Pièce d'identité scannée + selfie via Didit",
  },
];

export default function Limits() {
  const colors = useThemedColors();
  const user = useAuth((s) => s.user);
  const currentTier = user?.kyc_tier ?? 0;

  const requestUpgrade = async () => {
    const confirmMsg = "Confirmez-vous votre demande d'augmentation des limites ? Vous recevrez une réponse sous 48h par Email et messagerie interne.";
    const successMsg = "Votre demande a été prise en compte. Vous recevrez une réponse sous 48h par Email et messagerie interne.";
    const submit = async () => {
      try {
        await api.post("/limits/upgrade-request").catch(() => {});
      } catch {}
      if (Platform.OS === "web") (window as any).alert(successMsg);
      else Alert.alert("Demande enregistrée", successMsg);
    };
    if (Platform.OS === "web") {
      if ((window as any).confirm(confirmMsg)) await submit();
    } else {
      Alert.alert("Demande d'augmentation", confirmMsg, [
        { text: "Annuler", style: "cancel" },
        { text: "Confirmer", onPress: submit },
      ]);
    }
  };

  return (
    <Screen title="Limites de transfert" back hero>
      <Card>
        <View style={{ alignItems: "center" }}>
          <View style={[styles.iconBox, { backgroundColor: TIERS[currentTier].color }]}>
            <Ionicons name={TIERS[currentTier].icon} size={28} color="white" />
          </View>
          <TText variant="title" weight="extraBold" align="center" style={{ marginTop: 12 }}>
            Niveau actuel : {TIERS[currentTier].label}
          </TText>
          <TText variant="caption" color={colors.neutrals.textSecondary} align="center" style={{ marginTop: 4 }}>
            {TIERS[currentTier].note}
          </TText>
        </View>
      </Card>

      <TText variant="subtitle" weight="bold" style={{ marginTop: spacing.lg, marginBottom: 8 }}>
        Vos limites actuelles (EUR)
      </TText>
      <View style={styles.limitsRow}>
        <LimitCard label="Par transfert" value={TIERS[currentTier].perTx} icon="paper-plane-outline" />
        <LimitCard label="Quotidien" value={TIERS[currentTier].daily} icon="today-outline" />
        <LimitCard label="Mensuel" value={TIERS[currentTier].monthly} icon="calendar-outline" />
      </View>

      {/* CTA — Demander une augmentation des limites (remplace le tableau comparatif) */}
      <TouchableOpacity testID="limits-upgrade-cta" onPress={requestUpgrade} style={styles.upgradeCard} activeOpacity={0.9}>
        <View style={styles.upgradeIcon}>
          <Ionicons name="trending-up" size={26} color="white" />
        </View>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <TText variant="body" weight="extraBold" color="white">Augmenter mes limites</TText>
          <TText variant="caption" color="rgba(255,255,255,0.9)" style={{ marginTop: 4, lineHeight: 18 }}>
            Demandez une augmentation de vos plafonds quotidien et mensuel. Réponse sous 48h par Email et messagerie interne.
          </TText>
        </View>
        <Ionicons name="chevron-forward" size={22} color="white" />
      </TouchableOpacity>
    </Screen>
  );
}

function LimitCard({ label, value, icon }: { label: string; value: number; icon: any }) {
  return (
    <View style={styles.limitCard}>
      <Ionicons name={icon} size={20} color={colors.primary.base} />
      <TText variant="title" weight="extraBold" style={{ marginTop: 4 }}>{value.toLocaleString("fr-FR")}</TText>
      <TText variant="caption" color={colors.neutrals.textSecondary}>{label}</TText>
    </View>
  );
}

const styles = StyleSheet.create({
  iconBox: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  limitsRow: { flexDirection: "row", gap: 8 },
  limitCard: { flex: 1, backgroundColor: colors.neutrals.surface, padding: spacing.md, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.neutrals.border, alignItems: "center" },
  upgradeCard: { flexDirection: "row", alignItems: "center", backgroundColor: colors.primary.base, borderRadius: radii.xxl, padding: spacing.lg, marginTop: spacing.xl },
  upgradeIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
});
