/**
 * Wallet Operation Detail — style Wise
 * - Header gradient avec icône flèche directionnelle + montant en grand
 * - Pill catégorie + nom expéditeur/destinataire
 * - 2 onglets : "Mises à jour" (timeline ✓) / "Informations" (détails + coordonnées bancaires)
 * - 3 actions : Répéter ce transfert / Notez l'appli / Partager avec le bénéficiaire
 * - Bouton Télécharger la confirmation de transfert (PDF via /api/transfers/{id}/receipt-pdf)
 */
import React, { useEffect, useMemo, useState } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, Platform, Share, Linking } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { TText } from "../../../src/components/TText";
import { api } from "../../../src/api";
import { useAuth } from "../../../src/store"; // (eslint: kept for parity)
import { colors, spacing, radii } from "../../../src/theme";
import { useThemedColors } from "../../../src/themeContext";
import * as SecureStore from "expo-secure-store";

const INCOMING_TYPES = ["recharge", "recharge_qr", "recharge_card", "recharge_momo", "recharge_paypal", "p2p_in", "transfer_release", "refund"];

function fmtDate(iso?: string) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) +
      " à " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
}

export default function WalletOperationDetail() {
  const themed = useThemedColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tx, setTx] = useState<any | null>(null);
  const [transfer, setTransfer] = useState<any | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<"updates" | "info">("updates");

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const { data } = await api.get("/wallet/transactions");
        const found = (data || []).find((t: any) => t.id === id);
        if (!found) { setErr("Opération introuvable"); return; }
        setTx(found);
        // Si la transaction est liée à un transfert, on charge ses détails (bénéficiaire, IBAN, etc.)
        if (found.transfer_id) {
          try { const r = await api.get(`/transfers/${found.transfer_id}`); setTransfer(r.data); } catch {}
        }
      } catch (e: any) {
        setErr(e?.response?.data?.detail || "Erreur de chargement");
      }
    })();
  }, [id]);

  const isIncoming = useMemo(() => tx ? INCOMING_TYPES.includes(tx.type) : false, [tx]);
  const amount = Number(tx?.amount || 0);
  const counterpart = transfer?.beneficiary?.full_name || tx?.counterpart_name || tx?.peer_name || (isIncoming ? "Recharge SENDBID" : "SENDBID");
  const txCategory = useMemo(() => {
    if (!tx) return "Général";
    if (tx.type.startsWith("recharge")) return "Argent ajouté";
    if (tx.type === "refund") return "Remboursement";
    if (tx.type === "fee") return "Frais";
    if (tx.type === "p2p_in") return "Reçu P2P";
    if (tx.type === "p2p_out") return "Envoi P2P";
    return "Général";
  }, [tx]);

  // Timeline mises à jour
  const timeline = useMemo(() => {
    if (!tx) return [];
    const events: Array<{ label: string; date?: string; done: boolean }> = [];
    if (transfer) {
      events.push({ label: "Vous avez créé ce transfert", date: transfer.created_at, done: true });
      events.push({ label: "Fonds bloqués sur escrow", date: transfer.escrowed_at || transfer.created_at, done: !!transfer.escrowed_at || !!transfer.created_at });
      events.push({ label: "Agent sélectionné", date: transfer.agent_assigned_at, done: !!transfer.agent_id });
      events.push({ label: "Transfert envoyé au bénéficiaire", date: transfer.delivered_at, done: transfer.status === "COMPLETED" });
      events.push({ label: "Transfert terminé", date: transfer.completed_at || transfer.delivered_at, done: transfer.status === "COMPLETED" });
    } else {
      events.push({ label: "Opération créée", date: tx.created_at, done: true });
      events.push({ label: "Opération validée", date: tx.created_at, done: tx.status === "COMPLETED" || tx.status === "SUCCESS" });
    }
    return events;
  }, [tx, transfer]);

  const downloadPdf = async () => {
    if (!transfer?.id) {
      // Si pas de transfert lié, on génère un récap texte
      return;
    }
    try {
      const token = await SecureStore.getItemAsync("sb_token");
      const url = `${process.env.EXPO_PUBLIC_BACKEND_URL || ""}/api/transfers/${transfer.id}/receipt-pdf?token=${token || ""}`;
      if (Platform.OS === "web") {
        if (typeof window !== "undefined") window.open(url, "_blank");
      } else {
        await Linking.openURL(url);
      }
    } catch {}
  };

  const repeatTransfer = () => {
    if (!transfer) return;
    // Redirige vers le parcours transfert avec le bénéficiaire pré-sélectionné
    router.push({ pathname: "/transfer/new" as any, params: { beneficiary_id: transfer.beneficiary?.id || "" } });
  };

  const rateApp = () => {
    const storeUrl = Platform.OS === "ios"
      ? "https://apps.apple.com/app/sendbid/id0000000000"
      : "https://play.google.com/store/apps/details?id=app.sendbid.sendfloo";
    if (Platform.OS === "web" && typeof window !== "undefined") window.open(storeUrl, "_blank");
    else Linking.openURL(storeUrl);
  };

  const shareWithBen = async () => {
    if (!tx) return;
    const txt = `Bonjour ${counterpart},\n\nJe viens de t'envoyer ${amount.toFixed(2)} EUR via SENDBID.\nRéférence : ${tx.id.slice(0, 8).toUpperCase()}\n\nL'argent sera disponible sous peu.`;
    try {
      if (Platform.OS === "web" && (navigator as any).share) {
        await (navigator as any).share({ title: "Transfert SENDBID", text: txt });
      } else if (Platform.OS !== "web") {
        await Share.share({ message: txt, title: "Transfert SENDBID" });
      } else if (typeof window !== "undefined") {
        (window as any).alert(txt);
      }
    } catch {}
  };

  if (err) {
    return (
      <View style={{ flex: 1, backgroundColor: themed.neutrals.background }}>
        <SafeAreaView edges={["top"]} style={{ padding: spacing.lg }}>
          <TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={24} color={themed.neutrals.textPrimary} /></TouchableOpacity>
          <TText style={{ marginTop: 12 }}>{err}</TText>
        </SafeAreaView>
      </View>
    );
  }
  if (!tx) return null;

  const heroColors: [string, string] = isIncoming
    ? ["#022a6b", "#3B82F6"]
    : ["#022a6b", "#052080"];

  return (
    <View style={{ flex: 1, backgroundColor: themed.neutrals.background }}>
      <LinearGradient colors={heroColors} style={styles.hero}>
        <SafeAreaView edges={["top"]}>
          <View style={styles.heroTop}>
            <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
              <Ionicons name="chevron-back" size={22} color="white" />
            </TouchableOpacity>
            <TText variant="body" weight="extraBold" color="white" style={{ flex: 1 }} align="center">
              {isIncoming ? "Détail de la réception" : "Détail de l'envoi"}
            </TText>
            <View style={{ width: 36 }} />
          </View>

          <View style={styles.heroBody}>
            <View style={styles.heroIcon}>
              <Ionicons name={isIncoming ? "arrow-down" : "arrow-up"} size={32} color="white" />
            </View>
            <TText variant="caption" color="rgba(255,255,255,0.85)" style={{ marginTop: 10 }}>
              {isIncoming ? "Argent reçu" : "Envoyés"}
            </TText>
            <TText variant="display" weight="extraBold" color={isIncoming ? "#10B981" : "white"} style={{ marginTop: 4 }}>
              {isIncoming ? "+ " : "− "}{Math.abs(amount).toFixed(2)} EUR
            </TText>
            <TText variant="caption" color="rgba(255,255,255,0.85)" style={{ marginTop: 2 }}>
              {isIncoming ? "Reçu de" : "Envoyé à"} {counterpart}
            </TText>
            <View style={styles.pill}>
              <Ionicons name={isIncoming ? "add-circle" : "apps"} size={12} color="white" />
              <TText variant="label" weight="bold" color="white" style={{ marginLeft: 4 }}>{txCategory}</TText>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView style={styles.card} contentContainerStyle={styles.cardInner}>
        {/* Tabs Mises à jour / Informations */}
        <View style={styles.tabsRow}>
          {(["updates", "info"] as const).map((t) => (
            <TouchableOpacity
              key={t}
              testID={`tab-${t}`}
              onPress={() => setTab(t)}
              style={[styles.tab, tab === t && styles.tabActive]}
            >
              <TText variant="caption" weight="extraBold" color={tab === t ? "#022a6b" : themed.neutrals.textSecondary}>
                {t === "updates" ? "Mises à jour" : "Informations"}
              </TText>
            </TouchableOpacity>
          ))}
        </View>

        {tab === "updates" ? (
          <View style={{ marginTop: spacing.md }}>
            {timeline.map((e, i) => (
              <View key={i} style={styles.timeRow}>
                <View style={{ alignItems: "center" }}>
                  <View style={[styles.timeDot, { backgroundColor: e.done ? "#10B981" : "#D1D5DB" }]}>
                    <Ionicons name={e.done ? "checkmark" : "ellipse-outline"} size={14} color="white" />
                  </View>
                  {i < timeline.length - 1 ? <View style={styles.timeBar} /> : null}
                </View>
                <View style={{ flex: 1, marginLeft: 12, paddingBottom: spacing.md }}>
                  <TText variant="body" weight={e.done ? "extraBold" : "semiBold"}>{e.label}</TText>
                  {e.date ? <TText variant="label" color={themed.neutrals.textSecondary}>{fmtDate(e.date)}</TText> : null}
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={{ marginTop: spacing.md }}>
            <KV label={isIncoming ? "Vous avez reçu" : "Vous avez envoyé"} value={`${amount.toFixed(2)} EUR`} bold />
            {transfer ? (
              <>
                <KV label="Frais SENDBID" value={`${Number(transfer.fee_amount || 0).toFixed(2)} EUR`} />
                <KV label={`${counterpart} a reçu`} value={`${Number(transfer.receive_amount || 0).toFixed(2)} ${transfer.destination_currency || ""}`} bold />
                <KV label="Référence" value={transfer.id.slice(0, 8).toUpperCase()} />
                <KV label="Date" value={fmtDate(transfer.created_at)} />

                <TText variant="caption" weight="extraBold" color={themed.neutrals.textSecondary} style={{ marginTop: spacing.lg, marginBottom: 6, letterSpacing: 0.4 }}>
                  COORDONNÉES DU BÉNÉFICIAIRE
                </TText>
                <KV label="Nom" value={transfer.beneficiary?.full_name || "—"} />
                {transfer.beneficiary?.iban ? <KV label="IBAN" value={transfer.beneficiary.iban} /> : null}
                {transfer.beneficiary?.bic ? <KV label="BIC / SWIFT" value={transfer.beneficiary.bic} /> : null}
                {transfer.beneficiary?.bank_name ? <KV label="Banque" value={transfer.beneficiary.bank_name} /> : null}
                {transfer.beneficiary?.email ? <KV label="Email" value={transfer.beneficiary.email} /> : null}
                {transfer.beneficiary?.phone ? <KV label="Téléphone" value={transfer.beneficiary.phone} /> : null}
              </>
            ) : (
              <>
                <KV label="Type" value={txCategory} />
                <KV label="Référence" value={tx.id.slice(0, 8).toUpperCase()} />
                <KV label="Date" value={fmtDate(tx.created_at)} />
                <KV label="Statut" value={tx.status || "—"} />
              </>
            )}
          </View>
        )}

        {/* 3 actions en cartes vertes */}
        <View style={{ marginTop: spacing.xl, gap: 8 }}>
          {transfer ? (
            <TouchableOpacity onPress={repeatTransfer} style={styles.actionRow}>
              <Ionicons name="refresh-circle" size={22} color="#059669" />
              <TText variant="body" weight="extraBold" color="#065F46" style={{ marginLeft: 10 }}>Répéter ce transfert</TText>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity onPress={rateApp} style={styles.actionRow}>
            <Ionicons name="star" size={22} color="#059669" />
            <TText variant="body" weight="extraBold" color="#065F46" style={{ marginLeft: 10 }}>Notez l&apos;appli</TText>
          </TouchableOpacity>
          <TouchableOpacity onPress={shareWithBen} style={styles.actionRow}>
            <Ionicons name="share-social" size={22} color="#059669" />
            <TText variant="body" weight="extraBold" color="#065F46" style={{ marginLeft: 10 }}>Partager avec le bénéficiaire</TText>
          </TouchableOpacity>
        </View>

        {/* Bouton PDF */}
        {transfer ? (
          <TouchableOpacity onPress={downloadPdf} style={styles.pdfBtn} testID="download-pdf">
            <Ionicons name="download-outline" size={18} color="#022a6b" />
            <TText variant="caption" weight="extraBold" color="#022a6b" style={{ marginLeft: 8 }}>
              Télécharger la confirmation de transfert
            </TText>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </View>
  );
}

function KV({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.kv}>
      <TText variant="caption" color={colors.neutrals.textSecondary} style={{ flex: 1 }}>{label}</TText>
      <TText variant="caption" weight={bold ? "extraBold" : "semiBold"} style={{ flex: 1, textAlign: "right" }} numberOfLines={2}>{value}</TText>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  heroTop: { flexDirection: "row", alignItems: "center", paddingTop: spacing.sm },
  iconBtn: { width: 36, height: 36, borderRadius: radii.full, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  heroBody: { alignItems: "center", marginTop: spacing.md },
  heroIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  pill: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.22)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.full, marginTop: 10 },

  card: { flex: 1, backgroundColor: colors.neutrals.background, borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl, marginTop: -spacing.lg },
  cardInner: { padding: spacing.lg, paddingBottom: spacing.xxxl },

  tabsRow: { flexDirection: "row", backgroundColor: "#F3F4F6", borderRadius: radii.full, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: radii.full, alignItems: "center" },
  tabActive: { backgroundColor: "white", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },

  timeRow: { flexDirection: "row", alignItems: "flex-start" },
  timeDot: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  timeBar: { width: 2, flex: 1, backgroundColor: "#D1D5DB", marginTop: 2 },

  kv: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#F3F4F6", gap: 12 },

  actionRow: { flexDirection: "row", alignItems: "center", padding: spacing.md, backgroundColor: "#D1FAE5", borderRadius: radii.xl, borderWidth: 1, borderColor: "#A7F3D0" },

  pdfBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", padding: spacing.md, marginTop: spacing.md, borderRadius: radii.full, borderWidth: 1.5, borderStyle: "dashed", borderColor: "#022a6b" + "55", backgroundColor: "white" },
});
