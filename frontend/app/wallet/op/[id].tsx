import React, { useEffect, useMemo, useState } from "react";
import { View, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../../../src/components/Screen";
import { TText } from "../../../src/components/TText";
import { api } from "../../../src/api";
import { colors, spacing, radii } from "../../../src/theme";

const TX_META: Record<string, { icon: any; color: string; label: string }> = {
  recharge: { icon: "arrow-down-circle", color: colors.status.success, label: "Recharge wallet" },
  recharge_qr: { icon: "qr-code", color: colors.status.success, label: "Recharge cash via agent" },
  recharge_card: { icon: "card", color: colors.status.success, label: "Recharge carte bancaire" },
  recharge_momo: { icon: "phone-portrait", color: colors.status.success, label: "Recharge Mobile Money" },
  recharge_paypal: { icon: "logo-paypal", color: colors.status.success, label: "Recharge PayPal" },
  p2p_in: { icon: "arrow-down-circle", color: colors.status.success, label: "Réception P2P" },
  p2p_out: { icon: "arrow-up-circle", color: colors.status.error, label: "Envoi P2P" },
  withdraw: { icon: "cash-outline", color: colors.status.pending, label: "Retrait cash" },
  withdraw_qr: { icon: "qr-code-outline", color: colors.status.pending, label: "Retrait cash agent" },
  transfer_escrow: { icon: "paper-plane", color: colors.primary.base, label: "Blocage transfert" },
  transfer_release: { icon: "checkmark-done", color: colors.status.success, label: "Libération transfert" },
  refund: { icon: "refresh-circle", color: colors.status.info, label: "Remboursement" },
  fee: { icon: "remove-circle", color: colors.status.error, label: "Frais SENDBID" },
};

export default function WalletOperationDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tx, setTx] = useState<any | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const { data } = await api.get("/wallet/transactions");
        const found = (data || []).find((t: any) => t.id === id);
        if (!found) setErr("Opération introuvable");
        else setTx(found);
      } catch (e: any) {
        setErr(e?.response?.data?.detail || "Erreur de chargement");
      }
    })();
  }, [id]);

  const meta = useMemo(() => (tx ? TX_META[tx.type] || TX_META.recharge : null), [tx]);

  if (err) {
    return (
      <Screen title="Détail opération" back hero>
        <View style={styles.empty}>
          <Ionicons name="alert-circle-outline" size={40} color={colors.status.error} />
          <TText color={colors.status.error} style={{ marginTop: 8 }}>{err}</TText>
        </View>
      </Screen>
    );
  }

  if (!tx || !meta) return null;

  const positive = tx.amount >= 0;
  const dateStr = new Date(tx.created_at).toLocaleString("fr-FR");

  return (
    <Screen title="Détail opération" back hero>
      <View style={styles.hero}>
        <View style={[styles.heroIcon, { backgroundColor: meta.color + "1A" }]}>
          <Ionicons name={meta.icon} size={36} color={meta.color} />
        </View>
        <TText variant="caption" color={colors.neutrals.textSecondary} style={{ marginTop: spacing.md }}>
          {meta.label}
        </TText>
        <TText variant="display" weight="extraBold" color={positive ? colors.status.success : colors.status.error} style={{ marginTop: 4 }}>
          {positive ? "+" : ""}
          {Number(tx.amount).toFixed(2)} {tx.currency}
        </TText>
        <TText variant="caption" color={colors.neutrals.textTertiary}>
          {dateStr}
        </TText>
      </View>

      <View style={styles.box}>
        <Row label="Type" value={meta.label} />
        <Row label="Méthode" value={(tx.method || "—").toString()} />
        <Row label="Référence" value={(tx.id || "—").toString().slice(0, 12).toUpperCase()} />
        {tx.counterparty ? <Row label="Contrepartie" value={tx.counterparty} /> : null}
        {tx.note ? <Row label="Note" value={tx.note} /> : null}
        <Row label="Statut" value={(tx.status || "completed").toString().toUpperCase()} />
        <Row label="Date" value={dateStr} />
      </View>

      {tx.transfer_id ? (
        <View style={styles.box}>
          <TText variant="caption" weight="semiBold" color={colors.neutrals.textSecondary} style={{ marginBottom: 6 }}>
            TRANSFERT ASSOCIÉ
          </TText>
          <Row label="ID transfert" value={tx.transfer_id.slice(0, 12).toUpperCase()} />
        </View>
      ) : null}
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <TText variant="caption" color={colors.neutrals.textSecondary}>
        {label}
      </TText>
      <TText variant="caption" weight="semiBold" style={{ flexShrink: 1, textAlign: "right" }}>
        {value}
      </TText>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: "center", padding: spacing.xl },
  hero: {
    alignItems: "center",
    padding: spacing.xl,
    backgroundColor: colors.neutrals.surface,
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.neutrals.border,
  },
  heroIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  box: {
    marginTop: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.neutrals.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.neutrals.border,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    gap: 12,
  },
});
