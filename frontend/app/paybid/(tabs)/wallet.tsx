/**
 * /paybid/(tabs)/wallet.tsx — Portefeuille de l'agent PAYBID.
 *
 * Clone EXACT du Portefeuille Sendbid (item 5 de la spec utilisateur) avec :
 *   - Le hero/gradient PAYBID (#54280f marron café)
 *   - Les couleurs/typographies PAYBID
 *   - Les MÊMES actions rapides (Recharger / Retirer / Envoyer / Virement bancaire)
 *   - Les MÊMES routes partagées (/wallet/recharge, /wallet/withdraw, /wallet/p2p, /wallet/bank-transfer)
 *   - Le MÊME historique (/wallet/transactions) + filtre période + détail (/wallet/op/[id])
 *
 * Note métier (item 5 — confirmé par l'utilisateur) : c'est le compte personnel EUR
 * de l'agent. La vue "gains / commissions" reste séparée et sera intégrée à l'onglet
 * Transferts (item 7).
 */
import React, { useCallback, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { TText } from "../../../src/components/TText";
import { api } from "../../../src/api";
import { t, useLocale } from "../../../src/i18n";
import { useAuth } from "../../../src/store";
import { spacing, radii } from "../../../src/theme";
import { useThemedPaybidColors } from "../../../src/themeContext";
import { paybidColors } from "../../../src/paybidTheme";

// 4 quick actions — alignées sur Sendbid (Recharger / Retirer / Envoyer / Virement)
const QUICK = [
  {
    key: "recharge",
    icon: "add-circle" as const,
    labelKey: "home.addMoney",
    color: "#10B981",
    route: "/wallet/recharge",
  },
  {
    key: "withdraw",
    icon: "arrow-down-circle" as const,
    labelKey: "home.withdraw",
    color: "#54280f",
    route: "/wallet/withdraw",
  },
  {
    key: "send",
    icon: "paper-plane" as const,
    labelKey: "home.send",
    color: "#FFA500",
    route: "/wallet/p2p",
  },
  {
    key: "bank",
    icon: "business" as const,
    labelKey: "delivery.bank",
    color: "#8B5CF6",
    route: "/wallet/bank-transfer",
  },
];

function tint(type: string) {
  const x = (type || "").toLowerCase();
  if (
    x.includes("topup") ||
    x.includes("p2p_in") ||
    x.includes("refund") ||
    x.includes("bonus") ||
    x.includes("withdraw_credit") ||
    x.includes("agent_commission") ||
    x.includes("transfer_release")
  )
    return "#10B981";
  return "#EF4444";
}
function iconOf(type: string): keyof typeof Ionicons.glyphMap {
  const x = (type || "").toLowerCase();
  if (x.includes("topup") || x.includes("p2p_in")) return "arrow-down";
  if (x.includes("withdraw") || x.includes("p2p_out")) return "arrow-up";
  if (x.includes("agent_commission") || x.includes("transfer_release")) return "trophy";
  if (x.includes("transfer")) return "paper-plane";
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
    transfer_release: "Commission agent",
    agent_commission: "Commission agent",
    refund: "Remboursement",
    bonus: "Bonus",
  };
  return map[(tx.type || "").toLowerCase()] || tx.type || "Opération";
}

