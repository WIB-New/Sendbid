import React, { useEffect, useMemo, useState } from "react";
import { t, useLocale } from "../../src/i18n";
import { View, StyleSheet, TouchableOpacity, Linking, Platform, ScrollView, Share, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { SafeAreaView } from "react-native-safe-area-context";
import { TText } from "../../src/components/TText";
import { Button } from "../../src/components/Button";
import { VerticalProgress, type ProgressStep } from "../../src/components/VerticalProgress";
import { api } from "../../src/api";
import { useAuth } from "../../src/store";
import { colors, spacing, radii } from "../../src/theme";
import { useThemedColors } from "../../src/themeContext";
/**
 * Détail Transfert v6.4 — Timelines conditionnelles selon delivery_mode
 *  - CASH (Espèces) : 1) Créé 2) Fonds débités 3) Confié à un agent 4) Fonds disponibles (48h) 5) Bénéficiaire notifié 6) Terminé
 *  - BANK (Virement) : 1) Créé 2) Fonds débités 3) Virement bancaire en cours 4) Argent remis à la banque
 *  - MOMO (Mobile) : 1) Créé 2) Fonds débités 3) Portefeuille mobile en cours 4) Argent déposé sur le portefeuille mobile
 *  - Logique VIP : 2 tentatives/j pendant 2 j → fallback agence (notif Email + chat)
 *  - 48h pickup : compteur + extension à H-12 (1 ou 7j avec frais), auto-extension à H+0
 */

type Mode = "cash" | "bank" | "momo";

const ORDER_FULL = ["DRAFT", "PENDING_PAYMENT", "BIDDING", "AGENT_ASSIGNED", "NOTIFIED", "PROCESSING", "COMPLETED"];

function s(idx: number, cur: number, status: string): ProgressStep["state"] {
  if (["FAILED", "EXPIRED", "CANCELLED_USER"].includes(status)) return idx <= cur ? "failed" : "pending";
  if (idx < cur) return "completed";
  if (idx === cur) return "active";
  return "pending";
}

function fmt(iso?: string) {
  return iso ? new Date(iso).toLocaleString("fr-FR") : undefined;
}

// Cas 1 — Espèces standard (6 étapes)
function buildCashStandard(tx: any, deadlineCountdown?: string): ProgressStep[] {
  const status = tx.status as string;
  let cur = 0;
  if (status === "PENDING_PAYMENT") cur = 1;
  else if (["BIDDING", "AGENT_ASSIGNED"].includes(status)) cur = 2;
  else if (status === "PROCESSING") cur = 3;
  else if (status === "NOTIFIED") cur = 4;
  else if (status === "COMPLETED") cur = 5;
  else if (["FAILED", "EXPIRED", "CANCELLED_USER"].includes(status)) cur = -1;

  const ref = (tx.reference || tx.id || "").slice(-8).toUpperCase();
  const agentId = tx.agent_snapshot?.profile_id || "—";
  const agentLoc = `${tx.agent_snapshot?.city || "—"}${tx.agent_snapshot?.country ? ", " + tx.agent_snapshot.country : ""}`;
  const benName = tx.beneficiary?.full_name || "—";
  const fundsDesc = deadlineCountdown ? `Prêts pour le retrait auprès de l'agent (${deadlineCountdown})` : "Prêts pour le retrait auprès de l'agent";

  return [
    { key: "init", label: "Transfert créé", description: `Référence ${ref}`, state: s(0, cur, status), timestamp: fmt(tx.created_at) },
    { key: "pay", label: "Fonds reçus", description: "Le montant a été débité de votre compte", state: s(1, cur, status), timestamp: fmt(tx.paid_at) },
    { key: "agent", label: "Transfert confié à un agent", description: cur >= 2 ? `${agentId}\n${agentLoc} a accepté le transfert` : "En attente de la sélection d'un agent", state: s(2, cur, status), timestamp: fmt(tx.assigned_at) },
    { key: "funds", label: "Fonds disponibles", description: fundsDesc, state: s(3, cur, status), timestamp: fmt(tx.assigned_at) },
    { key: "done", label: "Transfert terminé", description: cur >= 5 ? `Argent récupéré par ${benName}` : "—", state: s(5, cur, status), timestamp: fmt(tx.completed_at) },
  ];
}

// Cas 2 — Espèces VIP / VIP EXPRESS (5 étapes — agent en chemin)
function buildCashVip(tx: any): ProgressStep[] {
  const status = tx.status as string;
  let cur = 0;
  if (status === "PENDING_PAYMENT") cur = 1;
  else if (["BIDDING", "AGENT_ASSIGNED"].includes(status)) cur = 2;
  else if (status === "NOTIFIED") cur = 3;
  else if (status === "PROCESSING") cur = 4;
  else if (status === "COMPLETED") cur = 5;
  else if (["FAILED", "EXPIRED", "CANCELLED_USER"].includes(status)) cur = -1;

  const ref = (tx.reference || tx.id || "").slice(-8).toUpperCase();
  const agentId = tx.agent_snapshot?.profile_id || "—";
  const agentLoc = `${tx.agent_snapshot?.city || "—"}${tx.agent_snapshot?.country ? ", " + tx.agent_snapshot.country : ""}`;
  const benName = tx.beneficiary?.full_name || "—";

  return [
    { key: "init", label: "Transfert créé", description: `Référence ${ref}`, state: s(0, cur, status), timestamp: fmt(tx.created_at) },
    { key: "pay", label: "Fonds reçus", description: "Le montant a été débité de votre compte", state: s(1, cur, status), timestamp: fmt(tx.paid_at) },
    { key: "agent", label: "Transfert confié à un agent", description: cur >= 2 ? `${agentId}\n${agentLoc} a accepté le transfert` : "En attente de la sélection d'un agent", state: s(2, cur, status), timestamp: fmt(tx.assigned_at) },
    { key: "delivery", label: "Fonds en cours de remise", description: cur >= 4 ? `${agentId} est en chemin vers ${benName}` : "L'agent se prépare", state: s(4, cur, status), timestamp: fmt(tx.processing_at) },
    { key: "done", label: "Transfert terminé", description: cur >= 5 ? `Argent récupéré par ${benName}` : "—", state: s(5, cur, status), timestamp: fmt(tx.completed_at) },
  ];
}

// Cas 3 — Virement bancaire (3 étapes)
function buildBank(tx: any): ProgressStep[] {
  const status = tx.status as string;
  let cur = 0;
  if (status === "PENDING_PAYMENT") cur = 1;
  else if (["BIDDING", "AGENT_ASSIGNED", "NOTIFIED", "PROCESSING", "COMPLETED"].includes(status)) cur = 2;
  else if (["FAILED", "EXPIRED", "CANCELLED_USER"].includes(status)) cur = -1;

  const ref = (tx.reference || tx.id || "").slice(-8).toUpperCase();
  // (sentDate retiré v2 — date n'est plus affichée sous le statut bancaire, cf. Lot 2.3)
  return [
    { key: "init", label: "Transfert créé", description: `Référence ${ref}`, state: s(0, cur, status), timestamp: fmt(tx.created_at) },
    { key: "pay", label: "Fonds reçus", description: "Le montant a été débité de votre compte", state: s(1, cur, status), timestamp: fmt(tx.paid_at) },
    { key: "sent", label: "Envoyé à la banque du bénéficiaire", description: "Un délai supplémentaire peut être nécessaire pour créditer le compte du bénéficiaire.", state: s(2, cur, status), timestamp: fmt(tx.completed_at || tx.processing_at || tx.assigned_at) },
  ];
}

// Cas 4 — Portefeuille mobile (3 étapes)
function buildMomo(tx: any): ProgressStep[] {
  const status = tx.status as string;
  let cur = 0;
  if (status === "PENDING_PAYMENT") cur = 1;
  else if (["BIDDING", "AGENT_ASSIGNED", "NOTIFIED", "PROCESSING", "COMPLETED"].includes(status)) cur = 2;
  else if (["FAILED", "EXPIRED", "CANCELLED_USER"].includes(status)) cur = -1;

  const ref = (tx.reference || tx.id || "").slice(-8).toUpperCase();
  const sentDate = tx.processing_at || tx.assigned_at || tx.completed_at;
  return [
    { key: "init", label: "Transfert créé", description: `Référence ${ref}`, state: s(0, cur, status), timestamp: fmt(tx.created_at) },
    { key: "pay", label: "Fonds reçus", description: "Le montant a été débité de votre compte", state: s(1, cur, status), timestamp: fmt(tx.paid_at) },
    { key: "sent", label: "Envoyé sur le téléphone du bénéficiaire", description: `${fmt(sentDate) || "—"}\nUn délai supplémentaire peut être nécessaire pour créditer le compte du bénéficiaire.`, state: s(2, cur, status), timestamp: fmt(sentDate) },
  ];
}

function statusHero(s: string) {
  switch (s) {
    case "COMPLETED": return { color: "#10B981", dark: "#065F46", label: "TERMINÉ", icon: "checkmark-circle" as const };
    case "FAILED": return { color: "#EF4444", dark: "#991B1B", label: "ÉCHEC", icon: "close-circle" as const };
    case "EXPIRED": return { color: "#F59E0B", dark: "#92400E", label: "EXPIRÉ", icon: "hourglass" as const };
    case "CANCELLED_USER": return { color: "#6B7280", dark: "#374151", label: "ANNULÉ", icon: "ban" as const };
    case "BIDDING": return { color: "#3B82F6", dark: "#1E40AF", label: "ENCHÈRE", icon: "trending-up" as const };
    case "AGENT_ASSIGNED":
    case "PROCESSING": return { color: "#8B5CF6", dark: "#5B21B6", label: "EN COURS", icon: "sync" as const };
    default: return { color: "#F59E0B", dark: "#92400E", label: "EN ATTENTE", icon: "time" as const };
  }
}

// Format remaining time as Hh Mm or Jj Hh
function formatRemaining(ms: number): string {
  if (ms <= 0) return "0h 0m";
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}j ${hours}h`;
  return `${hours}h ${minutes}m`;
}

export default function TransferDetail() {
  useLocale((st) => st.locale);
  const colors = useThemedColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const token = useAuth((s) => s.token);
  const [tx, setTx] = useState<any>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [now, setNow] = useState<number>(Date.now());

  const load = () => {
    if (!id) {
      setLoadErr("Identifiant de transfert manquant.");
      return;
    }
    api
      .get(`/transfers/${id}`)
      .then((r) => {
        setTx(r.data);
        setLoadErr(null);
      })
      .catch((e) => {
        const status = e?.response?.status;
        const detail = e?.response?.data?.detail;
        setLoadErr(
          status === 404
            ? "Transfert introuvable."
            : status === 401
            ? "Vous n'êtes pas autorisé à voir ce transfert."
            : detail || "Impossible de charger le transfert. Réessayez.",
        );
      });
  };
  useEffect(load, [id]);

  // Tick every minute for countdown
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(i);
  }, []);

  const mode: Mode = useMemo(() => {
    const m = String(tx?.delivery_mode || "cash").toLowerCase();
    return (m === "bank" || m === "momo" ? m : "cash") as Mode;
  }, [tx?.delivery_mode]);

  // 48h pickup deadline (cash only)
  const deadlineMs = useMemo(() => {
    if (!tx || mode !== "cash") return null;
    if (!tx.assigned_at) return null;
    const base = new Date(tx.assigned_at).getTime();
    const extensionDays = Number(tx.pickup_extension_days || 0);
    const baseHours = 48;
    return base + (baseHours + extensionDays * 24) * 3600 * 1000;
  }, [tx, mode]);
  const remainingMs = deadlineMs ? deadlineMs - now : 0;
  const isUrgent = remainingMs > 0 && remainingMs <= 12 * 3600 * 1000; // < 12h
  const countdownLabel = deadlineMs && tx?.status !== "COMPLETED" ? formatRemaining(Math.max(0, remainingMs)) : undefined;

  if (!tx) {
    // v6.5 — affichage explicite de l'erreur de chargement (au lieu d'un écran blanc)
    if (loadErr) {
      return (
        <View style={{ flex: 1, backgroundColor: colors.neutrals.background }}>
          <SafeAreaView edges={["top"]} style={{ padding: spacing.lg }}>
            <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: spacing.md }}>
              <Ionicons name="chevron-back" size={26} color={colors.neutrals.textPrimary} />
            </TouchableOpacity>
            <View style={{ alignItems: "center", marginTop: spacing.xxl }}>
              <Ionicons name="warning-outline" size={56} color="#F59E0B" />
              <TText variant="title" weight="extraBold" align="center" style={{ marginTop: spacing.md }}>
                Impossible d&apos;afficher le détail
              </TText>
              <TText
                variant="caption"
                color={colors.neutrals.textSecondary}
                align="center"
                style={{ marginTop: 8, maxWidth: 320 }}
              >
                {loadErr}
              </TText>
              <Button
                testID="detail-retry"
                title="Réessayer"
                icon="refresh"
                onPress={load}
                style={{ marginTop: spacing.lg, minWidth: 200 }}
              />
              <TouchableOpacity onPress={() => router.back()} style={{ marginTop: spacing.md }}>
                <TText variant="caption" weight="bold" color={colors.primary.base}>
                  ← Retour aux transferts
                </TText>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      );
    }
    return null;
  }

  const hero = statusHero(tx.status);
  const downloadReceipt = () => {
    const base = process.env.EXPO_PUBLIC_BACKEND_URL || "";
    const url = `${base}/api/transfers/${id}/receipt-pdf${token ? `?token=${encodeURIComponent(token)}` : ""}`;
    Linking.openURL(url).catch(() => {
      Alert.alert("Téléchargement", "Impossible d'ouvrir le PDF. Le reçu sera bientôt disponible.");
    });
  };
  const shareTransfer = async () => {
    try {
      await Share.share({ message: `SENDBID Transfert ${tx.reference || tx.id}\n${tx.receive_amount} ${tx.destination_currency} à ${tx.beneficiary?.full_name}\nStatut : ${hero.label}` });
    } catch {}
  };
  const extendPickup = (days: number) => {
    Alert.alert(
      "Prolonger le retrait",
      `Prolonger le délai de ${days} jour${days > 1 ? "s" : ""} (frais : ${days === 1 ? "1 €" : "3 €"} déduits du paiement bénéficiaire) ?`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Confirmer", onPress: async () => {
            try {
              await api.post(`/transfers/${id}/extend-pickup`, { days });
              load();
            } catch (e: any) {
              Alert.alert("Erreur", e?.response?.data?.detail || "Prolongation impossible. Réessayez plus tard.");
            }
          }
        },
      ],
    );
  };

  // Sélection de la timeline selon le mode de remise et le niveau de service
  const isVip = !!tx.vip_delivery || !!tx.vip_express || (tx.service_level && tx.service_level !== "standard");
  let steps: ProgressStep[];
  if (mode === "bank") steps = buildBank(tx);
  else if (mode === "momo") steps = buildMomo(tx);
  else if (isVip) steps = buildCashVip(tx);
  else steps = buildCashStandard(tx, countdownLabel);
  const activeIdx = steps.findIndex((s) => s.state === "active");

  return (
    <View style={{ flex: 1, backgroundColor: "#022a6b" }}>
      <LinearGradient colors={[hero.dark, "#022a6b"]} style={styles.hero}>
        <SafeAreaView edges={["top"]}>
          <View style={styles.heroTop}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={22} color="white" />
            </TouchableOpacity>
            <TText variant="body" weight="extraBold" color="white">Détail transfert</TText>
            <TouchableOpacity onPress={shareTransfer} style={styles.backBtn}>
              <Ionicons name="share-social-outline" size={18} color="white" />
            </TouchableOpacity>
          </View>

          <View style={styles.statusChip}>
            <Ionicons name={hero.icon} size={14} color="white" />
            <TText variant="label" weight="extraBold" color="white" style={{ marginLeft: 6, letterSpacing: 1 }}>
              {hero.label}
            </TText>
          </View>

          <TText variant="display" weight="extraBold" color="white" align="center" style={{ marginTop: spacing.md }}>
            {Number(tx.receive_amount).toFixed(0)} {tx.destination_currency}
          </TText>
          <TText variant="caption" color="rgba(255,255,255,0.75)" align="center" style={{ marginTop: 2 }}>
            ≈ {Number(tx.send_amount).toFixed(2)} {tx.source_currency || "EUR"} envoyé · Taux {Number(tx.fx_rate || 0).toFixed(4)}
          </TText>
          <TouchableOpacity onPress={() => Clipboard.setStringAsync(tx.reference || tx.id)} style={styles.refChip}>
            <Ionicons name="pricetag-outline" size={12} color="rgba(255,255,255,0.85)" />
            <TText variant="label" weight="semiBold" color="rgba(255,255,255,0.9)" style={{ marginLeft: 4 }}>
              Ref #{(tx.reference || tx.id).slice(-10).toUpperCase()}
            </TText>
          </TouchableOpacity>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView style={styles.card} contentContainerStyle={styles.cardInner} showsVerticalScrollIndicator={false}>
        {/* Actors: Cash → Expéditeur/Bénéficiaire/Payeur, Bank/MoMo → seulement Expéditeur/Bénéficiaire */}
        <View style={styles.actorsBox}>
          <ActorRow
            label="EXPÉDITEUR"
            name={tx.sender_snapshot?.full_name || "Vous"}
            sub={tx.sender_snapshot?.country || "—"}
            color="#3B82F6"
          />
          <Separator />
          <ActorRow
            label="BÉNÉFICIAIRE"
            name={tx.beneficiary?.full_name || "—"}
            sub={`${tx.beneficiary?.city ? tx.beneficiary.city + " · " : ""}${tx.destination_country} · ${mode === "cash" ? "ESPÈCES" : mode === "bank" ? "VIREMENT BANCAIRE" : "PORTEFEUILLE MOBILE"}${tx.vip_delivery ? " · VIP" : ""}`}
            color="#10B981"
          />
          {mode === "cash" ? (
            <>
              <Separator />
              <ActorRow
                label="AGENT"
                name={tx.agent_snapshot?.profile_id || (tx.status === "BIDDING" ? "En attente…" : "—")}
                sub={tx.agent_snapshot?.city || (tx.status === "BIDDING" ? "Sélection en cours" : "—")}
                color="#F59E0B"
                rating={tx.agent_snapshot?.rating}
              />
            </>
          ) : null}
        </View>

        {/* 48h countdown banner — visible quand fonds disponibles (cash + non terminé) */}
        {mode === "cash" && deadlineMs && tx.status !== "COMPLETED" && tx.status !== "FAILED" && tx.assigned_at ? (
          <View style={[styles.countdownBox, isUrgent && styles.countdownBoxUrgent]}>
            <View style={[styles.countdownIcon, { backgroundColor: isUrgent ? "#FEE2E2" : "#FEF3C7" }]}>
              <Ionicons name="time" size={20} color={isUrgent ? "#DC2626" : "#D97706"} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <TText variant="caption" weight="extraBold" color={isUrgent ? "#991B1B" : "#92400E"} style={{ letterSpacing: 0.5 }}>
                {remainingMs > 0 ? "DÉLAI DE RETRAIT" : "DÉLAI DÉPASSÉ"}
              </TText>
              <TText variant="title" weight="extraBold" color={isUrgent ? "#991B1B" : "#92400E"} style={{ marginTop: 2 }}>
                {countdownLabel}
              </TText>
              <TText variant="label" color={isUrgent ? "#7F1D1D" : "#78350F"} style={{ marginTop: 2 }}>
                {remainingMs > 0
                  ? "Au-delà, prolongation automatique de 48h (frais déduits du paiement bénéficiaire). Rappels Email à H-24, H-12 et H-6."
                  : "Prolongation automatique de 48h activée. Frais ajoutés."}
              </TText>
              {/* Boutons d'extension manuelle (visibles dès H-12) */}
              {isUrgent && remainingMs > 0 ? (
                <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                  <TouchableOpacity testID="extend-1d" style={styles.extendBtn} onPress={() => extendPickup(1)}>
                    <Ionicons name="add-circle-outline" size={14} color="#92400E" />
                    <TText variant="label" weight="extraBold" color="#92400E" style={{ marginLeft: 4 }}>Prolonger +1 jour</TText>
                  </TouchableOpacity>
                  <TouchableOpacity testID="extend-7d" style={styles.extendBtn} onPress={() => extendPickup(7)}>
                    <Ionicons name="add-circle-outline" size={14} color="#92400E" />
                    <TText variant="label" weight="extraBold" color="#92400E" style={{ marginLeft: 4 }}>Prolonger +7 jours</TText>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* Financial details */}
        <TText variant="label" weight="extraBold" color={colors.neutrals.textSecondary} style={styles.sectionTitle}>
          FINANCIER
        </TText>
        <View style={styles.finBox}>
          <FinRow label="Montant envoyé" value={`${Number(tx.send_amount).toFixed(2)} ${tx.source_currency || "EUR"}`} />
          <FinRow label="Taux" value={Number(tx.fx_rate || 0).toFixed(4)} />
          <FinRow label={t("transferFlow.fees")} value={`${Number(tx.fee_amount).toFixed(2)} ${tx.source_currency || "EUR"}`} />
          <FinRow label="Total débité" value={`${Number(tx.total_amount).toFixed(2)} ${tx.source_currency || "EUR"}`} bold />
          <FinRow label="Bénéficiaire reçoit" value={`${Number(tx.receive_amount).toFixed(0)} ${tx.destination_currency}`} tint="#10B981" bold last />
        </View>

        {/* Dates */}
        <TText variant="label" weight="extraBold" color={colors.neutrals.textSecondary} style={styles.sectionTitle}>
          DATES
        </TText>
        <View style={styles.finBox}>
          <FinRow label="Envoyé le" value={new Date(tx.created_at).toLocaleString("fr-FR")} />
          {mode === "cash" && tx.assigned_at ? <FinRow label="Agent assigné" value={new Date(tx.assigned_at).toLocaleString("fr-FR")} /> : null}
          {tx.completed_at ? <FinRow label="Livré le" value={new Date(tx.completed_at).toLocaleString("fr-FR")} tint="#10B981" /> : null}
          <FinRow label="Mode" value={mode === "cash" ? "ESPÈCES" : mode === "bank" ? "VIREMENT BANCAIRE" : "PORTEFEUILLE MOBILE"} last />
        </View>

        {/* Progression */}
        <TText variant="label" weight="extraBold" color={colors.neutrals.textSecondary} style={styles.sectionTitle}>
          PROGRESSION
        </TText>
        <View style={styles.progressBox}>
          <VerticalProgress steps={steps} />
        </View>

        {/* VIP banner retiré — spec v6.4 : ne pas afficher la procédure VIP sur l'écran détail */}

        {/* Withdrawal code reminder for active cash transfers */}
        {mode === "cash" && tx.status !== "COMPLETED" && tx.withdrawal_code ? (
          <TouchableOpacity onPress={() => Clipboard.setStringAsync(tx.withdrawal_code)} style={styles.codeStrip}>
            <Ionicons name="key" size={16} color="#065F46" />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <TText variant="label" color="#065F46">Code de retrait</TText>
              <TText weight="extraBold" style={styles.codeStripValue}>{tx.withdrawal_code}</TText>
            </View>
            <Ionicons name="copy-outline" size={16} color="#065F46" />
          </TouchableOpacity>
        ) : null}

        {/* Actions — v3 : Voir le reçu officiel + PDF + Ouvrir un litige sur UNE SEULE LIGNE.
            Tailles/polices réduites via size="sm" pour tenir confortablement sur mobile. */}
        <View style={{ marginTop: spacing.lg, gap: 8 }}>
          <View style={{ flexDirection: "row", gap: 6 }}>
            <Button
              testID="detail-receipt"
              title="Reçu officiel"
              icon="document-text-outline"
              size="sm"
              onPress={() => router.push({ pathname: "/transfer/receipt", params: { transfer_id: tx.id } } as any)}
              style={{ flex: 2 }}
            />
            <Button testID="detail-pdf" title="PDF" icon="download-outline" size="sm" variant="outline" onPress={downloadReceipt} style={{ flex: 1 }} />
            <Button testID="detail-dispute" title="Litige" icon="warning-outline" size="sm" variant="ghost" onPress={() => router.push({ pathname: "/disputes", params: { transfer_id: tx.id } })} style={{ flex: 1 }} />
          </View>
          {/* Boutons contextuels en dessous (Carte / Chat) si applicable */}
          {(mode === "cash" && (tx.vip_delivery || ["BIDDING", "AGENT_ASSIGNED", "PROCESSING"].includes(tx.status))) ? (
            <View style={{ flexDirection: "row", gap: 8 }}>
              {mode === "cash" && tx.vip_delivery ? (
                <Button testID="detail-map" title="Carte" icon="map-outline" size="sm" variant="outline" onPress={() => router.push({ pathname: "/transfer/map", params: { transfer_id: tx.id } } as any)} style={{ flex: 1 }} />
              ) : null}
              {mode === "cash" && ["BIDDING", "AGENT_ASSIGNED", "PROCESSING"].includes(tx.status) ? (
                <Button testID="detail-chat" title="Chat" icon="chatbubbles-outline" size="sm" variant="outline" onPress={() => router.push(`/chat/${tx.id}` as any)} style={{ flex: 1 }} />
              ) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

function ActorRow({ label, name, sub, color, rating }: { label: string; name: string; sub: string; color: string; rating?: number }) {
  return (
    <View style={styles.actorRow}>
      <View style={[styles.actorAvatar, { backgroundColor: color + "22", borderColor: color }]}>
        <TText variant="body" weight="extraBold" color={color}>{name.charAt(0).toUpperCase()}</TText>
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <TText variant="label" weight="extraBold" color={colors.neutrals.textTertiary} style={{ letterSpacing: 1 }}>{label}</TText>
        <TText variant="body" weight="extraBold">{name}</TText>
        <TText variant="label" color={colors.neutrals.textSecondary}>{sub}</TText>
      </View>
      {rating ? (
        <View style={styles.ratingChip}>
          <Ionicons name="star" size={12} color="#F59E0B" />
          <TText variant="label" weight="extraBold" style={{ marginLeft: 2 }}>{Number(rating).toFixed(1)}</TText>
        </View>
      ) : null}
    </View>
  );
}

function Separator() { return <View style={styles.separator} />; }

function FinRow({ label, value, bold, tint, last }: { label: string; value: string; bold?: boolean; tint?: string; last?: boolean }) {
  return (
    <View style={[styles.finRow, !last && { borderBottomWidth: 1, borderBottomColor: colors.neutrals.border }]}>
      <TText variant="caption" color={colors.neutrals.textSecondary}>{label}</TText>
      <TText variant="caption" weight={bold ? "extraBold" : "semiBold"} color={tint || colors.neutrals.textPrimary}>{value}</TText>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: spacing.sm },
  backBtn: { width: 36, height: 36, borderRadius: radii.full, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" },
  statusChip: {
    alignSelf: "center", flexDirection: "row", alignItems: "center",
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: radii.full,
    backgroundColor: "rgba(16,185,129,0.22)", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)",
    marginTop: spacing.lg,
  },
  refChip: { alignSelf: "center", flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.1)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.full, marginTop: 10 },
  card: { flex: 1, backgroundColor: colors.neutrals.background, borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl, marginTop: -spacing.lg },
  cardInner: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  actorsBox: { backgroundColor: colors.neutrals.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.neutrals.border, paddingHorizontal: spacing.md },
  actorRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
  actorAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: 2 },
  separator: { height: 1, backgroundColor: colors.neutrals.border },
  ratingChip: { flexDirection: "row", alignItems: "center", backgroundColor: "#FEF3C7", paddingHorizontal: 6, paddingVertical: 2, borderRadius: radii.full },
  sectionTitle: { letterSpacing: 1, marginTop: spacing.lg, marginBottom: 8, marginLeft: 4 },
  finBox: { backgroundColor: colors.neutrals.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.neutrals.border, paddingHorizontal: spacing.md },
  finRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12 },
  progressBox: { backgroundColor: colors.neutrals.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.neutrals.border, padding: spacing.md },
  codeStrip: { flexDirection: "row", alignItems: "center", backgroundColor: "#E6F8F0", borderWidth: 1, borderColor: "#10B981", borderRadius: radii.xl, padding: spacing.md, marginTop: spacing.md },
  codeStripValue: { letterSpacing: 4, color: "#065F46", fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }) },
  vipUnavailBox: { flexDirection: "row", alignItems: "flex-start", backgroundColor: "#FEF3C7", borderWidth: 1, borderColor: "#FCD34D", borderRadius: radii.xl, padding: spacing.md, marginTop: spacing.md },
  countdownBox: { flexDirection: "row", alignItems: "flex-start", backgroundColor: "#FFFBEB", borderWidth: 1.5, borderColor: "#FCD34D", borderRadius: radii.xl, padding: spacing.md, marginTop: spacing.md },
  countdownBoxUrgent: { backgroundColor: "#FEF2F2", borderColor: "#FCA5A5" },
  countdownIcon: { width: 40, height: 40, borderRadius: radii.full, alignItems: "center", justifyContent: "center" },
  extendBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "white", borderWidth: 1, borderColor: "#FCD34D", borderRadius: radii.full, paddingHorizontal: 10, paddingVertical: 6 },
});
