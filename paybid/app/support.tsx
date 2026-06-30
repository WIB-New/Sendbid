import React, { useState } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, Linking, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { TText } from "../src/components/TText";
import { colors, spacing, radii } from "../src/theme";
import { useTranslation } from "../src/i18n";

// Support / FAQ v4.0 — "40 Support FAQ" : 3 quick buttons + filters + accordion + search
const FAQ = [
  { cat: "Transferts", q: "Combien de temps dure un transfert ?", a: "Classique : jusqu'à 48h. VIP : livraison en 1-3h à domicile." },
  { cat: "Transferts", q: "Que se passe-t-il si le bénéficiaire n'a pas de compte ?", a: "Il recevra un email/WhatsApp avec un code de retrait à présenter à l'agent." },
  { cat: "Transferts", q: "Puis-je annuler un transfert ?", a: "Oui, tant qu'aucun agent n'a été assigné. Après, ouvrez un litige." },
  { cat: "Paiement", q: "Quels moyens de paiement acceptez-vous ?", a: "Carte bancaire, Orange Money, Wave, MTN, virement." },
  { cat: "Paiement", q: "Les frais sont-ils inclus dans le taux ?", a: "Non, nos frais sont affichés séparément. Taux de change réel sans marge." },
  { cat: "Compte", q: "Comment passer au KYC Tier 2 ?", a: "Profil → KYC → Passer au Gold. Vérification Didit en 3 minutes." },
  { cat: "Compte", q: "Comment activer la biométrie ?", a: "Paramètres → Sécurité → Connexion biométrique." },
];
const CATS = ["Tous", "Transferts", "Paiement", "Compte"];

export default function Support() {
  const { t } = useTranslation();
  const router = useRouter();
  const [cat, setCat] = useState("Tous");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<number | null>(null);

  const filtered = FAQ.filter((f) => (cat === "Tous" || f.cat === cat) && (!query || f.q.toLowerCase().includes(query.toLowerCase())));

  return (
    <View style={{ flex: 1, backgroundColor: "#0F1B40" }}>
      <LinearGradient colors={["#0F1B40", "#1B2A5B"]} style={styles.hero}>
        <SafeAreaView edges={["top"]}>
          <View style={styles.heroTop}>
            <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
              <Ionicons name="chevron-back" size={22} color="white" />
            </TouchableOpacity>
            <TText variant="body" weight="extraBold" color="white">Aide et support</TText>
            <TouchableOpacity onPress={() => router.push("/contact" as any)} style={styles.iconBtn}>
              <Ionicons name="headset" size={18} color="white" />
            </TouchableOpacity>
          </View>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={18} color="rgba(255,255,255,0.6)" />
            <TextInput
              placeholder="Rechercher une question…"
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={query} onChangeText={setQuery}
              style={styles.searchInput}
            />
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView style={styles.card} contentContainerStyle={styles.cardInner} showsVerticalScrollIndicator={false}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 4 }}>
          {CATS.map((c) => (
            <TouchableOpacity key={c} testID={`cat-${c}`} onPress={() => setCat(c)} style={[styles.chip, cat === c && styles.chipActive]}>
              <TText variant="caption" weight="extraBold" color={cat === c ? "white" : colors.neutrals.textPrimary}>{c}</TText>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.faqBox}>
          {filtered.map((f, i) => (
            <TouchableOpacity key={i} testID={`faq-${i}`} onPress={() => setOpen(open === i ? null : i)} style={[styles.faqRow, i < filtered.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.neutrals.border }]}>
              <View style={{ flex: 1 }}>
                <TText variant="body" weight="extraBold">{f.q}</TText>
                {open === i ? (<TText variant="caption" color={colors.neutrals.textSecondary} style={{ marginTop: 6, lineHeight: 18 }}>{f.a}</TText>) : null}
              </View>
              <Ionicons name={open === i ? "chevron-up" : "chevron-down"} size={18} color={colors.neutrals.textTertiary} />
            </TouchableOpacity>
          ))}
          {filtered.length === 0 ? (
            <View style={{ padding: spacing.lg, alignItems: "center" }}>
              <Ionicons name="help-circle-outline" size={28} color={colors.neutrals.textTertiary} />
              <TText variant="caption" color={colors.neutrals.textSecondary} style={{ marginTop: 6 }}>Aucun résultat</TText>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

function QuickBtn({ color, icon, label, onPress }: any) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.quickBtn, { backgroundColor: color }]}>
      <Ionicons name={icon} size={22} color="white" />
      <TText variant="label" weight="extraBold" color="white" style={{ marginTop: 4 }}>{label}</TText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: spacing.sm },
  iconBtn: { width: 36, height: 36, borderRadius: radii.full, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" },
  searchBox: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.1)", borderRadius: radii.full, paddingHorizontal: 14, paddingVertical: 10, marginTop: spacing.md, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" },
  searchInput: { flex: 1, color: "white", marginLeft: 8, fontSize: 14, outlineStyle: "none" } as any,
  quickRow: { flexDirection: "row", gap: 10, marginTop: spacing.md },
  quickBtn: { flex: 1, padding: 14, borderRadius: radii.xl, alignItems: "center" },
  card: { flex: 1, backgroundColor: colors.neutrals.background, borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl, marginTop: -spacing.lg },
  cardInner: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.full, backgroundColor: colors.neutrals.surface, borderWidth: 1, borderColor: colors.neutrals.border, marginRight: 8 },
  chipActive: { backgroundColor: colors.primary.base, borderColor: colors.primary.base },
  faqBox: { backgroundColor: colors.neutrals.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.neutrals.border, marginTop: spacing.md },
  faqRow: { flexDirection: "row", alignItems: "flex-start", padding: spacing.md },
});
