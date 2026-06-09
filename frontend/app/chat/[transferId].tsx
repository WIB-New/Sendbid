/**
 * /chat/[transferId].tsx — Chat 3 parties partagé Sendbid + Paybid.
 *
 * Backend: GET/POST /transfers/{id}/chat (auth 3 niveaux : sender / agent / admin).
 * - Étiquettes de rôle visibles : 👤 Expéditeur · 🛡️ Agent · 🎯 Bénéficiaire
 * - Détection automatique du rôle courant via `my_role` renvoyé par le backend
 * - Polling toutes les 4s pour récupérer les nouveaux messages
 * - Bouton "Appeler l'agent" si numéro disponible (côté expéditeur uniquement)
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { TText } from "../../src/components/TText";
import { api, apiError } from "../../src/api";
import { spacing, radii } from "../../src/theme";
import { useThemedColors } from "../../src/themeContext";

type Msg = {
  id: string;
  role: string; // "sender" | "agent" | "beneficiary" | "admin" | "system"
  author_name: string;
  content: string;
  created_at: string;
};

type Participants = {
  sender?: { name?: string };
  agent?: { name?: string; phone?: string };
  beneficiary?: { name?: string };
};

const ROLE_META: Record<string, { label: string; emoji: string; color: string; bg: string }> = {
  sender: { label: "Expéditeur", emoji: "👤", color: "#022a6b", bg: "#022a6b" },
  agent: { label: "Agent", emoji: "🛡️", color: "#F59E0B", bg: "#F59E0B" },
  beneficiary: { label: "Bénéficiaire", emoji: "🎯", color: "#10B981", bg: "#10B981" },
  admin: { label: "Admin", emoji: "⚙️", color: "#7C3AED", bg: "#7C3AED" },
  system: { label: "Système", emoji: "🤖", color: "#6B7280", bg: "#6B7280" },
};

// (Le bouclier de vérification (Lot 5) utilise la nuance #B91C1C — voir VerificationShieldFloating.tsx)

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function ChatScreen() {
  const router = useRouter();
  const colors = useThemedColors();
  const { transferId } = useLocalSearchParams<{ transferId: string }>();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [myRole, setMyRole] = useState<string>("sender");
  const [participants, setParticipants] = useState<Participants>({});
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const initialLoadRef = useRef(false);

  const load = useCallback(async () => {
    if (!transferId) return;
    try {
      const r = await api.get(`/transfers/${transferId}/chat`);
      setMessages((r.data?.messages || []) as Msg[]);
      setMyRole(r.data?.my_role || "sender");
      setParticipants(r.data?.participants || {});
      setErr(null);
    } catch (e: any) {
      setErr(apiError(e));
    } finally {
      if (!initialLoadRef.current) {
        initialLoadRef.current = true;
        setBusy(false);
      }
    }
  }, [transferId]);

  useEffect(() => {
    setBusy(true);
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    setTimeout(
      () => scrollRef.current?.scrollToEnd({ animated: true }),
      80
    );
  }, [messages.length]);

  const send = async () => {
    const c = text.trim();
    if (!c || !transferId) return;
    setSending(true);
    try {
      await api.post(`/transfers/${transferId}/chat`, {
        transfer_id: transferId,
        content: c,
      });
      setText("");
      await load();
    } catch (e: any) {
      setErr(apiError(e));
    } finally {
      setSending(false);
    }
  };

  const callAgent = () => {
    const phone = participants.agent?.phone;
    if (!phone) return;
    Linking.openURL(`tel:${phone}`).catch(() => {});
  };

  const myMeta = ROLE_META[myRole] || ROLE_META.sender;
  const agentPhone = participants.agent?.phone;
  const isAgentSide = myRole === "agent" || myRole === "admin";

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: colors.neutrals.background }]}
      edges={["top", "left", "right"]}
    >
      {/* ===== Header ===== */}
      <View
        style={[
          styles.header,
          { borderBottomColor: colors.neutrals.border },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          testID="chat-back"
        >
          <Ionicons
            name="chevron-back"
            size={26}
            color={colors.neutrals.textPrimary}
          />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <TText variant="title" weight="extraBold">
            Discussion
          </TText>
          <TText
            variant="caption"
            color={colors.neutrals.textSecondary}
          >
            3 parties · {myMeta.emoji} Vous êtes l’{myMeta.label.toLowerCase()}
          </TText>
        </View>
        {!isAgentSide && agentPhone ? (
          <TouchableOpacity
            testID="chat-call-agent"
            onPress={callAgent}
            style={styles.callBtn}
          >
            <Ionicons name="call" size={16} color="white" />
            <TText
              variant="label"
              weight="bold"
              color="white"
              style={{ marginLeft: 4 }}
            >
              Appeler
            </TText>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* ===== Participants pills ===== */}
      <View style={styles.pillsRow}>
        <ParticipantPill role="sender" name={participants.sender?.name} active={myRole === "sender"} />
        <ParticipantPill role="agent" name={participants.agent?.name} active={myRole === "agent"} />
        <ParticipantPill role="beneficiary" name={participants.beneficiary?.name} active={myRole === "beneficiary"} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{
            padding: spacing.lg,
            paddingBottom: spacing.xxxl,
          }}
        >
          {busy && messages.length === 0 ? (
            <View style={styles.empty}>
              <ActivityIndicator color={colors.primary.base} />
            </View>
          ) : messages.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons
                name="chatbubbles-outline"
                size={56}
                color={colors.neutrals.textTertiary}
              />
              <TText
                variant="body"
                weight="bold"
                style={{ marginTop: 10 }}
              >
                Pas encore de message
              </TText>
              <TText
                variant="caption"
                color={colors.neutrals.textSecondary}
                align="center"
                style={{ marginTop: 4, maxWidth: 280 }}
              >
                Démarrez la conversation — l’agent et le bénéficiaire pourront vous répondre.
              </TText>
            </View>
          ) : (
            messages.map((m) => {
              const meta = ROLE_META[m.role] || ROLE_META.system;
              const isMine = m.role === myRole;
              return (
                <View
                  key={m.id}
                  style={[
                    styles.msgRow,
                    isMine ? styles.msgRowMine : styles.msgRowOther,
                  ]}
                >
                  {!isMine ? (
                    <View
                      style={[
                        styles.avatar,
                        { backgroundColor: meta.color + "22" },
                      ]}
                    >
                      <TText style={{ fontSize: 14 }}>{meta.emoji}</TText>
                    </View>
                  ) : null}
                  <View style={{ maxWidth: "78%" }}>
                    {/* Étiquette de rôle au-dessus de la bulle */}
                    <View
                      style={[
                        styles.roleTag,
                        isMine
                          ? { alignSelf: "flex-end" }
                          : { alignSelf: "flex-start" },
                        { backgroundColor: meta.color + "1A" },
                      ]}
                    >
                      <TText
                        variant="label"
                        weight="bold"
                        style={{ fontSize: 10, color: meta.color }}
                      >
                        {meta.emoji} {meta.label}
                        {m.author_name &&
                        m.author_name !== meta.label
                          ? ` · ${m.author_name}`
                          : ""}
                      </TText>
                    </View>
                    <View
                      style={[
                        styles.bubble,
                        isMine
                          ? {
                              backgroundColor: meta.bg,
                              borderTopRightRadius: 4,
                            }
                          : [
                              styles.bubbleOther,
                              {
                                backgroundColor: colors.neutrals.surface,
                                borderColor: colors.neutrals.border,
                              },
                            ],
                      ]}
                    >
                      <TText
                        color={isMine ? "white" : colors.neutrals.textPrimary}
                      >
                        {m.content}
                      </TText>
                      <TText
                        variant="label"
                        color={
                          isMine
                            ? "rgba(255,255,255,0.78)"
                            : colors.neutrals.textTertiary
                        }
                        style={{ marginTop: 4, fontSize: 10 }}
                      >
                        {formatTime(m.created_at)}
                      </TText>
                    </View>
                  </View>
                </View>
              );
            })
          )}
          {err ? (
            <TText
              variant="caption"
              color={colors.status.error}
              align="center"
              style={{ marginTop: 12 }}
            >
              {err}
            </TText>
          ) : null}
        </ScrollView>

        {/* ===== Composer ===== */}
        <View
          style={[
            styles.composer,
            {
              borderTopColor: colors.neutrals.border,
              backgroundColor: colors.neutrals.surface,
              paddingBottom: Platform.OS === "ios" ? 22 : 10,
            },
          ]}
        >
          <TextInput
            testID="chat-input"
            value={text}
            onChangeText={setText}
            placeholder="Écrire un message…"
            placeholderTextColor={colors.neutrals.textTertiary}
            multiline
            style={[
              styles.input,
              {
                backgroundColor: colors.neutrals.background,
                borderColor: colors.neutrals.border,
                color: colors.neutrals.textPrimary,
              },
            ]}
            editable={!sending}
          />
          <TouchableOpacity
            testID="chat-send"
            onPress={send}
            disabled={sending || !text.trim()}
            style={[
              styles.sendBtn,
              { backgroundColor: myMeta.bg },
              (!text.trim() || sending) && { opacity: 0.4 },
            ]}
          >
            {sending ? (
              <ActivityIndicator color="white" />
            ) : (
              <Ionicons name="send" size={18} color="white" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Pilule discrète montrant l'identité de chaque participant en haut de l'écran. */
function ParticipantPill({
  role,
  name,
  active,
}: {
  role: "sender" | "agent" | "beneficiary";
  name?: string;
  active?: boolean;
}) {
  const meta = ROLE_META[role];
  return (
    <View
      style={[
        pillStyles.pill,
        {
          backgroundColor: meta.color + (active ? "22" : "0F"),
          borderColor: active ? meta.color : "transparent",
        },
      ]}
    >
      <TText style={{ fontSize: 12 }}>{meta.emoji}</TText>
      <View style={{ marginLeft: 6, flex: 1 }}>
        <TText
          variant="label"
          weight="bold"
          style={{ fontSize: 10, color: meta.color }}
          numberOfLines={1}
        >
          {meta.label}
          {active ? " (vous)" : ""}
        </TText>
        <TText variant="label" style={{ fontSize: 10 }} numberOfLines={1}>
          {name || "—"}
        </TText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 6, marginRight: 4 },
  callBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#10B981",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
  },
  pillsRow: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  empty: { alignItems: "center", padding: 40, marginTop: 40 },
  msgRow: {
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "flex-end",
  },
  msgRowMine: { justifyContent: "flex-end", alignSelf: "flex-end" },
  msgRowOther: { justifyContent: "flex-start", alignSelf: "flex-start" },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    marginBottom: 18,
  },
  roleTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    marginBottom: 4,
  },
  bubble: { padding: 10, borderRadius: radii.lg },
  bubbleOther: {
    borderTopLeftRadius: 4,
    borderTopRightRadius: radii.lg,
    borderWidth: 1,
  },
  composer: {
    flexDirection: "row",
    padding: 10,
    borderTopWidth: 1,
    gap: 8,
    alignItems: "flex-end",
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 14,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});

const pillStyles = StyleSheet.create({
  pill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    borderRadius: radii.md,
    borderWidth: 1,
  },
});
