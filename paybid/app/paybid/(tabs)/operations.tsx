/**
 * /paybid/(tabs)/operations.tsx — Cash In / Cash Out agent
 * Scanner QR fonctionnel, double PIN (client + agent), historique.
 */
import React, { useCallback, useState, useRef } from "react";
import {
  View, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Alert, Modal, ActivityIndicator, RefreshControl, KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { TText } from "../../../src/components/TText";
import { Button } from "../../../src/components/Button";
import { api, apiError } from "../../../src/api";
import { paybidColors } from "../../../src/paybidTheme";
import { spacing, radii } from "../../../src/theme";

/* ─── helpers ─── */
const fmt = (n: number, cur = "EUR") =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: cur, maximumFractionDigits: 2 }).format(n);


/* ─── PIN Pad 6 chiffres ─── */
function PinPad({ label, sublabel, onDone, loading }: { label: string; sublabel?: string; onDone: (pin: string) => void; loading?: boolean }) {
  const [pin, setPin] = useState("");
  const press = (d: string) => {
    if (pin.length >= 6) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 6) { onDone(next); setPin(""); }
  };
  return (
    <View style={{ alignItems: "center", paddingVertical: spacing.lg }}>
      <TText variant="subtitle" weight="bold" align="center">{label}</TText>
      {sublabel && <TText variant="caption" color={paybidColors.neutrals.textSecondary} align="center" style={{ marginTop: 4 }}>{sublabel}</TText>}
      <View style={{ flexDirection: "row", gap: 12, marginTop: spacing.lg, marginBottom: spacing.md }}>
        {[0,1,2,3,4,5].map(i => (
          <View key={i} style={[styles.pinDot, { backgroundColor: i < pin.length ? paybidColors.primary.base : paybidColors.neutrals.border }]} />
        ))}
      </View>
      {loading ? <ActivityIndicator color={paybidColors.primary.base} style={{ marginTop: 16 }} /> : (
        <View style={styles.keypad}>
          {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((k, i) => (
            <TouchableOpacity key={i} style={styles.key}
              onPress={() => k === "⌫" ? setPin(p => p.slice(0,-1)) : k ? press(k) : null}
              disabled={!k} activeOpacity={0.6}>
              <TText variant="title" weight="bold" color={k ? paybidColors.neutrals.textPrimary : "transparent"}>{k}</TText>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

/* ─── Row historique ─── */
function OpRow({ op }: { op: any }) {
  const isIn = op.type === "cash_in";
  return (
    <View style={styles.opRow}>
      <View style={[styles.opIcon, { backgroundColor: isIn ? "#D1FAE5" : "#FEE2E2" }]}>
        <Ionicons name={isIn ? "arrow-down" : "arrow-up"} size={16} color={isIn ? "#10B981" : "#EF4444"} />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <TText weight="semiBold" numberOfLines={1}>{op.client_name || "—"}</TText>
        <TText variant="caption" color={paybidColors.neutrals.textSecondary}>
          {isIn ? "Cash In" : "Cash Out"} · {op.created_at ? new Date(op.created_at).toLocaleString("fr-FR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" }) : ""}
        </TText>
      </View>
      <TText weight="extraBold" color={isIn ? "#10B981" : "#EF4444"}>
        {isIn ? "+" : "-"}{fmt(op.amount_eur || 0)}
      </TText>
    </View>
  );
}

/* ─── Scanner QR inline ─── */
function QRScanner({ onScanned, onClose }: { onScanned: (data: string) => void; onClose: () => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const scannedRef = useRef(false);

  if (!permission) return <ActivityIndicator color={paybidColors.primary.base} style={{ marginTop: 40 }} />;
  if (!permission.granted) {
    return (
      <View style={{ alignItems: "center", padding: spacing.xl }}>
        <Ionicons name="camera-outline" size={48} color={paybidColors.neutrals.textTertiary} />
        <TText variant="body" align="center" style={{ marginTop: 12, marginBottom: 16 }}>
          Autorisation caméra requise pour scanner
        </TText>
        <Button title="Autoriser la caméra" onPress={requestPermission} style={{ backgroundColor: paybidColors.primary.base }} />
        <TouchableOpacity onPress={onClose} style={{ marginTop: 12 }}>
          <TText variant="caption" color={paybidColors.neutrals.textSecondary}>Annuler</TText>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.cameraWrap}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={({ data }) => {
          if (scannedRef.current) return;
          scannedRef.current = true;
          onScanned(data);
        }}
      />
      {/* Viseur */}
      <View style={styles.cameraOverlay}>
        <View style={styles.viewfinder} />
        <TText variant="caption" color="white" align="center" style={{ marginTop: 16 }}>
          Placez le QR code du client dans le cadre
        </TText>
      </View>
      <TouchableOpacity style={styles.cameraClose} onPress={onClose}>
        <Ionicons name="close-circle" size={36} color="white" />
      </TouchableOpacity>
    </View>
  );
}

/* ─── Types ─── */
type Step = "menu" | "scan" | "client" | "confirm_client" | "amount" | "agent_pin" | "done";

export default function OperationsTab() {
  const [limits, setLimits]   = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [opType, setOpType]           = useState<"cash_in"|"cash_out">("cash_in");
  const [step, setStep]               = useState<Step>("menu");
  const [clientRef, setClientRef]     = useState("");
  const [clientInfo, setClientInfo]   = useState<any>(null);
  const [amountEur, setAmountEur]     = useState("");
  const [localAmount, setLocalAmount] = useState<number>(0);
  const [localCur, setLocalCur]       = useState("XAF");
  const [busy, setBusy]               = useState(false);
  const [receipt, setReceipt]         = useState<any>(null);

  const load = useCallback(async (showLoad = true) => {
    if (showLoad) setLoading(true);
    setRefreshing(true);
    try {
      const [limRes, hisRes] = await Promise.all([
        api.get("/agent/cash-limits").catch(() => ({ data: { cash_in_remaining: 500, cash_out_remaining: 300, currency: "XAF" } })),
        api.get("/agent/cash-operations").catch(() => ({ data: [] })),
      ]);
      setLimits(limRes.data);
      setLocalCur(limRes.data.currency || "XAF");
      setHistory(Array.isArray(hisRes.data) ? hisRes.data : hisRes.data.items || []);
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const startOp = (type: "cash_in"|"cash_out") => {
    setOpType(type); setClientRef(""); setClientInfo(null);
    setAmountEur(""); setLocalAmount(0); setReceipt(null);
    setStep("client");
  };

  const resolveClient = async (ref: string) => {
    if (!ref.trim()) return;
    setBusy(true);
    try {
      const { data } = await api.get(`/agent/client-lookup?ref=${encodeURIComponent(ref.trim())}`);
      setClientInfo(data);
      setStep("confirm_client");
    } catch (e: any) {
      Alert.alert("Client introuvable", apiError(e));
    } finally { setBusy(false); }
  };

  const computeLocal = async (eur: string) => {
    const val = parseFloat(eur);
    if (!val || isNaN(val)) { setLocalAmount(0); return; }
    try {
      const { data } = await api.get(`/fx/convert?amount=${val}&from=EUR&to=${localCur}`).catch(() => ({ data: { result: val * 655.957 } }));
      setLocalAmount(data.result || val * 655.957);
    } catch { setLocalAmount(val * 655.957); }
  };

  const onClientPin = async (pin: string) => {
    setBusy(true);
    try {
      await api.post("/agent/verify-client-pin", { client_id: clientInfo.id, pin });
      setStep("amount");
    } catch (e: any) {
      Alert.alert("PIN client incorrect", apiError(e));
    } finally { setBusy(false); }
  };

  const onAgentPin = async (pin: string) => {
    setBusy(true);
    try {
      const endpoint = opType === "cash_in" ? "/agent/cash-in" : "/agent/cash-out";
      const { data } = await api.post(endpoint, {
        client_id: clientInfo.id,
        amount_eur: parseFloat(amountEur),
        agent_pin: pin,
      });
      setReceipt(data);
      setStep("done");
      load(false);
    } catch (e: any) {
      Alert.alert("Erreur", apiError(e));
    } finally { setBusy(false); }
  };

  const reset = () => {
    setStep("menu"); setClientRef(""); setClientInfo(null);
    setAmountEur(""); setLocalAmount(0); setReceipt(null);
  };

  if (loading) return (
    <SafeAreaView style={styles.center}>
      <ActivityIndicator size="large" color={paybidColors.primary.base} />
    </SafeAreaView>
  );

  const accentColor = opType === "cash_in" ? "#10B981" : "#EF4444";
  const stepIndex   = ["menu","client","confirm_client","amount","agent_pin","done"].indexOf(step);

  return (
    <SafeAreaView edges={["top","bottom"]} style={{ flex:1, backgroundColor: paybidColors.neutrals.background }}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(false)} tintColor={paybidColors.primary.base} />}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={{ marginBottom: spacing.lg }}>
          <TText variant="title" weight="extraBold">Opérations</TText>
          <TText variant="caption" color={paybidColors.neutrals.textSecondary}>Caisse physique · Sécurité double PIN</TText>
        </View>

        {/* ── Plafonds journaliers ── */}
        {limits && (
          <View style={styles.limitsRow}>
            <View style={[styles.limitCard, { borderColor: "#10B981" }]}>
              <Ionicons name="arrow-down-circle" size={20} color="#10B981" />
              <TText variant="label" color={paybidColors.neutrals.textSecondary} style={{ marginTop: 4 }}>Cash In restant</TText>
              <TText weight="bold" color="#10B981" style={{ marginTop: 2 }}>{fmt(limits.cash_in_remaining)}</TText>
              <TText variant="label" color={paybidColors.neutrals.textTertiary}>/ 500 €/op</TText>
            </View>
            <View style={[styles.limitCard, { borderColor: "#EF4444" }]}>
              <Ionicons name="arrow-up-circle" size={20} color="#EF4444" />
              <TText variant="label" color={paybidColors.neutrals.textSecondary} style={{ marginTop: 4 }}>Cash Out restant</TText>
              <TText weight="bold" color="#EF4444" style={{ marginTop: 2 }}>{fmt(limits.cash_out_remaining)}</TText>
              <TText variant="label" color={paybidColors.neutrals.textTertiary}>/ 300 €/op</TText>
            </View>
          </View>
        )}

        {/* ── Section Cash In (vert) ── */}
        <View style={[styles.opSection, { borderColor: "#10B981" }]}>
          <View style={styles.opSectionHeader}>
            <View style={[styles.opSectionIcon, { backgroundColor: "#D1FAE5" }]}>
              <Ionicons name="arrow-down-circle" size={22} color="#10B981" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <TText variant="subtitle" weight="bold" color="#059669">Encaisser — Cash In</TText>
              <TText variant="caption" color={paybidColors.neutrals.textSecondary}>Le client vous donne des espèces → son compte est crédité</TText>
            </View>
          </View>
          <TouchableOpacity style={[styles.opActionBtn, { backgroundColor: "#10B981" }]} onPress={() => startOp("cash_in")} activeOpacity={0.8}>
            <Ionicons name="qr-code-outline" size={18} color="white" />
            <TText weight="bold" color="white" style={{ marginLeft: 8 }}>Scanner QR client</TText>
          </TouchableOpacity>
        </View>

        {/* ── Section Cash Out (rouge) ── */}
        <View style={[styles.opSection, { borderColor: "#EF4444", marginTop: 12 }]}>
          <View style={styles.opSectionHeader}>
            <View style={[styles.opSectionIcon, { backgroundColor: "#FEE2E2" }]}>
              <Ionicons name="arrow-up-circle" size={22} color="#EF4444" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <TText variant="subtitle" weight="bold" color="#DC2626">Décaisser — Cash Out</TText>
              <TText variant="caption" color={paybidColors.neutrals.textSecondary}>Le client demande un retrait → vous remettez les espèces</TText>
            </View>
          </View>
          <TouchableOpacity style={[styles.opActionBtn, { backgroundColor: "#EF4444" }]} onPress={() => startOp("cash_out")} activeOpacity={0.8}>
            <Ionicons name="qr-code-outline" size={18} color="white" />
            <TText weight="bold" color="white" style={{ marginLeft: 8 }}>Scanner QR client</TText>
          </TouchableOpacity>
        </View>

        {/* ── Historique ── */}
        <View style={{ marginTop: spacing.xl }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <TText variant="subtitle" weight="bold">Dernières opérations</TText>
            <TText variant="label" color={paybidColors.neutrals.textTertiary}>{history.length} opération(s)</TText>
          </View>
          {history.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="receipt-outline" size={36} color={paybidColors.neutrals.textTertiary} />
              <TText variant="caption" color={paybidColors.neutrals.textSecondary} style={{ marginTop: 8 }}>Aucune opération aujourd&apos;hui</TText>
            </View>
          ) : history.slice(0, 20).map((op, i) => <OpRow key={op.id || i} op={op} />)}
        </View>
      </ScrollView>

      {/* ════ MODAL FLUX OPÉRATION ════ */}
      <Modal visible={step !== "menu"} animationType="slide" presentationStyle="pageSheet" onRequestClose={reset}>
        <SafeAreaView style={{ flex: 1, backgroundColor: paybidColors.neutrals.background }}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>

            {/* Header modal avec barre de progression */}
            <View style={[styles.modalHeader, { borderBottomColor: accentColor + "33" }]}>
              <TouchableOpacity onPress={step === "scan" ? () => setStep("client") : reset} style={styles.modalClose}>
                <Ionicons name={step === "scan" ? "arrow-back" : "close"} size={20} color={paybidColors.neutrals.textPrimary} />
              </TouchableOpacity>
              <View style={{ alignItems: "center" }}>
                <TText variant="subtitle" weight="bold" color={accentColor}>
                  {opType === "cash_in" ? "Cash In — Encaisser" : "Cash Out — Décaisser"}
                </TText>
                {step !== "menu" && step !== "done" && step !== "scan" && (
                  <TText variant="label" color={paybidColors.neutrals.textTertiary}>
                    Étape {Math.max(1, stepIndex)} / 4
                  </TText>
                )}
              </View>
              <View style={{ width: 32 }} />
            </View>

            {/* Barre de progression */}
            {step !== "menu" && step !== "done" && step !== "scan" && (
              <View style={styles.progressBar}>
                {[1,2,3,4].map(n => (
                  <View key={n} style={[styles.progressStep, {
                    backgroundColor: n <= stepIndex ? accentColor : paybidColors.neutrals.border,
                    flex: 1,
                  }]} />
                ))}
              </View>
            )}

            <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">

              {/* ── ÉTAPE 1 : Scanner QR ou saisie manuelle ── */}
              {step === "client" && (
                <View>
                  <TText variant="body" weight="bold" style={{ marginBottom: 4 }}>Identifier le client</TText>
                  <TText variant="caption" color={paybidColors.neutrals.textSecondary} style={{ marginBottom: spacing.lg }}>
                    Scannez le QR code du client ou saisissez sa référence manuellement.
                  </TText>

                  {/* Bouton scanner QR — ouvre la caméra */}
                  <TouchableOpacity style={[styles.scanLargeBtn, { borderColor: accentColor }]} onPress={() => setStep("scan")} activeOpacity={0.8}>
                    <View style={[styles.scanLargeIcon, { backgroundColor: accentColor + "18" }]}>
                      <Ionicons name="qr-code" size={32} color={accentColor} />
                    </View>
                    <TText variant="subtitle" weight="bold" color={accentColor} style={{ marginTop: 10 }}>Scanner le QR code</TText>
                    <TText variant="caption" color={paybidColors.neutrals.textSecondary} style={{ marginTop: 4 }}>Appuyez pour ouvrir la caméra</TText>
                  </TouchableOpacity>

                  <View style={styles.dividerRow}>
                    <View style={styles.divider} />
                    <TText variant="caption" color={paybidColors.neutrals.textTertiary} style={{ marginHorizontal: 12 }}>ou</TText>
                    <View style={styles.divider} />
                  </View>

                  {/* Saisie manuelle */}
                  <TText variant="caption" weight="semiBold" color={paybidColors.neutrals.textSecondary} style={{ marginBottom: 6 }}>Saisie manuelle</TText>
                  <TextInput
                    style={styles.input}
                    placeholder="Référence, email ou téléphone client"
                    placeholderTextColor={paybidColors.neutrals.textTertiary}
                    value={clientRef}
                    onChangeText={setClientRef}
                    autoCapitalize="none"
                    returnKeyType="search"
                    onSubmitEditing={() => resolveClient(clientRef)}
                  />
                  <Button
                    title={busy ? "Recherche en cours…" : "Rechercher le client"}
                    onPress={() => resolveClient(clientRef)}
                    style={{ backgroundColor: accentColor, marginTop: spacing.md }}
                  />
                  {busy && <ActivityIndicator color={accentColor} style={{ marginTop: 12 }} />}
                </View>
              )}

              {/* ── SCANNER CAMÉRA ── */}
              {step === "scan" && (
                <QRScanner
                  onScanned={(data) => { setClientRef(data); setStep("client"); resolveClient(data); }}
                  onClose={() => setStep("client")}
                />
              )}

              {/* ── ÉTAPE 2 : Fiche client + PIN client ── */}
              {step === "confirm_client" && clientInfo && (
                <View>
                  <TText variant="body" weight="bold" style={{ marginBottom: 4 }}>Vérification client</TText>
                  <TText variant="caption" color={paybidColors.neutrals.textSecondary} style={{ marginBottom: spacing.md }}>
                    Confirmez l&apos;identité puis demandez au client de saisir son PIN.
                  </TText>
                  <View style={[styles.clientCard, { borderColor: accentColor }]}>
                    <View style={[styles.clientAvatar, { backgroundColor: accentColor + "18" }]}>
                      <Ionicons name="person" size={24} color={accentColor} />
                    </View>
                    <View style={{ marginLeft: 14, flex: 1 }}>
                      <TText weight="extraBold" style={{ fontSize: 16 }}>{clientInfo.full_name || clientInfo.name || "—"}</TText>
                      <TText variant="caption" color={paybidColors.neutrals.textSecondary}>{clientInfo.email || clientInfo.phone || "—"}</TText>
                      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
                        <Ionicons name="wallet-outline" size={12} color={paybidColors.neutrals.textSecondary} />
                        <TText variant="caption" color={paybidColors.neutrals.textSecondary} style={{ marginLeft: 4 }}>
                          Solde : {fmt(clientInfo.balance_eur || 0)}
                        </TText>
                      </View>
                    </View>
                  </View>
                  <View style={{ marginTop: spacing.xl }}>
                    <PinPad
                      label="PIN client"
                      sublabel="Le client saisit son code PIN à 6 chiffres"
                      onDone={onClientPin}
                      loading={busy}
                    />
                  </View>
                </View>
              )}

              {/* ── ÉTAPE 3 : Montant ── */}
              {step === "amount" && (
                <View>
                  <TText variant="body" weight="bold" style={{ marginBottom: 4 }}>Saisir le montant</TText>
                  <TText variant="caption" color={paybidColors.neutrals.textSecondary} style={{ marginBottom: spacing.lg }}>
                    {opType === "cash_in" ? "Montant des espèces reçues du client" : "Montant à remettre en espèces au client"}
                  </TText>
                  <View style={[styles.amountBox, { borderColor: accentColor }]}>
                    <TextInput
                      style={[styles.amountInput, { color: accentColor }]}
                      placeholder="0.00"
                      placeholderTextColor={paybidColors.neutrals.textTertiary}
                      keyboardType="decimal-pad"
                      value={amountEur}
                      onChangeText={v => { setAmountEur(v); computeLocal(v); }}
                      autoFocus
                    />
                    <TText variant="title" weight="bold" color={paybidColors.neutrals.textSecondary}> EUR</TText>
                  </View>
                  {localAmount > 0 && (
                    <View style={styles.conversionBadge}>
                      <Ionicons name="swap-horizontal" size={14} color={paybidColors.neutrals.textSecondary} />
                      <TText variant="caption" color={paybidColors.neutrals.textSecondary} style={{ marginLeft: 6 }}>
                        ≈ {Math.round(localAmount).toLocaleString("fr-FR")} {localCur}
                      </TText>
                    </View>
                  )}
                  <Button
                    title="Confirmer le montant →"
                    onPress={() => {
                      const val = parseFloat(amountEur);
                      if (!val || isNaN(val) || val <= 0) { Alert.alert("Montant invalide"); return; }
                      const max = opType === "cash_in" ? (limits?.cash_in_remaining ?? 500) : (limits?.cash_out_remaining ?? 300);
                      if (val > max) { Alert.alert("Plafond dépassé", `Maximum autorisé : ${fmt(max)}`); return; }
                      setStep("agent_pin");
                    }}
                    style={{ backgroundColor: accentColor, marginTop: spacing.lg }}
                  />
                </View>
              )}

              {/* ── ÉTAPE 4 : Récapitulatif + PIN agent ── */}
              {step === "agent_pin" && (
                <View>
                  <TText variant="body" weight="bold" style={{ marginBottom: 4 }}>Validation agent</TText>
                  <TText variant="caption" color={paybidColors.neutrals.textSecondary} style={{ marginBottom: spacing.md }}>
                    Vérifiez le récapitulatif, puis saisissez votre PIN pour confirmer.
                  </TText>
                  <View style={[styles.recap, { borderColor: accentColor }]}>
                    <View style={[styles.recapTypeTag, { backgroundColor: accentColor + "18" }]}>
                      <TText variant="label" weight="bold" color={accentColor}>
                        {opType === "cash_in" ? "ENCAISSEMENT" : "DÉCAISSEMENT"}
                      </TText>
                    </View>
                    <TText variant="caption" color={paybidColors.neutrals.textSecondary} style={{ marginTop: 8 }}>
                      {clientInfo?.full_name || clientInfo?.name}
                    </TText>
                    <TText weight="extraBold" style={{ fontSize: 32, marginTop: 8 }} color={accentColor}>
                      {opType === "cash_in" ? "+" : "-"}{fmt(parseFloat(amountEur))}
                    </TText>
                    {localAmount > 0 && (
                      <TText variant="caption" color={paybidColors.neutrals.textTertiary} style={{ marginTop: 4 }}>
                        ≈ {Math.round(localAmount).toLocaleString("fr-FR")} {localCur}
                      </TText>
                    )}
                  </View>
                  <PinPad
                    label="Votre PIN agent"
                    sublabel="Saisissez votre code PIN à 6 chiffres pour valider"
                    onDone={onAgentPin}
                    loading={busy}
                  />
                </View>
              )}

              {/* ── SUCCÈS ── */}
              {step === "done" && (
                <View style={{ alignItems: "center", paddingTop: spacing.xl }}>
                  <View style={[styles.successIcon, { backgroundColor: "#D1FAE5" }]}>
                    <Ionicons name="checkmark" size={40} color="#10B981" />
                  </View>
                  <TText variant="title" weight="extraBold" color="#059669" style={{ marginTop: 20 }}>
                    Opération réussie !
                  </TText>
                  <TText variant="body" color={paybidColors.neutrals.textSecondary} style={{ marginTop: 8, textAlign: "center" }}>
                    {opType === "cash_in" ? "Espèces encaissées et compte client crédité" : "Compte client débité et espèces remises"}
                  </TText>
                  <TText weight="extraBold" style={{ fontSize: 36, marginTop: 16 }} color="#059669">
                    {fmt(receipt?.amount_eur || parseFloat(amountEur))}
                  </TText>
                  {receipt?.receipt_id && (
                    <View style={styles.receiptBadge}>
                      <Ionicons name="receipt-outline" size={14} color={paybidColors.neutrals.textSecondary} />
                      <TText variant="caption" color={paybidColors.neutrals.textSecondary} style={{ marginLeft: 6 }}>
                        Reçu #{receipt.receipt_id}
                      </TText>
                    </View>
                  )}
                  <Button title="Nouvelle opération" onPress={reset} style={{ backgroundColor: paybidColors.primary.base, marginTop: spacing.xl, width: "100%" }} />
                  <TouchableOpacity onPress={reset} style={{ marginTop: 12 }}>
                    <TText variant="caption" color={paybidColors.neutrals.textSecondary}>Retour au menu</TText>
                  </TouchableOpacity>
                </View>
              )}

            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: paybidColors.neutrals.background },

  // Plafonds
  limitsRow: { flexDirection: "row", gap: 12, marginBottom: spacing.lg },
  limitCard: { flex: 1, backgroundColor: paybidColors.neutrals.surface, borderRadius: radii.xl, borderWidth: 1.5, padding: 14, alignItems: "center" },

  // Sections Cash In / Cash Out
  opSection: { backgroundColor: paybidColors.neutrals.surface, borderRadius: radii.xl, borderWidth: 1.5, padding: 16 },
  opSectionHeader: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  opSectionIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  opActionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 13, borderRadius: radii.xl },

  // Historique
  opRow: { flexDirection: "row", alignItems: "center", backgroundColor: paybidColors.neutrals.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: paybidColors.neutrals.border, padding: 12, marginBottom: 8 },
  opIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", padding: 40, backgroundColor: paybidColors.neutrals.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: paybidColors.neutrals.border },

  // Modal
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.lg, borderBottomWidth: 1 },
  modalClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: paybidColors.neutrals.border, alignItems: "center", justifyContent: "center" },
  progressBar: { flexDirection: "row", gap: 4, paddingHorizontal: spacing.lg, paddingVertical: 8 },
  progressStep: { height: 4, borderRadius: 2 },

  // Étape 1
  scanLargeBtn: { borderWidth: 2, borderStyle: "dashed", borderRadius: radii.xl, padding: 24, alignItems: "center", marginBottom: spacing.lg },
  scanLargeIcon: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  dividerRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.md },
  divider: { flex: 1, height: 1, backgroundColor: paybidColors.neutrals.border },
  input: { backgroundColor: paybidColors.neutrals.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: paybidColors.neutrals.border, paddingHorizontal: 14, paddingVertical: 13, color: paybidColors.neutrals.textPrimary, fontSize: 15 },

  // Caméra
  cameraWrap: { borderRadius: radii.xl, overflow: "hidden", height: 320, position: "relative" },
  camera: { flex: 1 },
  cameraOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "center", alignItems: "center" },
  viewfinder: { width: 200, height: 200, borderWidth: 2, borderColor: "white", borderRadius: 12, backgroundColor: "transparent" },
  cameraClose: { position: "absolute", top: 12, right: 12 },

  // Fiche client
  clientCard: { flexDirection: "row", alignItems: "center", backgroundColor: paybidColors.neutrals.surface, borderRadius: radii.xl, borderWidth: 1.5, padding: 16 },
  clientAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },

  // Montant
  amountBox: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: paybidColors.neutrals.surface, borderRadius: radii.xl, borderWidth: 2, padding: 20 },
  amountInput: { fontSize: 38, fontWeight: "800", minWidth: 100, textAlign: "center" },
  conversionBadge: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 10, backgroundColor: paybidColors.neutrals.surface, borderRadius: radii.lg, padding: 8 },

  // Récapitulatif
  recap: { backgroundColor: paybidColors.neutrals.surface, borderRadius: radii.xl, borderWidth: 1.5, padding: 24, alignItems: "center", marginBottom: spacing.lg },
  recapTypeTag: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },

  // PIN
  pinDot: { width: 14, height: 14, borderRadius: 7 },
  keypad: { flexDirection: "row", flexWrap: "wrap", width: 252, justifyContent: "center", marginTop: 8 },
  key: { width: 80, height: 60, justifyContent: "center", alignItems: "center" },

  // Succès
  successIcon: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center" },
  receiptBadge: { flexDirection: "row", alignItems: "center", marginTop: 12, backgroundColor: paybidColors.neutrals.surface, borderRadius: radii.lg, paddingHorizontal: 14, paddingVertical: 8 },
});
