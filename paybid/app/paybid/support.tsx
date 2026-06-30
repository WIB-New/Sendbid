import React from "react";
import { View, StyleSheet, TouchableOpacity, ScrollView, Linking, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { TText } from "../../src/components/TText";
import { useThemedPaybidColors } from "../../src/themeContext";
import { paybidColors } from "../../src/paybidTheme";
import { spacing, radii } from "../../src/theme";

const FAQ = [
  { q: "Comment recevoir une enchère ?", a: "Restez en ligne (statut Disponible). Dès qu'un expéditeur crée un transfert en espèces vers votre ville, vous recevez une notification push et un popup d'alerte dans l'onglet Offres live." },
  { q: "Comment est calculée ma commission ?", a: "Commission = montant envoyé × frais proposés. La plateforme retient 20%, vous percevez 80% net. Exemple : 500€ × 2% = 10€ brut → 8€ net." },
  { q: "Que se passe-t-il si je décline une mission ?", a: "La mission repart en enchère pour les agents suivants. Un nombre élevé de refus peut affecter votre score de priorité." },
  { q: "Comment fonctionne le code de retrait ?", a: "L'expéditeur reçoit un code à 10 chiffres. Le bénéficiaire vous le communique lors de la remise. Saisissez-le pour valider et percevoir votre commission." },
  { q: "Mon float est-il nécessaire ?", a: "Oui. Votre float (espèces en caisse déclarées) doit couvrir le montant à remettre. Un float insuffisant peut bloquer l'assignation." },
];

function SupportItem({ icon, label, subtitle, color, onPress }: any) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.iconWrap, { backgroundColor: color + "18" }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <TText variant="body" weight="extraBold">{label}</TText>
        {subtitle ? <TText variant="caption" color={paybidColors.neutrals.textSecondary} style={{ marginTop: 2 }}>{subtitle}</TText> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={paybidColors.neutrals.textTertiary} />
    </TouchableOpacity>
  );
}

export default function PaybidSupport() {
  const colors = useThemedPaybidColors();
  const router = useRouter();
  const [openFaq, setOpenFaq] = React.useState<number | null>(null);

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.neutrals.background }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.neutrals.textPrimary} />
        </TouchableOpacity>
        <TText variant="subtitle" weight="extraBold" style={{ marginLeft: 12 }}>Aide & Support</TText>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>

        {/* Contacts rapides */}
        <TText variant="label" weight="bold" color={colors.neutrals.textSecondary} style={styles.sectionLabel}>NOUS CONTACTER</TText>
        <View style={styles.card}>
          <SupportItem icon="mail-outline" color="#3B82F6" label="Email support" subtitle="support@paybid.app"
            onPress={() => Linking.openURL("mailto:support@paybid.app")} />
          <View style={styles.divider} />
          <SupportItem icon="logo-whatsapp" color="#25D366" label="WhatsApp" subtitle="Réponse en moins de 2h"
            onPress={() => Linking.openURL("https://wa.me/33000000000")} />
          <View style={styles.divider} />
          <SupportItem icon="chatbubbles-outline" color="#6366F1" label="Chat en direct" subtitle="Disponible 8h–20h"
            onPress={() => Linking.openURL("https://wa.me/33000000000?text=Bonjour%20support%20PAYBID")} />
        </View>

        {/* FAQ */}
        <TText variant="label" weight="bold" color={colors.neutrals.textSecondary} style={styles.sectionLabel}>QUESTIONS FRÉQUENTES</TText>
        <View style={styles.card}>
          {FAQ.map((item, i) => (
            <View key={i}>
              <TouchableOpacity
                style={[styles.faqQ, i > 0 && { borderTopWidth: 1, borderTopColor: colors.neutrals.border }]}
                onPress={() => setOpenFaq(openFaq === i ? null : i)}
                activeOpacity={0.75}
              >
                <TText variant="body" weight="semiBold" style={{ flex: 1 }}>{item.q}</TText>
                <Ionicons name={openFaq === i ? "chevron-up" : "chevron-down"} size={18} color={colors.neutrals.textTertiary} />
              </TouchableOpacity>
              {openFaq === i && (
                <View style={styles.faqA}>
                  <TText variant="caption" color={colors.neutrals.textSecondary} style={{ lineHeight: 20 }}>{item.a}</TText>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Légal */}
        <TText variant="label" weight="bold" color={colors.neutrals.textSecondary} style={styles.sectionLabel}>LÉGAL</TText>
        <View style={styles.card}>
          <SupportItem icon="document-text-outline" color="#10B981" label="Conditions générales"
            subtitle="CGU, CGV, Confidentialité" onPress={() => Linking.openURL("https://paybid.app/legal")} />
          <View style={styles.divider} />
          <SupportItem icon="shield-outline" color="#8B5CF6" label="Politique de confidentialité"
            subtitle="RGPD, vos données" onPress={() => Linking.openURL("https://paybid.app/privacy")} />
        </View>

        {/* Version */}
        <TText variant="label" color={colors.neutrals.textTertiary} style={{ textAlign: "center", marginTop: spacing.xl }}>
          PAYBID v1.0.0 · Agent Platform
        </TText>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: paybidColors.neutrals.border },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: paybidColors.neutrals.surface, borderWidth: 1, borderColor: paybidColors.neutrals.border, alignItems: "center", justifyContent: "center" },
  sectionLabel: { marginTop: spacing.lg, marginBottom: 6, letterSpacing: 0.5 },
  card: { backgroundColor: paybidColors.neutrals.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: paybidColors.neutrals.border, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", padding: 14 },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  divider: { height: 1, backgroundColor: paybidColors.neutrals.border, marginLeft: 66 },
  faqQ: { flexDirection: "row", alignItems: "center", padding: 14 },
  faqA: { paddingHorizontal: 14, paddingBottom: 14, backgroundColor: paybidColors.neutrals.background },
});
