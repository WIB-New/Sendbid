import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Modal } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { TText } from "../../src/components/TText";
import { api } from "../../src/api";
import { useAuth } from "../../src/store";
import { colors, spacing, radii } from "../../src/theme";
import { useThemedColors } from "../../src/themeContext";

// Wallet tab v4.0 — "17 Wallet" : hero gradient + 4 quick actions (Recharger/Retirer/Envoyer/Historique)
// + Opérations récentes liste cliquable vers /wallet/op/[id]
const QUICK = [
  { key: "recharge", icon: "add-circle" as const, label: "Ajouter de l'argent", color: "#10B981", route: "/wallet/recharge" },
  { key: "withdraw", icon: "arrow-down-circle" as const, label: "Retirer", color: "#3B82F6", route: "/wallet/withdraw" },
  { key: "send", icon: "paper-plane" as const, label: "Envoyer", color: "#F59E0B", route: "/wallet/p2p" },
  { key: "bank", icon: "business" as const, label: "Virement bancaire", color: "#8B5CF6", route: "/wallet/bank-transfer" },
];

function tint(type: string) {
  const t = (type || "").toLowerCase();
  if (t.includes("topup") || t.includes("p2p_in") || t.includes("refund") || t.includes("bonus") || t.includes("withdraw_credit")) return "#10B981";
  return "#EF4444";
}
function icon(type: string): keyof typeof Ionicons.glyphMap {
  const t = (type || "").toLowerCase();
  if (t.includes("topup") || t.includes("p2p_in")) return "arrow-down";
  if (t.includes("withdraw") || t.includes("p2p_out")) return "arrow-up";
  if (t.includes("transfer")) return "paper-plane";
  return "cash";
}
function getAmount(tx: any): number {
  const v = tx.amount_signed ?? tx.amount ?? 0;
  return typeof v === "number" && !isNaN(v) ? v : Number(v) || 0;
}
function formatLabel(tx: any): string {
  if (tx.label) return tx.label;
  const map: any = {
    topup: "Recharge",
    withdraw: "Retrait",
    p2p_in: "Reçu",
    p2p_out: "Envoyé",
    transfer_escrow: "Transfert international",
    transfer_release: "Versement agent",
    refund: "Remboursement",
    bonus: "Bonus",
  };
  return map[(tx.type || "").toLowerCase()] || tx.type || "Opération";
}

