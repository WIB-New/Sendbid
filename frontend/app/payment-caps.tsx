import React from "react";
import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../src/components/Screen";
import { TText } from "../src/components/TText";
import { colors, spacing, radii } from "../src/theme";
import { useThemedColors } from "../src/themeContext";
type Cap = { method: string; label: string; icon: any; perTx: number; daily: number; currency: string; note?: string };

const CAPS: Cap[] = [
  { method: "card", label: "Carte bancaire (Stripe 3DS)", icon: "card-outline", perTx: 500, daily: 1500, currency: "EUR", note: "Paiement sécurisé Stripe — vérification 3DS obligatoire" },
  { method: "paypal", label: "PayPal", icon: "logo-paypal", perTx: 500, daily: 1500, currency: "EUR" },  { method: "momo", label: "Portefeuille mobile (Wave, Orange Money…)", icon: "phone-portrait-outline", perTx: 1000, daily: 3000, currency: "EUR" },
  { method: "cash", label: "Espèces auprès d'un agent (QR)", icon: "qr-code-outline", perTx: 2000, daily: 5000, currency: "EUR", note: "Soumis à la disponibilité de l'agent" },
];

export default function PaymentCaps() {
  const colors = useThemedColors();
  return (
    <Screen title="Plafonds de paiement" back hero>
      <View style={styles.banner}>
        <Ionicons name="information-circle-outline" size={20} color={colors.primary.base} />
        <TText variant="caption" color={colors.primary.base} style={{ flex: 1, marginLeft: 8 }}>
          Ces plafonds s'appliquent par moyen de paiement, indépendamment de votre niveau KYC.
        </TText>
      </View>

      {CAPS.map((c) => (
        <View key={c.method} style={styles.row}>
          <View style={styles.icon}>
            <Ionicons name={c.icon} size={22} color={colors.primary.base} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <TText weight="bold">{c.label}</TText>
            {c.note ? <TText variant="caption" color={colors.neutrals.textSecondary}>{c.note}</TText> : null}
            <View style={{ flexDirection: "row", marginTop: 8, gap: 16 }}>
              <Stat label="Par transaction" value={`${c.perTx.toLocaleString("fr-FR")} ${c.currency}`} />
              <Stat label="Quotidien" value={`${c.daily.toLocaleString("fr-FR")} ${c.currency}`} />
            </View>
          </View>
        </View>
      ))}
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <TText variant="label" color={colors.neutrals.textTertiary}>{label}</TText>
      <TText variant="caption" weight="bold">{value}</TText>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: "row", alignItems: "center", padding: spacing.md, backgroundColor: colors.overlays.primarySoft, borderRadius: radii.lg, marginBottom: spacing.lg },
  row: { flexDirection: "row", padding: spacing.md, backgroundColor: colors.neutrals.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.neutrals.border, marginBottom: 10 },
  icon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.overlays.primarySoft, alignItems: "center", justifyContent: "center" },
});
