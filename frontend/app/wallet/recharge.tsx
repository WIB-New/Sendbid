import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, Platform, TouchableOpacity, ActivityIndicator, Modal, KeyboardAvoidingView, ScrollView, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import * as WebBrowser from "expo-web-browser";
import QRCode from "react-native-qrcode-svg";
import { Screen } from "../../src/components/Screen";
import { TText } from "../../src/components/TText";
import { Input } from "../../src/components/Input";
import { Button } from "../../src/components/Button";
import { PINPad } from "../../src/components/PINPad";
import { api, apiError } from "../../src/api";
import { useAuth } from "../../src/store";
import { colors, spacing, radii } from "../../src/theme";
import { useThemedColors } from "../../src/themeContext";
type Method = "cash" | "card" | "momo" | "paypal";
type Pkg = { id: string; amount: number; label: string };

const METHODS: { key: Method; label: string; icon: any; desc: string; available: boolean }[] = [
  { key: "cash", label: "Espèces", icon: "cash-outline", desc: "Présentez le QR Code à un agent pour déposer instantanément de l'argent sur votre compte. Code PIN requis", available: true },
  { key: "card", label: "Carte", icon: "card-outline", desc: "Visa / Mastercard / 3DS via Stripe", available: true },
  { key: "momo", label: "Mobile (Bientôt)", icon: "phone-portrait-outline", desc: "Wave, Orange Money, MTN MoMo — Intégration en cours de finalisation. Veuillez utiliser Carte ou Espèces.", available: false },
  { key: "paypal", label: "PayPal", icon: "logo-paypal", desc: "Recharge sécurisée via PayPal", available: true },
];

// Plafonds mensuels par tier KYC (cf. /app/frontend/app/kyc/index.tsx)
// Affichage du montant maximum admissible pour une carte selon le KYC client.
const KYC_MAX_BY_TIER: Record<number, number> = { 0: 200, 1: 2000, 2: 10000, 3: 50000 };

const ORIGIN = (process.env.EXPO_PUBLIC_BACKEND_URL || "").replace(/\/$/, "");

