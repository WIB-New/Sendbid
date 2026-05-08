import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { TText } from "../src/components/TText";
import { Button } from "../src/components/Button";
import { api } from "../src/api";
import { colors, spacing, radii } from "../src/theme";

// Moyens de paiement v6.4 — Refonte design moderne, regroupement par type :
//   1. Carte bancaire (Visa/Mastercard)
//   2. Mobile Money (Orange/Wave/MTN/Moov)
//   3. PayPal
// (WALLETS NATIFS / Apple Pay / Google Pay supprimés selon spécification)
const MOBILE_PROVIDERS = [
  { id: "orange_money", name: "Orange Money", colors: ["#FF7900", "#F59E0B"], shortName: "Orange" },
  { id: "wave", name: "Wave", colors: ["#1DCDFE", "#0EA5E9"], shortName: "Wave" },
  { id: "mtn_momo", name: "MTN MoMo", colors: ["#FFCC00", "#F59E0B"], shortName: "MTN" },
  { id: "moov_money", name: "Moov Money", colors: ["#0066CC", "#003D80"], shortName: "Moov" },
];

const showAlert = (title: string, msg?: string) => {
  if (Platform.OS === "web") (window as any).alert(msg ? `${title}\n\n${msg}` : title);
  else Alert.alert(title, msg);
};
const confirmAsync = (title: string, msg: string): Promise<boolean> =>
  new Promise((resolve) => {
    if (Platform.OS === "web") resolve((window as any).confirm(`${title}\n\n${msg}`));
    else Alert.alert(title, msg, [
      { text: "Annuler", style: "cancel", onPress: () => resolve(false) },
      { text: "Supprimer", style: "destructive", onPress: () => resolve(true) },
    ]);
  });
const promptAsync = (msg: string): Promise<string | null> =>
  new Promise((resolve) => {
    if (Platform.OS === "web") resolve((window as any).prompt(msg));
    else resolve(null);
  });

