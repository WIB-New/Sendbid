import React, { useEffect, useState } from "react";
import { t, useLocale } from "../../src/i18n";
import { View, StyleSheet, TouchableOpacity, Share, Platform, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { SafeAreaView } from "react-native-safe-area-context";
import { TText } from "../../src/components/TText";
import { Button } from "../../src/components/Button";
import { StatusChip } from "../../src/components/StatusChip";
import { api } from "../../src/api";
import { colors, spacing, radii } from "../../src/theme";
import { useThemedColors } from "../../src/themeContext";
import { useTranslation } from "../../../src/i18n";
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
  const { t } = useTranslation();
  useLocale((st) => st.locale);
  const colors = useThemedColors();
  const { transfer_id } = useLocalSearchParams<{ transfer_id: string }>();
  const router = useRouter();
  const [t, setT] = useState<any>(null);

  useEffect(() => {
    if (!transfer_id) return;
    api.get(`/transfers/${transfer_id}`).then((r) => setT(r.data));
  }, [transfer_id]);

  // Compteur 48h pour les remises cash en agence — hooks doivent être appelés AVANT tout return conditionnel
  const createdMs = t ? new Date(t.created_at || Date.now()).getTime() : Date.now();
  const deadlineMs = createdMs + 48 * 3600 * 1000;
  const [remaining, setRemaining] = useState(deadlineMs - Date.now());
  useEffect(() => {
    if (!t || t.delivery_mode !== "cash") return;
    const i = setInterval(() => setRemaining(deadlineMs - Date.now()), 1000);
    return () => clearInterval(i);
  }, [deadlineMs, t?.delivery_mode]);

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
      // "Poursuivre mon transfert" → écran live des offres agents
      router.replace(`/transfer/live-offers?transfer_id=${t.id}`);
    } else {
      router.replace(`/transfer/${t.id}`);
    }
  };

  const fmtCountdown = (ms: number) => {
    if (ms <= 0) return "00h:00m:00s";
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${String(h).padStart(2, "0")}h:${String(m).padStart(2, "0")}m:${String(s).padStart(2, "0")}s`;
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#022a6b" }}>
      <LinearGradient colors={["#022a6b", "#022a6b"]} style={styles.hero}>
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
                <Ionicons name="flash" size={14} color="white" />
                <TText variant="label" weight="extraBold" color="white" style={{ marginLeft: 6, letterSpacing: 1 }}>
                  VIP EXPRESS
                </TText>
              </LinearGradient>
            ) : (t.service_level === "vip" || t.vip_delivery) ? (
              <LinearGradient colors={["#F59E0B", "#EA580C"]} style={styles.vipBadge} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Ionicons name="rocket" size={14} color="white" />
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
          <Row label="Montant envoyé" value={`${Number(t.send_amount).toFixed(2)} ${t.source_currency || "EUR"}`} />
          <Row
            label="Bénéficiaire"
            value={t.beneficiary?.full_name || "—"}
            sub={t.destination_country}
          />
          {!t.vip_delivery && t.delivery_mode === "cash" ? (
            <Row
              label="Fonds disponibles"
              value={`Dans 48h · ${fmtCountdown(remaining)}`}
              tint="#F59E0B"
            />
          ) : null}
          <Row label="Statut" value="Confirmé" tint="#10B981" last statusBadge={"confirmed" as any} />
        </View>

        {/* Withdrawal code standout */}
        <View style={styles.codeCard}>
          <View style={styles.codeHeader}>
            <Ionicons name="key" size={16} color="#10B981" />
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

        {/* CTAs — v13 : sur UNE MÊME LIGNE (spec utilisateur) */}
        <View style={{ flexDirection: "row", gap: 8, marginTop: spacing.xl }}>
          <TouchableOpacity
            testID="success-track"
            onPress={goTrack}
            style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: colors.primary.base, paddingVertical: 12, paddingHorizontal: 6, borderRadius: radii.lg, gap: 5 }}
            activeOpacity={0.85}
          >
            <Ionicons name={t.delivery_mode === "cash" ? "arrow-forward" : "eye-outline"} size={15} color="white" />
            <TText variant="label" weight="extraBold" color="white" numberOfLines={1} style={{ fontSize: 12, flexShrink: 1 }}>
              {t.delivery_mode === "cash" ? "Poursuivre" : "Suivre transfert"}
            </TText>
          </TouchableOpacity>
          <TouchableOpacity
            testID="success-new"
            onPress={() => router.replace("/transfer/new")}
            style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.primary.base, paddingVertical: 12, paddingHorizontal: 6, borderRadius: radii.lg, gap: 5 }}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={15} color={colors.primary.base} />
            <TText variant="label" weight="extraBold" color={colors.primary.base} numberOfLines={1} style={{ fontSize: 12, flexShrink: 1 }}>
              Nouveau transfert
            </TText>
          </TouchableOpacity>
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
          <Ionicons name="chatbubble-ellipses" size={26} color="white" />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

function Row({ label, value, sub, tint, last, mono, statusBadge }: { label: string; value: string; sub?: string; tint?: string; last?: boolean; mono?: boolean; statusBadge?: string }) {
  return (
    <View style={[styles.row, !last && styles.rowSep]}>
      <TText variant="caption" color={colors.neutrals.textSecondary}>{label}</TText>
      <View style={{ alignItems: "flex-end", maxWidth: "60%" }}>
        {statusBadge ? (
          <StatusChip status={statusBadge} />
        ) : (
          <TText variant="caption" weight="extraBold" align="right" style={mono ? styles.mono : undefined} color={tint}>
            {value}
          </TText>
        )}
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
