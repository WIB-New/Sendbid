import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, TouchableOpacity, Animated, Easing, Alert, Modal, TextInput, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { TText } from "../../src/components/TText";
import { Button } from "../../src/components/Button";
import { api, apiError } from "../../src/api";
import { paybidColors } from "../../src/paybidTheme";
import { spacing, radii } from "../../src/theme";

/**
 * PAYBID Scanner — agent-side QR/code validator + complete payout.
 * 1. Validates the client's 10-digit withdrawal code (or signed qr_token)
 *    via POST /api/transfers/validate-code.
 * 2. Shows transfer details + lets the agent "Confirmer remise" which calls
 *    POST /api/agent/transfers/{id}/complete and credits commission.
 */
export default function PaybidScan() {
  const router = useRouter();
  const [manualOpen, setManualOpen] = useState(false);
  const [code, setCode] = useState("");
  const [scanning, setScanning] = useState(true);
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const lineY = useRef(new Animated.Value(0)).current;

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
      const { data } = await api.post("/transfers/validate-code", { code: input.trim() });
      setResult({ ok: true, code: input.trim(), ...data });
    } catch (e: any) {
      setResult({ ok: false, error: apiError(e) });
    }
    setManualOpen(false);
    setCode("");
  };

  const reset = () => { setResult(null); setScanning(true); };

  const completePayout = async () => {
    if (!result?.id) return;
    setBusy(true);
    try {
      const { data } = await api.post(`/agent/transfers/${result.id}/complete`, { code: result.code });
      Alert.alert("Remise confirmée", `Vous avez gagné +${Number(data.earned_eur).toFixed(2)} EUR`);
      reset();
      router.replace("/paybid/(tabs)" as any);
    } catch (e: any) {
      Alert.alert("Erreur", apiError(e));
    } finally {
      setBusy(false);
    }
  };

  const translateY = lineY.interpolate({ inputRange: [0, 1], outputRange: [0, 220] });

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: paybidColors.neutrals.background }}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={paybidColors.neutrals.textPrimary} />
        </TouchableOpacity>
        <TText variant="title" weight="extraBold" style={{ flex: 1 }}>Scanner client</TText>
      </View>

      <View style={{ paddingHorizontal: spacing.lg }}>
        <LinearGradient colors={paybidColors.gradients.main} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.bannerRow}>
          <View style={styles.bannerIcon}><Ionicons name="qr-code" size={20} color="white" /></View>
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <TText weight="extraBold" color="white">PAYBID — Validation remise</TText>
            <TText variant="caption" color="rgba(255,255,255,0.9)">Scannez le QR ou saisissez le code à 10 chiffres</TText>
          </View>
        </LinearGradient>

        <View style={styles.scanFrame}>
          <View style={styles.frameCorner} pointerEvents="none">
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
          {scanning ? (<Animated.View style={[styles.scanLine, { transform: [{ translateY }] }]} />) : null}
          <Ionicons name="qr-code-outline" size={120} color="rgba(255,255,255,0.18)" />
        </View>

        <TText variant="caption" color={paybidColors.neutrals.textSecondary} align="center" style={{ marginTop: spacing.md }}>
          Tenez le QR client à l'intérieur du cadre
        </TText>

        <View style={{ flexDirection: "row", gap: 8, marginTop: spacing.lg }}>
          <Button testID="paybid-scan-manual" title="Saisir le code" icon="keypad-outline" variant="outline" style={{ flex: 1, borderColor: paybidColors.primary.base }} textStyle={{ color: paybidColors.primary.base } as any} onPress={() => setManualOpen(true)} />
          <Button testID="paybid-scan-flash" title="Lampe" icon="flashlight-outline" variant="ghost" style={{ flex: 1 }} onPress={() => Alert.alert("Lampe", "Disponible en build natif")} />
        </View>
      </View>

      {/* Result */}
      <Modal visible={!!result} transparent animationType="fade" onRequestClose={reset}>
        <View style={styles.modalBg}>
          <View style={[styles.resultCard, !result?.ok && { borderColor: paybidColors.status.error }]}>
            <View style={[styles.resultIcon, { backgroundColor: result?.ok ? paybidColors.overlays.successSoft : paybidColors.overlays.errorSoft }]}>
              <Ionicons name={result?.ok ? "checkmark-circle" : "close-circle"} size={48} color={result?.ok ? paybidColors.status.success : paybidColors.status.error} />
            </View>
            <TText variant="title" weight="extraBold" align="center" style={{ marginTop: spacing.md }}>
              {result?.ok ? "Code validé" : "Échec de validation"}
            </TText>
            {result?.ok ? (
              <View style={{ width: "100%", marginTop: spacing.md }}>
                <Row label="Bénéficiaire" value={result.beneficiary?.full_name || "—"} />
                <Row label="Pays" value={result.destination_country || "—"} />
                <Row label="Montant à remettre" value={`${result.receive_amount?.toFixed?.(0) || "—"} ${result.destination_currency || ""}`} bold />
                <Row label="Mode" value={`${(result.delivery_mode || "").toUpperCase()}${result.vip_delivery ? " · VIP" : ""}`} />
                <Row label="Statut" value={result.status || "—"} />
              </View>
            ) : (
              <TText color={paybidColors.status.error} align="center" style={{ marginTop: spacing.md }}>
                {result?.error}
              </TText>
            )}
            <View style={{ flexDirection: "row", gap: 8, marginTop: spacing.lg, width: "100%" }}>
              <Button title="Re-scanner" variant="outline" onPress={reset} style={{ flex: 1, borderColor: paybidColors.primary.base }} textStyle={{ color: paybidColors.primary.base } as any} />
              {result?.ok ? (
                <Button title="Confirmer remise" icon="checkmark" onPress={completePayout} loading={busy} style={{ flex: 1, backgroundColor: paybidColors.status.success }} />
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
            <TText variant="caption" color={paybidColors.neutrals.textSecondary} style={{ marginBottom: spacing.md }}>
              Code à 10 chiffres fourni par le client
            </TText>
            <TextInput
              testID="paybid-scan-code" value={code} onChangeText={setCode}
              keyboardType={Platform.OS === "web" ? "default" : "number-pad"}
              maxLength={10} placeholder="XXXXXXXXXX" style={styles.codeInput}
            />
            <Button testID="paybid-scan-submit" title="Vérifier" onPress={() => submit(code)} disabled={code.trim().length < 6} style={{ backgroundColor: paybidColors.primary.base }} />
            <TouchableOpacity onPress={() => setManualOpen(false)} style={{ alignSelf: "center", marginTop: 8 }}>
              <TText color={paybidColors.neutrals.textSecondary}>Annuler</TText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: paybidColors.neutrals.border }}>
      <TText variant="caption" color={paybidColors.neutrals.textSecondary}>{label}</TText>
      <TText variant="caption" weight={bold ? "extraBold" : "semiBold"} color={bold ? paybidColors.primary.base : paybidColors.neutrals.textPrimary}>{value}</TText>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", padding: spacing.lg },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", marginRight: 4 },
  bannerRow: { flexDirection: "row", alignItems: "center", padding: spacing.md, borderRadius: radii.xl },
  bannerIcon: { width: 40, height: 40, borderRadius: radii.full, backgroundColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center" },
  scanFrame: { height: 280, marginTop: spacing.lg, borderRadius: radii.xxl, backgroundColor: "#1A0E06", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  frameCorner: { ...StyleSheet.absoluteFillObject, padding: 24 },
  corner: { position: "absolute", width: 32, height: 32, borderColor: paybidColors.primary.light },
  cornerTL: { top: 24, left: 24, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 12 },
  cornerTR: { top: 24, right: 24, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 12 },
  cornerBL: { bottom: 24, left: 24, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 12 },
  cornerBR: { bottom: 24, right: 24, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 12 },
  scanLine: { position: "absolute", left: 32, right: 32, height: 2, backgroundColor: paybidColors.primary.light, top: 32, opacity: 0.85 },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", alignItems: "center", padding: spacing.lg },
  resultCard: { backgroundColor: "white", padding: spacing.lg, borderRadius: radii.xxl, alignItems: "center", width: "100%", maxWidth: 360, borderWidth: 2, borderColor: paybidColors.status.success },
  resultIcon: { width: 72, height: 72, borderRadius: radii.full, alignItems: "center", justifyContent: "center" },
  sheet: { width: "100%", maxWidth: 420, backgroundColor: "white", padding: spacing.lg, borderRadius: radii.xxl },
  codeInput: { backgroundColor: paybidColors.neutrals.background, borderRadius: radii.lg, borderWidth: 1, borderColor: paybidColors.neutrals.border, padding: 14, marginBottom: spacing.md, fontSize: 22, letterSpacing: 6, textAlign: "center", fontFamily: "monospace" },
});
