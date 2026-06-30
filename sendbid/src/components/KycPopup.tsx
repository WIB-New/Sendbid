import React, { useEffect, useState } from "react";
import { View, StyleSheet, Modal, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { TText } from "./TText";
import { colors, spacing, radii } from "../theme";

type KycLevel = { key: string; title: string; desc: string; icon: any; color: string; bg: string; route: string };

const LEVELS: KycLevel[] = [
  {
    key: "tier1",
    title: "KYC Niveau 1 — Essentiel",
    desc: "Date de naissance, nationalité, email & téléphone vérifiés. 2 min.",
    icon: "shield-checkmark-outline",
    color: "#3B82F6",
    bg: "#DBEAFE",
    route: "/kyc/tier1",
  },
  {
    key: "tier2",
    title: "KYC Niveau 2 — Gold",
    desc: "Pièce d'identité + selfie. Déverrouillage plafond jusqu'à 10 000 €. 5 min.",
    icon: "id-card-outline",
    color: "#10B981",
    bg: "#D1FAE5",
    route: "/kyc/tier2",
  },
  {
    key: "corporate",
    title: "KYC Personnes morales",
    desc: "Entreprises, ONG, associations. Registre + représentant légal.",
    icon: "business-outline",
    color: "#8B5CF6",
    bg: "#EDE9FE",
    route: "/kyc",
  },
];

/**
 * KycPopup — modal automatique affiché une seule fois par compte au premier
 * login post-inscription. Propose les 3 niveaux KYC. Marque AsyncStorage
 * `sb_kyc_popup_seen_<userId>` pour ne pas réapparaitre.
 */
export function KycPopup({ userId, kycTier }: { userId?: string; kycTier?: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!userId) return;
    // Ne pas réafficher si déjà vu OU si l'utilisateur a déjà KYC Tier >= 2
    if ((kycTier || 0) >= 2) return;
    (async () => {
      const key = `sb_kyc_popup_seen_${userId}`;
      const seen = await AsyncStorage.getItem(key);
      if (!seen) {
        setOpen(true);
        await AsyncStorage.setItem(key, "1");
      }
    })();
  }, [userId, kycTier]);

  const goTo = (route: string) => {
    setOpen(false);
    setTimeout(() => router.push(route as any), 300);
  };

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
      <TouchableOpacity activeOpacity={1} style={styles.overlay} onPress={() => setOpen(false)}>
        <TouchableOpacity activeOpacity={1} style={styles.sheet}>
          <LinearGradient colors={["#0A1338", "#022a6b"]} style={styles.hero}>
            <View style={styles.handle} />
            <Ionicons name="shield-checkmark" size={40} color="#60A5FA" />
            <TText variant="subtitle" weight="extraBold" color="white" align="center" style={{ marginTop: 8 }}>
              Vérifions votre identité
            </TText>
            <TText variant="caption" color="rgba(255,255,255,0.8)" align="center" style={{ marginTop: 4, lineHeight: 18 }}>
              Pour respecter les réglementations AML/CFT et protéger votre compte,{"\n"}complétez votre vérification en quelques minutes.
            </TText>
          </LinearGradient>

          <View style={styles.body}>
            {LEVELS.map((l) => (
              <TouchableOpacity
                key={l.key}
                testID={`kyc-popup-${l.key}`}
                style={styles.row}
                activeOpacity={0.7}
                onPress={() => goTo(l.route)}
              >
                <View style={[styles.icon, { backgroundColor: l.bg }]}>
                  <Ionicons name={l.icon} size={22} color={l.color} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <TText variant="body" weight="extraBold">{l.title}</TText>
                  <TText variant="caption" color={colors.neutrals.textSecondary} style={{ marginTop: 2 }}>
                    {l.desc}
                  </TText>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.neutrals.textTertiary} />
              </TouchableOpacity>
            ))}

            <TouchableOpacity testID="kyc-popup-later" style={styles.later} onPress={() => setOpen(false)}>
              <TText variant="caption" weight="semiBold" color={colors.neutrals.textSecondary}>
                Plus tard (accès limité à votre compte)
              </TText>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "white", borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl, overflow: "hidden" },
  hero: { paddingHorizontal: spacing.lg, paddingTop: 10, paddingBottom: spacing.xl, alignItems: "center" },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.25)", marginBottom: spacing.md },
  body: { padding: spacing.lg, paddingTop: spacing.md },
  row: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.neutrals.border, backgroundColor: colors.neutrals.surface, marginBottom: 10 },
  icon: { width: 42, height: 42, borderRadius: radii.full, alignItems: "center", justifyContent: "center" },
  later: { alignItems: "center", paddingVertical: 14, marginTop: 4 },
});
