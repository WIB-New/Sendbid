import React, { useEffect, useState } from "react";
import { View, StyleSheet, TouchableOpacity, ScrollView, Linking, Platform, Share } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { TText } from "../../src/components/TText";
import { Button } from "../../src/components/Button";
import { SendBidLogo } from "../../src/components/Logo";
import { api } from "../../src/api";
import { colors, spacing, radii } from "../../src/theme";

/**
 * Official Receipt v4.0 — matches "29 Reçu de transfert":
 * - Dark hero "Reçu officiel" + SENDBID logo
 * - White paper-like card with receipt rows (Référence, Date, Statut)
 * - Sections: EXPÉDITEUR, BÉNÉFICIAIRE, FINANCIER (Montant, Taux, Frais, REÇU)
 * - Signed QR code
 * - Actions: "Partager" + "PDF"
 */
export default function OfficialReceipt() {
  const { transfer_id } = useLocalSearchParams<{ transfer_id: string }>();
  const router = useRouter();
  const [t, setT] = useState<any>(null);

  useEffect(() => {
    if (!transfer_id) return;
    api.get(`/transfers/${transfer_id}`).then((r) => setT(r.data));
  }, [transfer_id]);

  if (!t) return null;

  const status = t.status as string;
  const statusColor = status === "COMPLETED" ? "#10B981" : status === "FAILED" ? "#EF4444" : "#F59E0B";
  const statusLabel = status === "COMPLETED" ? "Terminé" : status === "FAILED" ? "Échec" : "En cours";

  const share = async () => {
    try {
      await Share.share({
        message: `Reçu SENDBID\nRef ${(t.reference || t.id).slice(-10).toUpperCase()}\n${Number(t.send_amount).toFixed(2)} ${t.source_currency} → ${Number(t.receive_amount).toFixed(0)} ${t.destination_currency}\nBénéficiaire : ${t.beneficiary?.full_name}\nStatut : ${statusLabel}`,
      });
    } catch {}
  };

  const downloadPDF = () => {
    const url = `${process.env.EXPO_PUBLIC_BACKEND_URL || ""}/api/transfers/${t.id}/receipt-pdf`;
    Linking.openURL(url);
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#0F1B40" }}>
      <LinearGradient colors={["#0F1B40", "#1B2A5B"]} style={styles.hero}>
        <SafeAreaView edges={["top"]}>
          <View style={styles.heroTop}>
            <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
              <Ionicons name="chevron-back" size={22} color="white" />
            </TouchableOpacity>
            <TText variant="body" weight="extraBold" color="white">Reçu officiel</TText>
            <TouchableOpacity onPress={share} style={styles.iconBtn}>
              <Ionicons name="share-social-outline" size={18} color="white" />
            </TouchableOpacity>
          </View>
          <View style={styles.heroBody}>
            <View style={styles.logoChip}><SendBidLogo size={36} /></View>
            <TText variant="subtitle" weight="extraBold" color="white" style={{ marginTop: 8, letterSpacing: 1 }}>
              SENDBID
            </TText>
            <TText variant="label" color="rgba(255,255,255,0.7)" style={{ marginTop: 2, fontStyle: "italic" }}>
              Transférez. Simplement.
            </TText>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView style={styles.sheet} contentContainerStyle={styles.sheetInner} showsVerticalScrollIndicator={false}>
        {/* Paper receipt */}
        <View style={styles.paper}>
          {/* Top notch jagged edges */}
          <NotchRow top />

          {/* Header block */}
          <View style={styles.paperHead}>
            <View>
              <TText variant="label" color={colors.neutrals.textTertiary} style={{ letterSpacing: 1 }}>RÉFÉRENCE</TText>
              <TText variant="body" weight="extraBold" style={styles.mono}>
                #{(t.reference || t.id).slice(-10).toUpperCase()}
              </TText>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <TText variant="label" color={colors.neutrals.textTertiary} style={{ letterSpacing: 1 }}>STATUT</TText>
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                <TText variant="caption" weight="extraBold" color={statusColor}>{statusLabel}</TText>
              </View>
            </View>
          </View>

          <Divider />

          <PaperRow label="Date d'émission" value={new Date(t.created_at).toLocaleString("fr-FR")} />
          {t.completed_at ? (
            <PaperRow label="Livré le" value={new Date(t.completed_at).toLocaleString("fr-FR")} />
          ) : null}
          <PaperRow label="Mode de remise" value={String(t.delivery_mode || "—").toUpperCase() + (t.vip_delivery ? " · VIP" : "")} />

          <Divider />

          {/* EXPÉDITEUR */}
          <SectionTitle label="EXPÉDITEUR" icon="person-outline" color="#3B82F6" />
          <PaperRow label="Nom" value={t.sender_snapshot?.full_name || "—"} />
          <PaperRow label="Pays" value={t.sender_snapshot?.country || "—"} />

          <Divider />

          {/* BÉNÉFICIAIRE */}
          <SectionTitle label="BÉNÉFICIAIRE" icon="people-outline" color="#10B981" />
          <PaperRow label="Nom" value={t.beneficiary?.full_name || "—"} />
          <PaperRow label="Pays" value={t.destination_country || "—"} />
          {t.beneficiary?.phone ? <PaperRow label="Téléphone" value={t.beneficiary.phone} /> : null}

          <Divider />

          {/* FINANCIER */}
          <SectionTitle label="FINANCIER" icon="cash-outline" color="#F59E0B" />
          <PaperRow label="Montant envoyé" value={`${Number(t.send_amount).toFixed(2)} ${t.source_currency || "EUR"}`} />
          <PaperRow label="Taux de change" value={Number(t.fx_rate || 0).toFixed(4)} />
          <PaperRow label="Frais" value={`${Number(t.fee_amount).toFixed(2)} ${t.source_currency || "EUR"}`} />
          <PaperRow label="Total débité" value={`${Number(t.total_amount).toFixed(2)} ${t.source_currency || "EUR"}`} bold />
          <View style={styles.receivedRow}>
            <TText variant="caption" weight="extraBold" color={colors.neutrals.textSecondary}>REÇU PAR LE BÉNÉFICIAIRE</TText>
            <TText variant="title" weight="extraBold" color="#10B981" style={{ marginTop: 4 }}>
              {Number(t.receive_amount).toFixed(0)} {t.destination_currency}
            </TText>
          </View>

          <Divider />

          {/* QR */}
          <View style={styles.qrWrap}>
            <View style={styles.qrBox}>
              {Platform.OS === "web" || !t.qr_token ? (
                <Ionicons name="qr-code" size={140} color={colors.neutrals.textPrimary} />
              ) : (
                <QRCode value={t.qr_token} size={140} backgroundColor="white" color={colors.neutrals.textPrimary} />
              )}
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <TText variant="label" weight="extraBold" color={colors.neutrals.textSecondary} style={{ letterSpacing: 1 }}>
                CODE DE VÉRIFICATION
              </TText>
              <TText variant="title" weight="extraBold" style={[styles.mono, { marginTop: 2, letterSpacing: 4 }]}>
                {t.withdrawal_code}
              </TText>
              <TText variant="label" color={colors.neutrals.textTertiary} style={{ marginTop: 4 }}>
                Signature HMAC-SHA256 · valide 48h
              </TText>
            </View>
          </View>

          {/* Footer legal */}
          <Divider />
          <TText variant="label" color={colors.neutrals.textTertiary} align="center" style={{ marginTop: 8 }}>
            Document généré électroniquement — aucune signature manuscrite requise.
          </TText>
          <TText variant="label" color={colors.neutrals.textTertiary} align="center">
            SENDBID SAS · RCS Paris · Licence PSP · support@sendbid.app
          </TText>

          <NotchRow />
        </View>

        {/* Actions */}
        <View style={{ flexDirection: "row", gap: 12, marginTop: spacing.lg }}>
          <Button
            testID="receipt-share"
            title="Partager"
            icon="share-social-outline"
            variant="outline"
            onPress={share}
            style={{ flex: 1 }}
          />
          <Button
            testID="receipt-pdf"
            title="PDF"
            icon="download-outline"
            onPress={downloadPDF}
            style={{ flex: 1, backgroundColor: "#10B981" }}
          />
        </View>
      </ScrollView>
    </View>
  );
}

function PaperRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.prow}>
      <TText variant="caption" color={colors.neutrals.textSecondary}>{label}</TText>
      <TText variant="caption" weight={bold ? "extraBold" : "semiBold"}>{value}</TText>
    </View>
  );
}

function SectionTitle({ label, icon, color }: { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }) {
  return (
    <View style={styles.secTitle}>
      <View style={[styles.secIcon, { backgroundColor: color + "22" }]}>
        <Ionicons name={icon} size={12} color={color} />
      </View>
      <TText variant="label" weight="extraBold" style={{ marginLeft: 6, letterSpacing: 1, color }}>
        {label}
      </TText>
    </View>
  );
}

function Divider() { return <View style={styles.divider} />; }

function NotchRow({ top }: { top?: boolean }) {
  return (
    <View style={[styles.notchRow, top ? { top: -10 } : { bottom: -10 }]}>
      {Array.from({ length: 16 }).map((_, i) => (
        <View key={i} style={styles.notch} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: spacing.sm },
  iconBtn: { width: 36, height: 36, borderRadius: radii.full, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" },
  heroBody: { alignItems: "center", marginTop: spacing.md },
  logoChip: { width: 56, height: 56, borderRadius: radii.lg, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" },
  sheet: { flex: 1, backgroundColor: colors.neutrals.background },
  sheetInner: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  paper: {
    backgroundColor: "white",
    borderRadius: 16,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    position: "relative",
    shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 24, shadowOffset: { width: 0, height: 12 },
    elevation: 4,
  },
  paperHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  divider: { height: 1, backgroundColor: colors.neutrals.border, marginVertical: spacing.md, borderStyle: "dashed", borderWidth: 0.5, borderColor: colors.neutrals.border },
  prow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 },
  secTitle: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  secIcon: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  receivedRow: { backgroundColor: "#E6F8F0", padding: spacing.md, borderRadius: radii.lg, alignItems: "center", marginTop: 8 },
  qrWrap: { flexDirection: "row", alignItems: "center" },
  qrBox: { width: 140, height: 140, backgroundColor: "white", padding: 6, borderWidth: 1, borderColor: colors.neutrals.border, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  mono: { fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }) },
  notchRow: { position: "absolute", left: 8, right: 8, flexDirection: "row", justifyContent: "space-between" },
  notch: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.neutrals.background },
});