export default function PaybidWalletTab() {
  const colors = useThemedPaybidColors();
  const router = useRouter();
  const wallet = useAuth((s) => s.wallet);
  const refreshMe = useAuth((s) => s.refreshMe);
  const [txs, setTxs] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [period, setPeriod] = useState<"day" | "week" | "month" | "quarter">(
    "month"
  );
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    await refreshMe().catch(() => {});
    try {
      const r = await api.get("/wallet/transactions", {
        params: { limit: 50 },
      });
      setTxs(r.data || []);
    } catch {}
    setBusy(false);
  }, [refreshMe]);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );
  useLocale((st) => st.locale);

  const filtered = React.useMemo(() => {
    const days =
      period === "day" ? 1 : period === "week" ? 7 : period === "month" ? 30 : 90;
    const cutoff = Date.now() - days * 86400000;
    return txs.filter((tx) => {
      const ts = new Date(tx.created_at || tx.date || 0).getTime();
      return ts >= cutoff;
    });
  }, [txs, period]);
  const visible = showAll ? filtered : filtered.slice(0, 5);

  return (
    <View style={[styles.bg, { backgroundColor: paybidColors.gradients.hero[0] }]}>
      {/* ===== Hero PAYBID (marron #54280f) ===== */}
      <LinearGradient colors={paybidColors.gradients.hero} style={styles.hero}>
        <SafeAreaView edges={["top"]}>
          <View style={styles.heroTop}>
            <TText variant="title" weight="extraBold" color="white">
              {t("wallet.title")}
            </TText>
            <TouchableOpacity
              testID="paybid-wallet-menu-btn"
              onPress={() => setShowMenu(true)}
              style={styles.iconBtn}
            >
              <Ionicons name="menu" size={22} color="white" />
            </TouchableOpacity>
          </View>
          <View style={styles.balanceBox}>
            <TText
              variant="label"
              color="rgba(255,255,255,0.75)"
              style={{ letterSpacing: 1 }}
            >
              {t("wallet.mainBalance")}
            </TText>
            <TText
              variant="display"
              weight="extraBold"
              color="white"
              style={{ marginTop: 4 }}
            >
              {Number(wallet?.balance || 0).toFixed(2)}{" "}
              <TText
                variant="title"
                weight="bold"
                color="rgba(255,255,255,0.8)"
              >
                {wallet?.currency || "EUR"}
              </TText>
            </TText>
            <View style={styles.walletRow}>
              <Ionicons
                name="wallet"
                size={14}
                color="rgba(255,255,255,0.75)"
              />
              <TText
                variant="label"
                color="rgba(255,255,255,0.75)"
                style={{ marginLeft: 4 }}
              >
                {t("wallet.multiCurrency")}
              </TText>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* ===== Carte blanche scrollable ===== */}
      <ScrollView
        style={[styles.card, { backgroundColor: colors.neutrals.background }]}
        contentContainerStyle={styles.cardInner}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={busy}
            onRefresh={load}
            tintColor={paybidColors.primary.base}
          />
        }
      >
        {/* 4 quick actions */}
        <View style={styles.quickRow}>
          {QUICK.map((q) => (
            <TouchableOpacity
              key={q.key}
              testID={`paybid-wallet-${q.key}`}
              onPress={() => q.route && router.push(q.route as any)}
              style={styles.quickBtn}
            >
              <View style={[styles.quickIcon, { backgroundColor: q.color }]}>
                <Ionicons name={q.icon} size={20} color="white" />
              </View>
              <TText
                variant="label"
                weight="semiBold"
                align="center"
                style={{ marginTop: 6 }}
              >
                {t(q.labelKey)}
              </TText>
            </TouchableOpacity>
          ))}
        </View>

        {/* Section title + refresh */}
        <View style={styles.secHead}>
          <TText
            variant="label"
            weight="bold"
            color={colors.neutrals.textSecondary}
            style={{ letterSpacing: 0.3, fontSize: 11 }}
          >
            {t("wallet.recentOps")}
          </TText>
          <TouchableOpacity onPress={load}>
            <Ionicons
              name="refresh"
              size={16}
              color={colors.neutrals.textSecondary}
            />
          </TouchableOpacity>
        </View>

        {/* Period filter chips */}
        <View style={styles.periodRow}>
          {[
            { k: "day", lk: "wallet.period.day" },
            { k: "week", lk: "wallet.period.week" },
            { k: "month", lk: "wallet.period.month" },
            { k: "quarter", lk: "wallet.period.quarter" },
          ].map((p) => (
            <TouchableOpacity
              key={p.k}
              testID={`paybid-wper-${p.k}`}
              onPress={() => {
                setPeriod(p.k as any);
                setShowAll(false);
              }}
              style={[
                styles.pChip,
                {
                  backgroundColor: colors.neutrals.surface,
                  borderColor: colors.neutrals.border,
                },
                period === p.k && {
                  backgroundColor: paybidColors.primary.base,
                  borderColor: paybidColors.primary.base,
                },
              ]}
            >
              <TText
                variant="label"
                weight="bold"
                color={period === p.k ? "white" : colors.neutrals.textPrimary}
              >
                {t(p.lk)}
              </TText>
            </TouchableOpacity>
          ))}
        </View>

        {/* Transactions list */}
        <View
          style={[
            styles.listBox,
            {
              backgroundColor: colors.neutrals.surface,
              borderColor: colors.neutrals.border,
            },
          ]}
        >
          {visible.length === 0 ? (
            <View style={{ padding: spacing.xl, alignItems: "center" }}>
              <Ionicons
                name="receipt-outline"
                size={28}
                color={colors.neutrals.textTertiary}
              />
              <TText
                variant="caption"
                color={colors.neutrals.textSecondary}
                style={{ marginTop: 6 }}
              >
                {t("wallet.noOpsPeriod")}
              </TText>
            </View>
          ) : (
            visible.map((tx: any, i: number) => {
              const amt = getAmount(tx);
              return (
                <TouchableOpacity
                  key={tx.id}
                  testID={`paybid-wtx-${i}`}
                  onPress={() =>
                    router.push({
                      pathname: "/wallet/op/[id]",
                      params: { id: tx.id },
                    })
                  }
                  style={[
                    styles.tx,
                    i < visible.length - 1 && {
                      borderBottomWidth: 1,
                      borderBottomColor: colors.neutrals.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.txIcon,
                      { backgroundColor: tint(tx.type) + "1A" },
                    ]}
                  >
                    <Ionicons
                      name={iconOf(tx.type)}
                      size={18}
                      color={tint(tx.type)}
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <TText variant="body" weight="semiBold">
                      {formatLabel(tx)}
                    </TText>
                    <TText
                      variant="label"
                      color={colors.neutrals.textTertiary}
                    >
                      {new Date(tx.created_at).toLocaleString("fr-FR")}
                    </TText>
                  </View>
                  <TText variant="body" weight="extraBold" color={tint(tx.type)}>
                    {amt > 0 ? "+" : ""}
                    {amt.toFixed(2)} {wallet?.currency || "EUR"}
                  </TText>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* See all / collapse */}
        {filtered.length > 10 ? (
          <TouchableOpacity
            testID="paybid-wallet-viewall"
            style={styles.seeAll}
            onPress={() => setShowAll((v) => !v)}
          >
            <TText
              variant="caption"
              weight="bold"
              color={paybidColors.primary.base}
            >
              {showAll
                ? t("wallet.reduce")
                : `${t("wallet.seeAll")} (${filtered.length})`}
            </TText>
            <Ionicons
              name={showAll ? "chevron-up" : "chevron-down"}
              size={16}
              color={paybidColors.primary.base}
            />
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      {/* ===== Wallet menu (top-right) ===== */}
      <Modal
        visible={showMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={styles.menuOverlay}
          onPress={() => setShowMenu(false)}
        >
          <View style={styles.menuCard}>
            <MenuRow
              icon="qr-code-outline"
              label="SBTag"
              onPress={() => {
                setShowMenu(false);
                router.push("/sbtag" as any);
              }}
            />
            <MenuRow
              icon="people-circle-outline"
              label="Mes contacts"
              onPress={() => {
                setShowMenu(false);
                router.push("/contacts" as any);
              }}
            />
            <MenuRow
              icon="speedometer-outline"
              label="Mes plafonds"
              onPress={() => {
                setShowMenu(false);
                router.push("/payment-caps" as any);
              }}
            />
            <MenuRow
              icon="receipt-outline"
              label={t("profile.documents")}
              onPress={() => {
                setShowMenu(false);
                router.push("/receipts" as any);
              }}
            />
            <MenuRow
              icon="help-circle-outline"
              label={t("profile.support")}
              onPress={() => {
                setShowMenu(false);
                router.push("/support" as any);
              }}
              last
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function MenuRow({
  icon,
  label,
  onPress,
  last,
}: {
  icon: any;
  label: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[walletMenuStyles.row, !last && walletMenuStyles.rowBorder]}
      activeOpacity={0.6}
    >
      <Ionicons name={icon} size={20} color={paybidColors.primary.base} />
      <TText
        variant="body"
        weight="semiBold"
        color="#0F172A"
        numberOfLines={1}
        style={{ flex: 1, marginLeft: 12, fontSize: 14 }}
      >
        {label}
      </TText>
      <Ionicons
        name="chevron-forward"
        size={16}
        color={paybidColors.neutrals.textTertiary}
      />
    </TouchableOpacity>
  );
}

const walletMenuStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,         // hauteur de ligne confortable
    paddingHorizontal: 16,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
});

const styles = StyleSheet.create({
  bg: { flex: 1 },
  hero: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl + 20 },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: spacing.sm,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  balanceBox: { marginTop: spacing.lg },
  walletRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  card: {
    flex: 1,
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    marginTop: -spacing.lg,
  },
  cardInner: { padding: spacing.lg, paddingBottom: 30 },
  quickRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 4,
  },
  quickBtn: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "transparent",
    paddingVertical: 8,
  },
  quickIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  secHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.lg,
    marginBottom: 8,
    marginHorizontal: 4,
  },
  periodRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  pChip: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: radii.full,
    borderWidth: 1,
    alignItems: "center",
  },
  seeAll: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    marginTop: 8,
    gap: 4,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "flex-end",
    paddingTop: 70,
    paddingRight: 14,
  },
  menuCard: {
    // v13 — Spec utilisateur : popup lisible, ordonné, contenu intégralement visible
    backgroundColor: "white",
    borderRadius: radii.xl,
    width: 260,                // largeur fixe suffisante pour les labels les plus longs
    overflow: "hidden",
    paddingVertical: 6,
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  listBox: { borderRadius: radii.xl, borderWidth: 1 },
  tx: { flexDirection: "row", alignItems: "center", padding: spacing.md },
  txIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
  },
});
