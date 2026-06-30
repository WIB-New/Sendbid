import React, { useEffect, useRef, useState } from "react";
import { t, useLocale } from "../../src/i18n";
import { View, StyleSheet, TouchableOpacity, Platform, Linking, Alert, Animated } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { TText } from "../../src/components/TText";
import { colors, spacing, radii } from "../../src/theme";
import { useThemedColors } from "../../src/themeContext";
/**
 * B6 — UI d'appel sortant vers l'agent payeur.
 * - Sur mobile (iOS/Android) : tentative d'appel natif via tel:
 * - Sur web : affiche la fiche contact avec le numéro cliquable
 * - UI inspirée des apps d'appel natives (avatar, gradient sombre, boutons actions)
 */
export default function Call() {
  const { t } = useTranslation();
  useLocale((st) => st.locale);
  const colors = useThemedColors();
  const router = useRouter();
  const { transfer_id, phone, name } = useLocalSearchParams<{ transfer_id: string; phone?: string; name?: string }>();
  const [status, setStatus] = useState<"dialing" | "ringing" | "in_call" | "ended">("dialing");
  const [secs, setSecs] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(false);
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Animation de pulse sur l'avatar pendant la sonnerie
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.15, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ]),
    ).start();
    const t1 = setTimeout(() => setStatus("ringing"), 1200);
    const t2 = setTimeout(() => setStatus("in_call"), 3500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [pulse]);

  useEffect(() => {
    if (status !== "in_call") return;
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [status]);

  const hangup = () => {
    setStatus("ended");
    setTimeout(() => router.back(), 800);
  };

  const dialNative = async () => {
    if (!phone) { Alert.alert("Numéro indisponible", "Aucun numéro n'est associé à cet agent."); return; }
    const url = `tel:${phone.replace(/\s+/g, "")}`;
    if (Platform.OS === "web") {
      Alert.alert("Appel indisponible sur le web", "Sur téléphone, cette action ouvrira directement votre composeur."); return;
    }
    const can = await Linking.canOpenURL(url);
    if (!can) { Alert.alert("Impossible", "Votre appareil ne prend pas en charge les appels téléphoniques."); return; }
    Linking.openURL(url);
  };

  const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <LinearGradient colors={["#0F172A", "#1E293B", "#0F172A"]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        {/* Header */}
        <View style={styles.header}>
          <TText variant="caption" color="rgba(255,255,255,0.6)" weight="semiBold">
            {status === "dialing" ? "Appel en cours…" : status === "ringing" ? "Sonnerie…" : status === "in_call" ? "Appel en cours" : "Appel terminé"}
          </TText>
          {status === "in_call" ? (
            <TText variant="title" weight="extraBold" color="white" style={{ marginTop: 4 }}>{fmt(secs)}</TText>
          ) : null}
        </View>

        {/* Avatar */}
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Animated.View style={[styles.avatarRing, { transform: [{ scale: pulse }] }]}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={72} color="white" />
            </View>
          </Animated.View>
          <TText variant="title" weight="extraBold" color="white" style={{ marginTop: spacing.xl }}>
            {name || "Agent SENDBID"}
          </TText>
          <TText variant="body" color="rgba(255,255,255,0.7)" style={{ marginTop: 4 }}>
            {phone || "Payeur local · ligne chiffrée"}
          </TText>
          <View style={styles.secBadge}>
            <Ionicons name="lock-closed" size={12} color="#10B981" />
            <TText variant="label" weight="bold" color="#10B981" style={{ marginLeft: 4 }}>Chiffré de bout en bout</TText>
          </View>
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          <View style={styles.ctrlRow}>
            <CtrlBtn icon={muted ? "mic-off" : "mic"} active={muted} onPress={() => setMuted((m) => !m)} label={muted ? "Muet" : "Micro"} />
            <CtrlBtn icon={speaker ? "volume-high" : "volume-medium"} active={speaker} onPress={() => setSpeaker((s) => !s)} label="HP" />
            <CtrlBtn icon="keypad" onPress={() => {}} label="Clavier" />
          </View>
          <View style={styles.ctrlRow}>
            <CtrlBtn icon="chatbubble-ellipses" onPress={() => router.replace({ pathname: "/transfer/chat", params: { transfer_id: transfer_id! } } as any)} label="Chat" />
            <CtrlBtn icon="call" onPress={dialNative} label="Natif" tint="#3B82F6" />
            <CtrlBtn icon="add" onPress={() => {}} label="Ajouter" />
          </View>

          <TouchableOpacity testID="call-hangup" style={styles.hangup} onPress={hangup} activeOpacity={0.8}>
            <Ionicons name="call" size={32} color="white" style={{ transform: [{ rotate: "135deg" }] }} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

function CtrlBtn({ icon, label, onPress, active, tint }: { icon: any; label: string; onPress: () => void; active?: boolean; tint?: string }) {
  return (
    <TouchableOpacity onPress={onPress} style={{ alignItems: "center", width: 80 }}>
      <View style={[styles.ctrlBtn, active && styles.ctrlBtnActive, tint ? { backgroundColor: tint } : null]}>
        <Ionicons name={icon} size={24} color="white" />
      </View>
      <TText variant="label" color="rgba(255,255,255,0.7)" style={{ marginTop: 6 }}>{label}</TText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", paddingTop: spacing.lg },
  avatarRing: {
    width: 160, height: 160, borderRadius: 80,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 2, borderColor: "rgba(255,255,255,0.2)",
  },
  avatar: {
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: "#334155", alignItems: "center", justifyContent: "center",
  },
  secBadge: {
    flexDirection: "row", alignItems: "center",
    marginTop: spacing.lg,
    backgroundColor: "rgba(16,185,129,0.15)",
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: radii.full,
  },
  controls: { paddingBottom: spacing.xl, paddingHorizontal: spacing.lg },
  ctrlRow: { flexDirection: "row", justifyContent: "space-around", marginBottom: spacing.lg },
  ctrlBtn: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center", justifyContent: "center",
  },
  ctrlBtnActive: { backgroundColor: "white" },
  hangup: {
    alignSelf: "center",
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: "#EF4444",
    alignItems: "center", justifyContent: "center",
    marginTop: spacing.md,
  },
});
