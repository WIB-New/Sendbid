import React, { useCallback, useEffect, useState } from "react";
import { View, StyleSheet, TouchableOpacity, RefreshControl, ScrollView, Image, Modal, FlatList } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { TText } from "../../src/components/TText";
import { FlooMoneyCard } from "../../src/components/FlooMoneyCard";
import { SendBidLogo } from "../../src/components/Logo";
import { StatusChip } from "../../src/components/StatusChip";
import { Input } from "../../src/components/Input";
import { Button } from "../../src/components/Button";
import { useAuth, useDraft } from "../../src/store";
import { KycPopup } from "../../src/components/KycPopup";
import { api } from "../../src/api";
import { colors, spacing, radii } from "../../src/theme";

type Corridor = {
  country_code: string;
  country_name: string;
  flag: string;
  currency: string;
  fx_rate_eur: number;
  fx_fixed: boolean;
  delivery_modes: string[];
  capital?: string;
};

const SERVICES = [
  { key: "ben", label: "Bénéficiaires", icon: "people-outline" as const, route: "/beneficiaries" },
  { key: "pm", label: "Moyens de paiement", icon: "card-outline" as const, route: "/payment-methods" },
  { key: "kyc", label: "KYC", icon: "shield-checkmark-outline" as const, route: "/kyc" },
  { key: "support", label: "Aide & Support", icon: "help-circle-outline" as const, route: "/support" },
  { key: "limits", label: "Limites de transfert", icon: "speedometer-outline" as const, route: "/limits" },
  { key: "caps", label: "Plafonds de paiement", icon: "lock-closed-outline" as const, route: "/payment-caps" },
];

const DELIVERY_MODES = [
  { key: "cash", label: "Espèces", icon: "cash-outline" as const },
  { key: "bank", label: "Virement", icon: "business-outline" as const },
  { key: "momo", label: "Mobile Money", icon: "phone-portrait-outline" as const },
];

