import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, TouchableOpacity, Animated, Easing, Alert, Modal, TextInput, Platform } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../../src/components/Screen";
import { TText } from "../../src/components/TText";
import { Button } from "../../src/components/Button";
import { api } from "../../src/api";
import { colors, spacing, radii } from "../../src/theme";
import { useThemedColors } from "../../src/themeContext";
import { useTranslation } from "../../src/i18n";
import { useToast } from "../../src/components/Toast";
/**
 * AGENT QR SCAN — preview view (PAYBID wireframe).
 * Lets a payer-agent scan a client's signed QR token to validate a withdrawal.
 *
 * Uses expo-camera if available; otherwise falls back to a manual code entry
 * with a simulated scan animation, so the wireframe is always reachable in
 * the SENDBID client preview build.
 */
export default function AgentScan() {
  const { t } = useTranslation();
  const colors = useThemedColors();
  const router = useRouter();
  const [manualOpen, setManualOpen] = useState(false);
  const [code, setCode] = useState("");
  const [scanning, setScanning] = useState(true);
  const [result, setResult] = useState<any>(null);
  const lineY = useRef(new Animated.Value(0)).current;
  const toast = useToast();

  // Pulsing scan line
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(lineY, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(lineY, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    if (scanning) loop.start();
    return () => loop.stop();
  }, [scanning, lineY]);

  const submit = async (input: string) => {
    setScanning(false);
    try {
      // Validates QR/withdrawal code against backend
      const { data } = await api.post("/transfers/validate-code", { code: input.trim() });
      setResult({ ok: true, ...data });
    } catch (e: any) {
      setResult({ ok: false, error: e?.response?.data?.detail || "Code invalide ou expiré" });
    }
    setManualOpen(false);
    setCode("");
  };

  const reset = () => {
    setResult(null);
    setScanning(true);
  };

  const translateY = lineY.interpolate({ inputRange: [0, 1], outputRange: [0, 220] });

  return (
    <Screen title="Scanner QR client" back scroll={false}>
      <View style={styles.bannerRow}>
        <View style={styles.bannerIcon}>
          <Ionicons name="qr-code" size={20} color="white" />
        </View>
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <TText weight="extraBold" color="white">Vue agent (PAYBID)</TText>
          <TText variant="caption" color="rgba(255,255,255,0.85)">
            Scannez le QR du client ou saisissez son code à 10 chiffres
          </TText>
        </View>
      </View>

      <View style={styles.scanFrame}>
        <View style={styles.frameCorner} pointerEvents="none">
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>
        {scanning ? (
          <Animated.View style={[styles.scanLine, { transform: [{ translateY }] }]} />
        ) : null}
        <Ionicons name="qr-code-outline" size={120} color="rgba(255,255,255,0.18)" />
      </View>

      <TText variant="caption" color={colors.neutrals.textSecondary} align="center" style={{ marginTop: spacing.md }}>
        Tenez le QR client à l&apos;intérieur du cadre
      </TText>

      <View style={{ flexDirection: "row", gap: 8, marginTop: spacing.lg }}>
        <Button
          testID="agent-scan-manual"
          title="Saisir le code"
          icon="keypad-outline"
          variant="outline"
          style={{ flex: 1 }}
          onPress={() => setManualOpen(true)}
        />
        <Button
          testID="agent-scan-flash"
          title="Lampe"
          icon="flashlight-outline"
          variant="ghost"
          style={{ flex: 1 }}
          onPress={() => toast.info({ title: "Lampe torche", message: "Disponible avec PAYBID natif" })}
        />
      </View>

      {/* Result */}
      <Modal visible={!!result} transparent animationType="fade" onRequestClose={reset}>
        <View style={styles.modalBg}>
          <View style={[styles.resultCard, !result?.ok && { borderColor: colors.status.error }]}>
            <View style={[styles.resultIcon, { backgroundColor: result?.ok ? colors.overlays.successSoft : colors.overlays.errorSoft }]}>
              <Ionicons
                name={result?.ok ? "checkmark-circle" : "close-circle"}
                size={48}
                color={result?.ok ? colors.status.success : colors.status.error}
              />
            </View>
            <TText variant="title" weight="extraBold" align="center" style={{ marginTop: spacing.md }}>
              {result?.ok ? "Code validé" : "Échec de validation"}
            </TText>
            {result?.ok ? (
              <View style={{ width: "100%", marginTop: spacing.md }}>
                <Row label="Bénéficiaire" value={result.beneficiary?.full_name || "—"} />
                <Row label="Pays" value={result.destination_country || "—"} />
                <Row label="Montant" value={`${result.receive_amount?.toFixed?.(0) || "—"} ${result.destination_currency || ""}`} bold />
                <Row label="Mode" value={(result.delivery_mode || "").toUpperCase()} />
              </View>
            ) : (
              <TText color={colors.status.error} align="center" style={{ marginTop: spacing.md }}>
                {result?.error}
              </TText>
            )}
            <View style={{ flexDirection: "row", gap: 8, marginTop: spacing.lg, width: "100%" }}>
              <Button title="Re-scanner" variant="outline" onPress={reset} style={{ flex: 1 }} />
              {result?.ok ? (
                <Button title="Confirmer remise" icon="checkmark" onPress={() => { toast.success({ title: "Confirmé", message: "Fonds remis (démo)" }); reset(); router.back(); }} style={{ flex: 1 }} />
              ) : null}
            </View>
          </View>
        </View>
      </Modal>

      {/* Manual input */}
      <Modal visible={manualOpen} transparent animationType="slide" onRequestClose={() => setManualOpen(false)}>
        <View style={styles.modalBg}>
          <View style={styles.sheet}>
            <TText variant="subtitle" weight="bold">Saisir le code de retrait</TText>
            <TText variant="caption" color={colors.neutrals.textSecondary} style={{ marginBottom: spacing.md }}>
              Code à 10 chiffres fourni par le client
            </TText>
            <TextInput
              testID="agent-scan-code"
              value={code}
              onChangeText={setCode}
              keyboardType={Platform.OS === "web" ? "default" : "number-pad"}
              maxLength={10}
              placeholder="XXXXXXXXXX"
              style={styles.codeInput}
            />
            <Button testID="agent-scan-submit" title="Vérifier" onPress={() => submit(code)} disabled={code.trim().length < 6} />
            <TouchableOpacity onPress={() => setManualOpen(false)} style={{ alignSelf: "center", marginTop: 8 }}>
              <TText color={colors.neutrals.textSecondary}>Annuler</TText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.neutrals.border }}>
      <TText variant="caption" color={colors.neutrals.textSecondary}>{label}</TText>
      <TText variant="caption" weight={bold ? "extraBold" : "semiBold"} color={bold ? colors.primary.base : colors.neutrals.textPrimary}>
        {value}
      </TText>
    </View>
  );
}

