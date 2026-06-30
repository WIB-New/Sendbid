import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, TouchableOpacity, Animated, Easing, Alert, Modal, TextInput, Platform, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { TText } from "../../src/components/TText";
import { Button } from "../../src/components/Button";
import { api, apiError } from "../../src/api";
import { paybidColors } from "../../src/paybidTheme";
import { spacing, radii } from "../../src/theme";
import { useTranslation } from "../../src/i18n";

/**
 * PAYBID Scanner universel — 3 opérations :
 * 1. Remise transfert (bénéficiaire)
 * 2. Recharge wallet (dépôt espèces → crédit wallet client)
 * 3. Retrait wallet (débit wallet client → remise espèces)
 */

const QR_TYPE_CONFIG: Record<string, { icon: string; color: string; label: string; desc: string }> = {
  transfer: { icon: "swap-horizontal", color: "#2563EB", label: "Remise transfert", desc: "Remettez les espèces au bénéficiaire" },
  recharge: { icon: "arrow-down-circle", color: "#10B981", label: "Recharge wallet", desc: "Le client vous donne des espèces → son wallet est crédité" },
  withdraw: { icon: "arrow-up-circle", color: "#F59E0B", label: "Retrait espèces", desc: "Vous remettez les espèces au client → son wallet est débité" },
};

