import React, { useCallback, useState } from "react";
import { t, useLocale } from "../src/i18n";
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform, Modal } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { TText } from "../src/components/TText";
import { Button } from "../src/components/Button";
import { Input } from "../src/components/Input";
import { api } from "../src/api";
import { colors, spacing, radii } from "../src/theme";
import { useThemedColors } from "../src/themeContext";

// v7 — Refonte UX :
// - 3 sections claires : Cartes bancaires / Portefeuilles mobiles / PayPal
// - Chaque section : titre + items enregistrés + lien d'ajout dédié
// - Grille d'opérateurs supprimée : sélection désormais dans un modal au moment de l'ajout
// - Différenciation visuelle forte par section (gradient header + bordure latérale colorée)

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
  useLocale((st) => st.locale);
  const themed = useThemedColors();
  const router = useRouter();
  const [methods, setMethods] = useState<any[]>([]);

  // Modal d'ajout Mobile Money (sélection opérateur + numéro)
  const [momoModalOpen, setMomoModalOpen] = useState(false);
  const [pickedProvider, setPickedProvider] = useState<any>(null);
  const [momoPhone, setMomoPhone] = useState("");

  const load = useCallback(async () => {
    try { const r = await api.get("/payment-methods"); setMethods(r.data || []); } catch {}
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const cards = methods.filter((m) => m.type === "card");
  const momos = methods.filter((m) => m.type === "momo");
  const paypals = methods.filter((m) => m.type === "paypal");

  const submitMomo = async () => {
    if (!pickedProvider || !momoPhone.trim()) {
      showAlert("Champ requis", "Sélectionnez un opérateur et saisissez votre numéro.");
      return;
    }
    try {
      await api.post("/payment-methods", {
        type: "momo",
        provider: pickedProvider.id,
        label: pickedProvider.name,
        phone: momoPhone.trim(),
      });
      setMomoModalOpen(false);
      setPickedProvider(null);
      setMomoPhone("");
      load();
    } catch (e: any) {
      showAlert("Erreur", e?.response?.data?.detail || "Impossible d'ajouter ce moyen.");
    }
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
    <View style={{ flex: 1, backgroundColor: "#022a6b" }}>
      <LinearGradient colors={["#022a6b", "#052080"]} style={styles.hero}>
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
        {/* ================== SECTION 1 — CARTES BANCAIRES ================== */}
        <View style={[styles.section, { borderLeftColor: "#022a6b" }]}>
          <View style={styles.sectionHead}>
            <View style={[styles.groupIcon, { backgroundColor: "#022a6b" }]}>
              <Ionicons name="card" size={18} color="white" />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <TText variant="body" weight="extraBold">Cartes bancaires</TText>
              <TText variant="label" color={themed.neutrals.textSecondary}>
                {cards.length} enregistrée{cards.length > 1 ? "s" : ""}
              </TText>
            </View>
          </View>

          {/* Liste des cartes */}
          <View style={styles.itemsList}>
            {cards.length === 0 ? (
              <View style={styles.emptyRow}>
                <Ionicons name="card-outline" size={28} color={themed.neutrals.textTertiary} />
                <TText variant="caption" color={themed.neutrals.textSecondary} style={{ marginTop: 6 }}>Aucune carte enregistrée</TText>
              </View>
            ) : cards.map((c, i) => (
              <View key={c.id} style={[styles.cRow, i < cards.length - 1 && styles.cRowBorder]}>
                <View style={[styles.cIcon, { backgroundColor: "#022a6b" }]}>
                  <Ionicons name="card" size={18} color="white" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <TText variant="body" weight="extraBold">{c.label || "Carte"} •••• {c.last4 || "—"}</TText>
                  <TText variant="label" color={themed.neutrals.textSecondary}>Expire {c.exp_month || "—"}/{c.exp_year || "—"}</TText>
                </View>
                <TouchableOpacity testID={`rm-card-${c.id}`} onPress={() => remove(c)} style={styles.roundBtnLight}>
                  <Ionicons name="trash-outline" size={16} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ))}
          </View>

          {/* Lien d'ajout */}
          <TouchableOpacity
            testID="add-card"
            onPress={() => router.push("/payment-methods/add-card" as any)}
            style={[styles.addLink, { borderColor: "#022a6b" + "40" }]}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle" size={18} color="#022a6b" />
            <TText variant="caption" weight="extraBold" color="#022a6b" style={{ marginLeft: 8 }}>
              Ajouter une carte bancaire
            </TText>
          </TouchableOpacity>
        </View>

        {/* ================== SECTION 2 — PORTEFEUILLES MOBILES ================== */}
        <View style={[styles.section, { borderLeftColor: "#F59E0B" }]}>
          <View style={styles.sectionHead}>
            <View style={[styles.groupIcon, { backgroundColor: "#F59E0B" }]}>
              <Ionicons name="phone-portrait" size={18} color="white" />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <TText variant="body" weight="extraBold">Portefeuilles mobiles</TText>
              <TText variant="label" color={themed.neutrals.textSecondary}>
                {momos.length} enregistré{momos.length > 1 ? "s" : ""}
              </TText>
            </View>
          </View>

          {/* Liste des comptes mobile money enregistrés */}
          <View style={styles.itemsList}>
            {momos.length === 0 ? (
              <View style={styles.emptyRow}>
                <Ionicons name="phone-portrait-outline" size={28} color={themed.neutrals.textTertiary} />
                <TText variant="caption" color={themed.neutrals.textSecondary} style={{ marginTop: 6 }}>Aucun compte mobile money enregistré</TText>
              </View>
            ) : momos.map((m, i) => {
              const provider = MOBILE_PROVIDERS.find((p) => p.id === m.provider);
              return (
                <View key={m.id} style={[styles.cRow, i < momos.length - 1 && styles.cRowBorder]}>
                  <LinearGradient
                    colors={(provider?.colors || ["#F59E0B", "#D97706"]) as any}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.cIcon}
                  >
                    <Ionicons name="phone-portrait" size={16} color="white" />
                  </LinearGradient>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <TText variant="body" weight="extraBold">{m.label || provider?.name || m.provider}</TText>
                    <TText variant="label" color={themed.neutrals.textSecondary}>{m.phone || "—"}</TText>
                  </View>
                  <TouchableOpacity testID={`rm-momo-${m.id}`} onPress={() => remove(m)} style={styles.roundBtnLight}>
                    <Ionicons name="trash-outline" size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>

          {/* Lien d'ajout */}
          <TouchableOpacity
            testID="add-momo"
            onPress={() => { setPickedProvider(null); setMomoPhone(""); setMomoModalOpen(true); }}
            style={[styles.addLink, { borderColor: "#F59E0B" + "40" }]}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle" size={18} color="#F59E0B" />
            <TText variant="caption" weight="extraBold" color="#F59E0B" style={{ marginLeft: 8 }}>
              Ajouter un compte mobile money
            </TText>
          </TouchableOpacity>
        </View>

        {/* ================== SECTION 3 — PAYPAL ================== */}
        <View style={[styles.section, { borderLeftColor: "#003087" }]}>
          <View style={styles.sectionHead}>
            <View style={[styles.groupIcon, { backgroundColor: "#003087" }]}>
              <Ionicons name="logo-paypal" size={18} color="white" />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <TText variant="body" weight="extraBold">PayPal</TText>
              <TText variant="label" color={themed.neutrals.textSecondary}>
                {paypals.length} enregistré{paypals.length > 1 ? "s" : ""}
              </TText>
            </View>
          </View>

          <View style={styles.itemsList}>
            {paypals.length === 0 ? (
              <View style={styles.emptyRow}>
                <Ionicons name="logo-paypal" size={28} color={themed.neutrals.textTertiary} />
                <TText variant="caption" color={themed.neutrals.textSecondary} style={{ marginTop: 6 }}>Aucun compte PayPal enregistré</TText>
              </View>
            ) : paypals.map((p, i) => (
              <View key={p.id} style={[styles.cRow, i < paypals.length - 1 && styles.cRowBorder]}>
                <View style={[styles.cIcon, { backgroundColor: "#003087" }]}>
                  <Ionicons name="logo-paypal" size={18} color="white" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <TText variant="body" weight="extraBold">{p.label || "PayPal"}</TText>
                  <TText variant="label" color={themed.neutrals.textSecondary}>{p.email || "—"}</TText>
                </View>
                <TouchableOpacity testID={`rm-paypal-${p.id}`} onPress={() => remove(p)} style={styles.roundBtnLight}>
                  <Ionicons name="trash-outline" size={16} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ))}
          </View>

          <TouchableOpacity
            testID="add-paypal"
            onPress={addPaypal}
            style={[styles.addLink, { borderColor: "#003087" + "40" }]}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle" size={18} color="#003087" />
            <TText variant="caption" weight="extraBold" color="#003087" style={{ marginLeft: 8 }}>
              Ajouter un compte Paypal
            </TText>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* === Modal d'ajout Mobile Money === */}
      <Modal visible={momoModalOpen} transparent animationType="slide" onRequestClose={() => setMomoModalOpen(false)}>
        <TouchableOpacity activeOpacity={1} style={styles.modalOverlay} onPress={() => setMomoModalOpen(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalSheet} onPress={(e) => e.stopPropagation && e.stopPropagation()}>
            <View style={styles.modalHandle} />
            <TText variant="subtitle" weight="extraBold" style={{ marginBottom: 4 }}>Ajouter un compte mobile money</TText>
            <TText variant="caption" color={themed.neutrals.textSecondary} style={{ marginBottom: spacing.md }}>
              Choisissez votre opérateur et saisissez votre numéro associé.
            </TText>

            <TText variant="caption" weight="extraBold" color={themed.neutrals.textSecondary} style={{ marginBottom: 8, letterSpacing: 0.4 }}>
              OPÉRATEUR
            </TText>
            <View style={styles.providersRow}>
              {MOBILE_PROVIDERS.map((p) => {
                const already = momos.find((m) => m.provider === p.id);
                const active = pickedProvider?.id === p.id;
                return (
                  <TouchableOpacity
                    key={p.id}
                    disabled={!!already}
                    onPress={() => setPickedProvider(p)}
                    style={[
                      styles.providerOpt,
                      active && { borderColor: p.colors[0], borderWidth: 2, backgroundColor: p.colors[0] + "12" },
                      already && { opacity: 0.4 },
                    ]}
                    testID={`pick-momo-${p.id}`}
                    activeOpacity={0.8}
                  >
                    <LinearGradient colors={p.colors as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.providerIcon}>
                      <Ionicons name="phone-portrait" size={18} color="white" />
                    </LinearGradient>
                    <TText variant="label" weight="extraBold" style={{ marginTop: 6, fontSize: 11 }} numberOfLines={1}>
                      {p.shortName}
                    </TText>
                    {already ? (
                      <TText variant="label" color={themed.neutrals.textTertiary} style={{ fontSize: 9, marginTop: 2 }}>déjà ajouté</TText>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>

            {pickedProvider ? (
              <View style={{ marginTop: spacing.md }}>
                <Input
                  label={`Numéro ${pickedProvider.name}`}
                  value={momoPhone}
                  onChangeText={setMomoPhone}
                  keyboardType="phone-pad"
                  icon="call-outline"
                  placeholder="ex: +221 77 123 45 67"
                />
                <Button title="Enregistrer ce compte" icon="checkmark-circle" onPress={submitMomo} disabled={!momoPhone.trim()} />
              </View>
            ) : (
              <View style={{ marginTop: spacing.md, alignItems: "center" }}>
                <TText variant="caption" color={themed.neutrals.textSecondary}>
                  Sélectionnez un opérateur ci-dessus pour continuer.
                </TText>
              </View>
            )}

            <TouchableOpacity onPress={() => setMomoModalOpen(false)} style={{ alignSelf: "center", marginTop: 8, padding: 8 }}>
              <TText variant="caption" color={themed.neutrals.textSecondary}>Annuler</TText>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
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

  // Section card unifiée avec bordure latérale colorée selon le type
  section: {
    backgroundColor: colors.neutrals.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.neutrals.border,
    borderLeftWidth: 4,
    padding: spacing.md,
    marginBottom: spacing.lg,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 1,
  },
  sectionHead: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  groupIcon: { width: 36, height: 36, borderRadius: radii.full, alignItems: "center", justifyContent: "center" },

  itemsList: { backgroundColor: colors.neutrals.background, borderRadius: radii.lg, overflow: "hidden", borderWidth: 1, borderColor: colors.neutrals.border },
  emptyRow: { padding: spacing.lg, alignItems: "center" },
  cRow: { flexDirection: "row", alignItems: "center", padding: spacing.md, backgroundColor: colors.neutrals.surface },
  cRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.neutrals.border },
  cIcon: { width: 40, height: 40, borderRadius: radii.full, alignItems: "center", justifyContent: "center" },
  roundBtnLight: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.overlays.errorSoft },

  addLink: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: radii.full,
    borderWidth: 1.5,
    borderStyle: "dashed",
    backgroundColor: "transparent",
  },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: colors.neutrals.surface,
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    paddingHorizontal: spacing.lg,
    paddingTop: 8,
    paddingBottom: spacing.xl,
    maxHeight: "82%",
  },
  modalHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.neutrals.border, marginBottom: 12 },
  providersRow: { flexDirection: "row", gap: 8 },
  providerOpt: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12, paddingHorizontal: 6,
    backgroundColor: colors.neutrals.background,
    borderRadius: radii.xl,
    borderWidth: 1.5,
    borderColor: colors.neutrals.border,
  },
  providerIcon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
});
