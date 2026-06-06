import React, { useEffect, useState } from "react";
import { t, useLocale } from "../../src/i18n";
import { View, StyleSheet, Alert, TouchableOpacity, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../../src/components/Screen";
import { TText } from "../../src/components/TText";
import { Input } from "../../src/components/Input";
import { Button } from "../../src/components/Button";
import { PinGate } from "../../src/components/PinGate";
import { api, apiError } from "../../src/api";
import { useAuth } from "../../src/store";
import { colors, spacing, radii } from "../../src/theme";
import { useThemedColors } from "../../src/themeContext";
export default function BankTransfer() {
  useLocale((st) => st.locale);
  const colors = useThemedColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ contact_name?: string; iban?: string; bank_name?: string; bic_swift?: string }>();
  const refreshMe = useAuth((s) => s.refreshMe);
  const [wallet, setWallet] = useState<any>(null);
  const [amount, setAmount] = useState("");
  const [iban, setIban] = useState((params.iban as string) || "");
  const [holder, setHolder] = useState((params.contact_name as string) || "");
  const [bank, setBank] = useState((params.bank_name as string) || "");
  const [bic, setBic] = useState((params.bic_swift as string) || "");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);

  useEffect(() => {
    api.get("/wallet").then((r) => setWallet(r.data)).catch(() => {});
  }, []);

  // Le tap sur t("walletOps.submit") → ouvre le PIN-gate au lieu d'exécuter directement
  const onPressSubmit = () => {
    setErr(null);
    const v = parseFloat(amount.replace(",", "."));
    if (!v || v <= 0) { setErr("Montant invalide"); return; }
    if (!iban || !holder) { setErr("IBAN et titulaire requis"); return; }
    if (wallet && v > wallet.balance) { setErr("Solde insuffisant"); return; }
    setPinOpen(true);
  };

  // Une fois le PIN validé, on exécute l'API. Le PIN est inclus dans le payload
  // pour respecter le contrat backend (BankWithdrawIn exige `pin`) + defence-in-depth.
  const submitWithPin = async (pin: string) => {
    setPinOpen(false);
    const v = parseFloat(amount.replace(",", "."));
    setBusy(true);
    try {
      await api.post("/wallet/withdraw", {
        amount: v,
        method: "bank",
        pin,
        details: { iban, holder, bank, bic },
      });
      // Rafraîchir le solde localement + dans le store auth
      try {
        const r = await api.get("/wallet");
        setWallet(r.data);
      } catch {}
      await refreshMe();
      Alert.alert(t("walletOps2.transferSent"), `${v.toFixed(2)} EUR ${t("walletOps2.willCredit")} ${iban.slice(-4).padStart(iban.length, "•")}`, [{ text: "OK", onPress: () => router.back() }]);
    } catch (e: any) {
      setErr(apiError(e));
    } finally { setBusy(false); }
  };

  return (
    <Screen title={t("walletOps.bankTitle")} back hero scroll={false}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
        <LinearGradient colors={["#022a6b", "#022a6b"]} style={styles.balanceCard}>
          <TText variant="caption" color="rgba(255,255,255,0.7)">Solde Portefeuille disponible</TText>
          <TText variant="display" weight="extraBold" color="white" style={{ marginTop: 4 }}>
            {wallet ? `${wallet.balance.toFixed(2)} EUR` : "…"}
          </TText>
          <View style={styles.infoRow}>
            <Ionicons name="information-circle-outline" size={14} color="rgba(255,255,255,0.7)" />
            <TText variant="label" color="rgba(255,255,255,0.7)" style={{ marginLeft: 6 }}>Délai 1-3 jours ouvrés • Frais 1 EUR</TText>
          </View>
        </LinearGradient>

        <Input testID="bt-amount" label="Montant à virer (EUR)" value={amount} onChangeText={setAmount} icon="cash-outline" keyboardType="decimal-pad" />
        <Input testID="bt-holder" label="Titulaire du compte" value={holder} onChangeText={setHolder} icon="person-outline" />
        <Input testID="bt-iban" label="IBAN" value={iban} onChangeText={setIban} icon="card-outline" autoCapitalize="characters" />
        <Input testID="bt-bank" label="Nom de la banque" value={bank} onChangeText={setBank} icon="business-outline" />
        <Input testID="bt-bic" label="BIC / SWIFT (optionnel)" value={bic} onChangeText={setBic} icon="key-outline" autoCapitalize="characters" />

        <TouchableOpacity style={styles.saveCheck}>
          <Ionicons name="bookmark-outline" size={18} color={colors.primary.base} />
          <TText variant="caption" color={colors.primary.base} weight="semiBold" style={{ marginLeft: 8, flex: 1 }}>
            Enregistrer ce compte bancaire pour mes prochains virements
          </TText>
          <Ionicons name="checkmark-circle" size={18} color={colors.primary.base} />
        </TouchableOpacity>

        {err ? <TText variant="caption" color={colors.status.error} style={{ marginTop: 8 }}>{err}</TText> : null}

        <Button testID="bt-submit" title={t("walletOps.submit")} icon="arrow-forward" onPress={onPressSubmit} loading={busy} style={{ marginTop: spacing.lg }} />
      </ScrollView>

      {/* PIN-gate avant exécution du virement bancaire — le PIN est envoyé au backend
           (BankWithdrawIn l'exige). On utilise returnPinToCaller pour récupérer le PIN saisi. */}
      <PinGate
        visible={pinOpen}
        title={t("walletOps.bankTitle")}
        subtitle={`Confirmez votre PIN pour valider le virement de ${amount || "0"} EUR`}
        onSuccess={() => {}}
        returnPinToCaller={submitWithPin}
        onCancel={() => setPinOpen(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  balanceCard: { borderRadius: radii.xxl, padding: spacing.lg, marginBottom: spacing.lg },
  infoRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.md },
  saveCheck: { flexDirection: "row", alignItems: "center", padding: 14, backgroundColor: colors.overlays.primarySoft, borderRadius: radii.lg, marginTop: spacing.sm },
});