export default function PaybidScan() {
  const { t } = useTranslation();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [manualOpen, setManualOpen] = useState(false);
  const [code, setCode] = useState("");
  const [scanning, setScanning] = useState(true);
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const scannedRef = useRef(false);
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

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (!scanning || scannedRef.current) return;
    scannedRef.current = true;
    submit(data);
  };

  const submit = async (input: string) => {
    setScanning(false);
    try {
      const { data } = await api.post("/agent/scan-qr", { code: input.trim() });
      setResult({ ok: true, raw_code: input.trim(), ...data });
    } catch (e: any) {
      setResult({ ok: false, error: apiError(e) });
    }
    setManualOpen(false);
    setCode("");
  };

  const reset = () => { setResult(null); setScanning(true); scannedRef.current = false; };

  // ── Actions selon le type ──────────────────────────────────────────────
  const confirmTransfer = async () => {
    if (!result?.transfer_id) return;
    setBusy(true);
    try {
      const { data } = await api.post(`/agent/transfers/${result.transfer_id}/complete`, { code: result.raw_code });
      Alert.alert("Remise confirmée", `Vous avez gagné +${Number(data.earned_eur).toFixed(2)} EUR`);
      reset(); router.replace("/paybid/(tabs)" as any);
    } catch (e: any) { Alert.alert("Erreur", apiError(e)); } finally { setBusy(false); }
  };

  const confirmRecharge = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/wallet/recharge-confirm", { qr_token: result.raw_code });
      Alert.alert("Recharge confirmée", `${data.amount.toFixed(2)} ${data.currency || "EUR"} crédités au client.\nNouveau solde client : ${data.new_balance.toFixed(2)} ${data.currency || "EUR"}`);
      reset(); router.replace("/paybid/(tabs)" as any);
    } catch (e: any) { Alert.alert("Erreur", apiError(e)); } finally { setBusy(false); }
  };

  const confirmWithdraw = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/wallet/withdraw-confirm", { qr_token: result.raw_code });
      Alert.alert("Retrait confirmé", `${data.amount.toFixed(2)} ${data.currency || "EUR"} débités du wallet client.\nRemettez les espèces au client.`);
      reset(); router.replace("/paybid/(tabs)" as any);
    } catch (e: any) { Alert.alert("Erreur", apiError(e)); } finally { setBusy(false); }
  };

  const translateY = lineY.interpolate({ inputRange: [0, 1], outputRange: [0, 220] });
  const qrType = result?.qr_type || "";
  const cfg = QR_TYPE_CONFIG[qrType] || QR_TYPE_CONFIG.transfer;

  // ── Écran permission caméra ──────────────────────────────────────────────
  if (!permission) {
    return <View style={{ flex: 1, backgroundColor: paybidColors.neutrals.background }} />;
  }
  if (!permission.granted) {
    return (
      <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: paybidColors.neutrals.background }}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={paybidColors.neutrals.textPrimary} />
          </TouchableOpacity>
          <TText variant="title" weight="extraBold" style={{ flex: 1 }}>Scanner client</TText>
        </View>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.xl }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: paybidColors.primary.base + "15", alignItems: "center", justifyContent: "center", marginBottom: spacing.lg }}>
            <Ionicons name="camera-outline" size={40} color={paybidColors.primary.base} />
          </View>
          <TText variant="subtitle" weight="extraBold" align="center" style={{ marginBottom: spacing.sm }}>Accès caméra requis</TText>
          <TText variant="caption" color={paybidColors.neutrals.textSecondary} align="center" style={{ marginBottom: spacing.xl }}>
            L'application a besoin d'accéder à votre caméra pour scanner les QR codes des clients.
          </TText>
          <Button title="Autoriser la caméra" icon="camera" onPress={requestPermission} style={{ backgroundColor: paybidColors.primary.base, width: "100%" }} />
          <TouchableOpacity onPress={() => setManualOpen(true)} style={{ marginTop: spacing.md }}>
            <TText color={paybidColors.primary.base} weight="semiBold">Saisir le code manuellement</TText>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      {/* Caméra plein écran */}
      {scanning ? (
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={handleBarCodeScanned}
        />
      ) : null}

      {/* Overlay sombre autour du cadre */}
      <View style={styles.overlay} pointerEvents="none">
        <View style={styles.overlayTop} />
        <View style={styles.overlayMiddle}>
          <View style={styles.overlaySide} />
          <View style={styles.scanWindow}>
            {/* Coins du cadre */}
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
            {/* Ligne de scan animée */}
            {scanning ? (
              <Animated.View style={[styles.scanLine, { transform: [{ translateY: lineY.interpolate({ inputRange: [0, 1], outputRange: [0, 220] }) }] }]} />
            ) : null}
          </View>
          <View style={styles.overlaySide} />
        </View>
        <View style={styles.overlayBottom} />
      </View>

      {/* Header transparent sur la caméra */}
      <SafeAreaView edges={["top"]} style={styles.cameraHeader}>
        <TouchableOpacity onPress={() => router.back()} style={styles.cameraBackBtn}>
          <Ionicons name="chevron-back" size={24} color="white" />
        </TouchableOpacity>
        <TText variant="title" weight="extraBold" color="white" style={{ flex: 1 }}>Scanner client</TText>
      </SafeAreaView>

      {/* Texte sous le cadre */}
      <View style={styles.cameraHintRow} pointerEvents="none">
        <TText variant="caption" color="white" align="center">Tenez le QR code du client à l'intérieur du cadre</TText>
      </View>

      {/* Boutons en bas */}
      <SafeAreaView edges={["bottom"]} style={styles.cameraBottomBar}>
        <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
          <Button
            testID="paybid-scan-manual"
            title="Saisir le code"
            icon="keypad-outline"
            onPress={() => setManualOpen(true)}
            style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.18)", borderWidth: 1, borderColor: "rgba(255,255,255,0.4)" }}
          />
          <Button
            testID="paybid-scan-guide"
            title="Aide"
            icon="information-circle-outline"
            variant="ghost"
            onPress={() => Alert.alert(
              "Opérations supportées",
              "• Transfert espèces : QR du client SendBID\n• Recharge wallet : QR de dépôt espèces\n• Retrait wallet : QR de retrait espèces"
            )}
            style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.18)", borderWidth: 1, borderColor: "rgba(255,255,255,0.4)" }}
          />
        </View>
      </SafeAreaView>

      {/* ── Result modal ── */}
      <Modal visible={!!result} transparent animationType="fade" onRequestClose={reset}>
        <TouchableOpacity style={styles.modalBg} activeOpacity={1} onPress={reset}>
          <View style={[styles.resultCard, !result?.ok && { borderColor: paybidColors.status.error }, result?.ok && { borderColor: cfg.color }]}>
            <View style={[styles.resultIcon, { backgroundColor: result?.ok ? cfg.color + "15" : paybidColors.overlays.errorSoft }]}>
              <Ionicons name={result?.ok ? (cfg.icon as any) : "close-circle"} size={48} color={result?.ok ? cfg.color : paybidColors.status.error} />
            </View>
            <TText variant="title" weight="extraBold" align="center" style={{ marginTop: spacing.md }}>
              {!result?.ok ? "Échec de validation" : cfg.label}
            </TText>

            {result?.ok && qrType === "transfer" ? (
              <View style={{ width: "100%", marginTop: spacing.md }}>
                <Row label="Bénéficiaire" value={result.beneficiary?.full_name || "—"} />
                <Row label="Montant à remettre" value={`${Number(result.receive_amount || 0).toLocaleString("fr-FR")} ${result.destination_currency || ""}`} bold />
                <Row label="Mode" value={`${(result.delivery_mode || "").toUpperCase()}${result.vip_delivery ? " · VIP" : ""}`} />
                <Row label="Statut" value={result.status || "—"} />
              </View>
            ) : null}

            {result?.ok && (qrType === "recharge" || qrType === "withdraw") ? (
              <View style={{ width: "100%", marginTop: spacing.md }}>
                <Row label="Client" value={result.client_name || "—"} />
                <Row label="Téléphone" value={result.client_phone || "—"} />
                <Row label="ID profil" value={result.profile_id || "—"} />
                <Row label="Montant" value={`${Number(result.amount || 0).toFixed(2)} ${result.currency || "EUR"}`} bold />
                <View style={[styles.tipBox, { backgroundColor: cfg.color + "10", borderColor: cfg.color + "40" }]}>
                  <Ionicons name="information-circle" size={16} color={cfg.color} />
                  <TText variant="caption" color={cfg.color} style={{ marginLeft: 6, flex: 1 }}>{cfg.desc}</TText>
                </View>
              </View>
            ) : null}

            {!result?.ok ? (
              <TText color={paybidColors.status.error} align="center" style={{ marginTop: spacing.md }}>
                {result?.error}
              </TText>
            ) : null}

            <View style={{ flexDirection: "row", gap: 8, marginTop: spacing.lg, width: "100%" }}>
              <Button title="Re-scanner" variant="outline" onPress={reset} style={{ flex: 1, borderColor: paybidColors.primary.base }} textStyle={{ color: paybidColors.primary.base } as any} />
              {result?.ok && qrType === "transfer" ? (
                <Button title="Confirmer remise" icon="checkmark" onPress={confirmTransfer} loading={busy} style={{ flex: 1, backgroundColor: "#2563EB" }} />
              ) : null}
              {result?.ok && qrType === "recharge" ? (
                <Button title="Confirmer recharge" icon="arrow-down-circle" onPress={confirmRecharge} loading={busy} style={{ flex: 1, backgroundColor: "#10B981" }} />
              ) : null}
              {result?.ok && qrType === "withdraw" ? (
                <Button title="Confirmer retrait" icon="arrow-up-circle" onPress={confirmWithdraw} loading={busy} style={{ flex: 1, backgroundColor: "#F59E0B" }} />
              ) : null}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Manual input ── */}
      <Modal visible={manualOpen} transparent animationType="slide" onRequestClose={() => setManualOpen(false)}>
        <TouchableOpacity style={styles.modalBg} activeOpacity={1} onPress={() => setManualOpen(false)}>
          <View style={styles.sheet}>
            <TText variant="subtitle" weight="bold">Saisir le code</TText>
            <TText variant="caption" color={paybidColors.neutrals.textSecondary} style={{ marginBottom: spacing.md }}>
              Code à 10 chiffres ou jeton QR copié
            </TText>
            <TextInput
              testID="paybid-scan-code" value={code} onChangeText={setCode}
              keyboardType={Platform.OS === "web" ? "default" : "number-pad"}
              maxLength={200} placeholder="Code ou QR token" style={styles.codeInput}
            />
            <Button testID="paybid-scan-submit" title="Vérifier" onPress={() => submit(code)} disabled={code.trim().length < 6} style={{ backgroundColor: paybidColors.primary.base }} />
            <TouchableOpacity onPress={() => setManualOpen(false)} style={{ alignSelf: "center", marginTop: 8 }}>
              <TText color={paybidColors.neutrals.textSecondary}>Annuler</TText>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
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
  codeInput: { backgroundColor: paybidColors.neutrals.background, borderRadius: radii.lg, borderWidth: 1, borderColor: paybidColors.neutrals.border, padding: 14, marginBottom: spacing.md, fontSize: 18, letterSpacing: 2, textAlign: "center", fontFamily: "monospace" },
  guideRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
  guideIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  tipBox: { flexDirection: "row", alignItems: "center", padding: 10, borderRadius: radii.lg, borderWidth: 1, marginTop: 10 },
  overlay: { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 },
  overlayTop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
  overlayMiddle: { flexDirection: "row", height: 260 },
  overlaySide: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
  scanWindow: { width: 260, height: 260, position: "relative" },
  overlayBottom: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
  cameraHeader: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  cameraBackBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center", marginRight: 8 },
  cameraHintRow: { position: "absolute", left: 0, right: 0, top: "58%", alignItems: "center", paddingHorizontal: spacing.xl },
  cameraBottomBar: { position: "absolute", bottom: 0, left: 0, right: 0 },
});