export default function PaymentMethods() {
  const router = useRouter();
  const [methods, setMethods] = useState<any[]>([]);

  const load = useCallback(async () => {
    try { const r = await api.get("/payment-methods"); setMethods(r.data || []); } catch {}
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const cards = methods.filter((m) => m.type === "card");
  const momos = methods.filter((m) => m.type === "momo");
  const paypals = methods.filter((m) => m.type === "paypal");

  const addMomo = async (provider: any) => {
    const phone = await promptAsync(`Numéro ${provider.name} (sans espaces) :`);
    if (!phone) return;
    try {
      await api.post("/payment-methods", { type: "momo", provider: provider.id, label: provider.name, phone });
      load();
    } catch (e: any) { showAlert("Erreur", e?.response?.data?.detail || "Impossible d'ajouter ce moyen."); }
  };

  const addPaypal = async () => {
    const email = await promptAsync("Email PayPal :");
    if (!email) return;
    try {
      await api.post("/payment-methods", { type: "paypal", label: "PayPal", email });
      load();
    } catch (e: any) { showAlert("Erreur", e?.response?.data?.detail || "Impossible d'ajouter PayPal."); }
  };

  const remove = async (m: any) => {
    const ok = await confirmAsync("Supprimer ce moyen de paiement ?", `${m.label || m.provider || m.type} sera retiré de votre compte.`);
    if (!ok) return;
    try { await api.delete(`/payment-methods/${m.id}`); load(); } catch {}
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#00147E" }}>
      <LinearGradient colors={["#00147E", "#3D52D5"]} style={styles.hero}>
        <SafeAreaView edges={["top"]}>
          <View style={styles.heroTop}>
            <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
              <Ionicons name="chevron-back" size={22} color="white" />
            </TouchableOpacity>
            <TText variant="body" weight="extraBold" color="white">Moyens de paiement</TText>
            <View style={{ width: 36 }} />
          </View>
          <View style={styles.heroSummary}>
            <View style={styles.summaryItem}>
              <TText variant="title" weight="extraBold" color="white">{cards.length}</TText>
              <TText variant="label" color="rgba(255,255,255,0.85)" style={{ marginTop: 2 }}>Cartes</TText>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <TText variant="title" weight="extraBold" color="white">{momos.length}</TText>
              <TText variant="label" color="rgba(255,255,255,0.85)" style={{ marginTop: 2 }}>Mobile Money</TText>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <TText variant="title" weight="extraBold" color="white">{paypals.length}</TText>
              <TText variant="label" color="rgba(255,255,255,0.85)" style={{ marginTop: 2 }}>PayPal</TText>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView style={styles.card} contentContainerStyle={styles.cardInner} showsVerticalScrollIndicator={false}>
        {/* CARTES BANCAIRES */}
        <View style={styles.groupHead}>
          <View style={[styles.groupIcon, { backgroundColor: "#1B2A5B" }]}>
            <Ionicons name="card" size={18} color="white" />
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <TText variant="body" weight="extraBold">Cartes bancaires</TText>
            <TText variant="label" color={colors.neutrals.textSecondary}>Visa, Mastercard, 3DS via Stripe</TText>
          </View>
        </View>
        <View style={styles.listBox}>
          {cards.length === 0 ? (
            <View style={styles.emptyRow}>
              <Ionicons name="card-outline" size={28} color={colors.neutrals.textTertiary} />
              <TText variant="caption" color={colors.neutrals.textSecondary} style={{ marginTop: 6 }}>Aucune carte enregistrée</TText>
            </View>
          ) : cards.map((c, i) => (
            <View key={c.id} style={[styles.cRow, i < cards.length - 1 && styles.cRowBorder]}>
              <View style={[styles.cIcon, { backgroundColor: "#1B2A5B" }]}>
                <Ionicons name="card" size={18} color="white" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <TText variant="body" weight="extraBold">{c.label || "Carte"} •••• {c.last4 || "—"}</TText>
                <TText variant="label" color={colors.neutrals.textSecondary}>Expire {c.exp_month || "—"}/{c.exp_year || "—"}</TText>
              </View>
              <TouchableOpacity testID={`rm-card-${c.id}`} onPress={() => remove(c)} style={styles.roundBtnLight}>
                <Ionicons name="trash-outline" size={16} color="#EF4444" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
        <Button testID="add-card" title="Ajouter une carte bancaire" icon="add-circle-outline" variant="outline" onPress={() => router.push("/payment-methods/add-card" as any)} style={{ marginTop: 12 }} />

        {/* MOBILE MONEY */}
        <View style={[styles.groupHead, { marginTop: spacing.xl }]}>
          <View style={[styles.groupIcon, { backgroundColor: "#F59E0B" }]}>
            <Ionicons name="phone-portrait" size={18} color="white" />
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <TText variant="body" weight="extraBold">Portefeuilles mobiles</TText>
            <TText variant="label" color={colors.neutrals.textSecondary}>Orange Money, Wave, MTN MoMo, Moov</TText>
          </View>
        </View>

        {/* Comptes connectés */}
        {momos.length > 0 ? (
          <View style={styles.listBox}>
            {momos.map((m, i) => {
              const provider = MOBILE_PROVIDERS.find((p) => p.id === m.provider);
              return (
                <View key={m.id} style={[styles.cRow, i < momos.length - 1 && styles.cRowBorder]}>
                  <LinearGradient colors={(provider?.colors || ["#F59E0B", "#D97706"]) as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cIcon}>
                    <Ionicons name="phone-portrait" size={16} color="white" />
                  </LinearGradient>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <TText variant="body" weight="extraBold">{m.label || provider?.name || m.provider}</TText>
                    <TText variant="label" color={colors.neutrals.textSecondary}>{m.phone || "—"}</TText>
                  </View>
                  <View style={styles.connectedChip}>
                    <Ionicons name="checkmark-circle" size={12} color="#065F46" />
                    <TText variant="label" weight="extraBold" color="#065F46" style={{ marginLeft: 3 }}>Connecté</TText>
                  </View>
                  <TouchableOpacity testID={`rm-momo-${m.id}`} onPress={() => remove(m)} style={[styles.roundBtnLight, { marginLeft: 6 }]}>
                    <Ionicons name="trash-outline" size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        ) : null}

        {/* Grille des opérateurs disponibles */}
        <TText variant="label" color={colors.neutrals.textSecondary} style={{ marginTop: 12, marginBottom: 8, marginLeft: 4 }}>
          Ajouter un opérateur
        </TText>
        <View style={styles.providersGrid}>
          {MOBILE_PROVIDERS.map((p) => {
            const added = momos.find((m) => m.provider === p.id);
            return (
              <TouchableOpacity
                key={p.id}
                testID={`add-momo-${p.id}`}
                disabled={!!added}
                onPress={() => addMomo(p)}
                style={styles.providerCard}
                activeOpacity={0.85}
              >
                <LinearGradient colors={p.colors as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.providerIcon}>
                  <Ionicons name="phone-portrait" size={20} color="white" />
                </LinearGradient>
                <TText variant="caption" weight="extraBold" style={{ marginTop: 8 }} numberOfLines={1}>{p.shortName}</TText>
                {added ? (
                  <View style={styles.providerBadgeActive}>
                    <Ionicons name="checkmark" size={10} color="white" />
                  </View>
                ) : (
                  <View style={styles.providerBadgePlus}>
                    <Ionicons name="add" size={12} color={colors.primary.base} />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* PAYPAL */}
        <View style={[styles.groupHead, { marginTop: spacing.xl }]}>
          <View style={[styles.groupIcon, { backgroundColor: "#003087" }]}>
            <Ionicons name="logo-paypal" size={18} color="white" />
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <TText variant="body" weight="extraBold">PayPal</TText>
            <TText variant="label" color={colors.neutrals.textSecondary}>Comptes PayPal liés</TText>
          </View>
        </View>
        <View style={styles.listBox}>
          {paypals.length === 0 ? (
            <View style={styles.emptyRow}>
              <Ionicons name="logo-paypal" size={28} color={colors.neutrals.textTertiary} />
              <TText variant="caption" color={colors.neutrals.textSecondary} style={{ marginTop: 6 }}>Aucun compte PayPal lié</TText>
            </View>
          ) : paypals.map((p, i) => (
            <View key={p.id} style={[styles.cRow, i < paypals.length - 1 && styles.cRowBorder]}>
              <View style={[styles.cIcon, { backgroundColor: "#003087" }]}>
                <Ionicons name="logo-paypal" size={18} color="white" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <TText variant="body" weight="extraBold">{p.label || "PayPal"}</TText>
                <TText variant="label" color={colors.neutrals.textSecondary}>{p.email || "—"}</TText>
              </View>
              <TouchableOpacity testID={`rm-paypal-${p.id}`} onPress={() => remove(p)} style={styles.roundBtnLight}>
                <Ionicons name="trash-outline" size={16} color="#EF4444" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
        <Button testID="add-paypal" title="Lier un compte PayPal" icon="logo-paypal" variant="outline" onPress={addPaypal} style={{ marginTop: 12 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: spacing.sm },
  heroSummary: { flexDirection: "row", alignItems: "center", justifyContent: "space-around", marginTop: spacing.lg, paddingHorizontal: spacing.md },
  summaryItem: { alignItems: "center", flex: 1 },
  summaryDivider: { width: 1, height: 30, backgroundColor: "rgba(255,255,255,0.25)" },
  iconBtn: { width: 36, height: 36, borderRadius: radii.full, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" },
  card: { flex: 1, backgroundColor: colors.neutrals.background, borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl, marginTop: -spacing.lg },
  cardInner: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  groupHead: { flexDirection: "row", alignItems: "center", marginBottom: 10, marginLeft: 2 },
  groupIcon: { width: 36, height: 36, borderRadius: radii.full, alignItems: "center", justifyContent: "center" },
  listBox: { backgroundColor: colors.neutrals.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.neutrals.border, overflow: "hidden" },
  emptyRow: { padding: spacing.xl, alignItems: "center" },
  cRow: { flexDirection: "row", alignItems: "center", padding: spacing.md },
  cRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.neutrals.border },
  cIcon: { width: 40, height: 40, borderRadius: radii.full, alignItems: "center", justifyContent: "center" },
  roundBtnLight: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.overlays.errorSoft },
  connectedChip: { flexDirection: "row", alignItems: "center", backgroundColor: "#D1FAE5", paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.full },
  providersGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  providerCard: { width: "23.5%", backgroundColor: colors.neutrals.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.neutrals.border, padding: 12, alignItems: "center", position: "relative" },
  providerIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  providerBadgePlus: { position: "absolute", top: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.overlays.primarySoft, alignItems: "center", justifyContent: "center" },
  providerBadgeActive: { position: "absolute", top: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: "#10B981", alignItems: "center", justifyContent: "center" },
});
