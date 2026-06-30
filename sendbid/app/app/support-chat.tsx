import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../src/components/Screen";
import { TText } from "../src/components/TText";
import { api, apiError } from "../src/api";
import { colors, spacing, radii } from "../src/theme";
import { useThemedColors } from "../src/themeContext";
import { useTranslation } from "../../src/i18n";
type Msg = { id: string; sender: "user" | "bot" | "agent"; text: string; created_at: string };

export default function SupportChat() {
  const { t } = useTranslation();
  const colors = useThemedColors();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/support/chat/messages");
      setMessages(data.messages || []);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: any) {
      setErr(apiError(e));
    }
  }, []);

  useEffect(() => {
    load();
    // Polling toutes les 10s pour recevoir les réponses agents
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setErr(null);
    // Optimistic: on ajoute immédiatement le msg user à l'UI
    const tempUser: Msg = { id: "tmp-" + Date.now(), sender: "user", text, created_at: new Date().toISOString() };
    setMessages((prev) => [...prev, tempUser]);
    setInput("");
    try {
      const { data } = await api.post("/support/chat/send", { message: text });
      // Remplace le temp par le vrai + ajoute la réponse bot
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== tempUser.id);
        return [...filtered, data.user_message, data.bot_reply];
      });
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: any) {
      setErr(apiError(e));
      // Rollback optimistic
      setMessages((prev) => prev.filter((m) => m.id !== tempUser.id));
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen title="Chat en direct" back hero scroll={false}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View style={styles.statusBar}>
          <View style={styles.onlineDot} />
          <TText variant="caption" color={colors.neutrals.textSecondary}>Assistant SENDBID en ligne — réponse &lt; 30s</TText>
        </View>

        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingVertical: spacing.md }}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {messages.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: spacing.xxxl }}>
              <ActivityIndicator color={colors.primary.base} />
              <TText variant="caption" color={colors.neutrals.textSecondary} style={{ marginTop: 8 }}>Chargement...</TText>
            </View>
          ) : (
            messages.map((m) => <Bubble key={m.id} msg={m} />)
          )}
          {sending ? (
            <View style={[styles.bubbleLeft, { marginTop: 6 }]}>
              <ActivityIndicator size="small" color={colors.primary.base} />
            </View>
          ) : null}
        </ScrollView>

        {err ? <TText variant="caption" color={colors.status.error} align="center" style={{ marginVertical: 6 }}>{err}</TText> : null}

        <View style={styles.composer}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Écrivez votre message..."
            placeholderTextColor={colors.neutrals.textTertiary}
            style={styles.input}
            multiline
            maxLength={2000}
            onSubmitEditing={send}
          />
          <TouchableOpacity testID="support-send" onPress={send} disabled={!input.trim() || sending} style={[styles.sendBtn, (!input.trim() || sending) && { opacity: 0.4 }]}>
            <Ionicons name="send" size={18} color="white" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Bubble({ msg }: { msg: Msg }) {
  const isUser = msg.sender === "user";
  const isBot = msg.sender === "bot";
  const bg = isUser ? colors.primary.base : isBot ? "#EEF1F9" : "#DCFCE7";
  const fg = isUser ? "white" : colors.neutrals.textPrimary;
  return (
    <View style={[{ flexDirection: "row", paddingHorizontal: 8 }, isUser ? { justifyContent: "flex-end" } : { justifyContent: "flex-start" }]}>
      <View style={[styles.bubble, { backgroundColor: bg }, isUser ? styles.bubbleRight : styles.bubbleLeft]}>
        {!isUser ? (
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
            <Ionicons name={isBot ? "chatbubble-ellipses" : "person-circle"} size={12} color={colors.primary.base} />
            <TText variant="label" weight="bold" color={colors.primary.base} style={{ marginLeft: 4 }}>
              {isBot ? "Assistant SENDBID" : "Conseiller"}
            </TText>
          </View>
        ) : null}
        <TText variant="body" color={fg} style={{ lineHeight: 20 }}>{msg.text}</TText>
        <TText variant="label" color={isUser ? "rgba(255,255,255,0.7)" : colors.neutrals.textTertiary} style={{ marginTop: 4, fontSize: 10 }}>
          {new Date(msg.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
        </TText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  statusBar: { flexDirection: "row", alignItems: "center", paddingVertical: 6, paddingHorizontal: spacing.sm, backgroundColor: colors.neutrals.surface, borderRadius: radii.full, borderWidth: 1, borderColor: colors.neutrals.border, marginBottom: spacing.sm },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#10B981", marginRight: 8 },
  bubble: { maxWidth: "82%", padding: 10, borderRadius: radii.xl, marginVertical: 4 },
  bubbleLeft: { borderBottomLeftRadius: 4 },
  bubbleRight: { borderBottomRightRadius: 4 },
  composer: { flexDirection: "row", alignItems: "flex-end", backgroundColor: colors.neutrals.surface, borderRadius: radii.xl, padding: 8, borderWidth: 1, borderColor: colors.neutrals.border, marginBottom: spacing.sm },
  input: { flex: 1, paddingHorizontal: 8, paddingVertical: 8, fontSize: 15, color: colors.neutrals.textPrimary, maxHeight: 120, ...(Platform.OS === "web" ? { outlineStyle: "none" as any, outlineWidth: 0 as any } : {}) },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary.base, alignItems: "center", justifyContent: "center", marginLeft: 4 },
});
