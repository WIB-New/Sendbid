import React, { useState } from "react";
import { View, StyleSheet, Alert, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../../src/components/Screen";
import { TText } from "../../src/components/TText";
import { Input } from "../../src/components/Input";
import { Button } from "../../src/components/Button";
import { api, apiError } from "../../src/api";
import { colors, spacing, radii } from "../../src/theme";
import { useTranslation } from "../../src/i18n";

function luhnOK(num: string) {
  const s = num.replace(/\s+/g, "");
  if (!/^\d{12,19}$/.test(s)) return false;
  let sum = 0, alt = false;
  for (let i = s.length - 1; i >= 0; i--) {
    let n = parseInt(s[i]);
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

export default function AddCard() {
  const { t } = useTranslation();
  const router = useRouter();
  const [number, setNumber] = useState("");
  const [holder, setHolder] = useState("");
  const [exp, setExp] = useState("");
  const [cvc, setCvc] = useState("");
  const [save, setSave] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const brand = (() => {
    const n = number.replace(/\s+/g, "");
    if (n.startsWith("4")) return { name: "Visa", icon: "card" as const, color: "#1A1F71" };
    if (/^5[1-5]/.test(n) || /^2[2-7]/.test(n)) return { name: "Mastercard", icon: "card" as const, color: "#EB001B" };
    if (/^3[47]/.test(n)) return { name: "American Express", icon: "card" as const, color: "#2E77BB" };
    return { name: "Carte", icon: "card-outline" as const, color: colors.primary.base };
  })();

  const formatNumber = (v: string) => v.replace(/\D/g, "").slice(0, 19).replace(/(.{4})/g, "$1 ").trim();
  const formatExp = (v: string) => {
    const n = v.replace(/\D/g, "").slice(0, 4);
    if (n.length < 3) return n;
    return `${n.slice(0, 2)}/${n.slice(2)}`;
  };

  const submit = async () => {
    setErr(null);
    if (!luhnOK(number)) { setErr("Numéro de carte invalide"); return; }
    if (!holder) { setErr("Titulaire requis"); return; }
    if (!/^\d{2}\/\d{2}$/.test(exp)) { setErr("Date d'expiration invalide (MM/AA)"); return; }
    if (!/^\d{3,4}$/.test(cvc)) { setErr("CVC invalide"); return; }
    setBusy(true);
    try {
      // En production : tokeniser via Stripe.js puis envoyer le token au backend.
      // Stub demo : enregistre les 4 derniers chiffres + brand seulement (jamais le PAN complet).
      const last4 = number.replace(/\s+/g, "").slice(-4);
      await api.post("/payment-methods", {
        type: "card",
        brand: brand.name.toLowerCase(),
        last4,
        holder,
        exp_month: parseInt(exp.split("/")[0]),
        exp_year: 2000 + parseInt(exp.split("/")[1]),
        save,
      });
      Alert.alert("Carte ajoutée", `${brand.name} •••• ${last4} a bien été enregistrée.`, [{ text: "OK", onPress: () => router.back() }]);
    } catch (e: any) {
      setErr(apiError(e));
    } finally { setBusy(false); }
  };

  return (
    <Screen title="Ajouter une carte bancaire" back>
      {/* Card preview */}
      <View style={[styles.cardPreview, { backgroundColor: brand.color }]}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Ionicons name="wifi" size={22} color="rgba(255,255,255,0.85)" style={{ transform: [{ rotate: "90deg" }] }} />
          <TText variant="caption" color="white" weight="extraBold">{brand.name}</TText>
        </View>
        <TText variant="title" weight="bold" color="white" style={{ marginTop: 28, letterSpacing: 3 }}>
          {(number || "•••• •••• •••• ••••").padEnd(19, "•").slice(0, 19)}
        </TText>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 16 }}>
          <View>
            <TText variant="label" color="rgba(255,255,255,0.7)">Titulaire</TText>
            <TText variant="caption" weight="bold" color="white">{holder.toUpperCase() || "NOM PRÉNOM"}</TText>
          </View>
          <View>
            <TText variant="label" color="rgba(255,255,255,0.7)">Expire</TText>
            <TText variant="caption" weight="bold" color="white">{exp || "MM/AA"}</TText>
          </View>
        </View>
      </View>

      <Input testID="card-number" label="Numéro de carte" value={number} onChangeText={(v) => setNumber(formatNumber(v))} keyboardType="number-pad" icon="card-outline" placeholder="4242 4242 4242 4242" />
      <Input testID="card-holder" label="Titulaire" value={holder} onChangeText={setHolder} icon="person-outline" autoCapitalize="characters" />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Input testID="card-exp" label="Expiration (MM/AA)" value={exp} onChangeText={(v) => setExp(formatExp(v))} keyboardType="number-pad" icon="calendar-outline" placeholder="12/27" />
        </View>
        <View style={{ flex: 1 }}>
          <Input testID="card-cvc" label="CVC" value={cvc} onChangeText={(v) => setCvc(v.replace(/\D/g, "").slice(0, 4))} keyboardType="number-pad" icon="lock-closed-outline" placeholder="123" passwordToggle secureTextEntry />
        </View>
      </View>

      <TouchableOpacity onPress={() => setSave((s) => !s)} style={styles.saveRow}>
        <Ionicons name={save ? "checkbox" : "square-outline"} size={22} color={save ? colors.primary.base : colors.neutrals.textSecondary} />
        <TText variant="caption" weight="semiBold" style={{ marginLeft: 10, flex: 1 }}>
          Enregistrer cette carte pour mes prochains paiements
        </TText>
      </TouchableOpacity>

      <View style={styles.secNote}>
        <Ionicons name="shield-checkmark" size={16} color="#10B981" />
        <TText variant="label" color="#065F46" style={{ marginLeft: 8, flex: 1 }}>
          Paiement sécurisé via Stripe • 3D Secure • Conformité PCI-DSS niveau 1
        </TText>
      </View>

      {err ? <TText variant="caption" color={colors.status.error} style={{ marginTop: 8 }}>{err}</TText> : null}

      <Button testID="add-card-submit" title="Ajouter la carte" icon="shield-checkmark" onPress={submit} loading={busy} style={{ marginTop: spacing.lg }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardPreview: { borderRadius: radii.xxl, padding: spacing.lg, marginBottom: spacing.lg, minHeight: 180 },
  saveRow: { flexDirection: "row", alignItems: "center", padding: 14, backgroundColor: colors.overlays.primarySoft, borderRadius: radii.lg, marginTop: spacing.sm },
  secNote: { flexDirection: "row", alignItems: "flex-start", padding: 12, backgroundColor: "rgba(16,185,129,0.10)", borderRadius: radii.lg, marginTop: spacing.md, borderWidth: 1, borderColor: "rgba(16,185,129,0.25)" },
});
