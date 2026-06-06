import React, { useCallback, useEffect, useState } from "react";
import { View, StyleSheet, TouchableOpacity, RefreshControl, ScrollView, Image, Modal, FlatList } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { TText } from "../../src/components/TText";
import { FlooMoneyCard } from "../../src/components/FlooMoneyCard";
import { SendBidLogo } from "../../src/components/Logo";
import { Input } from "../../src/components/Input";
import { Button } from "../../src/components/Button";
import { useAuth, useDraft } from "../../src/store";
import { KycPopup } from "../../src/components/KycPopup";
import { api } from "../../src/api";
import { colors, spacing, radii } from "../../src/theme";
import { useThemeTokens } from "../../src/themeContext";

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
  { key: "bank", label: "Virement bancaire", icon: "business-outline" as const },
  { key: "momo", label: "Portefeuille mobile", icon: "phone-portrait-outline" as const },
];

export default function Home() {
  const user = useAuth((s) => s.user);
  const wallet = useAuth((s) => s.wallet);
  const refreshMe = useAuth((s) => s.refreshMe);
  const setDraft = useDraft((s) => s.setDraft);
  const router = useRouter();
  const { tokens } = useThemeTokens();

  const [operations, setOperations] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // \"Nouveau transfert\" — Étape 1 inline (déroulée par la flèche ↓)
  const [transferOpen, setTransferOpen] = useState(false);
  const [corridors, setCorridors] = useState<Corridor[]>([]);
  const [country, setCountry] = useState<Corridor | null>(null);
  const [showCountry, setShowCountry] = useState(false);
  const [search, setSearch] = useState("");
  const [sendAmountStr, setSendAmountStr] = useState("100");
  const [receiveAmountStr, setReceiveAmountStr] = useState("");
  const [editing, setEditing] = useState<"send" | "receive">("send");
  const [mode, setMode] = useState("cash");
  const [serviceLevel, setServiceLevel] = useState<"standard" | "vip" | "vip_express">("standard");
  const [beneficiaries, setBeneficiaries] = useState<any[]>([]);
  const [benQuery, setBenQuery] = useState("");
  const [selectedBen, setSelectedBen] = useState<any>(null);

  // Note v7 : la popup post-1ère-connexion est désormais gérée globalement par
  // FirstLoginVerificationGuard (cf. /app/frontend/app/(tabs)/_layout.tsx).
  // L'ancien splash modal a été retiré pour éviter la double-popup.

  const load = useCallback(async () => {
    setRefreshing(true);
    await refreshMe();
    try {
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
      // Pas de pays présélectionné — le client choisit librement le pays du bénéficiaire
    }).catch(() => {});
    api.get("/beneficiaries").then((r) => setBeneficiaries(r.data || [])).catch(() => {});
  }, []);

  // Recompute the non-edited amount when rate/mode/inputs change
  useEffect(() => {
    if (!country) return;
    if (editing === "send") {
      const s = parseFloat(sendAmountStr || "0") || 0;
      setReceiveAmountStr((s * country.fx_rate_eur).toFixed(0));
    } else {
      const r = parseFloat(receiveAmountStr || "0") || 0;
      setSendAmountStr(country.fx_rate_eur ? (r / country.fx_rate_eur).toFixed(2) : "0");
    }
  }, [country, sendAmountStr, receiveAmountStr, editing]);

  if (!user) return null;

  const sendAmt = parseFloat(sendAmountStr || "0") || 0;
  const receiveAmt = parseFloat(receiveAmountStr || "0") || 0;

  // Beneficiary suggestions (dynamic prefix search)
  const benSuggestions = React.useMemo(() => {
    const q = (benQuery || "").trim().toLowerCase();
    if (!q) return [] as any[];
    return beneficiaries
      .filter((b: any) => {
        const name = String(b.full_name || "").toLowerCase();
        const first = String(b.first_name || "").toLowerCase();
        const last = String(b.last_name || "").toLowerCase();
        return name.includes(q) || first.startsWith(q) || last.startsWith(q);
      })
      .slice(0, 8);
  }, [benQuery, beneficiaries]);

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
      vip_delivery: mode === "cash" && serviceLevel !== "standard",
      service_level: mode === "cash" ? serviceLevel : "standard",
      beneficiary: selectedBen,
    });
    router.push("/transfer/details");
  };

  const filtered = corridors.filter((c) => !search || c.country_name.toLowerCase().includes(search.toLowerCase()) || c.country_code.toLowerCase().includes(search.toLowerCase()));

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: tokens.neutrals.background }}>
      <KycPopup userId={user.id} kycTier={user.kyc_tier} />
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 30 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.primary.base} />}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity testID="home-avatar" style={styles.avatar} onPress={() => router.push("/(tabs)/profile")}>
            {user.avatar_url ? <Image source={{ uri: user.avatar_url }} style={styles.avatarImg} /> : <Ionicons name="person" size={20} color={colors.primary.base} />}
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12, flexDirection: "row", alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <TText variant="caption" color={colors.neutrals.textSecondary}>Bonjour</TText>
              <TText variant="subtitle" weight="extraBold">{user.full_name.split(" ")[0]} 👋</TText>
              <TText variant="label" color={colors.primary.base} weight="bold" style={{ marginTop: 2 }}>@{user.profile_id}</TText>
            </View>
            <SendBidLogo size={40} />
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

        {/* 3 quick wallet actions */}
        <View style={styles.walletQuickRow}>
          <TouchableOpacity testID="home-recharge" onPress={() => router.push("/wallet/recharge" as any)} style={styles.walletQuickBtn}>
            <View style={[styles.walletQuickIcon, { backgroundColor: "#10B981" }]}>
              <Ionicons name="add-circle" size={22} color="white" />
            </View>
            <TText variant="label" weight="semiBold" align="center" style={{ marginTop: 6 }}>Ajouter de l'argent</TText>
          </TouchableOpacity>
          <TouchableOpacity testID="home-withdraw" onPress={() => router.push("/wallet/withdraw" as any)} style={styles.walletQuickBtn}>
            <View style={[styles.walletQuickIcon, { backgroundColor: "#3B82F6" }]}>
              <Ionicons name="arrow-down-circle" size={22} color="white" />
            </View>
            <TText variant="label" weight="semiBold" align="center" style={{ marginTop: 6 }}>Retirer</TText>
          </TouchableOpacity>
          <TouchableOpacity testID="home-send" onPress={() => router.push("/wallet/p2p" as any)} style={styles.walletQuickBtn}>
            <View style={[styles.walletQuickIcon, { backgroundColor: "#F59E0B" }]}>
              <Ionicons name="paper-plane" size={22} color="white" />
            </View>
            <TText variant="label" weight="semiBold" align="center" style={{ marginTop: 6 }}>Envoyer</TText>
          </TouchableOpacity>
        </View>

        {/* === CTA "Nouveau transfert" — flèche ↓ qui déroule l'étape 1 inline === */}
        <TouchableOpacity
          testID="home-new-transfer-toggle"
          activeOpacity={0.85}
          onPress={() => setTransferOpen((v) => !v)}
          style={{ marginTop: spacing.xl }}
        >
          <LinearGradient
            colors={transferOpen ? [colors.primary.base, colors.primary.dark] : ["#10B981", "#04ba28"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.newTransferCta}
          >
            <View style={styles.newTransferIcon}>
              <SendBidLogo size={28} withBackground />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <TText weight="extraBold" color="white">Nouveau transfert</TText>
              <TText variant="caption" color="rgba(255,255,255,0.92)">
                {transferOpen ? "Replier pour masquer le formulaire" : "Envoyer de l'argent dans le monde entier"}
              </TText>
            </View>
            <View style={styles.arrowCircle}>
              <Ionicons name={transferOpen ? "chevron-up" : "chevron-down"} size={22} color="white" />
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* === Étape 1 (inline) === */}
        {transferOpen ? (
          <View style={styles.transferForm}>
            {/* Pays bénéficiaire */}
            <TText variant="caption" weight="semiBold" color={colors.neutrals.textSecondary} style={{ marginBottom: 6 }}>
              Pays du bénéficiaire
            </TText>
            <TouchableOpacity testID="home-tr-country" style={styles.selector} onPress={() => setShowCountry(true)}>
              <TText weight="semiBold">{country ? `${country.flag} ${country.country_name}` : "Sélectionner"}</TText>
              <Ionicons name="chevron-down" size={18} color={colors.neutrals.textSecondary} />
            </TouchableOpacity>

            {/* === Combien voulez-vous envoyer ? === */}
            <TText variant="body" weight="extraBold" style={{ marginTop: spacing.md }}>
              Combien voulez-vous envoyer ?
            </TText>
            <View style={styles.amountsRow}>
              <View style={styles.amountBoxHalf}>
                <TText variant="label" color={colors.neutrals.textSecondary} style={{ marginBottom: 4 }}>
                  Vous envoyez
                </TText>
                <View style={styles.amountInner}>
                  <Input
                    testID="home-tr-send"
                    value={sendAmountStr}
                    onChangeText={(v) => { setEditing("send"); setSendAmountStr(v); }}
                    keyboardType="decimal-pad"
                    style={{ marginBottom: 0 } as any}
                  />
                  <View style={styles.currencyChip}>
                    <TText variant="caption" weight="extraBold">EUR</TText>
                  </View>
                </View>
              </View>

              <View style={styles.amountBoxHalf}>
                <TText variant="label" color={colors.neutrals.textSecondary} style={{ marginBottom: 4 }}>
                  Le bénéficiaire reçoit
                </TText>
                <View style={styles.amountInner}>
                  <Input
                    testID="home-tr-receive"
                    value={receiveAmountStr}
                    onChangeText={(v) => { setEditing("receive"); setReceiveAmountStr(v); }}
                    keyboardType="decimal-pad"
                    style={{ marginBottom: 0 } as any}
                  />
                  <View style={styles.currencyChip}>
                    <TText variant="caption" weight="extraBold">{country?.currency || "—"}</TText>
                  </View>
                </View>
              </View>
            </View>
            <View style={styles.fxBox}>
              <Ionicons name="swap-horizontal" size={14} color={colors.primary.base} />
              <TText variant="caption" weight="semiBold" color={colors.primary.base} style={{ marginLeft: 6 }}>
                1 EUR = {country?.fx_rate_eur.toFixed(2)} {country?.currency} {country?.fx_fixed ? "• parité fixe" : "• taux variable"}
              </TText>
            </View>

            {/* === Mode de remise === */}
            <TText variant="body" weight="extraBold" style={{ marginTop: spacing.lg }}>
              Comment voulez-vous que le bénéficiaire reçoive l'argent ?
            </TText>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              {DELIVERY_MODES.map((m) => {
                const supported = !country || country.delivery_modes.includes(m.key);
                const active = mode === m.key && supported;
                return (
                  <TouchableOpacity
                    key={m.key}
                    testID={`home-tr-mode-${m.key}`}
                    disabled={!supported}
                    style={[
                      styles.modeChip,
                      active && { backgroundColor: colors.primary.base, borderColor: colors.primary.base },
                      !supported && { opacity: 0.4 },
                    ]}
                    onPress={() => setMode(m.key)}
                  >
                    <Ionicons name={m.icon} size={16} color={active ? "white" : colors.primary.base} />
                    <TText variant="label" weight="bold" color={active ? "white" : colors.neutrals.textPrimary} style={{ marginLeft: 4 }}>
                      {m.label}
                    </TText>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* === Bénéficiaire (recherche dynamique) === */}
            <TText variant="body" weight="extraBold" style={{ marginTop: spacing.lg }}>
              À qui voulez-vous envoyer de l'argent ?
            </TText>
            {selectedBen ? (
              <View style={styles.selectedBenRow}>
                <View style={styles.benAvatar}>
                  <TText weight="extraBold" color="white">{(selectedBen.full_name || "?").charAt(0).toUpperCase()}</TText>
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <TText variant="body" weight="extraBold">{selectedBen.full_name}</TText>
                  <TText variant="caption" color={colors.neutrals.textSecondary}>
                    {selectedBen.country}{selectedBen.city ? ` · ${selectedBen.city}` : ""} {selectedBen.relation ? `· ${selectedBen.relation}` : ""}
                  </TText>
                </View>
                <TouchableOpacity onPress={() => { setSelectedBen(null); setBenQuery(""); }} style={styles.clearBtn}>
                  <Ionicons name="close" size={16} color={colors.neutrals.textSecondary} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ marginTop: 8 }}>
                <Input
                  testID="home-tr-ben-search"
                  value={benQuery}
                  onChangeText={setBenQuery}
                  placeholder="Tapez le nom ou prénom du bénéficiaire…"
                  icon="search-outline"
                  style={{ marginBottom: 0 } as any}
                />
                {benQuery.trim().length > 0 ? (
                  <View style={styles.suggestBox}>
                    {benSuggestions.length === 0 ? (
                      <View style={{ padding: spacing.md }}>
                        <TText variant="caption" color={colors.neutrals.textSecondary} style={{ marginBottom: 8 }}>
                          Aucun bénéficiaire trouvé pour « {benQuery} ».
                        </TText>
                        <TouchableOpacity
                          testID="home-tr-ben-create"
                          style={styles.createBenBtn}
                          onPress={() => router.push("/beneficiaries/add" as any)}
                        >
                          <Ionicons name="person-add" size={16} color="white" />
                          <TText variant="label" weight="extraBold" color="white" style={{ marginLeft: 6 }}>
                            Créer un bénéficiaire
                          </TText>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      benSuggestions.map((b: any, idx: number) => (
                        <TouchableOpacity
                          key={b.id}
                          testID={`home-tr-ben-${b.id}`}
                          onPress={() => { setSelectedBen(b); setBenQuery(""); }}
                          style={[styles.suggestRow, idx < benSuggestions.length - 1 && styles.suggestRowSep]}
                        >
                          <View style={styles.benAvatarSm}>
                            <TText variant="caption" weight="extraBold" color="white">{(b.full_name || "?").charAt(0).toUpperCase()}</TText>
                          </View>
                          <View style={{ flex: 1, marginLeft: 10 }}>
                            <TText variant="body" weight="semiBold">{b.full_name}</TText>
                            <TText variant="label" color={colors.neutrals.textSecondary}>
                              {b.country}{b.city ? ` · ${b.city}` : ""}{b.default_delivery_mode ? ` · ${String(b.default_delivery_mode).toUpperCase()}` : ""}
                            </TText>
                          </View>
                          <Ionicons name="chevron-forward" size={16} color={colors.neutrals.textTertiary} />
                        </TouchableOpacity>
                      ))
                    )}
                  </View>
                ) : null}
              </View>
            )}

            {/* === Services VIP (uniquement pour cash) — layout horizontal 3 colonnes === */}
            {mode === "cash" ? (
              <View style={{ marginTop: spacing.lg }}>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                  <Ionicons name="rocket-outline" size={14} color="#F59E0B" />
                  <TText variant="caption" weight="extraBold" color={colors.neutrals.textSecondary} style={{ marginLeft: 6, letterSpacing: 0.5 }}>
                    NIVEAU DE SERVICE
                  </TText>
                </View>

                <View style={{ flexDirection: "row", gap: 8 }}>
                  {/* Standard */}
                  <TouchableOpacity
                    testID="home-svc-standard"
                    style={[styles.svcCard, serviceLevel === "standard" && styles.svcCardActiveGreen]}
                    onPress={() => setServiceLevel("standard")}
                    activeOpacity={0.85}
                  >
                    <View style={[styles.svcIcon, { backgroundColor: serviceLevel === "standard" ? "#10B981" : "#10B98122" }]}>
                      <Ionicons name="checkmark-circle" size={18} color={serviceLevel === "standard" ? "white" : "#10B981"} />
                    </View>
                    <TText variant="caption" weight="extraBold" align="center" style={{ marginTop: 6 }}>Standard</TText>
                    <View style={[styles.tagPill, { backgroundColor: "#D1FAE5", marginTop: 4 }]}>
                      <TText variant="label" weight="extraBold" color="#065F46">GRATUIT</TText>
                    </View>
                    <TText variant="label" align="center" color={colors.neutrals.textSecondary} style={{ marginTop: 4, fontSize: 10, lineHeight: 13 }}>
                      Retrait en agence
                    </TText>
                  </TouchableOpacity>

                  {/* VIP */}
                  <TouchableOpacity
                    testID="home-svc-vip"
                    style={[styles.svcCard, serviceLevel === "vip" && styles.svcCardActiveOrange]}
                    onPress={() => setServiceLevel("vip")}
                    activeOpacity={0.85}
                  >
                    <View style={[styles.svcIcon, { backgroundColor: serviceLevel === "vip" ? "#F59E0B" : "#F59E0B22" }]}>
                      <Ionicons name="flash" size={18} color={serviceLevel === "vip" ? "white" : "#F59E0B"} />
                    </View>
                    <TText variant="caption" weight="extraBold" align="center" style={{ marginTop: 6 }}>VIP</TText>
                    <View style={[styles.tagPill, { backgroundColor: "#FEF3C7", marginTop: 4 }]}>
                      <TText variant="label" weight="extraBold" color="#92400E">1-4h</TText>
                    </View>
                    <TText variant="label" align="center" color={colors.neutrals.textSecondary} style={{ marginTop: 4, fontSize: 10, lineHeight: 13 }}>
                      Rapide{"\n"}1%, min. 15€
                    </TText>
                  </TouchableOpacity>

                  {/* VIP+ */}
                  <TouchableOpacity
                    testID="home-svc-vip-express"
                    style={[styles.svcCard, serviceLevel === "vip_express" && styles.svcCardActiveOrange]}
                    onPress={() => setServiceLevel("vip_express")}
                    activeOpacity={0.85}
                  >
                    <View style={[styles.svcIcon, { backgroundColor: serviceLevel === "vip_express" ? "#EA580C" : "#EA580C22" }]}>
                      <Ionicons name="rocket" size={18} color={serviceLevel === "vip_express" ? "white" : "#EA580C"} />
                    </View>
                    <TText variant="caption" weight="extraBold" align="center" style={{ marginTop: 6 }}>VIP+</TText>
                    <View style={[styles.tagPill, { backgroundColor: "#FFEDD5", marginTop: 4 }]}>
                      <TText variant="label" weight="extraBold" color="#9A3412">1-2h</TText>
                    </View>
                    <TText variant="label" align="center" color={colors.neutrals.textSecondary} style={{ marginTop: 4, fontSize: 10, lineHeight: 13 }}>
                      Ultra rapide{"\n"}1,5%, min. 20€
                    </TText>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            {/* CTA Continuer */}
            <Button
              testID="home-tr-continue"
              title="Continuer"
              icon="arrow-forward"
              onPress={continueTransfer}
              disabled={!country || !selectedBen || sendAmt <= 0}
              style={{ marginTop: spacing.lg }}
            />
          </View>
        ) : null}

        {/* Dernières opérations */}
        <View style={{ marginTop: spacing.xl }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <TText variant="caption" weight="bold" style={{ fontSize: 12 }}>Mes dernières opérations</TText>
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

        {/* === Services — grille compacte avec dégradé bleu Portefeuille === */}
        <View style={{ marginTop: spacing.lg }}>
          <TText variant="subtitle" weight="extraBold" style={{ marginBottom: 8 }}>Services</TText>
          <LinearGradient
            colors={["#00147E", "#3D52D5"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.servicesGrid}
          >
            {SERVICES.map((s) => (
              <TouchableOpacity
                key={s.key}
                testID={`home-service-${s.key}`}
                onPress={() => router.push(s.route as any)}
                activeOpacity={0.7}
                style={styles.serviceMiniCard}
              >
                <Ionicons name={s.icon} size={20} color="white" />
                <TText variant="label" weight="semiBold" color="white" align="center" style={{ marginTop: 4 }} numberOfLines={2}>{s.label}</TText>
              </TouchableOpacity>
            ))}
          </LinearGradient>
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

      {/* La pop-up de vérification post-1ère-connexion est gérée par
          FirstLoginVerificationGuard (voir (tabs)/_layout.tsx). */}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center" },
  avatar: { width: 48, height: 48, borderRadius: radii.full, backgroundColor: colors.overlays.primarySoft, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarImg: { width: "100%", height: "100%" },
  notifBtn: { width: 44, height: 44, borderRadius: radii.full, backgroundColor: colors.neutrals.surface, borderWidth: 1, borderColor: colors.neutrals.border, alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", top: 6, right: 6, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: colors.status.error, alignItems: "center", justifyContent: "center" },

  walletQuickRow: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.lg, borderRadius: radii.xl, paddingVertical: 12, paddingHorizontal: 8 },
  walletQuickBtn: { flex: 1, alignItems: "center", backgroundColor: "transparent", paddingVertical: 10, borderRadius: radii.lg },
  walletQuickIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },

  // CTA Nouveau transfert
  newTransferCta: { flexDirection: "row", alignItems: "center", padding: 16, borderRadius: radii.xl, shadowColor: "#022a6b", shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 5 },
  newTransferIcon: { width: 44, height: 44, borderRadius: radii.full, backgroundColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center" },
  arrowCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center" },

  // Form
  transferForm: { backgroundColor: colors.neutrals.surface, padding: spacing.lg, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.neutrals.border, marginTop: 8 },
  selector: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: colors.neutrals.background, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.neutrals.border, paddingHorizontal: spacing.lg, height: 52 },
  amountsRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  amountBoxHalf: { flex: 1 },
  amountInner: { flexDirection: "row", alignItems: "center", gap: 6 },
  currencyChip: { backgroundColor: colors.overlays.primarySoft, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.full, marginBottom: 12 },
  fxBox: { flexDirection: "row", alignItems: "center", backgroundColor: colors.overlays.primarySoft, padding: 10, borderRadius: radii.lg, marginTop: 4 },
  modeChip: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 10, paddingHorizontal: 6, borderRadius: radii.full, backgroundColor: colors.neutrals.surface, borderWidth: 1.5, borderColor: colors.neutrals.border },

  svcRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.neutrals.surface, padding: 12, borderRadius: radii.lg, borderWidth: 1.5, borderColor: colors.neutrals.border, marginBottom: 8 },
  svcRowActiveGreen: { borderColor: "#10B981", backgroundColor: "rgba(16,185,129,0.06)" },
  svcRowActiveOrange: { borderColor: "#F59E0B", backgroundColor: "rgba(245,158,11,0.06)" },
  svcCard: {
    flex: 1,
    backgroundColor: colors.neutrals.surface,
    paddingVertical: 12, paddingHorizontal: 8,
    borderRadius: radii.lg, borderWidth: 1.5, borderColor: colors.neutrals.border,
    alignItems: "center", justifyContent: "flex-start",
    minHeight: 120,
  },
  svcCardActiveGreen: { borderColor: "#10B981", backgroundColor: "rgba(16,185,129,0.06)" },
  svcCardActiveOrange: { borderColor: "#F59E0B", backgroundColor: "rgba(245,158,11,0.06)" },
  svcIcon: { width: 40, height: 40, borderRadius: radii.full, alignItems: "center", justifyContent: "center" },
  tagPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radii.full },

  selectedBenRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.overlays.primarySoft, borderRadius: radii.xl, borderWidth: 1.5, borderColor: colors.primary.base, padding: 10, marginTop: 8 },
  benAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primary.base, alignItems: "center", justifyContent: "center" },
  benAvatarSm: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary.base, alignItems: "center", justifyContent: "center" },
  clearBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.neutrals.surface, alignItems: "center", justifyContent: "center" },
  suggestBox: { backgroundColor: colors.neutrals.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.neutrals.border, marginTop: 6, overflow: "hidden" },
  suggestRow: { flexDirection: "row", alignItems: "center", padding: 10 },
  suggestRowSep: { borderBottomWidth: 1, borderBottomColor: colors.neutrals.border },
  createBenBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: colors.primary.base, paddingVertical: 10, borderRadius: radii.full, alignSelf: "flex-start", paddingHorizontal: 14 },

  // Empty / TX
  empty: { alignItems: "center", paddingVertical: spacing.xxl, backgroundColor: colors.neutrals.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.neutrals.border, marginTop: 12 },
  txRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.neutrals.surface, padding: 12, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.neutrals.border, marginTop: 8 },
  txIcon: { width: 40, height: 40, borderRadius: radii.full, backgroundColor: colors.overlays.primarySoft, alignItems: "center", justifyContent: "center" },

  // Services — grille compacte mini-cards transparentes, conteneur bleu thème + trait fin bleu nuit
  servicesGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 4, borderRadius: radii.xl, borderWidth: 1, borderColor: "#000C3A", padding: 8 },
  serviceMiniCard: { width: "31.5%", paddingVertical: 8, paddingHorizontal: 4, backgroundColor: "transparent", alignItems: "center", minHeight: 60 },
  servicesContainer: { backgroundColor: "transparent" },
  servicesRow: { flexDirection: "row", alignItems: "center", paddingVertical: 14 },
  servicesRowSep: { borderBottomWidth: 0 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: colors.neutrals.surface, borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl, padding: spacing.lg, maxHeight: "75%" },
  modalSheetTall: { backgroundColor: colors.neutrals.surface, borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl, padding: spacing.lg, height: "85%" },
  modalRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.neutrals.border },
});
