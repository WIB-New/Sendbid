import React, { useEffect, useState } from "react";
import { View, StyleSheet, TouchableOpacity, Share, Platform, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { SafeAreaView } from "react-native-safe-area-context";
import { TText } from "../../src/components/TText";
import { Button } from "../../src/components/Button";
import { api } from "../../src/api";
import { colors, spacing, radii } from "../../src/theme";

/**
 * Transfer Success v4.0 — matches the "22 Transfer Success" wireframe:
 * - Dark navy hero + big green checkmark
 * - Optional "TRAITEMENT VIP" gradient badge
 * - Transaction details table (# Transaction, Montant, Bénéficiaire, Fonds disponibles, Statut)
 * - Highlighted "CODE DE RETRAIT UNIQUE" card with copy/share + instruction
 * - Signed QR (HMAC-SHA256) area
 * - Two CTAs: "Suivre mon transfert" (navy) + "Nouveau transfert" (teal)
 */
export default function TransferSuccess() {
  const { transfer_id } = useLocalSearchParams<{ transfer_id: string }>();
  const router = useRouter();
  const [t, setT] = useState<any>(null);

  useEffect(() => {
    if (!transfer_id) return;
    api.get(`/transfers/${transfer_id}`).then((r) => setT(r.data));
  }, [transfer_id]);

  if (!t) return null;

  const copyCode = async () => {
    try {
      await Clipboard.setStringAsync(t.withdrawal_code || "");
      if (Platform.OS === "web") (window as any).alert?.("Code copié dans le presse-papiers");
    } catch {
      // Fallback web : navigator.clipboard
      if (Platform.OS === "web" && (navigator as any)?.clipboard) {
        try { await (navigator as any).clipboard.writeText(t.withdrawal_code || ""); (window as any).alert?.("Code copié"); } catch {}
      }
    }
  };
  const share = async () => {
    const msg = `Transfert SENDBID\nCode retrait : ${t.withdrawal_code}\nMontant : ${Number(t.receive_amount).toFixed(2)} ${t.destination_currency || "EUR"}`;
    try {
      if (Platform.OS === "web" && (navigator as any)?.share) {
        await (navigator as any).share({ title: "Transfert SENDBID", text: msg });
        return;
      }
      await Share.share({ message: msg });
    } catch {
      if (Platform.OS === "web") (window as any).alert?.(msg);
    }
  };

  const goTrack = () => {
    if (t.delivery_mode === "cash") {
      router.replace(`/transfer/auction?transfer_id=${t.id}`);
    } else {
      router.replace(`/transfer/${t.id}`);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#0F1B40" }}>
      <LinearGradient colors={["#0F1B40", "#1B2A5B"]} style={styles.hero}>
        <SafeAreaView edges={["top"]}>
          <View style={styles.heroTop}>
            <TouchableOpacity onPress={() => router.replace("/(tabs)")}>
              <Ionicons name="close" size={22} color="white" />
            </TouchableOpacity>
            <TText variant="body" weight="extraBold" color="white">Confirmation</TText>
            <View style={{ width: 22 }} />
          </View>
          <View style={styles.heroBody}>
            <LinearGradient colors={["#10B981", "#059669"]} style={styles.checkCircle}>
              <Ionicons name="checkmark" size={52} color="white" />
            </LinearGradient>
            <TText variant="title" weight="extraBold" color="white" align="center" style={{ marginTop: spacing.md }}>
              Envoi confirmé !
            </TText>
            <TText variant="caption" color="rgba(255,255,255,0.85)" align="center" style={{ marginTop: 4 }}>
              Votre transfert va être pris en charge par un de nos agents
            </TText>
            {t.service_level === "vip_express" || t.vip_express ? (
              <LinearGradient colors={["#EF4444", "#DC2626"]} style={styles.vipBadge} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Ionicons name="flash-outline" size={14} color="white" />
                <TText variant="label" weight="extraBold" color="white" style={{ marginLeft: 6, letterSpacing: 1 }}>
                  VIP EXPRESS
                </TText>
              </LinearGradient>
            ) : (t.service_level === "vip" || t.vip_delivery) ? (
              <LinearGradient colors={["#F59E0B", "#EA580C"]} style={styles.vipBadge} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Ionicons name="rocket-outline" size={14} color="white" />
                <TText variant="label" weight="extraBold" color="white" style={{ marginLeft: 6, letterSpacing: 1 }}>
                  VIP
                </TText>
              </LinearGradient>
            ) : null}
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView style={styles.card} contentContainerStyle={styles.cardInner} showsVerticalScrollIndicator={false}>
        {/* Transaction details */}
        <View style={styles.detailsBox}>
          <Row label="# Transaction" value={`#${(t.reference || t.id).slice(-10).toUpperCase()}`} mono />
          <Row label="Montant envoyé" value={`${Number(t.send_amount).toFixed(2)} ${t.sender_currency || t.source_currency || "EUR"}`} />
          <Row label={`Frais (${t.fee_percent ?? 0}%)`} value={`${Number(t.fee_amount ?? 0).toFixed(2)} ${t.sender_currency || t.source_currency || "EUR"}`} />
          <Row label="Le bénéficiaire reçoit" value={`${Number(t.receive_amount).toFixed(0)} ${t.destination_currency || "—"}`} tint={colors.primary.base} />
          <Row
            label="Bénéficiaire"
            value={t.beneficiary?.full_name || "—"}
            sub={`${t.destination_country || ""}${t.beneficiary?.city ? " · " + t.beneficiary.city : ""}`}
          />
          <Row
            label="Mode de remise"
            value={t.delivery_mode === "cash" ? "💵 Espèces" : t.delivery_mode === "bank" ? "🏦 Virement" : "📱 Mobile Money"}
          />
          {!t.vip_delivery ? (
            <Row label="Disponibilité" value="Dans 48h (Classique)" tint="#F59E0B" />
          ) : null}
          <Row label="Statut" value={t.status} tint="#10B981" last />
        </View>

        {/* Withdrawal code standout */}
        <View style={styles.codeCard}>
          <View style={styles.codeHeader}>
            <Ionicons name="key-outline" size={16} color="#10B981" />
            <TText variant="label" weight="extraBold" style={{ marginLeft: 6, letterSpacing: 1, color: "#065F46" }}>
              CODE DE RETRAIT UNIQUE
            </TText>
          </View>
          <TText variant="display" weight="extraBold" align="center" style={styles.codeValue}>
            {t.withdrawal_code}
          </TText>
          <TText variant="caption" color={colors.neutrals.textSecondary} align="center">
            À transmettre à <TText variant="caption" weight="bold">{t.beneficiary?.full_name || "votre bénéficiaire"}</TText>
          </TText>
          <TText variant="label" color={colors.neutrals.textTertiary} align="center" style={{ marginTop: 4 }}>
            Valide 48h · à usage unique
          </TText>

          <View style={styles.codeActionsRow}>
            <TouchableOpacity testID="copy-code" style={styles.smallBtn} onPress={copyCode}>
              <Ionicons name="copy-outline" size={18} color="#065F46" />
              <TText variant="caption" weight="semiBold" style={{ marginLeft: 6, color: "#065F46" }}>Copier</TText>
            </TouchableOpacity>
            <TouchableOpacity testID="share-code" style={styles.smallBtn} onPress={share}>
              <Ionicons name="share-social-outline" size={18} color="#065F46" />
              <TText variant="caption" weight="semiBold" style={{ marginLeft: 6, color: "#065F46" }}>Partager</TText>
            </TouchableOpacity>
          </View>
        </View>

        {/* CTAs */}
        <View style={{ gap: 12, marginTop: spacing.xl }}>
          <Button testID="success-track" title="Suivre mon transfert" icon="eye-outline" onPress={goTrack} />
          <Button testID="success-new" title="+ Nouveau transfert" icon="add" variant="outline" onPress={() => router.replace("/transfer/new")} />
        </View>
      </ScrollView>

      {/* FAB chat flottant — préremplit message avec code de retrait */}
      <TouchableOpacity
        testID="success-chat-fab"
        style={styles.chatFab}
        onPress={async () => {
          const phone = (t.beneficiary?.phone || "").replace(/\D/g, "");
          const msg = `Bonjour ${t.beneficiary?.full_name || ""}, voici votre code de retrait SENDBID : ${t.withdrawal_code}. Valide 48h. Référence : #${(t.reference || t.id).slice(-8).toUpperCase()}`;
          if (Platform.OS !== "web" && phone) {
            const wa = `whatsapp://send?phone=${phone}&text=${encodeURIComponent(msg)}`;
            try { const { Linking } = require("react-native"); await Linking.openURL(wa); return; } catch {}
          }
          try { await Share.share({ message: msg }); } catch {}
        }}
      >
        <LinearGradient colors={["#10B981", "#059669"]} style={styles.chatFabInner}>
          <Ionicons name="chatbubble-ellipses-outline" size={26} color="white" />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

function Row({ label, value, sub, tint, last, mono }: { label: string; value: string; sub?: string; tint?: string; last?: boolean; mono?: boolean }) {
  return (
    <View style={[styles.row, !last && styles.rowSep]}>
      <TText variant="caption" color={colors.neutrals.textSecondary}>{label}</TText>
      <View style={{ alignItems: "flex-end", maxWidth: "60%" }}>
        <TText variant="caption" weight="extraBold" align="right" style={mono ? styles.mono : undefined} color={tint}>
          {value}
        </TText>
        {sub ? (<TText variant="label" color={colors.neutrals.textTertiary}>{sub}</TText>) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: spacing.sm },
  heroBody: { alignItems: "center", marginTop: spacing.lg },
  checkCircle: {
    width: 100, height: 100, borderRadius: 50,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#10B981", shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  vipBadge: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: radii.full, marginTop: 12,
  },
  card: {
    flex: 1, backgroundColor: colors.neutrals.background,
    borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl,
    marginTop: -spacing.lg,
  },
  cardInner: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  detailsBox: {
    backgroundColor: colors.neutrals.surface,
    borderRadius: radii.xl,
    borderWidth: 1, borderColor: colors.neutrals.border,
    paddingHorizontal: spacing.md,
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12 },
  rowSep: { borderBottomWidth: 1, borderBottomColor: colors.neutrals.border },
  mono: { fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }) },
  codeCard: {
    marginTop: spacing.lg,
    backgroundColor: "#E6F8F0",
    borderWidth: 1.5, borderColor: "#10B981",
    borderRadius: radii.xl,
    padding: spacing.lg,
    alignItems: "center",
  },
  codeHeader: { flexDirection: "row", alignItems: "center" },
  codeValue: {
    letterSpacing: 6, marginVertical: 8, color: "#065F46",
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
  },
  codeActionsRow: { flexDirection: "row", gap: 12, marginTop: 14 },
  smallBtn: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: "white", borderRadius: radii.full,
    borderWidth: 1, borderColor: "#10B981",
  },
  qrBox: {
    marginTop: spacing.lg,
    backgroundColor: colors.neutrals.surface,
    borderWidth: 1, borderColor: colors.neutrals.border,
    borderRadius: radii.xl,
    padding: spacing.lg,
    alignItems: "center",
  },
  qrWebFallback: { width: 180, height: 180, backgroundColor: "white", padding: 8, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.neutrals.border, borderRadius: radii.md },
  infoBox: {
    flexDirection: "row", alignItems: "flex-start",
    marginTop: spacing.lg,
    backgroundColor: colors.overlays.primarySoft,
    borderRadius: radii.lg, padding: spacing.md,
    borderWidth: 1, borderColor: colors.primary.base + "33",
  },
  chatFab: { position: "absolute", right: 20, bottom: 24, width: 60, height: 60, borderRadius: 30, elevation: 6 },
  chatFabInner: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center" },
});
