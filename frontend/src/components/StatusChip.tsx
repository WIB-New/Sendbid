import React from "react";
import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing } from "../theme";
import { TText } from "./TText";

const MAP: Record<string, { label: string; bg: string; fg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  DRAFT: { label: "Brouillon", bg: colors.neutrals.border, fg: colors.neutrals.textSecondary, icon: "create-outline" },
  PENDING_PAYMENT: { label: "En attente de paiement", bg: colors.overlays.pendingSoft, fg: colors.status.pending, icon: "card-outline" },
  // Spec : un transfert paiement validé (en attente d'un agent) doit être affiché « Confirmé »
  BIDDING: { label: "Confirmé", bg: colors.overlays.successSoft, fg: colors.status.success, icon: "checkmark-circle" },
  AGENT_ASSIGNED: { label: "Agent assigné", bg: colors.overlays.infoSoft, fg: colors.status.info, icon: "person-outline" },
  IN_DELIVERY: { label: "En remise", bg: colors.overlays.infoSoft, fg: colors.status.info, icon: "navigate-outline" },
  PROCESSING: { label: "En cours", bg: colors.overlays.infoSoft, fg: colors.status.info, icon: "sync-outline" },
  PROCESSING_BANK: { label: "Virement en cours", bg: colors.overlays.infoSoft, fg: colors.status.info, icon: "business-outline" },
  PROCESSING_MOMO: { label: "Mobile Money en cours", bg: colors.overlays.infoSoft, fg: colors.status.info, icon: "phone-portrait-outline" },
  READY_FOR_PICKUP: { label: "Prêt à retirer", bg: colors.overlays.successSoft, fg: colors.status.success, icon: "qr-code-outline" },
  VIP_DELIVERY: { label: "Livraison VIP", bg: colors.overlays.pendingSoft, fg: "#EA580C", icon: "rocket-outline" },
  COMPLETED: { label: "Finalisé", bg: colors.overlays.successSoft, fg: colors.status.success, icon: "checkmark-circle-outline" },
  EXPIRED: { label: "Expiré", bg: colors.overlays.errorSoft, fg: colors.status.error, icon: "time-outline" },
  CANCELLED: { label: "Annulé", bg: colors.overlays.errorSoft, fg: colors.status.error, icon: "close-circle-outline" },
  CANCELLED_USER: { label: "Annulé par vous", bg: colors.overlays.errorSoft, fg: colors.status.error, icon: "close-circle-outline" },
  FAILED: { label: "Échec", bg: colors.overlays.errorSoft, fg: colors.status.error, icon: "alert-circle-outline" },
  REFUNDED: { label: "Remboursé", bg: colors.overlays.successSoft, fg: colors.status.success, icon: "return-down-back-outline" },
};

export function StatusChip({ status, testID }: { status: string; testID?: string }) {
  const s = MAP[status] || { label: status, bg: colors.neutrals.border, fg: colors.neutrals.textSecondary, icon: "ellipse-outline" as const };
  return (
    <View testID={testID} style={[styles.chip, { backgroundColor: s.bg }]}>
      <Ionicons name={s.icon} size={12} color={s.fg} />
      <TText variant="label" weight="semiBold" color={s.fg} style={{ marginLeft: 4 }}>
        {s.label}
      </TText>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radii.full,
    alignSelf: "flex-start",
  },
});
