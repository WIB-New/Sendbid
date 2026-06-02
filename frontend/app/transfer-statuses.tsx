import React from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../src/components/Screen";
import { TText } from "../src/components/TText";
import { colors, spacing, radii } from "../src/theme";
import { useThemedColors } from "../src/themeContext";
// 13 statuts de transfert — Annexe B du Document Maître v5.0
const STATUSES = [
  { id: "DRAFT", label: "Brouillon", icon: "create-outline", color: colors.neutrals.textTertiary, group: "Initial",
    desc: "Transfert en cours de création (pas encore confirmé par le PIN)." },
  { id: "PENDING_PAYMENT", label: "En attente de paiement", icon: "time-outline", color: colors.status.pending, group: "Initial",
    desc: "Paiement de l'expéditeur en attente (carte, wallet…)." },
  { id: "BIDDING", label: "Offres en cours", icon: "trending-up-outline", color: colors.primary.base, group: "Cash",
    desc: "Les agents enchérissent en temps réel pour servir le transfert (mode cash)." },
  { id: "AGENT_ASSIGNED", label: "Agent assigné", icon: "checkmark-circle-outline", color: colors.accent.base, group: "Cash",
    desc: "Un agent a remporté l'offre ou a été auto-assigné. Code de retrait actif." },
  { id: "PROCESSING_BANK", label: "Virement en cours", icon: "business-outline", color: colors.status.info, group: "Bank",
    desc: "Virement bancaire en traitement chez le partenaire." },
  { id: "PROCESSING_MOMO", label: "Mobile Money en cours", icon: "phone-portrait-outline", color: colors.status.info, group: "MoMo",
    desc: "Crédit du portefeuille mobile en cours via l'agrégateur." },
  { id: "READY_FOR_PICKUP", label: "Prêt à retirer", icon: "qr-code-outline", color: colors.accent.base, group: "Cash",
    desc: "Le bénéficiaire peut se présenter à l'agent avec son code de retrait." },
  { id: "VIP_DELIVERY", label: "Livraison VIP en route", icon: "rocket-outline", color: colors.accent.dark, group: "VIP",
    desc: "L'agent se déplace au domicile du bénéficiaire (suivi GPS actif)." },
  { id: "COMPLETED", label: "Terminé", icon: "checkmark-done-circle", color: colors.status.success, group: "Final",
    desc: "Argent remis. Reçu PDF disponible. Le transfert est clos." },
  { id: "CANCELLED_USER", label: "Annulé par l'utilisateur", icon: "close-circle-outline", color: colors.neutrals.textSecondary, group: "Final",
    desc: "Annulation à l'initiative de l'expéditeur (avant assignation)." },
  { id: "EXPIRED", label: "Expiré", icon: "alarm-outline", color: colors.status.pending, group: "Final",
    desc: "Code de retrait non utilisé dans les 48h. Remboursement automatique." },
  { id: "FAILED", label: "Échec technique", icon: "alert-circle-outline", color: colors.status.error, group: "Final",
    desc: "Erreur de traitement chez le partenaire bancaire ou MoMo. Remboursement déclenché." },
  { id: "DISPUTED", label: "En litige", icon: "warning-outline", color: colors.status.error, group: "Final",
    desc: "Litige ouvert. Médiation en cours. Délai max 7 jours ouvrés." },
];

const GROUPS = ["Initial", "Cash", "Bank", "MoMo", "VIP", "Final"];

export default function TransferStatuses() {
  const colors = useThemedColors();
  return (
    <Screen title="Statuts de transfert" back hero scroll={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
        <View style={styles.intro}>
          <Ionicons name="information-circle-outline" size={18} color={colors.primary.base} />
          <TText variant="caption" color={colors.primary.base} style={{ marginLeft: 6, flex: 1 }}>
            Les 13 statuts officiels d'un transfert SENDBID. Chaque transfert progresse à travers un sous-ensemble selon son mode de remise.
          </TText>
        </View>

        {GROUPS.map((g) => {
          const items = STATUSES.filter((s) => s.group === g);
          if (items.length === 0) return null;
          return (
            <View key={g} style={{ marginBottom: spacing.lg }}>
              <TText variant="caption" weight="bold" color={colors.neutrals.textSecondary} style={{ marginBottom: 8, marginTop: 4 }}>
                {g.toUpperCase()}
              </TText>
              {items.map((s) => (
                <View key={s.id} style={styles.row}>
                  <View style={[styles.icon, { backgroundColor: s.color + "1A" }]}>
                    <Ionicons name={(s.icon as any)} size={20} color={s.color} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <TText weight="bold">{s.label}</TText>
                    <TText variant="caption" color={colors.neutrals.textTertiary} style={{ marginBottom: 2 }}>{s.id}</TText>
                    <TText variant="caption" color={colors.neutrals.textSecondary}>{s.desc}</TText>
                  </View>
                </View>
              ))}
            </View>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { flexDirection: "row", alignItems: "center", padding: spacing.md, backgroundColor: colors.overlays.primarySoft, borderRadius: radii.lg, marginBottom: spacing.lg },
  row: { flexDirection: "row", padding: spacing.md, backgroundColor: colors.neutrals.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.neutrals.border, marginBottom: 8 },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
});
