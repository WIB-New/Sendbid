import React, { useEffect, useState, useRef } from "react";
import { t, useLocale } from "../../src/i18n";
import { View, StyleSheet, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, Alert, Linking } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../../src/components/Screen";
import { TText } from "../../src/components/TText";
import { api } from "../../src/api";
import { colors, spacing, radii, fontFamily } from "../../src/theme";
import { useThemedColors } from "../../src/themeContext";
import { useTranslation } from "../../../src/i18n";
const ROLE_LABELS: Record<string, { name: string; color: string }> = {
  sender: { name: "Vous", color: colors.primary.base },
  agent: { name: "Agent", color: colors.accent.base },
  beneficiary: { name: "Bénéficiaire", color: colors.status.pending },
  system: { name: "Système", color: colors.neutrals.textSecondary },
};

export default function Chat() {
  const { t } = useTranslation();
  useLocale((st) => st.locale);
  const colors = useThemedColors();
  const router = useRouter();
  const { transfer_id } = useLocalSearchParams<{ transfer_id: string }>();
  const [messages, setMessages] = useState<any[]>([]);
  const [open, setOpen] = useState(true);
  const [text, setText] = useState("");
  const [agentPhone, setAgentPhone] = useState<string | null>(null);
  const ref = useRef<FlatList>(null);

  const load = async () => {
    const { data } = await api.get(`/transfers/${transfer_id}/chat`);
    setMessages(data.messages || []);
    setOpen(!!(data.room && data.room.open));
    // Récupère la fiche du transfert pour obtenir le téléphone de l'agent
    try {
      const tr = await api.get(`/transfers/${transfer_id}`);
      setAgentPhone(tr.data?.agent_snapshot?.phone || null);
    } catch {}
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, []);

  const send = async () => {
    if (!text.trim()) return;
    setText("");
    try {
      await api.post(`/transfers/${transfer_id}/chat`, { transfer_id: transfer_id!, content: text });
      load();
    } catch {}
  };

  return (
    <Screen title="Chat 3 parties" back scroll={false}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={80}>
        <View style={styles.banner}>
          <Ionicons name="people" size={16} color={colors.primary.base} />
          <TText variant="caption" weight="semiBold" color={colors.primary.base} style={{ marginLeft: 6, flex: 1 }}>
            Vous • Agent • Bénéficiaire {open ? "" : "(fermé)"}
          </TText>
          <TouchableOpacity
            testID="chat-call-agent"
            onPress={() => router.push({ pathname: "/transfer/call", params: { transfer_id: transfer_id!, phone: agentPhone || "" } } as any)}
            style={styles.callBtn}
          >
            <Ionicons name="call" size={16} color="white" />
            <TText variant="label" weight="bold" color="white" style={{ marginLeft: 4 }}>Appeler</TText>
          </TouchableOpacity>
        </View>

        <FlatList
          ref={ref}
          data={messages}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: spacing.md }}
          onContentSizeChange={() => ref.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => {
            const role = ROLE_LABELS[item.role] || ROLE_LABELS.system;
            const mine = item.role === "sender";
            return (
              <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                <TText variant="label" weight="bold" color={mine ? "rgba(255,255,255,0.85)" : role.color}>
                  {role.name}
                </TText>
                <TText variant="body" color={mine ? "white" : colors.neutrals.textPrimary} style={{ marginTop: 2 }}>
                  {item.content}
                </TText>
              </View>
            );
          }}
        />

        {open ? (
          <View style={styles.inputRow}>
            <TextInput
              testID="chat-input"
              value={text}
              onChangeText={setText}
              placeholder="Votre message…"
              placeholderTextColor={colors.neutrals.textTertiary}
              style={styles.input}
            />
            <TouchableOpacity testID="chat-send" onPress={send} style={styles.sendBtn}>
              <Ionicons name="send" size={20} color="white" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ padding: spacing.lg, alignItems: "center" }}>
            <TText variant="caption" color={colors.neutrals.textSecondary}>Chat fermé (transfert finalisé)</TText>
          </View>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.overlays.primarySoft, padding: 10,
    borderRadius: radii.lg,
    marginHorizontal: spacing.md, marginVertical: 6,
  },
  callBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#10B981", paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.full },
  bubble: { padding: 10, borderRadius: radii.lg, marginVertical: 4, maxWidth: "80%" },
  bubbleMine: { backgroundColor: colors.primary.base, alignSelf: "flex-end", borderTopRightRadius: 0 },
  bubbleOther: {
    backgroundColor: colors.neutrals.surface, alignSelf: "flex-start", borderTopLeftRadius: 0,
    borderWidth: 1, borderColor: colors.neutrals.border,
  },
  inputRow: { flexDirection: "row", padding: spacing.md, gap: 8, alignItems: "center" },
  input: {
    flex: 1, height: 48,
    backgroundColor: colors.neutrals.surface, borderRadius: radii.full,
    borderWidth: 1, borderColor: colors.neutrals.border,
    paddingHorizontal: 16, fontFamily: fontFamily.regular, color: colors.neutrals.textPrimary,
  },
  sendBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: colors.accent.base, alignItems: "center", justifyContent: "center",
  },
});
