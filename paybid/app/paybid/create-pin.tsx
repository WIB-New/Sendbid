import React, { useCallback, useRef, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  Platform, Animated, ScrollView, useWindowDimensions,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, apiError } from "../../src/api";
import { useAuth, usePinSession } from "../../src/store";
import { paybidColors, paybidFontFamily as fontFamily } from "../../src/paybidTheme";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTranslation } from "../../src/i18n";

const PIN_LENGTH = 6;
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"];

export default function PaybidCreatePin() {
  const { t } = useTranslation();
  const router = useRouter();
  const { height: screenH } = useWindowDimensions();
  const refreshMe = useAuth((s) => s.refreshMe);
  const setUser = useAuth((s) => s.setUser);
  const user = useAuth((s) => s.user);
  const markPinValidated = usePinSession((s) => s.setPinValidated);

  const [step, setStep] = useState<"create" | "confirm">("create");
  const [pin, setPin] = useState("");
  const [pinCreate, setPinCreate] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const triggerShake = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 12, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -12, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const isWeakPin = (code: string): boolean => {
    if (code.length !== 6) return false;
    if (/^(\d)\1{5}$/.test(code)) return true;
    if ("0123456789".includes(code) || "9876543210".includes(code)) return true;
    const nums = code.split("").map(Number);
    let seq = true, rev = true;
    for (let i = 1; i < nums.length; i++) {
      if (nums[i] !== nums[i - 1] + 1) seq = false;
      if (nums[i] !== nums[i - 1] - 1) rev = false;
    }
    return seq || rev;
  };

  const submitPin = async (code: string) => {
    setLoading(true);
    setErr(null);
    try {
      await api.post("/auth/create-pin", { pin: code });
      if (user) {
        setUser({ ...user, pin_created: true, has_pin: true });
      }
      await AsyncStorage.setItem("sb_pin_just_created", Date.now().toString());
      try { await refreshMe(); } catch {}
      markPinValidated(true);
      await new Promise(resolve => setTimeout(resolve, 100));
      router.replace("/paybid/(tabs)" as any);
    } catch (e: any) {
      setErr(apiError(e));
      setPin("");
    } finally {
      setLoading(false);
    }
  };

  const onKeyPress = (key: string) => {
    if (loading) return;
    setErr(null);

    if (key === "back") {
      setPin((p) => p.slice(0, -1));
      return;
    }

    if (!key || pin.length >= PIN_LENGTH) return;
    const next = pin + key;
    setPin(next);

    if (next.length === PIN_LENGTH) {
      setTimeout(() => {
        if (step === "create") {
          if (isWeakPin(next)) {
            triggerShake();
            setErr("Code trop simple. Évitez les suites ou répétitions.");
            setPin("");
            return;
          }
          setPinCreate(next);
          setPin("");
          setStep("confirm");
        } else {
          if (next !== pinCreate) {
            triggerShake();
            setErr("Les codes ne correspondent pas. Recommencez.");
            setPin("");
            setStep("create");
            setPinCreate("");
            return;
          }
          submitPin(next);
        }
      }, 250);
    }
  };

  const goBack = () => {
    setStep("create");
    setPin("");
    setPinCreate("");
    setErr(null);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" translucent backgroundColor="transparent" />

      {/* BANNER PAYBID */}
      <View style={[styles.banner, { height: screenH * 0.26 }]}>
        <Text style={styles.brandText}>P A Y B I D</Text>
        <Text style={styles.bannerSubtitle}>Sécurité du compte agent</Text>
      </View>

      {/* CARD */}
      <View style={[styles.card, { top: screenH * 0.20 }]}>
        <ScrollView
          contentContainerStyle={[styles.cardContent, { minHeight: screenH * 0.80 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* STEPS */}
          <View style={styles.stepsRow}>
            <View style={styles.stepItem}>
              <View style={[styles.stepCircle, { backgroundColor: paybidColors.primary.base }]}>
                <Text style={styles.stepCircleText}>1</Text>
              </View>
              <Text style={[styles.stepLabel, step === "create" && styles.stepLabelActive]}>
                Créer
              </Text>
            </View>
            <View style={[styles.stepLine, { backgroundColor: step === "confirm" ? paybidColors.primary.base : "#D1D5DB" }]} />
            <View style={styles.stepItem}>
              <View style={[styles.stepCircle, { backgroundColor: step === "confirm" ? paybidColors.primary.base : "#E5E7EB" }]}>
                <Text style={[styles.stepCircleText, step !== "confirm" && { color: "#9CA3AF" }]}>2</Text>
              </View>
              <Text style={[styles.stepLabel, step === "confirm" && styles.stepLabelActive]}>
                Confirmer
              </Text>
            </View>
          </View>

          {/* TITLE */}
          <Text style={styles.title}>
            {step === "create" ? "Créez votre code PIN" : "Confirmez votre code PIN"}
          </Text>
          <Text style={styles.subtitle}>
            {step === "create"
              ? "Ce code à 6 chiffres sécurisera vos retraits et opérations sensibles."
              : "Saisissez à nouveau votre code PIN pour confirmer."}
          </Text>

          {/* PIN DOTS */}
          <Animated.View style={[styles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}>
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.pinDot,
                  i < pin.length
                    ? { backgroundColor: paybidColors.primary.base, borderWidth: 0, transform: [{ scale: 1.1 }] }
                    : { backgroundColor: "transparent", borderWidth: 2, borderColor: "#D1D5DB" },
                ]}
              />
            ))}
          </Animated.View>

          {/* ERROR */}
          <View style={styles.errContainer}>
            {err ? (
              <View style={styles.errBox}>
                <Ionicons name="alert-circle" size={16} color="#EF4444" style={{ marginRight: 6 }} />
                <Text style={styles.errText}>{err}</Text>
              </View>
            ) : (
              <View style={{ height: 36 }} />
            )}
          </View>

          {/* GO BACK */}
          {step === "confirm" && (
            <TouchableOpacity onPress={goBack} style={styles.goBackRow} activeOpacity={0.7}>
              <Ionicons name="arrow-back-circle-outline" size={18} color={paybidColors.primary.dark} style={{ marginRight: 6 }} />
              <Text style={styles.goBackText}>Modifier le code</Text>
            </TouchableOpacity>
          )}

          {/* KEYPAD */}
          <View style={styles.keypad}>
            {KEYS.map((k, idx) => (
              <TouchableOpacity
                key={idx}
                disabled={!k || loading}
                activeOpacity={0.6}
                onPress={() => onKeyPress(k)}
                style={[styles.key, !k && { opacity: 0 }]}
              >
                {k === "back" ? (
                  <Ionicons name="backspace-outline" size={28} color={paybidColors.primary.dark} />
                ) : (
                  <Text style={styles.keyText}>{k}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* SECURITY NOTE */}
          <View style={styles.securityRow}>
            <Ionicons name="lock-closed-outline" size={13} color="#9CA3AF" style={{ marginRight: 4 }} />
            <Text style={styles.securityNote}>Votre PIN est chiffré et stocké de manière sécurisée.</Text>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: paybidColors.primary.dark },

  banner: {
    paddingTop: Platform.OS === "ios" ? 60 : 48,
    paddingHorizontal: 24,
    backgroundColor: paybidColors.primary.dark,
    justifyContent: "center",
    alignItems: "center",
  },
  brandText: {
    fontSize: 18, fontFamily: fontFamily.bold,
    letterSpacing: 4, color: "#FFFFFF",
  },
  bannerSubtitle: {
    fontSize: 13, fontFamily: fontFamily.regular,
    color: "rgba(255,255,255,0.7)", marginTop: 6,
  },

  card: {
    position: "absolute",
    left: 0, right: 0, bottom: 0,
    backgroundColor: paybidColors.neutrals.background,
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    shadowColor: "#000", shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.12, shadowRadius: 20, elevation: 12,
  },
  cardContent: {
    alignItems: "center",
    paddingHorizontal: 28, paddingTop: 32, paddingBottom: 40,
  },

  stepsRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    marginBottom: 28,
  },
  stepItem: { alignItems: "center" },
  stepCircle: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
  },
  stepCircleText: {
    fontSize: 15, fontFamily: fontFamily.bold, color: "#FFFFFF",
  },
  stepLabel: {
    fontSize: 12, fontFamily: fontFamily.regular,
    color: "#9CA3AF", marginTop: 6,
  },
  stepLabelActive: {
    color: paybidColors.primary.dark, fontFamily: fontFamily.bold,
  },
  stepLine: { width: 60, height: 2, marginHorizontal: 14, borderRadius: 1, marginBottom: 20 },

  title: {
    fontSize: 22, fontFamily: fontFamily.bold,
    color: paybidColors.primary.dark, textAlign: "center",
  },
  subtitle: {
    fontSize: 14, fontFamily: fontFamily.regular,
    color: "#6B7280", textAlign: "center", marginTop: 8, lineHeight: 20,
    paddingHorizontal: 16,
  },

  dotsRow: {
    flexDirection: "row", justifyContent: "center",
    marginTop: 32, gap: 16,
  },
  pinDot: {
    width: 22, height: 22, borderRadius: 11,
  },

  errContainer: { height: 44, justifyContent: "center", marginTop: 8 },
  errBox: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "#FEF2F2", paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 10,
  },
  errText: {
    fontSize: 13, fontFamily: fontFamily.medium, color: "#EF4444",
  },

  keypad: {
    flexDirection: "row", flexWrap: "wrap", justifyContent: "center",
    marginTop: 8, width: "100%", paddingHorizontal: 16,
  },
  key: {
    width: "33.33%", height: 72,
    alignItems: "center", justifyContent: "center",
    borderRadius: 16,
  },
  keyText: {
    fontSize: 28, fontFamily: fontFamily.medium, color: paybidColors.primary.dark,
  },

  goBackRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    marginBottom: 8, paddingVertical: 10, paddingHorizontal: 20,
    borderRadius: 10, backgroundColor: "#F3F4F6",
  },
  goBackText: {
    fontSize: 14, fontFamily: fontFamily.semiBold, color: paybidColors.primary.dark,
  },

  securityRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    marginTop: 20,
  },
  securityNote: {
    fontSize: 12, fontFamily: fontFamily.regular,
    color: "#9CA3AF", textAlign: "center",
  },
});
