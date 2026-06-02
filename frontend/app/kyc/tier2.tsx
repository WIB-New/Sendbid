import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, Alert, Modal, Platform, ActivityIndicator, TouchableOpacity, Linking } from "react-native";
import { useRouter } from "expo-router";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../../src/components/Screen";
import { TText } from "../../src/components/TText";
import { Button } from "../../src/components/Button";
import { Card } from "../../src/components/Card";
import { api, apiError } from "../../src/api";
import { useAuth } from "../../src/store";
import { colors, spacing, radii } from "../../src/theme";
import { useThemedColors } from "../../src/themeContext";
type Session = {
  session_id: string;
  verification_url: string;
  status: string;
  provider: "didit" | "mock";
};

export default function KycTier2() {
  const colors = useThemedColors();
  const router = useRouter();
  const refreshMe = useAuth((s) => s.refreshMe);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [polling, setPolling] = useState(false);
  const pollTimer = useRef<any>(null);

  useEffect(() => () => {
    if (pollTimer.current) clearTimeout(pollTimer.current);
  }, []);

  const start = async () => {
    setError(null);
    setLoading(true);
    try {
      const { data } = await api.post("/kyc/tier2/start");
      setSession(data);
      setOpen(true);
    } catch (e: any) {
      setError(apiError(e));
    } finally {
      setLoading(false);
    }
  };

  const pollStatus = async (sid: string, attempts = 0) => {
    if (attempts > 30) {
      setPolling(false);
      setError("Vérification non aboutie. Réessayez plus tard.");
      return;
    }
    try {
      const { data } = await api.get(`/kyc/tier2/status/${sid}`);
      if (data.approved && data.promoted !== undefined) {
        setPolling(false);
        await refreshMe();
        Alert.alert(
          "KYC validé ✓",
          "Niveau Gold débloqué !",
          [{ text: "OK", onPress: () => router.back() }],
        );
        return;
      }
      const status = (data.status || "").toLowerCase();
      if (["declined", "expired", "rejected"].includes(status)) {
        setPolling(false);
        setError(`Vérification refusée (${data.status})`);
        return;
      }
    } catch {
      // transient
    }
    pollTimer.current = setTimeout(() => pollStatus(sid, attempts + 1), 3000);
  };

  const completeMockOrPoll = async () => {
    if (!session) return;
    if (session.provider === "mock") {
      // Local stub flow (kept so demos work without Didit creds)
      try {
        await api.post("/kyc/tier2/complete", { session_id: session.session_id });
        await refreshMe();
        setOpen(false);
        Alert.alert("KYC validé", "Niveau Gold débloqué !", [{ text: "OK", onPress: () => router.back() }]);
      } catch (e: any) {
        setError(apiError(e));
      }
      return;
    }
    setPolling(true);
    pollStatus(session.session_id);
  };

  const onWebViewNavChange = (event: { url: string }) => {
    if (!session) return;
    const u = event.url || "";
    // Didit redirects to its own /complete page on success/cancel.
    // We don't have a strict redirect URL, so we trigger polling whenever
    // the user navigates back to a page that looks "post-flow" or closes.
    if (u.includes("/complete") || u.includes("/success") || u.includes("/cancel")) {
      setOpen(false);
      if (!u.includes("/cancel")) {
        setPolling(true);
        pollStatus(session.session_id);
      }
    }
  };

  return (
    <Screen title="KYC Tier 2 — Didit" back hero>
      <Card>
        <View style={{ alignItems: "center" }}>
          <View style={styles.iconBox}>
            <Ionicons name="scan-outline" size={36} color={colors.primary.base} />
          </View>
          <TText variant="subtitle" weight="bold" align="center" style={{ marginTop: 12 }}>
            Vérification d'identité avancée
          </TText>
          <TText variant="caption" color={colors.neutrals.textSecondary} align="center" style={{ marginTop: 4 }}>
            Scan de votre pièce d'identité + selfie via Didit. Limites étendues à 10 000 €/mois.
          </TText>
        </View>
      </Card>

      <View style={styles.steps}>
        <Step n={1} t="Scanner votre pièce d'identité" />
        <Step n={2} t="Photo selfie liveness" />
        <Step n={3} t="Validation automatique <2 min" />
      </View>

      {error ? <TText variant="caption" color={colors.status.error} style={{ marginBottom: 8 }}>{error}</TText> : null}

      <Button
        testID="kyc-tier2-start"
        title={polling ? "Vérification en cours…" : "Démarrer la vérification"}
        onPress={start}
        loading={loading || polling}
        icon="scan"
      />
      <TText variant="caption" color={colors.neutrals.textTertiary} align="center" style={{ marginTop: spacing.md }}>
        Powered by Didit • Conforme RGPD
      </TText>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "white" }}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setOpen(false)} style={{ padding: 8 }}>
              <Ionicons name="close" size={24} color={colors.neutrals.textPrimary} />
            </TouchableOpacity>
            <TText weight="bold" style={{ flex: 1, textAlign: "center" }}>
              {session?.provider === "mock" ? "Didit (mode démo)" : "Didit Verification"}
            </TText>
            <View style={{ width: 40 }} />
          </View>

          {session && session.provider === "didit" && Platform.OS !== "web" ? (
            <WebView
              source={{ uri: session.verification_url }}
              onNavigationStateChange={onWebViewNavChange}
              startInLoadingState
              renderLoading={() => (
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                  <ActivityIndicator color={colors.primary.base} />
                </View>
              )}
            />
          ) : (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl }}>
              <Ionicons name="scan-circle-outline" size={120} color={colors.primary.base} />
              <TText variant="subtitle" weight="bold" align="center" style={{ marginTop: spacing.md }}>
                {session?.provider === "mock" ? "Mode démo Didit" : "Ouvrez la vérification dans le navigateur"}
              </TText>
              <TText variant="caption" color={colors.neutrals.textSecondary} align="center" style={{ marginVertical: spacing.md }}>
                {session?.provider === "mock"
                  ? "Cliquez sur Valider pour simuler une vérification réussie."
                  : "La WebView n'est pas disponible sur ce canal — terminez la vérification dans votre navigateur puis revenez."}
              </TText>
              {session?.provider === "didit" && session?.verification_url ? (
                <Button
                  title="Ouvrir Didit"
                  icon="open-outline"
                  style={{ marginTop: 8 }}
                  onPress={() => Linking.openURL(session.verification_url)}
                />
              ) : null}
              <Button
                testID="kyc-tier2-complete"
                title={session?.provider === "mock" ? "Simuler la validation ✓" : "J'ai terminé — Vérifier le statut"}
                onPress={completeMockOrPoll}
                style={{ marginTop: 12 }}
              />
            </View>
          )}
        </View>
      </Modal>
    </Screen>
  );
}

function Step({ n, t }: { n: number; t: string }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepNum}>
        <TText weight="bold" color="white">{n}</TText>
      </View>
      <TText variant="body" weight="semiBold" style={{ marginLeft: 12 }}>{t}</TText>
    </View>
  );
}

const styles = StyleSheet.create({
  iconBox: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.overlays.primarySoft, alignItems: "center", justifyContent: "center" },
  steps: { marginVertical: spacing.lg },
  step: { flexDirection: "row", alignItems: "center", marginVertical: 6 },
  stepNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary.base, alignItems: "center", justifyContent: "center" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.neutrals.border },
});
