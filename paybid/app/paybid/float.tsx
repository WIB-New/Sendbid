import React, { useEffect, useState } from "react";
import { View, StyleSheet, TouchableOpacity, Alert, RefreshControl, ScrollView, Modal } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../../src/components/Screen";
import { TText } from "../../src/components/TText";
import { Input } from "../../src/components/Input";
import { Button } from "../../src/components/Button";
import { api, apiError } from "../../src/api";
import { paybidColors as pc } from "../../src/paybidTheme";
import { spacing, radii } from "../../src/theme";
import { useTranslation } from "../../src/i18n";

/**
 * PAYBID Float — Déclaration et gestion des espèces en caisse.
 *
 * Logique métier :
 * - Chaque paiement à un bénéficiaire débite le float en devise locale.
 * - L'agent déclare ses approvisionnements physiques (cash-in).
 * - L'agent verse au siège (settlement) pour réduire le float.
 * - Solde insuffisant = impossible de compléter un transfert.
 */
export default function AgentFloat() {
  const { t } = useTranslation();
  const router = useRouter();
  const [floats, setFloats] = useState<any[]>([]);
  const [moves, setMoves] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showDeclare, setShowDeclare] = useState(false);
  const [showSettle, setShowSettle] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setRefreshing(true);
    try {
      const [fl, mv] = await Promise.all([
        api.get("/agent/float"),
        api.get("/agent/float/movements", { params: { limit: 30 } }),
      ]);
      setFloats(fl.data?.items || []);
      setMoves(mv.data?.items || []);
    } catch (e: any) {
      // pas d'alerte obstrusive
    } finally { setRefreshing(false); }
  };
  useEffect(() => { load(); }, []);

  const currency = floats[0]?.currency || "XOF";
  const balance = floats[0]?.balance ?? 0;

  const submit = async (mode: "declare" | "settle") => {
    const v = parseFloat(amount.replace(",", "."));
    if (!v || v <= 0) { Alert.alert("Montant invalide", "Saisir un montant positif."); return; }
    setBusy(true);
    try {
      const path = mode === "declare" ? "/agent/float/declare" : "/agent/float/settle";
      await api.post(path, { amount: v, currency, reason });
      setAmount(""); setReason("");
      setShowDeclare(false); setShowSettle(false);
      await load();
    } catch (e: any) {
      Alert.alert("Erreur", apiError(e));
    } finally { setBusy(false); }
  };

  const icon = (type: string) => {
    switch (type) {
      case "declare": return "cash" as const;
      case "payout": return "paper-plane-outline" as const;
      case "cashin": return "download-outline" as const;
      case "settlement": return "arrow-up-circle-outline" as const;
      default: return "swap-horizontal-outline" as const;
    }
  };
  const tint = (type: string) => type === "declare" || type === "cashin" ? "#10B981" : type === "settlement" || type === "payout" ? "#EF4444" : pc.primary.base;
  const label = (type: string) => ({
    declare: "Déclaration", payout: "Paiement bénéficiaire",
    cashin: "Encaissement client", settlement: "Versement au siège",
    adjustment: "Régularisation",
  } as any)[type] || type;

  return (
    <Screen title="Gestion des espèces" back scroll={false}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />} contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
        {/* Hero — solde float */}
        <LinearGradient colors={[pc.primary.dark, pc.primary.base, pc.primary.dark]} style={styles.hero}>
          <TText variant="caption" color="rgba(255,255,255,0.7)" weight="semiBold">FLOAT DISPONIBLE — CAISSE</TText>
          <TText variant="display" weight="extraBold" color="white" style={{ marginTop: 4 }}>
            {balance.toLocaleString("fr-FR")} {currency}
          </TText>
          <TText variant="caption" color="rgba(255,255,255,0.85)">
            {floats[0]?.declared_at ? `Déclaré le ${new Date(floats[0].declared_at).toLocaleDateString("fr-FR")}` : "Aucune déclaration enregistrée"}
          </TText>
          <View style={styles.btnRow}>
            <TouchableOpacity testID="float-declare-btn" style={[styles.action, { backgroundColor: "rgba(255,255,255,0.22)" }]} onPress={() => setShowDeclare(true)}>
              <Ionicons name="cash" size={18} color="white" />
              <TText variant="caption" weight="extraBold" color="white" style={{ marginLeft: 6 }}>Déclarer espèces</TText>
            </TouchableOpacity>
            <TouchableOpacity testID="float-settle-btn" style={[styles.action, { backgroundColor: "rgba(255,255,255,0.12)" }]} onPress={() => setShowSettle(true)}>
              <Ionicons name="arrow-up-circle-outline" size={18} color="white" />
              <TText variant="caption" weight="extraBold" color="white" style={{ marginLeft: 6 }}>Verser au siège</TText>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Règles métier */}
        <View style={styles.infoCard}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
            <Ionicons name="information-circle" size={16} color={pc.primary.base} />
            <TText variant="caption" weight="bold" color={pc.primary.base} style={{ marginLeft: 6 }}>Règles métier</TText>
          </View>
          <TText variant="label" color="#6B5A48" style={{ lineHeight: 17 }}>
            • Chaque paiement à un bénéficiaire débite votre float.{"\n"}
            • Chaque encaissement client débite aussi votre float (à reverser).{"\n"}
            • Si le float est épuisé, vous ne pouvez plus payer.{"\n"}
            • Déclarez vos approvisionnements et versez régulièrement.
          </TText>
        </View>

        {/* Historique des mouvements */}
        <TText variant="label" weight="extraBold" color="#6B5A48" style={{ marginTop: spacing.lg, marginBottom: 8, letterSpacing: 1 }}>MOUVEMENTS RÉCENTS</TText>
        <View style={styles.list}>
          {moves.length === 0 ? (
            <View style={{ padding: spacing.xl, alignItems: "center" }}>
              <Ionicons name="receipt-outline" size={28} color="#C7B5A3" />
              <TText variant="caption" color="#6B5A48" style={{ marginTop: 6 }}>Aucun mouvement</TText>
            </View>
          ) : moves.map((m, i) => (
            <View key={m.id} style={[styles.move, i < moves.length - 1 && styles.moveBorder]}>
              <View style={[styles.moveIcon, { backgroundColor: tint(m.type) + "1A" }]}>
                <Ionicons name={icon(m.type)} size={18} color={tint(m.type)} />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <TText variant="body" weight="semiBold">{label(m.type)}</TText>
                <TText variant="label" color="#6B5A48" numberOfLines={1}>{m.reason || "—"}</TText>
                <TText variant="label" color="#A89078">{new Date(m.created_at).toLocaleString("fr-FR")}</TText>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <TText weight="bold" color={m.amount_signed >= 0 ? "#10B981" : "#EF4444"}>
                  {m.amount_signed >= 0 ? "+" : ""}{m.amount_signed.toLocaleString("fr-FR")}
                </TText>
                <TText variant="label" color="#A89078">{m.balance_after?.toLocaleString("fr-FR")} {m.currency}</TText>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Modal Déclaration */}
      <Modal visible={showDeclare} transparent animationType="slide" onRequestClose={() => setShowDeclare(false)}>
        <TouchableOpacity activeOpacity={1} style={styles.overlay} onPress={() => setShowDeclare(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.sheet}>
            <TText variant="subtitle" weight="extraBold" style={{ marginBottom: 6 }}>Déclarer un approvisionnement</TText>
            <TText variant="caption" color="#6B5A48" style={{ marginBottom: 14 }}>
              Vous venez de recevoir physiquement un nouvel approvisionnement en espèces.
            </TText>
            <Input testID="float-declare-amount" label={`Montant en ${currency}`} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" icon="cash-outline" />
            <Input testID="float-declare-reason" label="Référence (optionnel)" value={reason} onChangeText={setReason} icon="reader-outline" />
            <Button testID="float-declare-submit" title="Confirmer la déclaration" icon="checkmark-circle" loading={busy} onPress={() => submit("declare")} style={{ marginTop: spacing.md }} />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Modal Settlement */}
      <Modal visible={showSettle} transparent animationType="slide" onRequestClose={() => setShowSettle(false)}>
        <TouchableOpacity activeOpacity={1} style={styles.overlay} onPress={() => setShowSettle(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.sheet}>
            <TText variant="subtitle" weight="extraBold" style={{ marginBottom: 6 }}>Verser au siège</TText>
            <TText variant="caption" color="#6B5A48" style={{ marginBottom: 14 }}>
              Vous allez remettre physiquement ce montant au siège / coursier régional.
            </TText>
            <Input testID="float-settle-amount" label={`Montant versé en ${currency}`} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" icon="arrow-up-circle-outline" />
            <Input testID="float-settle-reason" label="Référence (bordereau, coursier…)" value={reason} onChangeText={setReason} icon="reader-outline" />
            <Button testID="float-settle-submit" title="Confirmer le versement" icon="send" loading={busy} onPress={() => submit("settle")} style={{ marginTop: spacing.md, backgroundColor: "#EF4444" }} />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radii.xxl, padding: spacing.lg, marginTop: spacing.sm },
  btnRow: { flexDirection: "row", gap: 10, marginTop: spacing.md },
  action: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 12, borderRadius: radii.full },
  infoCard: { backgroundColor: "#FDF5EA", borderRadius: radii.lg, padding: spacing.md, marginTop: spacing.md, borderWidth: 1, borderColor: "#E8D5BA" },
  list: { backgroundColor: "white", borderRadius: radii.xl, borderWidth: 1, borderColor: "#EED9BF", overflow: "hidden" },
  move: { flexDirection: "row", alignItems: "center", padding: 12 },
  moveBorder: { borderBottomWidth: 1, borderBottomColor: "#F5E8D4" },
  moveIcon: { width: 36, height: 36, borderRadius: radii.full, alignItems: "center", justifyContent: "center" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "white", borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl, padding: spacing.lg, paddingBottom: spacing.xl },
});
