import React, { useRef, useState } from "react";
import { View, StyleSheet, TouchableOpacity, Dimensions, FlatList } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { TText } from "../../src/components/TText";
import { paybidColors } from "../../src/paybidTheme";
import { spacing, radii } from "../../src/theme";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width } = Dimensions.get("window");

const STEPS = [
  {
    key: "s1",
    icon: "flash" as const,
    gradient: ["#994A26", "#C4622D", "#E8823A"] as [string, string, string],
    title: "Recevez des missions en temps réel",
    desc: "Dès qu'un expéditeur SendBID crée un transfert en espèces vers votre ville, vous êtes alerté instantanément avec un popup d'enchère.",
  },
  {
    key: "s2",
    icon: "trending-down" as const,
    gradient: ["#1E3A5F", "#2563EB", "#3B82F6"] as [string, string, string],
    title: "Enchérissez ou acceptez au tarif",
    desc: "Acceptez directement au tarif client ou proposez un frais inférieur. Le meilleur prix remporte la mission à la fin du cycle.",
  },
  {
    key: "s3",
    icon: "people" as const,
    gradient: ["#065F46", "#059669", "#10B981"] as [string, string, string],
    title: "Remettez l'argent en espèces",
    desc: "Démarrez la livraison, contactez le bénéficiaire et confirmez la remise avec le code à 10 chiffres. Votre commission est versée immédiatement.",
  },
  {
    key: "s4",
    icon: "trophy" as const,
    gradient: ["#78350F", "#D97706", "#F59E0B"] as [string, string, string],
    title: "Progressez et gagnez plus",
    desc: "Complétez des missions, montez de Bronze à Platine et débloquez des bonus de commission et des missions VIP exclusives.",
  },
];

export default function PaybidOnboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const flatRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();

  const finish = async () => {
    await AsyncStorage.setItem("paybid_onboarded", "1");
    router.replace("/paybid/login" as any);
  };

  const next = () => {
    if (step < STEPS.length - 1) {
      flatRef.current?.scrollToIndex({ index: step + 1, animated: true });
      setStep(step + 1);
    } else {
      finish();
    }
  };

  const current = STEPS[step];

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        ref={flatRef}
        data={STEPS}
        keyExtractor={i => i.key}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <LinearGradient colors={item.gradient} style={[styles.slide, { width }]}>
            <SafeAreaView edges={["top", "bottom"]} style={styles.slideInner}>
              <View style={styles.iconWrap}>
                <Ionicons name={item.icon} size={72} color="white" />
              </View>
              <TText variant="display" weight="extraBold" color="white" align="center" style={styles.title}>
                {item.title}
              </TText>
              <TText variant="body" color="rgba(255,255,255,0.88)" align="center" style={styles.desc}>
                {item.desc}
              </TText>
            </SafeAreaView>
          </LinearGradient>
        )}
      />

      {/* Dots + boutons */}
      <View style={[styles.footer, { paddingBottom: Math.max(20, insets.bottom + 16) }]}>
        {/* Dots */}
        <View style={styles.dots}>
          {STEPS.map((_, i) => (
            <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
          ))}
        </View>

        {/* Boutons */}
        <View style={styles.btnRow}>
          <TouchableOpacity onPress={finish} style={styles.skipBtn}>
            <TText variant="body" color={paybidColors.neutrals.textSecondary}>Passer</TText>
          </TouchableOpacity>
          <TouchableOpacity onPress={next} style={styles.nextBtn} activeOpacity={0.85}>
            <TText variant="body" weight="extraBold" color="white">
              {step === STEPS.length - 1 ? "Commencer" : "Suivant"}
            </TText>
            <Ionicons name="arrow-forward" size={18} color="white" style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  slide: { flex: 1, minHeight: "100%" },
  slideInner: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl },
  iconWrap: {
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center", justifyContent: "center",
    marginBottom: spacing.xl,
  },
  title: { fontSize: 28, lineHeight: 36, marginBottom: spacing.lg },
  desc: { lineHeight: 24, maxWidth: 320 },
  footer: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: paybidColors.neutrals.background,
    paddingHorizontal: spacing.xl, paddingTop: spacing.lg,
    borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl,
  },
  dots: { flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: spacing.lg },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: paybidColors.neutrals.border },
  dotActive: { width: 24, backgroundColor: paybidColors.primary.base },
  btnRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  skipBtn: { paddingVertical: 12, paddingHorizontal: 8 },
  nextBtn: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: paybidColors.primary.base,
    paddingVertical: 14, paddingHorizontal: 28,
    borderRadius: radii.full,
  },
});