export default function Recharge() {
  const colors = useThemedColors();
  const router = useRouter();
  const refreshMe = useAuth((s) => s.refreshMe);
  const user = useAuth((s) => s.user);
  const wallet = useAuth((s) => s.wallet);
  const kycTier: number = Number((user as any)?.kyc_tier ?? 0);
  const cardMax: number = KYC_MAX_BY_TIER[kycTier] ?? 500;
  const [method, setMethod] = useState<Method>("card");
  const [amount, setAmount] = useState("100");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Card / Stripe
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [selectedPkg, setSelectedPkg] = useState<string>("");
  const [customAmount, setCustomAmount] = useState("");
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [paid, setPaid] = useState<{ amount: number } | null>(null);
  const pollTimer = useRef<any>(null);
  // Momo
  const [momoOp, setMomoOp] = useState("Wave");
  const [momoNumber, setMomoNumber] = useState("");
  // PayPal — vrai flow Sandbox
  const [pplOrderId, setPplOrderId] = useState<string | null>(null);
  const [pplApproveUrl, setPplApproveUrl] = useState<string | null>(null);
  const [pplApproved, setPplApproved] = useState(false);
  const [pplPin, setPplPin] = useState("");
  const [pplPinModal, setPplPinModal] = useState(false);
  // Cash QR — vrai flow backend
  const [cashQrToken, setCashQrToken] = useState<string | null>(null);
  const [cashQrExpiresAt, setCashQrExpiresAt] = useState<string | null>(null);
  const [cashPin, setCashPin] = useState("");
  const [cashPinModal, setCashPinModal] = useState(false);

  useEffect(() => {
    api.get("/payments/packages").then((r) => {
      setPackages(r.data?.packages || []);
      if (r.data?.packages?.length) setSelectedPkg(r.data.packages[1]?.id || r.data.packages[0].id);
    }).catch(() => {});
    return () => { if (pollTimer.current) clearTimeout(pollTimer.current); };
  }, []);

  const startCard = async () => {
    setErr(null); setPaid(null); setLoading(true);
    try {
      const body: any = { origin_url: ORIGIN };
      if (selectedPkg === "custom") {
        const v = parseFloat(customAmount.replace(",", ".")); if (!v) throw new Error("Montant invalide"); body.amount = v;
      } else { body.package_id = selectedPkg; }
      const { data } = await api.post("/payments/checkout/session", body);
      setSessionId(data.session_id); setCheckoutUrl(data.url);
    } catch (e: any) { setErr(apiError(e)); } finally { setLoading(false); }
  };

  const pollStatus = async (sid: string, attempts = 0) => {
    if (attempts > 30) { setPolling(false); setErr("Vérification expirée"); return; }
    try {
      const { data } = await api.get(`/payments/checkout/status/${sid}`);
      if (data.payment_status === "paid") { setPolling(false); setPaid({ amount: data.amount }); await refreshMe(); return; }
      if (data.status === "expired") { setPolling(false); setErr("Session expirée"); return; }
    } catch {}
    pollTimer.current = setTimeout(() => pollStatus(sid, attempts + 1), 2000);
  };

  const onWebViewNavChange = (event: { url: string }) => {
    if (!sessionId) return;
    const u = event.url || "";
    if (u.includes("cancelled=1")) { setCheckoutUrl(null); setErr("Paiement annulé."); return; }
    if (u.includes("session_id=")) { setCheckoutUrl(null); setPolling(true); pollStatus(sessionId); }
  };

  const submitMomo = async () => {
    setErr(null); setLoading(true);
    try {
      // Stub: utilise recharge-qr pour simuler côté demo (le routing back-office connecte le vrai agrégateur)
      const { data } = await api.post("/wallet/recharge-qr", { amount: parseFloat(amount) });
      await refreshMe();
      setPaid({ amount: parseFloat(amount) });
    } catch (e: any) { setErr(apiError(e)); } finally { setLoading(false); }
  };

  const submitPaypal = async () => {
    setErr(null); setLoading(true);
    try {
      const a = parseFloat(amount.replace(",", "."));
      if (!a || a <= 0) throw new Error("Montant invalide");
      const { data } = await api.post("/paypal/order", { amount: a });
      setPplOrderId(data.order_id);
      setPplApproveUrl(data.approve_url);
      setPplApproved(false);
    } catch (e: any) { setErr(apiError(e)); } finally { setLoading(false); }
  };

  const onPaypalWebViewNav = (event: { url: string }) => {
    const u = event.url || "";
    if (u.includes("/paypal/cancel")) {
      setPplApproveUrl(null); setPplOrderId(null); setErr("Paiement PayPal annulé");
      return;
    }
    if (u.includes("/paypal/return")) {
      setPplApproveUrl(null); setPplApproved(true); setPplPinModal(true);
    }
  };

  const capturePaypal = async () => {
    if (!pplOrderId) return;
    setErr(null); setLoading(true);
    try {
      const { data } = await api.post("/paypal/capture", { order_id: pplOrderId, pin: pplPin });
      await refreshMe();
      setPplPinModal(false); setPplPin(""); setPplApproved(false); setPplOrderId(null);
      setPaid({ amount: data.amount });
    } catch (e: any) { setErr(apiError(e)); } finally { setLoading(false); }
  };

  const startCashQr = async () => {
    setCashPinModal(true);
  };

  const confirmCashQr = async () => {
    setErr(null); setLoading(true);
    try {
      const a = parseFloat(amount.replace(",", "."));
      if (!a || a <= 0) throw new Error("Montant invalide");
      const { data } = await api.post("/wallet/recharge-qr", { amount: a, pin: cashPin });
      setCashQrToken(data.qr_token);
      setCashQrExpiresAt(data.expires_at);
      setCashPinModal(false); setCashPin("");
    } catch (e: any) { setErr(apiError(e)); } finally { setLoading(false); }
  };

  return (
    <Screen title="Ajouter de l'argent" back hero scroll={false}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
          {/* Solde disponible — affiché juste sous le titre de la page */}
          <View style={styles.balanceBox}>
            <Ionicons name="wallet-outline" size={18} color={colors.primary.base} />
            <TText variant="caption" color={colors.neutrals.textSecondary} style={{ marginLeft: 8 }}>
              Solde disponible :
            </TText>
            <TText variant="body" weight="extraBold" color={colors.primary.base} style={{ marginLeft: 6 }}>
              {Number(wallet?.balance ?? 0).toFixed(2)} EUR
            </TText>
          </View>

          {/* Méthode picker — chips horizontaux comme RETRAIT */}
          <View style={styles.methodsRow}>
            {METHODS.map((m) => (
              <TouchableOpacity
                key={m.key}
                testID={`recharge-chip-${m.key}`}
                disabled={!m.available}
                onPress={() => setMethod(m.key)}
                style={[
                  styles.methodChip,
                  method === m.key && m.available && { backgroundColor: colors.primary.base, borderColor: colors.primary.base },
                  !m.available && { opacity: 0.45 },
                ]}
              >
                <Ionicons name={m.icon} size={18} color={method === m.key && m.available ? "white" : colors.primary.base} />
                <TText
                  variant="label"
                  weight="bold"
                  color={method === m.key && m.available ? "white" : colors.neutrals.textPrimary}
                  style={{ marginLeft: 6 }}
                  numberOfLines={1}
                >
                  {m.label}
                </TText>
              </TouchableOpacity>
            ))}
          </View>

          {/* Description du mode actif */}
          <View style={styles.info}>
            <Ionicons name="information-circle-outline" size={18} color={colors.primary.base} />
            <TText variant="caption" color={colors.primary.base} style={{ marginLeft: 6, flex: 1 }}>
              {METHODS.find((x) => x.key === method)?.desc}
            </TText>
          </View>

          {paid ? (
            <View style={styles.successBox}>
              <Ionicons name="checkmark-circle" size={36} color={colors.status.success} />
              <TText variant="title" weight="extraBold" align="center" style={{ marginTop: 8 }}>Recharge confirmée</TText>
              <TText variant="body" color={colors.neutrals.textSecondary} align="center">+{paid.amount.toFixed(2)} EUR crédités</TText>
            </View>
          ) : (
            <View style={{ marginTop: spacing.lg }}>
              {method === "card" ? (
                <>
                  <Input
                    testID="recharge-card-amount"
                    label="Montant à débiter (EUR)"
                    value={customAmount}
                    onChangeText={(v) => { setCustomAmount(v); setSelectedPkg("custom"); }}
                    keyboardType="decimal-pad"
                    icon="cash-outline"
                    placeholder="Ex : 50.00"
                    hint={`Montant compris entre 5 € et ${cardMax} €`}
                  />
                  <Button testID="recharge-pay-card" title={polling ? "Vérification…" : "Payer par carte"} onPress={startCard} loading={loading || polling} icon="card" />
                </>
              ) : method === "momo" ? (
                <>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                    {["Wave", "Orange Money", "MTN MoMo", "Moov", "Free Money"].map((op) => (
                      <TouchableOpacity key={op} onPress={() => setMomoOp(op)} style={[styles.opChip, momoOp === op && { backgroundColor: colors.primary.base, borderColor: colors.primary.base }]}>
                        <TText variant="caption" weight="bold" color={momoOp === op ? "white" : colors.neutrals.textPrimary}>{op}</TText>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Input label="Numéro mobile" value={momoNumber} onChangeText={setMomoNumber} icon="call-outline" keyboardType="phone-pad" />
                  <Input label="Montant (EUR)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" icon="cash-outline" />
                  <Button title={`Recharger via ${momoOp}`} onPress={submitMomo} loading={loading} disabled={!momoNumber || parseFloat(amount) <= 0} icon="phone-portrait-outline" />
                </>
              ) : method === "paypal" ? (
                <>
                  <Input label="Montant (EUR)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" icon="cash-outline" />
                  <TText variant="caption" color={colors.neutrals.textSecondary} style={{ marginBottom: 8, marginTop: 4 }}>
                    Frais plateforme : 0%. Frais Paypal à prévoir
                  </TText>
                  <Button testID="recharge-pay-paypal" title="Payer avec PayPal" onPress={submitPaypal} loading={loading} disabled={parseFloat(amount) <= 0} icon="logo-paypal" />
                </>
              ) : method === "cash" ? (
                <>
                  <Input label="Montant à déposer (EUR)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" icon="cash-outline" />
                  {cashQrToken ? (
                    <View style={styles.qrBox}>
                      <QRCode value={cashQrToken} size={200} color="#022a6b" backgroundColor="white" />
                      <TText variant="caption" color={colors.neutrals.textSecondary} align="center" style={{ marginTop: 12 }}>
                        Présentez ce QR à un agent SENDBID
                      </TText>
                      <TText variant="caption" weight="bold" color={colors.status.success} align="center" style={{ marginTop: 4 }}>
                        Montant : {parseFloat(amount).toFixed(2)} EUR
                      </TText>
                      {cashQrExpiresAt ? (
                        <TText variant="label" color={colors.neutrals.textTertiary} align="center" style={{ marginTop: 2 }}>
                          Expire : {new Date(cashQrExpiresAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                        </TText>
                      ) : null}
                      <Button title="Générer un nouveau QR" icon="refresh" variant="outline" onPress={() => { setCashQrToken(null); setCashQrExpiresAt(null); }} style={{ marginTop: 12 }} />
                    </View>
                  ) : (
                    <Button
                      testID="recharge-cash-qr"
                      title="Générer le QR de dépôt"
                      icon="qr-code"
                      onPress={startCashQr}
                      disabled={parseFloat(amount) <= 0}
                    />
                  )}
                </>
              ) : null}
              {err ? <TText variant="caption" color={colors.status.error} style={{ marginTop: 8 }}>{err}</TText> : null}

              {/* B2: Lien modification des limites */}
              <TouchableOpacity
                testID="recharge-limits"
                style={styles.limitsRow}
                onPress={() => router.push("/limits" as any)}
              >
                <Ionicons name="speedometer-outline" size={18} color={colors.primary.base} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <TText variant="caption" weight="bold" color={colors.primary.base}>Modifier mes limites de recharge</TText>
                  <TText variant="label" color={colors.neutrals.textSecondary} style={{ marginTop: 2 }}>
                    Augmenter vos plafonds mensuels/annuels (nécessite KYC Tier 2)
                  </TText>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.primary.base} />
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={!!checkoutUrl} animationType="slide" onRequestClose={() => setCheckoutUrl(null)}>
        <View style={{ flex: 1, backgroundColor: "white" }}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setCheckoutUrl(null)} style={{ padding: 8 }}><Ionicons name="close" size={24} color={colors.neutrals.textPrimary} /></TouchableOpacity>
            <TText variant="subtitle" weight="bold" style={{ flex: 1, textAlign: "center" }}>Paiement sécurisé</TText>
            <View style={{ width: 40 }} />
          </View>
          {checkoutUrl ? (Platform.OS === "web" ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
              <Ionicons name="card" size={48} color={colors.primary.base} />
              <TText variant="body" align="center" style={{ marginTop: 12 }}>Paiement Stripe sécurisé in-app</TText>
              <TText variant="caption" color={colors.neutrals.textSecondary} align="center" style={{ marginTop: 4 }}>
                La fenêtre se fermera automatiquement après le paiement.
              </TText>
              <Button
                title="Continuer vers Stripe"
                icon="lock-closed"
                style={{ marginTop: 16 }}
                onPress={async () => {
                  try {
                    // Session navigateur in-app (modal sécurisé sur natif, popup avec auto-close sur web)
                    const r = await WebBrowser.openAuthSessionAsync(checkoutUrl, `${ORIGIN}/api/payments/return`);
                    if (r.type === "success" || r.type === "dismiss") {
                      setCheckoutUrl(null);
                      try { refreshMe(); } catch {}
                    }
                  } catch (e) { console.warn("stripe browser err", e); }
                }}
              />
            </View>
          ) : (
            <WebView source={{ uri: checkoutUrl }} onNavigationStateChange={onWebViewNavChange} startInLoadingState renderLoading={() => (<View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={colors.primary.base} /></View>)} />
          )) : null}
        </View>
      </Modal>

      {/* PayPal WebView */}
      <Modal visible={!!pplApproveUrl} animationType="slide" onRequestClose={() => { setPplApproveUrl(null); setPplOrderId(null); }}>
        <View style={{ flex: 1, backgroundColor: "white" }}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => { setPplApproveUrl(null); setPplOrderId(null); }} style={{ padding: 8 }}>
              <Ionicons name="close" size={24} color={colors.neutrals.textPrimary} />
            </TouchableOpacity>
            <TText variant="subtitle" weight="bold" style={{ flex: 1, textAlign: "center" }}>PayPal (Sandbox)</TText>
            <View style={{ width: 40 }} />
          </View>
          {pplApproveUrl ? (Platform.OS === "web" ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
              <Ionicons name="logo-paypal" size={48} color="#003087" />
              <TText variant="body" align="center" style={{ marginTop: 12 }}>Paiement PayPal sécurisé in-app</TText>
              <TText variant="caption" color={colors.neutrals.textSecondary} align="center" style={{ marginTop: 4 }}>
                La fenêtre se fermera automatiquement après l'approbation.
              </TText>
              <Button
                title="Continuer vers PayPal"
                icon="lock-closed"
                style={{ marginTop: 16 }}
                onPress={async () => {
                  try {
                    const r = await WebBrowser.openAuthSessionAsync(pplApproveUrl, `${ORIGIN}/api/paypal/return`);
                    if (r.type === "success" || r.type === "dismiss") {
                      setPplApproveUrl(null);
                      setPplPinModal(true);
                    }
                  } catch (e) { console.warn("paypal browser err", e); }
                }}
              />
              <Button title="J'ai approuvé — Continuer" variant="outline" style={{ marginTop: 8 }} onPress={() => { setPplApproveUrl(null); setPplPinModal(true); }} />
            </View>
          ) : (
            <WebView source={{ uri: pplApproveUrl }} onNavigationStateChange={onPaypalWebViewNav} startInLoadingState
              renderLoading={() => (<View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color="#003087" /></View>)} />
          )) : null}
        </View>
      </Modal>

      {/* PIN modal for PayPal capture */}
      <Modal visible={pplPinModal} transparent animationType="slide" onRequestClose={() => setPplPinModal(false)}>
        <View style={styles.pinSheetBg}>
          <View style={styles.pinSheet}>
            <Ionicons name="logo-paypal" size={32} color="#003087" style={{ alignSelf: "center" }} />
            <TText variant="subtitle" weight="extraBold" align="center" style={{ marginTop: 8 }}>Confirmer la recharge PayPal</TText>
            <TText variant="caption" color={colors.neutrals.textSecondary} align="center" style={{ marginTop: 4, marginBottom: spacing.md }}>
              Saisissez votre PIN à 6 chiffres pour créditer votre wallet.
            </TText>
            <PINPad pin={pplPin} onChange={setPplPin} />
            {err ? <TText variant="caption" color={colors.status.error} align="center" style={{ marginTop: 6 }}>{err}</TText> : null}
            <Button title="Valider et créditer" loading={loading} disabled={pplPin.length !== 6} onPress={capturePaypal} style={{ marginTop: 12 }} />
            <TouchableOpacity onPress={() => { setPplPinModal(false); setPplPin(""); }} style={{ alignItems: "center", marginTop: 8 }}>
              <TText variant="caption" color={colors.neutrals.textSecondary}>Annuler</TText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* PIN modal for Cash QR generation */}
      <Modal visible={cashPinModal} transparent animationType="slide" onRequestClose={() => setCashPinModal(false)}>
        <View style={styles.pinSheetBg}>
          <View style={styles.pinSheet}>
            <Ionicons name="cash" size={32} color="#10B981" style={{ alignSelf: "center" }} />
            <TText variant="subtitle" weight="extraBold" align="center" style={{ marginTop: 8 }}>Confirmer le dépôt en espèces</TText>
            <TText variant="caption" color={colors.neutrals.textSecondary} align="center" style={{ marginTop: 4, marginBottom: spacing.md }}>
              Saisissez votre PIN pour générer un QR sécurisé valable 15 min.
            </TText>
            <PINPad pin={cashPin} onChange={setCashPin} />
            {err ? <TText variant="caption" color={colors.status.error} align="center" style={{ marginTop: 6 }}>{err}</TText> : null}
            <Button title="Générer le QR" loading={loading} disabled={cashPin.length !== 6} onPress={confirmCashQr} style={{ marginTop: 12 }} />
            <TouchableOpacity onPress={() => { setCashPinModal(false); setCashPin(""); }} style={{ alignItems: "center", marginTop: 8 }}>
              <TText variant="caption" color={colors.neutrals.textSecondary}>Annuler</TText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  methodsRow: { flexDirection: "row", gap: 6, marginBottom: spacing.md },
  balanceBox: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.overlays.primarySoft,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: radii.lg,
    borderWidth: 1, borderColor: colors.primary.base + "33",
    marginBottom: spacing.md,
  },
  methodChip: {
    flex: 1,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingHorizontal: 6, paddingVertical: 10,
    borderRadius: radii.full,
    backgroundColor: colors.neutrals.surface,
    borderWidth: 1.5, borderColor: colors.neutrals.border,
  },
  info: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.overlays.primarySoft, padding: spacing.md,
    borderRadius: radii.lg, marginBottom: spacing.lg,
  },
  row: { flexDirection: "row", alignItems: "center", padding: 12, backgroundColor: colors.neutrals.surface, borderRadius: radii.lg, borderWidth: 1.5, borderColor: colors.neutrals.border, marginBottom: 8 },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.overlays.primarySoft, alignItems: "center", justifyContent: "center" },
  pkgGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: spacing.md },
  pkgCard: { width: "48%", padding: spacing.md, borderRadius: radii.lg, borderWidth: 1.5, borderColor: colors.neutrals.border, backgroundColor: colors.neutrals.surface, alignItems: "center", justifyContent: "center", minHeight: 88 },
  pkgCardActive: { backgroundColor: colors.primary.base, borderColor: colors.primary.base },
  qrBox: { backgroundColor: colors.neutrals.surface, padding: spacing.xl, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.neutrals.border, alignItems: "center", marginTop: spacing.lg },
  successBox: { backgroundColor: colors.overlays.successSoft, padding: spacing.xl, borderRadius: radii.xl, alignItems: "center", marginTop: spacing.lg },
  opChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.full, backgroundColor: colors.neutrals.surface, borderWidth: 1.5, borderColor: colors.neutrals.border },
  modalHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderColor: colors.neutrals.border },
  limitsRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.overlays.primarySoft, padding: 14, borderRadius: radii.lg, marginTop: spacing.lg, borderWidth: 1, borderColor: colors.primary.base + "33" },
  cashInfoBox: { flexDirection: "row", alignItems: "flex-start", backgroundColor: "#D1FAE5", borderWidth: 1, borderColor: "#10B981", borderRadius: radii.xl, padding: spacing.md, marginBottom: spacing.md },
  pinSheetBg: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  pinSheet: { backgroundColor: "white", borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl, padding: spacing.lg, paddingBottom: spacing.xl },
});
