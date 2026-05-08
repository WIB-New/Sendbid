import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, Platform, TouchableOpacity, ActivityIndicator, Modal, Linking, KeyboardAvoidingView, ScrollView, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import { Screen } from "../../src/components/Screen";
import { TText } from "../../src/components/TText";
import { Input } from "../../src/components/Input";
import { Button } from "../../src/components/Button";
import { api, apiError } from "../../src/api";
import { useAuth } from "../../src/store";
import { colors, spacing, radii } from "../../src/theme";

type Method = "cash" | "card" | "momo" | "paypal";
type Pkg = { id: string; amount: number; label: string };

const METHODS: { key: Method; label: string; icon: any; desc: string; available: boolean }[] = [
  { key: "cash", label: "Espèces", icon: "cash-outline", desc: "Dépôt en espèces chez un agent agréé. Crédit sous 5-15 minutes après confirmation par l'agent.", available: true },
  { key: "card", label: "Carte", icon: "card-outline", desc: "Visa / Mastercard / 3DS via Stripe", available: true },
  { key: "momo", label: "Mobile", icon: "phone-portrait-outline", desc: "Wave, Orange Money, MTN MoMo, Moov", available: true },
  { key: "paypal", label: "PayPal", icon: "logo-paypal", desc: "Compte PayPal", available: true },
];

const ORIGIN = (process.env.EXPO_PUBLIC_BACKEND_URL || "").replace(/\/$/, "");

export default function Recharge() {
  const router = useRouter();
  const refreshMe = useAuth((s) => s.refreshMe);
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
  // PayPal
  const [pplEmail, setPplEmail] = useState("");

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
      const { data } = await api.post("/wallet/recharge-qr", { amount: parseFloat(amount) });
      await refreshMe();
      setPaid({ amount: parseFloat(amount) });
    } catch (e: any) { setErr(apiError(e)); } finally { setLoading(false); }
  };

  return (
    <Screen title="Ajouter de l'argent" back hero scroll={false}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
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
                  <TText variant="caption" weight="semiBold" color={colors.neutrals.textSecondary} style={{ marginBottom: 8 }}>Forfaits</TText>
                  <View style={styles.pkgGrid}>
                    {packages.map((p) => (
                      <TouchableOpacity key={p.id} testID={`recharge-pkg-${p.id}`} onPress={() => setSelectedPkg(p.id)} style={[styles.pkgCard, selectedPkg === p.id && styles.pkgCardActive]}>
                        <TText variant="title" weight="extraBold" color={selectedPkg === p.id ? "white" : colors.neutrals.textPrimary}>{p.amount.toFixed(0)} €</TText>
                        <TText variant="caption" color={selectedPkg === p.id ? "white" : colors.neutrals.textSecondary}>{p.label}</TText>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity testID="recharge-pkg-custom" onPress={() => setSelectedPkg("custom")} style={[styles.pkgCard, selectedPkg === "custom" && styles.pkgCardActive]}>
                      <Ionicons name="create-outline" size={22} color={selectedPkg === "custom" ? "white" : colors.primary.base} />
                      <TText variant="caption" weight="bold" color={selectedPkg === "custom" ? "white" : colors.neutrals.textPrimary} style={{ marginTop: 4 }}>Personnalisé</TText>
                    </TouchableOpacity>
                  </View>
                  {selectedPkg === "custom" ? <Input label="Montant 5–500 €" value={customAmount} onChangeText={setCustomAmount} keyboardType="decimal-pad" icon="cash-outline" /> : null}
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
                  <Input label="Email PayPal" value={pplEmail} onChangeText={setPplEmail} icon="mail-outline" keyboardType="email-address" autoCapitalize="none" />
                  <Input label="Montant (EUR)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" icon="cash-outline" />
                  <Button title="Payer avec PayPal" onPress={submitPaypal} loading={loading} disabled={!pplEmail || parseFloat(amount) <= 0} icon="logo-paypal" />
                </>
              ) : method === "cash" ? (
                <>
                  <View style={styles.cashInfoBox}>
                    <Ionicons name="storefront" size={22} color="#065F46" />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <TText variant="caption" weight="extraBold" color="#065F46">DÉPÔT EN ESPÈCES — AGENT AGRÉÉ</TText>
                      <TText variant="label" color="#065F46" style={{ marginTop: 4, lineHeight: 18 }}>
                        1. Indiquez le montant ci-dessous{"\n"}
                        2. Présentez le QR généré à un agent SENDBID{"\n"}
                        3. L'agent valide le dépôt — votre solde est crédité instantanément
                      </TText>
                    </View>
                  </View>
                  <Input label="Montant à déposer (EUR)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" icon="cash-outline" />
                  <Button
                    testID="recharge-cash-qr"
                    title="Générer le QR de dépôt"
                    icon="qr-code"
                    onPress={() => {
                      const a = parseFloat(amount.replace(",", "."));
                      if (!a || a <= 0) { setErr("Montant invalide"); return; }
                      // Pour démo : on simule la création d'un dépôt en attente
                      setErr(null);
                      setPaid({ amount: 0 } as any);
                      if (Platform.OS === "web") (window as any).alert(`QR de dépôt généré pour ${a.toFixed(2)} €.\nPrésentez-le à un agent SENDBID. Votre solde sera crédité dès validation.`);
                      else Alert.alert("QR généré", `Présentez-le à un agent SENDBID pour déposer ${a.toFixed(2)} €. Crédit instantané après validation.`);
                    }}
                    disabled={parseFloat(amount) <= 0}
                  />
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
              <TText variant="body" align="center" style={{ marginTop: 12 }}>Ouvrez Stripe dans votre navigateur pour finaliser le paiement.</TText>
              <Button title="Ouvrir Stripe" icon="open-outline" style={{ marginTop: 16 }} onPress={() => Linking.openURL(checkoutUrl)} />
            </View>
          ) : (
            <WebView source={{ uri: checkoutUrl }} onNavigationStateChange={onWebViewNavChange} startInLoadingState renderLoading={() => (<View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={colors.primary.base} /></View>)} />
          )) : null}
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  methodsRow: { flexDirection: "row", gap: 6, marginBottom: spacing.md },
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
});
