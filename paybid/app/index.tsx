import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, Easing } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { TText } from "../src/components/TText";
import { SendBidLogo } from "../src/components/Logo";
import { colors, spacing } from "../src/theme";
import { useThemedColors } from "../src/themeContext";
import { useAuth } from "../src/store";
import { useTranslation } from "../src/i18n";

/**
 * Splash v4.0 — PayBID agent app branding.
 */
export default function Splash() {
  const { t } = useTranslation();
  const colors = useThemedColors();
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const hydrated = useAuth((s) => s.hydrated);

  // 3 synchronised dots animation
  const d1 = useRef(new Animated.Value(0.3)).current;
  const d2 = useRef(new Animated.Value(0.3)).current;
  const d3 = useRef(new Animated.Value(0.3)).current;
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulse = (v: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, { toValue: 1, duration: 400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.3, duration: 400, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        ])
      );
    pulse(d1, 0).start();
    pulse(d2, 200).start();
    pulse(d3, 400).start();
    Animated.timing(progress, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: false }).start();
  }, [d1, d2, d3, progress]);

  useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(() => {
      const isAgent = (user as any)?.role === "agent";
      router.replace(user ? (isAgent ? ("/paybid/(tabs)" as any) : "/paybid/login") : "/paybid/onboarding");
    }, 1700);
    return () => clearTimeout(t);
  }, [hydrated, user, router]);

  const progressWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

  return (
    <LinearGradient colors={["#994A26", "#C4622D", "#E8823A"]} style={styles.bg} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
      <View style={styles.center}>
        <View style={styles.logoBox}>
          <SendBidLogo size={88} />
        </View>
        <TText variant="display" weight="extraBold" color="white" style={{ marginTop: spacing.xl, letterSpacing: 2 }}>
          PAYBID
        </TText>
        <TText variant="body" color="rgba(255,255,255,0.85)" style={{ marginTop: 6, fontStyle: "italic" }}>
          Accept. Deliver. Earn.
        </TText>

        <View style={styles.dotsRow}>
          {[d1, d2, d3].map((v, i) => (
            <Animated.View key={i} style={[styles.dot, { opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0.3, 1], outputRange: [0.8, 1.15] }) }] }]} />
          ))}
        </View>
      </View>

      <View style={styles.progressWrap}>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
        </View>
        <TText variant="label" color="rgba(255,255,255,0.6)" align="center" style={{ marginTop: 6 }}>
          Initialisation sécurisée…
        </TText>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  logoBox: {
    width: 128, height: 128, borderRadius: 42,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.14)",
  },
  dotsRow: { flexDirection: "row", gap: 10, marginTop: spacing.xxl },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#F59E0B" },
  progressWrap: { paddingHorizontal: spacing.xxl, paddingBottom: 56 },
  progressTrack: { height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.12)", overflow: "hidden" },
  progressFill: { height: 4, backgroundColor: "#F59E0B", borderRadius: 2 },
});
