import React, { useState } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert, TextInput as NativeTextInput, Platform } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { TText } from "../src/components/TText";
import { Button } from "../src/components/Button";
import { Input } from "../src/components/Input";
import { colors, spacing, radii } from "../src/theme";

// Nous contacter v4.0 — "41 Nous contacter" : grille 4 canaux + formulaire contact
const CHANNELS = [
  { key: "chat", label: "Chat en direct", sub: "En ligne", color: "#10B981", icon: "chatbubbles" as const, action: "chat" },
  { key: "phone", label: "Téléphone", sub: "24/7", color: "#3B82F6", icon: "call" as const, action: "tel:+33180888888" },
  { key: "email", label: "Email", sub: "< 24h", color: "#8B5CF6", icon: "mail" as const, action: "mailto:support@sendbid.app" },
  { key: "wa", label: "WhatsApp", sub: "< 1h", color: "#25D366", icon: "logo-whatsapp" as const, action: "https://wa.me/33180888888" },
];

export default function Contact() {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const tap = (c: any) => {
    if (c.action === "chat") {
      router.push("/support-chat" as any);
    } else {
      Linking.openURL(c.action);
    }
  };

  const send = async () => {
    if (!subject.trim() || !message.trim()) return;
    setBusy(true);
    setTimeout(() => {
      setBusy(false);
      Alert.alert("Message envoyé", "Nous vous répondrons sous 24h par email.");
      setSubject(""); setMessage("");
    }, 800);
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#0F1B40" }}>
      <LinearGradient colors={["#0F1B40", "#1B2A5B"]} style={styles.hero}>
        <SafeAreaView edges={["top"]}>
          <View style={styles.heroTop}>
            <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
              <Ionicons name="chevron-back" size={22} color="white" />
            </TouchableOpacity>
            <TText variant="body" weight="extraBold" color="white">Nous contacter</TText>
            <View style={{ width: 36 }} />
          </View>
          <TText variant="title" weight="extraBold" color="white" align="center" style={{ marginTop: spacing.md }}>
            Notre équipe est là
          </TText>
          <TText variant="caption" color="rgba(255,255,255,0.8)" align="center">
            24h/24 · 7j/7 · français, anglais, wolof
          </TText>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView style={styles.card} contentContainerStyle={styles.cardInner} showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          {CHANNELS.map((c) => (
            <TouchableOpacity key={c.key} testID={`ch-${c.key}`} onPress={() => tap(c)} style={[styles.chanCard, { borderColor: c.color }]}>
              <View style={[styles.chanIcon, { backgroundColor: c.color }]}>
                <Ionicons name={c.icon} size={22} color="white" />
              </View>
              <TText variant="body" weight="extraBold" style={{ marginTop: 8 }}>{c.label}</TText>
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
                <View style={[styles.onlineDot, { backgroundColor: c.color }]} />
                <TText variant="label" color={colors.neutrals.textSecondary} style={{ marginLeft: 4 }}>{c.sub}</TText>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <TText variant="label" weight="extraBold" color={colors.neutrals.textSecondary} style={styles.secTitle}>
          FORMULAIRE DE CONTACT
        </TText>
        <View style={styles.formBox}>
          <Input label="Sujet" value={subject} onChangeText={setSubject} placeholder="Résumez votre demande" icon="pricetag-outline" />
          <TText variant="label" weight="semiBold" color={colors.neutrals.textSecondary} style={{ marginTop: 8, marginBottom: 6 }}>Message</TText>
          <View style={styles.textareaWrap}>
            <Ionicons name="chatbox-outline" size={18} color={colors.neutrals.textTertiary} style={{ marginTop: 4 }} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <TextInputArea value={message} onChangeText={setMessage} />
            </View>
          </View>
          <Button testID="contact-send" title="Envoyer le message" icon="paper-plane" loading={busy} disabled={!subject.trim() || !message.trim()} onPress={send} style={{ marginTop: spacing.md, backgroundColor: "#10B981" }} />
        </View>
      </ScrollView>
    </View>
  );
}

function TextInputArea({ value, onChangeText }: { value: string; onChangeText: (t: string) => void }) {
  return (
    <NativeTextInput
      value={value}
      onChangeText={onChangeText}
      multiline
      numberOfLines={5}
      placeholder="Votre message détaillé…"
      placeholderTextColor={colors.neutrals.textTertiary}
      style={{ color: colors.neutrals.textPrimary, minHeight: 100, textAlignVertical: "top", fontSize: 14, ...(Platform.OS === "web" ? { outlineStyle: "none" } : {}) } as any}
    />
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: spacing.sm },
  iconBtn: { width: 36, height: 36, borderRadius: radii.full, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" },
  card: { flex: 1, backgroundColor: colors.neutrals.background, borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl, marginTop: -spacing.lg },
  cardInner: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chanCard: { flex: 1, minWidth: "45%", backgroundColor: colors.neutrals.surface, borderWidth: 2, borderRadius: radii.xl, padding: spacing.md, alignItems: "center" },
  chanIcon: { width: 48, height: 48, borderRadius: radii.full, alignItems: "center", justifyContent: "center" },
  onlineDot: { width: 6, height: 6, borderRadius: 3 },
  secTitle: { letterSpacing: 1, marginTop: spacing.lg, marginBottom: 8, marginLeft: 4 },
  formBox: { backgroundColor: colors.neutrals.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.neutrals.border, padding: spacing.md },
  textareaWrap: { flexDirection: "row", alignItems: "flex-start", backgroundColor: colors.neutrals.background, borderRadius: radii.lg, padding: 10, borderWidth: 1, borderColor: colors.neutrals.border, minHeight: 110 },
});
