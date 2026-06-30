import React, { useEffect, useState, useCallback } from "react";
import { View, StyleSheet, Platform, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, ScrollView, Alert, Modal } from "react-native";
import WebView from "react-native-webview";
import QRCode from "react-native-qrcode-svg";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../../src/components/Screen";
import { TText } from "../../src/components/TText";
import { Input } from "../../src/components/Input";
import { Button } from "../../src/components/Button";
import { api, apiError } from "../../src/api";
import { useAuth } from "../../src/store";
import { colors, spacing, radii } from "../../src/theme";
import { getLocalCurrency, getMomoOps } from "../../src/currency";
import { useTranslation } from "../../src/i18n";

type Method = "cash" | "card" | "momo" | "paypal";
type Pkg = { id: string; amount: number; amount_eur?: number; label: string; currency: string };

const ORIGIN = (process.env.EXPO_PUBLIC_BACKEND_URL || "").replace(/\/$/, "");

export default function Recharge() {
  const { t } = useTranslation();
  const router = useRouter();
  const refreshMe = useAuth((s) => s.refreshMe);
  const wallet = useAuth((s) => s.wallet);
  const user = useAuth((s) => s.user);
  const currency = getLocalCurrency(user?.country, wallet?.currency);
  const momoOps = getMomoOps(user?.country);

  const METHODS: { key: Method; label: string; icon: any; desc: string; available: boolean }[] = [
    { key: "cash", label: t("wallet.methods.cash"), icon: "cash-outline", desc: t("recharge.cashDesc"), available: true },
    { key: "card", label: t("wallet.methods.card"), icon: "card-outline", desc: t("recharge.cardDesc"), available: true },
    { key: "momo", label: t("wallet.methods.mobile"), icon: "phone-portrait-outline", desc: t("recharge.momoDesc"), available: true },
    { key: "paypal", label: "PayPal", icon: "logo-paypal", desc: t("recharge.paypalDesc"), available: true },
  ];

  const [method, setMethod] = useState<Method>("card");
  const [amount, setAmount] = useState("100");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Card / Stripe PaymentSheet (in-app)
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [selectedPkg, setSelectedPkg] = useState<string>("");
  const [customAmount, setCustomAmount] = useState("");
  const [paid, setPaid] = useState<{ amount: number; currency: string } | null>(null);

  // Momo
  const [momoOp, setMomoOp] = useState(momoOps[0] || "Wave");
  const [momoNumber, setMomoNumber] = useState("");
  // PayPal
  const [pplEmail, setPplEmail] = useState("");
  // Comptes liés
  const [linkedAccounts, setLinkedAccounts] = useState<any[]>([]);
  const [selectedLinkedAccount, setSelectedLinkedAccount] = useState<any>(null);
  const [paypalOrderId, setPaypalOrderId] = useState<string | null>(null);
  const [paypalApprovalUrl, setPaypalApprovalUrl] = useState<string | null>(null);
  const [paypalAmount, setPaypalAmount] = useState<number>(0);
  // QR code espèces
  const [cashQr, setCashQr] = useState<{ token: string; amount: number; currency: string; expires_at: string } | null>(null);
  const [cashQrLoading, setCashQrLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadPackages();
      loadLinkedAccounts();
    }, [currency])
  );

  const loadLinkedAccounts = async () => {
    try {
      const { data } = await api.get("/wallet/linked-accounts");
      setLinkedAccounts(Array.isArray(data) ? data : []);
    } catch {}
  };

  const loadPackages = async () => {
    try {
      // Charger les packages convertis en devise locale
      const { data } = await api.get(`/payments/packages?target_currency=${currency}`);

      // Mapper les packages avec amount (local) et amount_eur (pour Stripe)
      const pkgs = (data?.packages || []).map((p: any) => ({
        id: p.id,
        amount: p.amount,           // Affichage: montant en devise locale (XAF, etc.)
        amount_eur: p.amount_eur,   // Paiement: montant en EUR pour Stripe
        label: p.label,
        currency: data?.currency || currency,
      }));

      setPackages(pkgs);
      if (pkgs.length && !selectedPkg) {
        setSelectedPkg(pkgs[1]?.id || pkgs[0]?.id);
      }
    } catch {}
  };

  // Paiement in-app avec Stripe PaymentSheet (pas de WebView)
  const startCardPayment = async () => {
    setErr(null); setPaid(null); setLoading(true);
    try {
      const displayAmount = parseFloat(customAmount.replace(",", "."));
      if (!displayAmount || displayAmount <= 0) throw new Error(t("recharge.invalidAmount"));

      // Conversion en EUR pour Stripe
      const rate = currency.toUpperCase() === "XAF" || currency.toUpperCase() === "XOF" ? 655.957
        : currency.toUpperCase() === "USD" ? 1.08
        : currency.toUpperCase() === "GBP" ? 0.86
        : currency.toUpperCase() === "MAD" ? 10.85
        : currency.toUpperCase() === "CAD" ? 1.47
        : 1.0;
      const payAmountEur = currency.toUpperCase() === "EUR" ? displayAmount : displayAmount / rate;

      if (payAmountEur <= 0) throw new Error(t("recharge.invalidAmount"));

      // 1. Créer l'intention de paiement côté backend (toujours en EUR pour Stripe)
      const { data: intent } = await api.post("/payments/payment-intent", {
        amount: payAmountEur,
        currency: "eur",  // Stripe requiert EUR
      });

      // 2. Ouvrir PaymentSheet natif Stripe (in-app)
      // Import platform-agnostic : .native.ts sur mobile, .web.ts sur web
      const { initPaymentSheet, presentPaymentSheet } = await import("../../services/stripe-payment");

      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: intent.client_secret,
        merchantDisplayName: "SENDBID",
        style: "automatic",
        allowsDelayedPaymentMethods: false,
        defaultBillingDetails: {
          email: user?.email,
          name: `${user?.first_name || ""} ${user?.last_name || ""}`.trim(),
        },
      });

      if (initError) {
        throw new Error(initError.message);
      }

      // 3. Présenter le sheet de paiement (UI native Stripe in-app)
      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        if (presentError.code === "Canceled") {
          // Utilisateur a annulé, c'est ok
          setLoading(false);
          return;
        }
        throw new Error(presentError.message);
      }

      // 4. Paiement confirmé → créditer le wallet en devise locale
      await api.post("/payments/confirm-payment", {
        payment_intent_id: intent.id,
        amount: displayAmount,
        currency: currency,
      });

      setPaid({ amount: displayAmount, currency });
      await refreshMe();
      Alert.alert(t("recharge.successTitle"), t("recharge.successMsg", { amount: displayAmount.toFixed(0), currency }));

    } catch (e: any) {
      setErr(apiError(e));
    } finally {
      setLoading(false);
    }
  };

  const submitMomo = async () => {
    setErr(null); setLoading(true);
    try {
      const amt = parseFloat(amount.replace(",", "."));
      if (!amt || amt <= 0) throw new Error(t("recharge.invalidAmount"));

      // API CinetPay Mobile Money
      const { data } = await api.post("/momo/initiate-recharge", {
        amount: amt,
        currency: currency,
        operator: momoOp,
        phone_number: momoNumber,
        return_url: "sendbid://payment/success",
      });

      // Pour l'instant simulation en attendant CinetPay
      if (data?.status === "pending") {
        Alert.alert(
          t("recharge.momoPendingTitle"),
          t("recharge.momoPendingMsg", { amount: amt.toFixed(2), currency, operator: momoOp })
        );
      }
      await refreshMe();
      setPaid({ amount: amt, currency });
    } catch (e: any) {
      setErr(apiError(e));
    } finally {
      setLoading(false);
    }
  };

  const submitPaypal = async () => {
    setErr(null); setLoading(true);
    try {
      const amt = parseFloat(amount.replace(",", "."));
      if (!amt || amt <= 0) throw new Error(t("recharge.invalidAmount"));
      if (!pplEmail) throw new Error(t("recharge.paypalEmailRequired"));
      if (!pplEmail.includes("@")) throw new Error(t("recharge.paypalEmailInvalid"));

      // Étape 1: Créer l'ordre PayPal via le backend
      const { data } = await api.post("/payments/paypal/create-order", {
        amount: amt,
        currency: currency,
        email: pplEmail,
      });

      if (data?.order_id && data?.approval_url) {
        // Étape 2: Ouvrir le checkout PayPal dans WebView
        setPaypalOrderId(data.order_id);
        setPaypalAmount(amt);
        setPaypalApprovalUrl(data.approval_url);
      } else {
        throw new Error(t("recharge.paypalError"));
      }

    } catch (e: any) {
      const errorMsg = apiError(e);
      setErr(errorMsg);
      Alert.alert(
        t("recharge.errorTitle") || "Erreur",
        errorMsg,
        [{ text: t("common.ok") || "OK" }]
      );
    } finally {
      setLoading(false);
    }
  };

  // Capture le paiement PayPal après retour de la WebView
  const capturePaypalOrder = async (orderId: string) => {
    setLoading(true);
    try {
      const { data } = await api.post("/payments/paypal/capture-order", {
        order_id: orderId,
      });

      if (data?.credited || data?.status === "COMPLETED") {
        // Paiement réussi
        await refreshMe();
        setPaid({ amount: paypalAmount, currency });
        setPaypalOrderId(null);
        setPaypalApprovalUrl(null);
        Alert.alert(
          t("recharge.successTitle"),
          t("recharge.successMsg", { amount: paypalAmount.toFixed(2), currency })
        );
      } else {
        throw new Error(t("recharge.paypalError"));
      }
    } catch (e: any) {
      const errorMsg = apiError(e);
      setErr(errorMsg);
      Alert.alert(
        t("recharge.errorTitle") || "Erreur",
        errorMsg,
        [{ text: t("common.ok") || "OK" }]
      );
    } finally {
      setLoading(false);
    }
  };

  // Gérer la navigation dans la WebView PayPal
  const onPaypalNavChange = (navState: any) => {
    const { url } = navState;
    
    // Détecter le succès (URL de retour avec token)
    if (url?.includes("sendbid://payment/success") || url?.includes("/success")) {
      setPaypalApprovalUrl(null);
      if (paypalOrderId) {
        capturePaypalOrder(paypalOrderId);
      }
    }
    
    // Détecter l'annulation
    if (url?.includes("sendbid://payment/cancel") || url?.includes("/cancel")) {
      setPaypalApprovalUrl(null);
      setPaypalOrderId(null);
      Alert.alert(
        t("recharge.errorTitle") || "Erreur",
        t("recharge.paypalCancelled") || "Paiement PayPal annulé",
        [{ text: t("common.ok") || "OK" }]
      );
    }
  };

  return (
    <Screen title={t("recharge.title")} back hero scroll={false}>
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
              <TText variant="title" weight="extraBold" align="center" style={{ marginTop: 8 }}>{t("recharge.successTitle")}</TText>
              <TText variant="body" color={colors.neutrals.textSecondary} align="center">{t("recharge.successMsg", { amount: paid.amount.toFixed(2), currency: paid.currency })}</TText>
            </View>
          ) : (
            <View style={{ marginTop: spacing.lg }}>
              {method === "card" ? (
                <>
                  {/* Comptes bancaires enregistrés */}
                  {linkedAccounts.filter((a) => a.type === "bank").length > 0 ? (
                    <>
                      <TText variant="caption" weight="semiBold" color={colors.neutrals.textSecondary} style={{ marginBottom: 8 }}>
                        Mes comptes bancaires
                      </TText>
                      {linkedAccounts.filter((a) => a.type === "bank").map((card) => {
                        const isPending = card.status === "pending";
                        return (
                          <TouchableOpacity
                            key={card.id}
                            onPress={() => !isPending && setSelectedLinkedAccount(card)}
                            activeOpacity={isPending ? 1 : 0.7}
                            style={[styles.cardRow, selectedLinkedAccount?.id === card.id && styles.cardRowActive, isPending && { opacity: 0.6 }]}
                          >
                            <View style={[styles.cardIcon, selectedLinkedAccount?.id === card.id && { backgroundColor: colors.primary.base }]}>
                              <Ionicons name="business-outline" size={20} color={selectedLinkedAccount?.id === card.id ? "white" : colors.primary.base} />
                            </View>
                            <View style={{ flex: 1, marginLeft: 12 }}>
                              <TText variant="caption" weight="extraBold" color={selectedLinkedAccount?.id === card.id ? colors.primary.base : colors.neutrals.textPrimary}>
                                {card.label || card.bank_name || "Compte bancaire"}
                              </TText>
                              <TText variant="label" color={colors.neutrals.textSecondary}>
                                {card.identifier || card.iban || ""}
                              </TText>
                              {isPending ? (
                                <View style={styles.pendingBadge}>
                                  <Ionicons name="time-outline" size={11} color="#92400E" />
                                  <TText variant="label" color="#92400E" style={{ marginLeft: 3 }}>En attente de vérification</TText>
                                </View>
                              ) : null}
                            </View>
                            {selectedLinkedAccount?.id === card.id ? (
                              <Ionicons name="checkmark-circle" size={22} color={colors.primary.base} />
                            ) : null}
                          </TouchableOpacity>
                        );
                      })}
                      <View style={styles.dividerLine} />
                    </>
                  ) : (
                    <View style={styles.noCardBox}>
                      <Ionicons name="business-outline" size={28} color={colors.neutrals.textSecondary} />
                      <TText variant="caption" color={colors.neutrals.textSecondary} align="center" style={{ marginTop: 8 }}>
                        Aucun compte bancaire enregistré.{"\n"}Ajoutez-en un dans Comptes liés.
                      </TText>
                    </View>
                  )}

                  {/* Champ montant */}
                  <Input
                    label={`Montant à recharger (${currency})`}
                    value={customAmount}
                    onChangeText={setCustomAmount}
                    keyboardType="decimal-pad"
                    icon="cash-outline"
                    placeholder={`Ex : 50`}
                  />

                  <Button
                    testID="recharge-pay-card"
                    title={loading ? t("recharge.processing") : t("recharge.payByCard")}
                    onPress={startCardPayment}
                    loading={loading}
                    disabled={!customAmount || parseFloat(customAmount) <= 0}
                    icon="card"
                  />
                </>
              ) : method === "momo" ? (
                <>
                  {/* Comptes Mobile Money liés */}
                  {linkedAccounts.filter(a => a.type === "momo").length > 0 && (
                    <>
                      <TText variant="caption" weight="semiBold" color={colors.neutrals.textSecondary} style={{ marginBottom: 8 }}>Comptes liés</TText>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                        {linkedAccounts.filter(a => a.type === "momo").map((acc) => (
                          <TouchableOpacity
                            key={acc.id}
                            onPress={() => {
                              setMomoOp(acc.operator || "Wave");
                              setMomoNumber(acc.identifier);
                              setSelectedLinkedAccount(acc);
                            }}
                            style={[styles.opChip, selectedLinkedAccount?.id === acc.id && { backgroundColor: colors.primary.base, borderColor: colors.primary.base }]}
                          >
                            <TText variant="caption" weight="bold" color={selectedLinkedAccount?.id === acc.id ? "white" : colors.neutrals.textPrimary}>
                              {acc.label || acc.operator} · {acc.identifier.slice(-4)}
                            </TText>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  )}
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                    {momoOps.map((op) => (
                      <TouchableOpacity key={op} onPress={() => setMomoOp(op)} style={[styles.opChip, momoOp === op && { backgroundColor: colors.primary.base, borderColor: colors.primary.base }]}>
                        <TText variant="caption" weight="bold" color={momoOp === op ? "white" : colors.neutrals.textPrimary}>{op}</TText>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Input label={t("recharge.phoneNumber")} value={momoNumber} onChangeText={(txt) => { setMomoNumber(txt); setSelectedLinkedAccount(null); }} icon="call-outline" keyboardType="phone-pad" />
                  <Input label={t("recharge.amount", { currency })} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" icon="cash-outline" />
                  <Button
                    title={t("recharge.rechargeVia", { operator: momoOp })}
                    onPress={submitMomo}
                    loading={loading}
                    disabled={!momoNumber || parseFloat(amount) <= 0}
                    icon="phone-portrait-outline"
                  />
                </>
              ) : method === "paypal" ? (
                <>
                  {/* Comptes PayPal liés */}
                  {linkedAccounts.filter(a => a.type === "paypal").length > 0 && (
                    <>
                      <TText variant="caption" weight="semiBold" color={colors.neutrals.textSecondary} style={{ marginBottom: 8 }}>Comptes PayPal liés</TText>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                        {linkedAccounts.filter(a => a.type === "paypal").map((acc) => (
                          <TouchableOpacity
                            key={acc.id}
                            onPress={() => {
                              setPplEmail(acc.identifier);
                              setSelectedLinkedAccount(acc);
                            }}
                            style={[styles.opChip, selectedLinkedAccount?.id === acc.id && { backgroundColor: colors.primary.base, borderColor: colors.primary.base }]}
                          >
                            <TText variant="caption" weight="bold" color={selectedLinkedAccount?.id === acc.id ? "white" : colors.neutrals.textPrimary}>
                              {acc.identifier}
                            </TText>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  )}
                  <Input label={t("recharge.paypalEmail")} value={pplEmail} onChangeText={(txt) => { setPplEmail(txt); setSelectedLinkedAccount(null); }} icon="mail-outline" keyboardType="email-address" autoCapitalize="none" />
                  <Input label={t("recharge.amount", { currency })} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" icon="cash-outline" />
                  <Button
                    title={t("recharge.payWithPaypal")}
                    onPress={submitPaypal}
                    loading={loading}
                    disabled={!pplEmail || parseFloat(amount) <= 0}
                    icon="logo-paypal"
                  />
                </>
              ) : method === "cash" ? (
                <>
                  <View style={styles.cashInfoBox}>
                    <Ionicons name="storefront" size={22} color="#065F46" />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <TText variant="caption" weight="extraBold" color="#065F46">{t("recharge.cashAgentTitle")}</TText>
                      <TText variant="label" color="#065F46" style={{ marginTop: 4, lineHeight: 18 }}>
                        {t("recharge.cashSteps")}
                      </TText>
                    </View>
                  </View>
                  <Input label={t("recharge.amountDeposit", { currency })} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" icon="cash-outline" />
                  <Button
                    testID="recharge-cash-qr"
                    title={cashQrLoading ? "Génération..." : t("recharge.generateQR")}
                    icon="qr-code"
                    loading={cashQrLoading}
                    onPress={async () => {
                      const a = parseFloat(amount.replace(",", "."));
                      if (!a || a <= 0) { setErr(t("recharge.invalidAmount")); return; }
                      setErr(null);
                      setCashQrLoading(true);
                      try {
                        const { data } = await api.post("/wallet/recharge-qr", { amount: a });
                        setCashQr({ token: data.qr_token, amount: a, currency, expires_at: data.expires_at });
                      } catch (e: any) {
                        setErr(apiError(e));
                      } finally {
                        setCashQrLoading(false);
                      }
                    }}
                    disabled={parseFloat(amount) <= 0 || cashQrLoading}
                  />

                  {/* Modal QR code recharge espèces */}
                  <Modal visible={!!cashQr} transparent animationType="fade" onRequestClose={() => setCashQr(null)}>
                    <View style={styles.qrOverlay}>
                      <View style={styles.qrCard}>
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md }}>
                          <TText variant="subtitle" weight="extraBold">Code de recharge</TText>
                          <TouchableOpacity onPress={() => setCashQr(null)} hitSlop={10}>
                            <Ionicons name="close" size={24} color={colors.neutrals.textPrimary} />
                          </TouchableOpacity>
                        </View>
                        <View style={styles.qrCodeWrap}>
                          {cashQr ? <QRCode value={cashQr.token} size={200} color="#0F1B40" backgroundColor="white" /> : null}
                        </View>
                        <TText variant="title" weight="extraBold" align="center" style={{ marginTop: spacing.lg }}>
                          {cashQr?.amount.toFixed(2)} {cashQr?.currency}
                        </TText>
                        <TText variant="caption" color={colors.neutrals.textSecondary} align="center" style={{ marginTop: 4 }}>
                          Présentez ce QR code à l’agent SENDBID
                        </TText>
                        {cashQr?.expires_at ? (
                          <View style={styles.expireRow}>
                            <Ionicons name="time-outline" size={14} color="#92400E" />
                            <TText variant="label" color="#92400E" style={{ marginLeft: 4 }}>
                              Expire le {new Date(cashQr.expires_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                            </TText>
                          </View>
                        ) : null}
                        <Button
                          title="Fermer"
                          icon="checkmark-circle-outline"
                          style={{ marginTop: spacing.lg }}
                          onPress={() => setCashQr(null)}
                        />
                      </View>
                    </View>
                  </Modal>
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
                  <TText variant="caption" weight="bold" color={colors.primary.base}>{t("recharge.modifyLimits")}</TText>
                  <TText variant="label" color={colors.neutrals.textSecondary} style={{ marginTop: 2 }}>
                    {t("recharge.modifyLimitsSub")}
                  </TText>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.primary.base} />
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        {/* Modal PayPal WebView Checkout */}
        <Modal
          visible={!!paypalApprovalUrl}
          animationType="slide"
          onRequestClose={() => {
            setPaypalApprovalUrl(null);
            setPaypalOrderId(null);
          }}
        >
          <View style={{ flex: 1, backgroundColor: "white" }}>
            <View style={styles.paypalModalHeader}>
              <TouchableOpacity
                onPress={() => {
                  setPaypalApprovalUrl(null);
                  setPaypalOrderId(null);
                }}
                style={{ padding: 8 }}
              >
                <Ionicons name="close" size={24} color={colors.neutrals.textPrimary} />
              </TouchableOpacity>
              <TText variant="subtitle" weight="bold" style={{ flex: 1, textAlign: "center" }}>
                {t("recharge.paypalCheckoutTitle") || "Paiement PayPal"}
              </TText>
              <View style={{ width: 40 }} />
            </View>
            {paypalApprovalUrl ? (
              Platform.OS === "web" ? (
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
                  <Ionicons name="logo-paypal" size={48} color="#003087" />
                  <TText variant="body" align="center" style={{ marginTop: 12 }}>
                    {t("recharge.paypalOpenBrowser") || "Ouvrez PayPal dans votre navigateur pour finaliser le paiement."}
                  </TText>
                  <Button
                    title={t("recharge.paypalOpenLink") || "Ouvrir PayPal"}
                    icon="open-outline"
                    style={{ marginTop: 16 }}
                    onPress={() => {
                      if (paypalOrderId) capturePaypalOrder(paypalOrderId);
                    }}
                  />
                </View>
              ) : (
                <WebView
                  source={{ uri: paypalApprovalUrl }}
                  onNavigationStateChange={onPaypalNavChange}
                  startInLoadingState
                  renderLoading={() => (
                    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                      <ActivityIndicator color={colors.primary.base} />
                    </View>
                  )}
                />
              )
            ) : null}
          </View>
        </Modal>
      </KeyboardAvoidingView>
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
  limitsRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.overlays.primarySoft, padding: 14, borderRadius: radii.lg, marginTop: spacing.lg, borderWidth: 1, borderColor: colors.primary.base + "33" },
  cashInfoBox: { flexDirection: "row", alignItems: "flex-start", backgroundColor: "#D1FAE5", borderWidth: 1, borderColor: "#10B981", borderRadius: radii.xl, padding: spacing.md, marginBottom: spacing.md },
  paypalModalHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.neutrals.border, backgroundColor: colors.neutrals.background },
  qrOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: spacing.lg },
  qrCard: { backgroundColor: "white", borderRadius: radii.xxl, padding: spacing.xl, width: "100%", maxWidth: 340, alignItems: "stretch" },
  qrCodeWrap: { alignItems: "center", justifyContent: "center", backgroundColor: "white", padding: spacing.lg, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.neutrals.border },
  expireRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: spacing.md, backgroundColor: "#FEF3C7", borderRadius: radii.full, paddingHorizontal: 12, paddingVertical: 6, alignSelf: "center" },
  cardRow: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: radii.xl, borderWidth: 1.5, borderColor: colors.neutrals.border, backgroundColor: colors.neutrals.surface, marginBottom: 8 },
  cardRowActive: { borderColor: colors.primary.base, backgroundColor: colors.overlays.primarySoft },
  cardIcon: { width: 40, height: 40, borderRadius: radii.full, backgroundColor: colors.overlays.primarySoft, alignItems: "center", justifyContent: "center" },
  dividerLine: { height: 1, backgroundColor: colors.neutrals.border, marginVertical: spacing.md },
  noCardBox: { alignItems: "center", backgroundColor: colors.neutrals.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.neutrals.border, padding: spacing.xl, marginBottom: spacing.md },
  pendingBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "#FEF3C7", borderRadius: radii.full, paddingHorizontal: 8, paddingVertical: 3, marginTop: 4, alignSelf: "flex-start" },
});