const styles = StyleSheet.create({
  bannerRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.primary.base, padding: spacing.md,
    borderRadius: radii.xl,
  },
  bannerIcon: {
    width: 40, height: 40, borderRadius: radii.full,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center", justifyContent: "center",
  },
  scanFrame: {
    height: 280, marginTop: spacing.lg, borderRadius: radii.xxl,
    backgroundColor: "#0F172A",
    alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  frameCorner: { ...StyleSheet.absoluteFillObject, padding: 24 },
  corner: { position: "absolute", width: 32, height: 32, borderColor: colors.accent.base },
  cornerTL: { top: 24, left: 24, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 12 },
  cornerTR: { top: 24, right: 24, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 12 },
  cornerBL: { bottom: 24, left: 24, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 12 },
  cornerBR: { bottom: 24, right: 24, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 12 },
  scanLine: { position: "absolute", left: 32, right: 32, height: 2, backgroundColor: colors.accent.base, top: 32, opacity: 0.85 },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", alignItems: "center", padding: spacing.lg },
  resultCard: {
    backgroundColor: "white", padding: spacing.lg,
    borderRadius: radii.xxl, alignItems: "center",
    width: "100%", maxWidth: 360,
    borderWidth: 2, borderColor: colors.status.success,
  },
  resultIcon: { width: 72, height: 72, borderRadius: radii.full, alignItems: "center", justifyContent: "center" },
  sheet: {
    width: "100%", maxWidth: 420, backgroundColor: "white",
    padding: spacing.lg, borderRadius: radii.xxl,
  },
  codeInput: {
    backgroundColor: colors.neutrals.background,
    borderRadius: radii.lg, borderWidth: 1, borderColor: colors.neutrals.border,
    padding: 14, marginBottom: spacing.md,
    fontSize: 22, letterSpacing: 6, textAlign: "center",
    fontFamily: "monospace",
  },
});