export default function WalletTab() {
  const router = useRouter();
  const wallet = useAuth((s) => s.wallet);
  const refreshMe = useAuth((s) => s.refreshMe);
  const [txs, setTxs] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [period, setPeriod] = useState<"day" | "week" | "month" | "quarter">("month");
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    await refreshMe().catch(() => {});
    try {
      const r = await api.get("/wallet/transactions", { params: { limit: 50 } });
      setTxs(r.data || []);
    } catch {}
    setBusy(false);
  }, [refreshMe]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = React.useMemo(() => {
    const days = period === "day" ? 1 : period === "week" ? 7 : period === "month" ? 30 : 90;
    const cutoff = Date.now() - days * 86400000;
    return txs.filter((t) => {
      const ts = new Date(t.created_at || t.date || 0).getTime();
      return ts >= cutoff;
    });
  }, [txs, period]);
  const visible = showAll ? filtered : filtered.slice(0, 5);

  return (
    <View style={styles.bg}>
      <LinearGradient colors={["#022a6b", "#052080"]} style={styles.hero}>
        <SafeAreaView edges={["top"]}>
          <View style={styles.heroTop}>
            <TText variant="title" weight="extraBold" color="white">Mon portefeuille</TText>
            <TouchableOpacity testID="wallet-menu-btn" onPress={() => setShowMenu(true)} style={styles.iconBtn}>
              <Ionicons name="menu" size={22} color="white" />
            </TouchableOpacity>
          </View>
          <View style={styles.balanceBox}>
            <TText variant="label" color="rgba(255,255,255,0.75)" style={{ letterSpacing: 1 }}>SOLDE PRINCIPAL</TText>
            <TText variant="display" weight="extraBold" color="white" style={{ marginTop: 4 }}>
              {Number(wallet?.balance || 0).toFixed(2)} <TText variant="title" weight="bold" color="rgba(255,255,255,0.8)">{wallet?.currency || "EUR"}</TText>
            </TText>
            <View style={styles.walletRow}>
              <Ionicons name="wallet" size={14} color="rgba(255,255,255,0.75)" />
              <TText variant="label" color="rgba(255,255,255,0.75)" style={{ marginLeft: 4 }}>
                Wallet multi-devises · Gratuit
              </TText>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        style={styles.card}
        contentContainerStyle={styles.cardInner}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={busy} onRefresh={load} tintColor={colors.primary.base} />}
      >
        {/* 4 quick actions */}
        <View style={styles.quickRow}>
          {QUICK.map((q) => (
            <TouchableOpacity key={q.key} testID={`wallet-${q.key}`} onPress={() => q.route !== "/wallet" && router.push(q.route as any)} style={styles.quickBtn}>
              <View style={[styles.quickIcon, { backgroundColor: q.color }]}>
                <Ionicons name={q.icon} size={20} color="white" />
              </View>
              <TText variant="label" weight="semiBold" align="center" style={{ marginTop: 6 }}>{q.label}</TText>
            </TouchableOpacity>
          ))}
        </View>

        {/* Transactions */}
        <View style={styles.secHead}>
          <TText variant="label" weight="bold" color={colors.neutrals.textSecondary} style={{ letterSpacing: 0.3, fontSize: 11 }}>
            Opérations récentes
          </TText>
          <TouchableOpacity onPress={load}>
            <Ionicons name="refresh" size={16} color={colors.neutrals.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Period filter chips */}
        <View style={styles.periodRow}>
          {[{ k: "day", l: "Jour" }, { k: "week", l: "Sem." }, { k: "month", l: "Mois" }, { k: "quarter", l: "Trim." }].map((p) => (
            <TouchableOpacity key={p.k} testID={`wper-${p.k}`} onPress={() => { setPeriod(p.k as any); setShowAll(false); }} style={[styles.pChip, period === p.k && styles.pChipActive]}>
              <TText variant="label" weight="bold" color={period === p.k ? "white" : colors.neutrals.textPrimary}>{p.l}</TText>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.listBox}>
          {visible.length === 0 ? (
            <View style={{ padding: spacing.xl, alignItems: "center" }}>
              <Ionicons name="receipt-outline" size={28} color={colors.neutrals.textTertiary} />
              <TText variant="caption" color={colors.neutrals.textSecondary} style={{ marginTop: 6 }}>Aucune opération sur cette période</TText>
            </View>
          ) : visible.map((tx: any, i: number) => {
            const amt = getAmount(tx);
            return (
            <TouchableOpacity
              key={tx.id}
              testID={`wtx-${i}`}
              onPress={() => router.push({ pathname: "/wallet/op/[id]", params: { id: tx.id } })}
              style={[styles.tx, i < visible.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.neutrals.border }]}
            >
              <View style={[styles.txIcon, { backgroundColor: tint(tx.type) + "1A" }]}>
                <Ionicons name={icon(tx.type)} size={18} color={tint(tx.type)} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <TText variant="body" weight="semiBold">{formatLabel(tx)}</TText>
                <TText variant="label" color={colors.neutrals.textTertiary}>
                  {new Date(tx.created_at).toLocaleString("fr-FR")}
                </TText>
              </View>
              <TText variant="body" weight="extraBold" color={tint(tx.type)}>
                {amt > 0 ? "+" : ""}{amt.toFixed(2)} {wallet?.currency || "EUR"}
              </TText>
            </TouchableOpacity>
          );})}
        </View>

        {/* Voir tout / Réduire */}
        {filtered.length > 10 ? (
          <TouchableOpacity testID="wallet-viewall" style={styles.seeAll} onPress={() => setShowAll((v) => !v)}>
            <TText variant="caption" weight="bold" color={colors.primary.base}>
              {showAll ? "Réduire" : `Voir tout (${filtered.length})`}
            </TText>
            <Ionicons name={showAll ? "chevron-up" : "chevron-down"} size={16} color={colors.primary.base} />
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      {/* Wallet menu top-right */}
      <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
        <TouchableOpacity activeOpacity={1} style={styles.menuOverlay} onPress={() => setShowMenu(false)}>
          <View style={styles.menuCard}>
            <MenuRow icon="qr-code-outline" label="Connaître mon SBTag" onPress={() => { setShowMenu(false); router.push("/sbtag" as any); }} />
            <MenuRow icon="people-circle-outline" label="Mes contacts" onPress={() => { setShowMenu(false); router.push("/contacts" as any); }} />
            <MenuRow icon="speedometer-outline" label="Mes plafonds" onPress={() => { setShowMenu(false); router.push("/payment-caps" as any); }} />
            <MenuRow icon="receipt-outline" label="Reçus PDF" onPress={() => { setShowMenu(false); router.push("/receipts" as any); }} />
            <MenuRow icon="help-circle-outline" label="Support" onPress={() => { setShowMenu(false); router.push("/support" as any); }} last />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function MenuRow({ icon, label, onPress, last }: { icon: any; label: string; onPress: () => void; last?: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} style={[walletMenuStyles.row, !last && walletMenuStyles.rowBorder]}>
      <Ionicons name={icon} size={20} color={colors.primary.base} />
      <TText variant="body" weight="semiBold" style={{ flex: 1, marginLeft: 12 }}>{label}</TText>
      <Ionicons name="chevron-forward" size={16} color={colors.neutrals.textTertiary} />
    </TouchableOpacity>
  );
}

const walletMenuStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 11, paddingHorizontal: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
});

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: "#022a6b" },
  hero: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl + 20 },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: spacing.sm },
  iconBtn: { width: 36, height: 36, borderRadius: radii.full, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" },
  balanceBox: { marginTop: spacing.lg },
  walletRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  card: { flex: 1, backgroundColor: colors.neutrals.background, borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl, marginTop: -spacing.lg },
  cardInner: { padding: spacing.lg, paddingBottom: 30 },
  quickRow: { flexDirection: "row", justifyContent: "space-between", gap: 4 },
  quickBtn: { flex: 1, alignItems: "center", backgroundColor: "transparent", paddingVertical: 8 },
  quickIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  secHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.lg, marginBottom: 8, marginHorizontal: 4 },
  periodRow: { flexDirection: "row", gap: 6, marginBottom: 10, paddingHorizontal: 4 },
  pChip: { flex: 1, paddingVertical: 7, borderRadius: radii.full, backgroundColor: colors.neutrals.surface, borderWidth: 1, borderColor: colors.neutrals.border, alignItems: "center" },
  pChipActive: { backgroundColor: colors.primary.base, borderColor: colors.primary.base },
  seeAll: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 12, marginTop: 8, gap: 4 },
  menuOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "flex-end", paddingTop: 60, paddingRight: 10 },
  menuCard: { backgroundColor: "white", borderRadius: radii.lg, minWidth: 180, overflow: "hidden", elevation: 6, shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  listBox: { backgroundColor: colors.neutrals.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.neutrals.border },
  tx: { flexDirection: "row", alignItems: "center", padding: spacing.md },
  txIcon: { width: 36, height: 36, borderRadius: radii.full, alignItems: "center", justifyContent: "center" },
});
