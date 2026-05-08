import React, { useState } from "react";
import { View, StyleSheet, TouchableOpacity, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { TText } from "../src/components/TText";
import { Button } from "../src/components/Button";
import { colors, spacing, radii } from "../src/theme";

type Badge = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  // Position around the circle (in percentage from center)
  pos: { top?: number; left?: number; right?: number; bottom?: number };
};

type Step = {
  key: string;
  title: string;
  desc: string;
  heroIcon: keyof typeof Ionicons.glyphMap;
  heroGradient: [string, string, string];
  badges: Badge[];
};

// Onboarding v2 — icônes fintech premium avec palette vive et gradients attractifs
const STEPS: Step[] = [
  {
    key: "s1",
    title: "Envoyez partout dans le monde",
    desc: "Transférez de l'argent dans 250 pays en quelques secondes, depuis votre mobile, avec les meilleurs taux.",
    heroIcon: "rocket",
    heroGradient: ["#6366F1", "#8B5CF6", "#EC4899"],
    badges: [
      { label: "250 pays", icon: "planet", color: "#06B6D4", pos: { top: 6, right: -6 } },
      { label: "Instantané", icon: "flash", color: "#F59E0B", pos: { bottom: 18, left: -10 } },
      { label: "Meilleurs taux", icon: "trending-up", color: "#10B981", pos: { top: "46%" as any, right: -16 } },
    ],
  },
  {
    key: "s2",
    title: "Cash, virement ou mobile",
    desc: "Choisissez librement le mode de remise : espèces chez un agent, virement bancaire ou portefeuille mobile.",
    heroIcon: "wallet",
    heroGradient: ["#10B981", "#06B6D4", "#3B82F6"],
    badges: [
      { label: "Cash", icon: "cash", color: "#22C55E", pos: { top: 10, left: -8 } },
      { label: "Mobile Money", icon: "phone-portrait", color: "#F97316", pos: { top: "40%" as any, right: -14 } },
      { label: "Virement", icon: "business", color: "#8B5CF6", pos: { bottom: 10, left: "40%" as any } },
    ],
  },
  {
    key: "s3",
    title: "Votre argent est protégé",
    desc: "PIN 6 chiffres, biométrie, KYC vérifié, chiffrement AES-256 et traçabilité complète conformité AML/RGPD.",
    heroIcon: "shield-checkmark",
    heroGradient: ["#0EA5E9", "#6366F1", "#EC4899"],
    badges: [
      { label: "PIN", icon: "keypad", color: "#10B981", pos: { top: 8, left: -6 } },
      { label: "KYC", icon: "ribbon", color: "#3B82F6", pos: { top: 8, right: -6 } },
      { label: "AML", icon: "checkmark-done-circle", color: "#F59E0B", pos: { top: "50%" as any, left: -14 } },
      { label: "RGPD", icon: "lock-closed", color: "#8B5CF6", pos: { top: "50%" as any, right: -14 } },
      { label: "Biométrie", icon: "finger-print", color: "#EC4899", pos: { bottom: 12, left: "42%" as any } },
    ],
  },
];

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const cur = STEPS[step];
  const last = step === STEPS.length - 1;

  const next = () => (last ? router.replace("/welcome") : setStep((s) => s + 1));

  return (
    <LinearGradient colors={["#0F1B40", "#1B2A5B", "#142247"]} style={styles.bg} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.topBar}>
          <View style={styles.dots}>
            {STEPS.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === step && styles.dotActive, { width: i === step ? 26 : 8 }]}
              />
            ))}
          </View>
          <TouchableOpacity testID="onboarding-skip" onPress={() => router.replace("/welcome")}>
            <TText variant="caption" weight="semiBold" color="rgba(255,255,255,0.7)">
              Ignorer
            </TText>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {/* Illustrated circular hero with floating badges — faithful to v4.0 */}
          <View style={styles.heroWrap}>
            <LinearGradient
              colors={cur.heroGradient}
              style={styles.heroCircle}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.heroInner}>
                <Ionicons name={cur.heroIcon} size={96} color="white" />
              </View>
              {/* Decorative rings */}
              <View style={[styles.ring, styles.ringOuter]} />
              <View style={[styles.ring, styles.ringMid]} />
            </LinearGradient>

            {/* Floating badges */}
            {cur.badges.map((b) => (
              <View
                key={b.label}
                style={[
                  styles.badge,
                  { backgroundColor: "white", borderColor: b.color, ...b.pos },
                ]}
              >
                <Ionicons name={b.icon} size={12} color={b.color} />
                <TText variant="label" weight="extraBold" style={{ marginLeft: 4, color: b.color }}>
                  {b.label}
                </TText>
              </View>
            ))}
          </View>

          <TText variant="title" weight="extraBold" color="white" align="center" style={styles.title}>
            {cur.title}
          </TText>
          <TText variant="body" color="rgba(255,255,255,0.82)" align="center" style={styles.desc}>
            {cur.desc}
          </TText>
        </View>

        <View style={styles.cta}>
          {!last ? (
            <Button testID={`onboarding-next-${step}`} title="Suivant" onPress={next} icon="arrow-forward" />
          ) : (
            <Button
              testID={`onboarding-next-${step}`}
              title="Ouvrir SENDBID"
              onPress={next}
              icon="rocket"
              style={styles.finalBtn}
            />
          )}
          <Pressable onPress={() => setStep((s) => Math.max(0, s - 1))} style={styles.backRow} disabled={step === 0}>
            <TText variant="caption" color={step === 0 ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.75)"} weight="semiBold" align="center">
              {step > 0 ? "Précédent" : " "}
            </TText>
          </Pressable>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  dots: { flexDirection: "row", gap: 6 },
  dot: { height: 8, borderRadius: radii.full, backgroundColor: "rgba(255,255,255,0.25)" },
  dotActive: { backgroundColor: "#10B981" },
  content: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl },
  heroWrap: {
    width: 280, height: 280,
    alignItems: "center", justifyContent: "center",
    position: "relative",
  },
  heroCircle: {
    width: 220, height: 220, borderRadius: 110,
    alignItems: "center", justifyContent: "center",
    overflow: "hidden",
  },
  heroInner: {
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center", justifyContent: "center",
  },
  ring: { position: "absolute", borderRadius: 999, borderWidth: 1.5 },
  ringOuter: { width: 210, height: 210, borderColor: "rgba(255,255,255,0.18)" },
  ringMid: { width: 170, height: 170, borderColor: "rgba(255,255,255,0.08)" },
  badge: {
    position: "absolute",
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: radii.full,
    borderWidth: 1.5,
    shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  title: { marginTop: spacing.xxl, paddingHorizontal: spacing.md },
  desc: { marginTop: spacing.sm, paddingHorizontal: spacing.md, lineHeight: 22 },
  cta: { padding: spacing.lg, paddingBottom: spacing.xl },
  finalBtn: { backgroundColor: "#10B981" },
  backRow: { marginTop: 12 },
});