export default function Home() {
  const user = useAuth((s) => s.user);
  const wallet = useAuth((s) => s.wallet);
  const refreshMe = useAuth((s) => s.refreshMe);
  const setDraft = useDraft((s) => s.setDraft);
  const router = useRouter();

  const [operations, setOperations] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // \"Nouveau transfert\" inline (collapsed by default)
  const [transferOpen, setTransferOpen] = useState(false);
  const [corridors, setCorridors] = useState<Corridor[]>([]);
  const [country, setCountry] = useState<Corridor | null>(null);
  const [showCountry, setShowCountry] = useState(false);
  const [search, setSearch] = useState("");
  const [amount, setAmount] = useState("100");
  const [mode, setMode] = useState("cash");
  const [beneficiaries, setBeneficiaries] = useState<any[]>([]);
  const [showBen, setShowBen] = useState(false);
  const [selectedBen, setSelectedBen] = useState<any>(null);

  // "Recharger" multi-method modal
  const [showRecharge, setShowRecharge] = useState(false);

  // === Pop-up 30s post-login : démarrage procédure de vérification email + téléphone ===
  const [verifPopupVisible, setVerifPopupVisible] = useState(false);

  useEffect(() => {
    if (!user) return;
    // Si déjà vérifié, ne rien faire
    if (user.email_verified && user.phone_verified) return;
    // Si déjà affiché dans cette session, ne pas redéclencher
    try {
      const flag = (globalThis as any).__sendbid_verifPopupShown;
      if (flag) return;
    } catch {}
    const t = setTimeout(() => {
      (globalThis as any).__sendbid_verifPopupShown = true;
      setVerifPopupVisible(true);
      // Auto-fermeture après 10s + redirection vers OTP
      setTimeout(() => {
        setVerifPopupVisible(false);
        router.push({ pathname: "/(auth)/verify-otp" as any, params: { user_id: user.id, from_banner: "1" } });
      }, 10000);
    }, 30000);
    return () => clearTimeout(t);
  }, [user?.id, user?.email_verified, user?.phone_verified]);

  const load = useCallback(async () => {
    setRefreshing(true);
    await refreshMe();
    try {
      // Fetch latest transfers + wallet history and merge into "operations"
      const [tRes, wRes, nRes] = await Promise.all([
        api.get("/transfers", { params: { limit: 5 } }).catch(() => ({ data: [] })),
        api.get("/wallet/transactions").catch(() => ({ data: [] })),
        api.get("/notifications").catch(() => ({ data: [] })),
      ]);
      const tx = (tRes.data || []).map((t: any) => ({
        id: t.id,
        kind: "transfer",
        title: `Transfert ${t.beneficiary?.full_name || ""}`.trim(),
        subtitle: `${t.destination_country || ""} • ${(t.delivery_mode || "").toUpperCase()}`,
        amount: -Math.abs(t.send_amount || 0),
        currency: "EUR",
        ts: t.created_at || Date.now(),
        icon: "paper-plane-outline",
        route: `/transfer/${t.id}`,
      }));
      const wh = (wRes.data || []).slice(0, 5).map((w: any) => ({
        id: w.id || `${w.created_at}-${w.amount}`,
        kind: "wallet",
        title: w.label || w.type || w.kind || "Opération wallet",
        subtitle: w.method || w.note || w.status || "Portefeuille",
        amount: Number(w.amount || 0),
        currency: w.currency || "EUR",
        ts: w.created_at || Date.now(),
        icon: w.amount >= 0 ? "arrow-down-circle-outline" : "arrow-up-circle-outline",
        route: `/wallet/op/${w.id}`,
      }));
      const merged = [...tx, ...wh].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()).slice(0, 5);
      setOperations(merged);
      setUnread((nRes.data || []).filter((x: any) => !x.read).length);
    } catch {}
    setRefreshing(false);
  }, [refreshMe]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    api.get("/corridors").then((r) => {
      const list: Corridor[] = r.data?.corridors || [];
      setCorridors(list);
      if (list.length > 0 && !country) setCountry(list.find((c) => c.country_code === "SN") || list[0]);
    }).catch(() => {});
    api.get("/beneficiaries").then((r) => setBeneficiaries(r.data || [])).catch(() => {});
  }, []);

  if (!user) return null;

  const sendAmt = parseFloat(amount || "0");
  const receiveAmt = country ? sendAmt * country.fx_rate_eur : 0;

  const continueTransfer = () => {
    if (!country || !selectedBen || sendAmt <= 0) return;
    setDraft({
      destination_country: country.country_code,
      destination_country_name: country.country_name,
      destination_currency: country.currency,
      send_amount: sendAmt,
      receive_amount: receiveAmt,
      fx_rate: country.fx_rate_eur,
      fx_fixed: country.fx_fixed,
      delivery_mode: mode,
      vip_delivery: false,
      beneficiary: selectedBen,
    });
    router.push("/transfer/details");
  };

  const filtered = corridors.filter((c) => !search || c.country_name.toLowerCase().includes(search.toLowerCase()) || c.country_code.toLowerCase().includes(search.toLowerCase()));

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.neutrals.background }}>
      <KycPopup userId={user.id} kycTier={user.kyc_tier} />
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.primary.base} />}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity testID="home-avatar" style={styles.avatar} onPress={() => router.push("/(tabs)/profile")}>
            {user.avatar_url ? <Image source={{ uri: user.avatar_url }} style={styles.avatarImg} /> : <Ionicons name="person" size={20} color={colors.primary.base} />}
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <TText variant="caption" color={colors.neutrals.textSecondary}>Bonjour</TText>
            <TText variant="subtitle" weight="extraBold">{user.full_name.split(" ")[0]} 👋</TText>
          </View>
          <TouchableOpacity testID="home-notifications" onPress={() => router.push("/notifications")} style={styles.notifBtn}>
            <Ionicons name="notifications-outline" size={22} color={colors.neutrals.textPrimary} />
            {unread > 0 ? (
              <View style={styles.badge}>
                <TText variant="label" weight="bold" color="white">{unread > 9 ? "9+" : unread}</TText>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>

        {/* Portefeuille card */}
        <View style={{ marginTop: spacing.lg }}>
          <FlooMoneyCard balance={wallet?.balance ?? 0} currency={wallet?.currency ?? "EUR"} fullName={user.full_name} profileId={user.profile_id} compact />
        </View>

        {/* Item 3 — Bandeau "Vérifier votre compte" SUPPRIMÉ.
            Le pop-up automatique 30s post-login déclenche désormais la procédure
            de vérification email + téléphone (voir useEffect verifPopupVisible). */}

        {/* 3 boutons identiques à la page Portefeuille : Recharger / Retirer / Envoyer */}
        <View style={styles.walletQuickRow}>
          <TouchableOpacity testID="home-recharge" onPress={() => router.push("/wallet/recharge" as any)} style={styles.walletQuickBtn}>
            <View style={[styles.walletQuickIcon, { backgroundColor: "#10B981" }]}>
              <Ionicons name="add-circle" size={22} color="white" />
            </View>
            <TText variant="label" weight="extraBold" align="center" style={{ marginTop: 6 }}>Ajouter de l'argent</TText>
          </TouchableOpacity>
          <TouchableOpacity testID="home-withdraw" onPress={() => router.push("/wallet/withdraw" as any)} style={styles.walletQuickBtn}>
            <View style={[styles.walletQuickIcon, { backgroundColor: "#3B82F6" }]}>
              <Ionicons name="arrow-down-circle" size={22} color="white" />
            </View>
            <TText variant="label" weight="extraBold" align="center" style={{ marginTop: 6 }}>Retirer</TText>
          </TouchableOpacity>
          <TouchableOpacity testID="home-send" onPress={() => router.push("/wallet/p2p" as any)} style={styles.walletQuickBtn}>
            <View style={[styles.walletQuickIcon, { backgroundColor: "#F59E0B" }]}>
              <Ionicons name="paper-plane" size={22} color="white" />
            </View>
            <TText variant="label" weight="extraBold" align="center" style={{ marginTop: 6 }}>Envoyer</TText>
          </TouchableOpacity>
        </View>

        {/* Section "Nouveau transfert" — fond vert unicolore (thème) */}
        <TouchableOpacity testID="home-new-transfer-toggle" activeOpacity={0.85} onPress={() => router.push("/transfer/new" as any)} style={{ marginTop: spacing.xl }}>
          <View style={[styles.sectionHeadAccent, { backgroundColor: "#10B981" }]}>
            <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
              <View style={styles.sectionIconAccent}>
                <SendBidLogo size={28} />
              </View>
              <View style={{ marginLeft: 12, flex: 1 }}>
                <TText weight="extraBold" color="white">Nouveau transfert</TText>
                <TText variant="caption" color="rgba(255,255,255,0.9)">
                  Envoyer de l'argent dans le monde entier
                </TText>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={22} color="white" />
          </View>
        </TouchableOpacity>

        {transferOpen ? (
          <View style={styles.transferForm}>
            {/* Pays de destination */}
            <TText variant="caption" weight="semiBold" color={colors.neutrals.textSecondary} style={{ marginBottom: 6 }}>Pays de destination</TText>
            <TouchableOpacity testID="home-tr-country" style={styles.selector} onPress={() => setShowCountry(true)}>
              <TText weight="semiBold">{country ? `${country.flag} ${country.country_name}` : "Sélectionner"}</TText>
              <Ionicons name="chevron-down" size={18} color={colors.neutrals.textSecondary} />
            </TouchableOpacity>

            {/* Montant */}
            <View style={{ marginTop: 12 }}>
              <Input testID="home-tr-amount" label="Montant à envoyer (EUR)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" icon="cash-outline" />
            </View>

            {/* Conversion auto */}
            <View style={styles.fxBox}>
              <TText variant="caption" color={colors.neutrals.textSecondary}>Le bénéficiaire reçoit</TText>
              <TText variant="title" weight="extraBold" color={colors.accent.base}>
                {receiveAmt.toFixed(0)} {country?.currency}
              </TText>
              <TText variant="caption" color={colors.neutrals.textTertiary}>
                1 EUR = {country?.fx_rate_eur.toFixed(2)} {country?.currency} {country?.fx_fixed ? "• parité fixe" : "• taux variable"}
              </TText>
            </View>

            {/* Mode */}
            <TText variant="caption" weight="semiBold" color={colors.neutrals.textSecondary} style={{ marginTop: 12, marginBottom: 6 }}>Mode de remise</TText>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {DELIVERY_MODES.map((m) => {
                const supported = !country || country.delivery_modes.includes(m.key);
                const active = mode === m.key && supported;
                return (
                  <TouchableOpacity
                    key={m.key}
                    testID={`home-tr-mode-${m.key}`}
                    disabled={!supported}
                    style={[styles.modeChip, active && { backgroundColor: colors.primary.base, borderColor: colors.primary.base }, !supported && { opacity: 0.4 }]}
                    onPress={() => setMode(m.key)}
                  >
                    <Ionicons name={m.icon} size={16} color={active ? "white" : colors.primary.base} />
                    <TText variant="caption" weight="bold" color={active ? "white" : colors.neutrals.textPrimary} style={{ marginLeft: 4 }}>{m.label}</TText>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Bénéficiaire */}
            <TText variant="caption" weight="semiBold" color={colors.neutrals.textSecondary} style={{ marginTop: 12, marginBottom: 6 }}>Bénéficiaire</TText>
            <TouchableOpacity testID="home-tr-ben" style={styles.selector} onPress={() => setShowBen(true)}>
              <TText weight="semiBold">{selectedBen ? selectedBen.full_name : "Choisir dans l'annuaire"}</TText>
              <Ionicons name="chevron-forward" size={18} color={colors.neutrals.textSecondary} />
            </TouchableOpacity>

            <Button testID="home-tr-continue" title="Continuer" icon="arrow-forward" onPress={continueTransfer} disabled={!country || !selectedBen || sendAmt <= 0} style={{ marginTop: 16 }} />
          </View>
        ) : null}

        {/* Mes dernières opérations (5 dernières, tous types) */}
        <View style={{ marginTop: spacing.xl }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <TText variant="subtitle" weight="bold">Mes dernières opérations</TText>
            <TouchableOpacity testID="home-see-all" onPress={() => router.push("/(tabs)/transfers")}>
              <TText variant="caption" weight="bold" color={colors.primary.base}>Voir plus</TText>
            </TouchableOpacity>
          </View>
          {operations.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="diamond-outline" size={36} color={colors.neutrals.textTertiary} />
              <TText variant="body" color={colors.neutrals.textSecondary} style={{ marginTop: 8 }}>Aucune opération pour l'instant</TText>
            </View>
          ) : (
            operations.slice(0, 3).map((op) => (
              <TouchableOpacity key={`${op.kind}-${op.id}`} testID={`op-${op.id}`} style={styles.txRow} onPress={() => router.push(op.route as any)} activeOpacity={0.7}>
                <View style={styles.txIcon}><Ionicons name={op.icon as any} size={18} color={colors.primary.base} /></View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <TText variant="body" weight="semiBold" numberOfLines={1}>{op.title}</TText>
                  <TText variant="caption" color={colors.neutrals.textSecondary} numberOfLines={1}>{op.subtitle}</TText>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <TText variant="body" weight="bold" color={op.amount >= 0 ? colors.status.success : colors.status.error}>
                    {op.amount >= 0 ? "+" : ""}{op.amount.toFixed(2)} {op.currency}
                  </TText>
                  <TText variant="label" color={colors.neutrals.textTertiary}>{new Date(op.ts).toLocaleDateString("fr-FR")}</TText>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Services — Liste épurée sans cadres (Item 4) */}
        <View style={{ marginTop: spacing.xl }}>
          <TText variant="subtitle" weight="extraBold" style={{ marginBottom: 10 }}>Services</TText>
          <View style={styles.servicesListFlat}>
            {SERVICES.map((s, i) => (
              <TouchableOpacity
                key={s.key}
                testID={`home-service-${s.key}`}
                onPress={() => router.push(s.route as any)}
                activeOpacity={0.7}
                style={[styles.svcRowFlat, i < SERVICES.length - 1 && styles.svcRowSep]}
              >
                <View style={styles.svcIconFlat}>
                  <Ionicons name={s.icon} size={16} color={colors.primary.base} />
                </View>
                <TText variant="caption" weight="semiBold" style={{ flex: 1, marginLeft: 10 }}>{s.label}</TText>
                <Ionicons name="chevron-forward" size={14} color={colors.neutrals.textTertiary} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Country picker */}
      <Modal visible={showCountry} transparent animationType="slide" onRequestClose={() => setShowCountry(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowCountry(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalSheetTall}>
            <TText variant="subtitle" weight="bold">Pays de destination</TText>
            <TText variant="caption" color={colors.neutrals.textSecondary} style={{ marginBottom: 12 }}>{corridors.length} pays disponibles</TText>
            <Input testID="home-country-search" value={search} onChangeText={setSearch} placeholder="Rechercher…" icon="search-outline" />
            <FlatList
              data={filtered}
              keyExtractor={(i) => i.country_code}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity testID={`home-country-${item.country_code}`} style={styles.modalRow} onPress={() => { setCountry(item); setShowCountry(false); setSearch(""); }}>
                  <View style={{ flex: 1 }}>
                    <TText weight="semiBold">{item.flag} {item.country_name}</TText>
                    <TText variant="caption" color={colors.neutrals.textSecondary}>{item.capital || "—"} • {item.currency}</TText>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.neutrals.textTertiary} />
                </TouchableOpacity>
              )}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Beneficiary picker */}
      <Modal visible={showBen} transparent animationType="slide" onRequestClose={() => setShowBen(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowBen(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalSheet}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <TText variant="subtitle" weight="bold">Bénéficiaires</TText>
              <TouchableOpacity testID="home-ben-add" onPress={() => { setShowBen(false); router.push("/beneficiaries"); }}>
                <Ionicons name="add-circle" size={26} color={colors.primary.base} />
              </TouchableOpacity>
            </View>
            {beneficiaries.length === 0 ? (
              <View style={{ padding: 20, alignItems: "center" }}>
                <Ionicons name="people-outline" size={36} color={colors.neutrals.textTertiary} />
                <TText color={colors.neutrals.textSecondary} style={{ marginTop: 8 }}>Aucun bénéficiaire</TText>
                <Button title="+ Nouveau contact" variant="outline" style={{ marginTop: 12 }} onPress={() => { setShowBen(false); router.push("/beneficiaries"); }} />
              </View>
            ) : (
              <FlatList
                data={beneficiaries}
                keyExtractor={(i) => i.id}
                renderItem={({ item }) => (
                  <TouchableOpacity testID={`home-ben-${item.id}`} style={styles.modalRow} onPress={() => { setSelectedBen(item); setShowBen(false); }}>
                    <View style={{ flex: 1 }}>
                      <TText weight="semiBold">{item.full_name}</TText>
                      <TText variant="caption" color={colors.neutrals.textSecondary}>{item.country}{item.city ? ` · ${item.city}` : ""} • {item.relation || "—"}</TText>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.neutrals.textTertiary} />
                  </TouchableOpacity>
                )}
              />
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Recharge methods */}
      <Modal visible={showRecharge} transparent animationType="slide" onRequestClose={() => setShowRecharge(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowRecharge(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalSheet}>
            <TText variant="subtitle" weight="bold" style={{ marginBottom: 4 }}>Ajouter de l'argent</TText>
            <TText variant="caption" color={colors.neutrals.textSecondary} style={{ marginBottom: 12 }}>Choisissez votre méthode de recharge</TText>
            <RechargeMethod testID="rch-cash-qr" icon="qr-code-outline" label="Espèces via agent (QR)" desc="Déposer du cash auprès d'un agent SENDBID" onPress={() => { setShowRecharge(false); router.push("/wallet/recharge"); }} />
            <RechargeMethod testID="rch-card" icon="card-outline" label="Carte bancaire" desc="Visa / Mastercard / 3DS via Stripe" onPress={() => { setShowRecharge(false); router.push("/wallet/recharge"); }} />
            <RechargeMethod testID="rch-momo" icon="phone-portrait-outline" label="Portefeuille mobile" desc="Wave, Orange Money, MTN MoMo, etc." onPress={() => { setShowRecharge(false); router.push("/wallet/recharge"); }} />
            <RechargeMethod testID="rch-paypal" icon="logo-paypal" label="PayPal" desc="Compte PayPal" onPress={() => { setShowRecharge(false); router.push("/wallet/recharge"); }} />          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Pop-up démarrage vérification email + téléphone (30s après login, durée 10s) */}
      <Modal visible={verifPopupVisible} transparent animationType="fade" onRequestClose={() => setVerifPopupVisible(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <View style={{ backgroundColor: "white", borderRadius: 24, padding: 24, maxWidth: 380, width: "100%", alignItems: "center" }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: "#FEF3C7", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="shield-checkmark" size={32} color="#D97706" />
            </View>
            <TText variant="subtitle" weight="extraBold" align="center" style={{ marginTop: 12 }}>
              Vérification de sécurité
            </TText>
            <TText variant="body" align="center" color={colors.neutrals.textSecondary} style={{ marginTop: 8, lineHeight: 20 }}>
              Nous allons maintenant vérifier votre adresse email et votre numéro de téléphone afin de sécuriser votre compte SENDBID.
            </TText>
            <TText variant="caption" weight="bold" color="#D97706" style={{ marginTop: 10 }}>
              Cette procédure est obligatoire et démarre dans quelques instants…
            </TText>
            <View style={{ height: 4, backgroundColor: "#FEF3C7", borderRadius: 2, marginTop: 16, width: "100%", overflow: "hidden" }}>
              <View style={{ height: 4, backgroundColor: "#D97706", width: "100%" }} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function ActionBtn({ icon, label, onPress, testID, tint }: { icon: any; label: string; onPress: () => void; testID?: string; tint?: string }) {
  const color = tint || colors.primary.base;
  return (
    <TouchableOpacity testID={testID} style={[styles.actionBtn, { borderColor: color + "33" }]} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.actionIcon, { backgroundColor: color + "1A" }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <TText variant="caption" weight="bold" align="center" color={color} style={{ marginTop: 6 }}>{label}</TText>
    </TouchableOpacity>
  );
}

function RechargeMethod({ icon, label, desc, onPress, disabled, testID }: { icon: any; label: string; desc: string; onPress: () => void; disabled?: boolean; testID?: string }) {
  return (
    <TouchableOpacity testID={testID} disabled={disabled} style={[styles.rchRow, disabled && { opacity: 0.5 }]} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.rchIcon}><Ionicons name={icon} size={22} color={colors.primary.base} /></View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <TText weight="semiBold">{label}</TText>
        <TText variant="caption" color={colors.neutrals.textSecondary}>{desc}</TText>
      </View>
      {!disabled ? <Ionicons name="chevron-forward" size={18} color={colors.neutrals.textTertiary} /> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center" },
  avatar: { width: 48, height: 48, borderRadius: radii.full, backgroundColor: colors.overlays.primarySoft, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarImg: { width: "100%", height: "100%" },
  notifBtn: { width: 44, height: 44, borderRadius: radii.full, backgroundColor: colors.neutrals.surface, borderWidth: 1, borderColor: colors.neutrals.border, alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", top: 6, right: 6, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: colors.status.error, alignItems: "center", justifyContent: "center" },

  walletQuickRow: { flexDirection: "row", justifyContent: "space-between", gap: 8, marginTop: spacing.lg },
  walletQuickBtn: { flex: 1, alignItems: "center", backgroundColor: colors.neutrals.surface, paddingVertical: 12, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.neutrals.border },
  walletQuickIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  actionsRow: { flexDirection: "row", gap: 10, marginTop: spacing.lg },
  actionBtn: { flex: 1, backgroundColor: colors.neutrals.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.neutrals.border, paddingVertical: 14, alignItems: "center" },
  actionIcon: { width: 44, height: 44, borderRadius: radii.full, backgroundColor: colors.overlays.primarySoft, alignItems: "center", justifyContent: "center" },

  sectionHeadAccent: { flexDirection: "row", alignItems: "center", padding: 16, borderRadius: radii.xl, shadowColor: "#10B981", shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 5 },
  sectionIconAccent: { width: 40, height: 40, borderRadius: radii.full, backgroundColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center" },
  sectionHead: { flexDirection: "row", alignItems: "center", padding: 14, backgroundColor: colors.neutrals.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.neutrals.border, marginTop: spacing.xl },
  sectionIcon: { width: 36, height: 36, borderRadius: radii.full, backgroundColor: colors.primary.base, alignItems: "center", justifyContent: "center" },

  transferForm: { backgroundColor: colors.neutrals.surface, padding: spacing.lg, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.neutrals.border, marginTop: 8 },
  selector: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: colors.neutrals.background, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.neutrals.border, paddingHorizontal: spacing.lg, height: 52 },
  fxBox: { backgroundColor: colors.overlays.accentSoft, padding: spacing.md, borderRadius: radii.lg, marginTop: 4 },
  modeChip: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 10, paddingHorizontal: 8, borderRadius: radii.full, backgroundColor: colors.neutrals.surface, borderWidth: 1.5, borderColor: colors.neutrals.border },

  empty: { alignItems: "center", paddingVertical: spacing.xxl, backgroundColor: colors.neutrals.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.neutrals.border, marginTop: 12 },
  txRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.neutrals.surface, padding: 12, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.neutrals.border, marginTop: 8 },
  txIcon: { width: 40, height: 40, borderRadius: radii.full, backgroundColor: colors.overlays.primarySoft, alignItems: "center", justifyContent: "center" },

  servicesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  servicesListFlat: { backgroundColor: colors.neutrals.surface, borderRadius: radii.lg, paddingHorizontal: 12 },
  svcRowFlat: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  svcRowSep: { borderBottomWidth: 1, borderBottomColor: colors.neutrals.border },
  svcIconFlat: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.overlays.primarySoft, alignItems: "center", justifyContent: "center" },
  serviceCard: { width: "48%", backgroundColor: colors.neutrals.surface, padding: spacing.lg, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.neutrals.border, alignItems: "center" },
  serviceIconLg: { width: 56, height: 56, borderRadius: radii.full, backgroundColor: colors.overlays.primarySoft, alignItems: "center", justifyContent: "center" },
  miniGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10 },
  miniCard: { width: "31.5%", backgroundColor: colors.neutrals.surface, paddingVertical: 12, paddingHorizontal: 6, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.neutrals.border, alignItems: "center", minHeight: 78 },
  miniCardLight: { width: "31.5%", backgroundColor: "rgba(255,255,255,0.08)", paddingVertical: 12, paddingHorizontal: 6, borderRadius: radii.lg, borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", alignItems: "center", minHeight: 78 },
  miniIcon: { width: 36, height: 36, borderRadius: radii.full, backgroundColor: colors.overlays.primarySoft, alignItems: "center", justifyContent: "center" },
  miniIconLight: { width: 36, height: 36, borderRadius: radii.full, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  servicesWrap: { padding: spacing.lg, borderRadius: radii.xxl },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: colors.neutrals.surface, borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl, padding: spacing.lg, maxHeight: "75%" },
  modalSheetTall: { backgroundColor: colors.neutrals.surface, borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl, padding: spacing.lg, height: "85%" },
  modalRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.neutrals.border },

  rchRow: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.neutrals.border, marginBottom: 8 },
  rchIcon: { width: 40, height: 40, borderRadius: radii.full, backgroundColor: colors.overlays.primarySoft, alignItems: "center", justifyContent: "center" },
});
