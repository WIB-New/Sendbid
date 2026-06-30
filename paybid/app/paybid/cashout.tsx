import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity, TextInput, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { TText } from "../../src/components/TText";
import { Button } from "../../src/components/Button";
import { api, apiError } from "../../src/api";
import { PinBiometryModal } from "../../src/components/PinBiometryModal";
import { paybidColors } from "../../src/paybidTheme";
import { spacing, radii } from "../../src/theme";
import { useTranslation } from "../../src/i18n";

type Method = "momo" | "bank";

export default function AgentCashout() {
  const { t } = useTranslation();
  const router = useRouter();
  const [balance, setBalance] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [method, setMethod] = useState<Method>("momo");
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [operator, setOperator] = useState("orange_money");
  const [iban, setIban] = useState("");
  const [bankName, setBankName] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPin, setShowPin] = useState(false);

  const loadBalance = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/agent/balance");
      setBalance(data);
    } catch {} finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { loadBalance(); }, [loadBalance]));

  const validateBeforePin = () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { Alert.alert("Erreur", "Montant invalide"); return; }
    if (amt > (balance?.balance_eur || 0)) { Alert.alert("Erreur", "Solde insuffisant"); return; }
    if (method === "momo" && !phone.trim()) { Alert.alert("Erreur", "Numéro Mobile Money requis"); return; }
    if (method === "bank" && !iban.trim()) { Alert.alert("Erreur", "IBAN requis"); return; }
    // Tout est valide -> demander le PIN
    setShowPin(true);
  };

  const submit = async () => {
    setShowPin(false);
    const amt = parseFloat(amount);
    const body: any = { amount: amt, method };
    if (method === "momo") {
      body.phone = phone.trim();
      body.operator = operator;
    } else {
      body.iban = iban.trim();
      body.bank_name = bankName.trim();
    }

    setBusy(true);
    try {
      const { data } = await api.post("/agent/cashout", body);
      Alert.alert("Retrait initié", data.message || `${amt.toFixed(2)} EUR en cours d'envoi.`);
      setAmount("");
      loadBalance();
    } catch (e: any) {
      Alert.alert("Erreur", apiError(e));
    } finally { setBusy(false); }
  };

  const operators = [
    { id: "orange_money", label: "Orange Money" },
    { id: "mtn_money", label: "MTN MoMo" },
    { id: "wave", label: "Wave" },
    { id: "m_pesa", label: "M-Pesa" },
    { id: "airtel_money", label: "Airtel Money" },
  ];

  if (loading) return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: paybidColors.neutrals.background, justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator size="large" color={paybidColors.primary.base} />
    </SafeAreaView>
  );

  return (
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: paybidColors.neutrals.background }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={26} color={paybidColors.neutrals.textPrimary} />
        </TouchableOpacity>
        <TText weight="extraBold" style={{ flex: 1, marginLeft: 8, fontSize: 16 }}>Retirer mes gains</TText>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}>
        {/* Solde */}
        <View style={styles.balanceCard}>
          <TText variant="caption" color="rgba(255,255,255,0.8)">Solde disponible</TText>
          <TText variant="display" weight="extraBold" color="white" style={{ marginTop: 4 }}>
            {(balance?.balance_eur || 0).toFixed(2)} EUR
          </TText>
          <View style={{ flexDirection: "row", marginTop: 8, gap: 16 }}>
            <View>
              <TText variant="label" color="rgba(255,255,255,0.6)">Total gagné</TText>
              <TText variant="caption" weight="bold" color="white">{(balance?.total_earned_eur || 0).toFixed(2)} EUR</TText>
            </View>
            <View>
              <TText variant="label" color="rgba(255,255,255,0.6)">Déjà retiré</TText>
              <TText variant="caption" weight="bold" color="white">{(balance?.total_cashed_out_eur || 0).toFixed(2)} EUR</TText>
            </View>
          </View>
        </View>

        {/* Méthode */}
        <TText weight="bold" style={{ marginTop: spacing.xl, marginBottom: 8 }}>Méthode de retrait</TText>
        <View style={{ flexDirection: "row", gap: 10, marginBottom: spacing.md }}>
          <TouchableOpacity style={[styles.methodBtn, method === "momo" && styles.methodActive]} onPress={() => setMethod("momo")}>
            <Ionicons name="phone-portrait" size={20} color={method === "momo" ? "white" : paybidColors.primary.base} />
            <TText weight="bold" style={{ marginLeft: 6, color: method === "momo" ? "white" : paybidColors.neutrals.textPrimary }}>Mobile Money</TText>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.methodBtn, method === "bank" && styles.methodActive]} onPress={() => setMethod("bank")}>
            <Ionicons name="business" size={20} color={method === "bank" ? "white" : paybidColors.primary.base} />
            <TText weight="bold" style={{ marginLeft: 6, color: method === "bank" ? "white" : paybidColors.neutrals.textPrimary }}>Virement bancaire</TText>
          </TouchableOpacity>
        </View>

        {/* Montant */}
        <View style={styles.field}>
          <TText variant="caption" weight="bold" style={{ marginBottom: 4 }}>Montant (EUR)</TText>
          <TextInput
            value={amount} onChangeText={setAmount}
            keyboardType="numeric" placeholder="0.00"
            placeholderTextColor={paybidColors.neutrals.textTertiary}
            style={styles.input}
          />
          <TouchableOpacity onPress={() => setAmount(String(balance?.balance_eur || 0))} style={styles.maxBtn}>
            <TText variant="label" weight="bold" color={paybidColors.primary.base}>MAX</TText>
          </TouchableOpacity>
        </View>

        {/* Champs selon méthode */}
        {method === "momo" ? (
          <>
            <View style={styles.field}>
              <TText variant="caption" weight="bold" style={{ marginBottom: 4 }}>Opérateur</TText>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {operators.map((op) => (
                  <TouchableOpacity key={op.id} style={[styles.chip, operator === op.id && styles.chipActive]} onPress={() => setOperator(op.id)}>
                    <TText style={{ fontSize: 11, fontWeight: "700", color: operator === op.id ? "white" : paybidColors.neutrals.textPrimary }}>{op.label}</TText>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.field}>
              <TText variant="caption" weight="bold" style={{ marginBottom: 4 }}>Numéro Mobile Money</TText>
              <TextInput
                value={phone} onChangeText={setPhone}
                keyboardType="phone-pad" placeholder="+237 6XX XXX XXX"
                placeholderTextColor={paybidColors.neutrals.textTertiary}
                style={styles.input}
              />
            </View>
          </>
        ) : (
          <>
            <View style={styles.field}>
              <TText variant="caption" weight="bold" style={{ marginBottom: 4 }}>Nom de la banque</TText>
              <TextInput
                value={bankName} onChangeText={setBankName}
                placeholder="Ex: Afriland First Bank"
                placeholderTextColor={paybidColors.neutrals.textTertiary}
                style={styles.input}
              />
            </View>
            <View style={styles.field}>
              <TText variant="caption" weight="bold" style={{ marginBottom: 4 }}>IBAN / RIB</TText>
              <TextInput
                value={iban} onChangeText={setIban}
                placeholder="CM21 XXXX XXXX XXXX XXXX"
                placeholderTextColor={paybidColors.neutrals.textTertiary}
                style={styles.input}
                autoCapitalize="characters"
              />
            </View>
          </>
        )}

        {/* Info */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={16} color={paybidColors.primary.base} />
          <TText variant="caption" color={paybidColors.neutrals.textSecondary} style={{ marginLeft: 8, flex: 1 }}>
            {method === "momo"
              ? "Le retrait Mobile Money est traité en quelques minutes. Des frais opérateur peuvent s'appliquer."
              : "Le virement bancaire est traité sous 1-3 jours ouvrés."}
          </TText>
        </View>

        {/* Bouton */}
        <Button
          title={busy ? "Traitement..." : `Retirer ${amount ? parseFloat(amount).toFixed(2) : "0.00"} EUR`}
          icon="arrow-up-circle"
          onPress={validateBeforePin}
          loading={busy}
          disabled={!amount || parseFloat(amount) <= 0}
          style={{ backgroundColor: paybidColors.primary.base, marginTop: spacing.lg }}
        />
      </ScrollView>
      <PinBiometryModal visible={showPin} onSuccess={submit} onCancel={() => setShowPin(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: paybidColors.neutrals.border,
  },
  balanceCard: {
    backgroundColor: paybidColors.primary.base,
    padding: spacing.xl, borderRadius: radii.xxl,
  },
  methodBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 14, borderRadius: radii.lg,
    backgroundColor: paybidColors.neutrals.surface,
    borderWidth: 1, borderColor: paybidColors.neutrals.border,
  },
  methodActive: {
    backgroundColor: paybidColors.primary.base, borderColor: paybidColors.primary.base,
  },
  field: { marginBottom: spacing.md },
  input: {
    backgroundColor: paybidColors.neutrals.surface, borderRadius: radii.lg,
    borderWidth: 1, borderColor: paybidColors.neutrals.border,
    padding: 14, fontSize: 16, color: paybidColors.neutrals.textPrimary,
  },
  maxBtn: {
    position: "absolute", right: 14, top: 32,
    backgroundColor: paybidColors.overlays?.primarySoft || "#EFF6FF",
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: radii.full,
  },
  chip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.full,
    backgroundColor: paybidColors.neutrals.surface,
    borderWidth: 1, borderColor: paybidColors.neutrals.border,
  },
  chipActive: {
    backgroundColor: paybidColors.primary.base, borderColor: paybidColors.primary.base,
  },
  infoBox: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: paybidColors.overlays?.primarySoft || "#EFF6FF",
    padding: 12, borderRadius: radii.lg, marginTop: spacing.md,
  },
});
