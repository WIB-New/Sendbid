/**
 * /paybid/agency/cashout.tsx — Décaissement client (payer retrait / transfert).
 */
import React, { useState } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { TText } from "../../../src/components/TText";
import { Input } from "../../../src/components/Input";
import { Button } from "../../../src/components/Button";
import { api, apiError } from "../../../src/api";
import { paybidColors } from "../../../src/paybidTheme";
import { spacing, radii } from "../../../src/theme";
import { formatMoney } from "../../../src/utils/money";
import { useTranslation } from "../../../src/i18n";

export default function PaybidAgencyCashout() {
  const { t } = useTranslation();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!code.trim() || code.trim().length < 6) { Alert.alert("Erreur", "Veuillez saisir le code de retrait"); return; }
    setBusy(true);
    try {
      const r = await api.post("/agent/agency/cashout", { withdrawal_code: code.trim().toUpperCase() });
      const amt = r.data?.amount || 0;
      const cur = r.data?.currency || "EUR";
      Alert.alert("Retrait validé", `Remettez ${formatMoney(amt, cur)} au client.`, [
        { text: "OK", onPress: () => router.back() }
      ]);
    } catch (e: any) {
      Alert.alert("Erreur", apiError(e));
    } finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: paybidColors.neutrals.background }} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={paybidColors.neutrals.textPrimary} />
        </TouchableOpacity>
        <TText variant="title" weight="extraBold" style={{ marginLeft: 6 }}>Décaisser</TText>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <View style={[styles.brownCard, { backgroundColor: "#54280f" }]}>
          <Ionicons name="arrow-up-circle" size={36} color="white" />
          <TText weight="extraBold" color="white" style={{ fontSize: 16, marginTop: 8 }}>Payer un retrait ou transfert</TText>
          <TText variant="caption" color="rgba(255,255,255,0.85)" style={{ marginTop: 4 }}>
            Saisissez le code de retrait fourni par le client.
          </TText>
        </View>
        <View style={styles.formCard}>
          <Input label="Code de retrait (8 caractères)" value={code} onChangeText={setCode} icon="key" autoCapitalize="characters" maxLength={12} />
          <Button title="Valider et décaisser" icon="cash" loading={busy} disabled={!code} onPress={submit} style={{ marginTop: 14, backgroundColor: "#EF4444" }} />
          <TouchableOpacity onPress={() => router.push("/paybid/scan" as any)} style={{ marginTop: 12, alignItems: "center" }}>
            <TText variant="caption" weight="extraBold" color={paybidColors.primary.base}>
              <Ionicons name="qr-code" size={14} />  Ou scanner le QR du client
            </TText>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", padding: spacing.lg, paddingBottom: 0 },
  backBtn: { padding: 6 },
  brownCard: { padding: spacing.lg, borderRadius: radii.xxl, marginBottom: spacing.md, alignItems: "flex-start" },
  formCard: { backgroundColor: paybidColors.neutrals.surface, padding: spacing.lg, borderRadius: radii.xl, borderWidth: 1, borderColor: paybidColors.neutrals.border },
});
