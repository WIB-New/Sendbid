/**
 * /paybid/transfer/[id].tsx — Détail de mission agent style Wise (Item 7).
 *
 * Aligné sur la mise en page Sendbid /wallet/op/[id] :
 *   - Hero gradient PAYBID avec icône statut + montant à remettre en grand
 *   - Pill catégorie + nom du bénéficiaire
 *   - Onglets "Mises à jour" (timeline) / "Informations" (détails complets)
 *   - Boutons d'actions de contact (Appel · WhatsApp · Chat · Itinéraire)
 *   - CTAs Démarrer la livraison / Confirmer remise (code 10 chiffres)
 */
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { TText } from "../../../src/components/TText";
import { Input } from "../../../src/components/Input";
import { Button } from "../../../src/components/Button";
import { api, apiError } from "../../../src/api";
import { useThemedPaybidColors } from "../../../src/themeContext";
import { paybidColors } from "../../../src/paybidTheme";
import { spacing, radii } from "../../../src/theme";
import { useTranslation } from "../../../src/i18n";

const openExternal = async (
  kind: "phone" | "sms" | "whatsapp" | "maps",
  target: string
) => {
  let url = "";
  if (kind === "phone") url = `tel:${target}`;
  else if (kind === "sms") url = `sms:${target}`;
  else if (kind === "whatsapp") {
    const clean = target.replace(/[^\d+]/g, "");
    url =
      Platform.OS === "web"
        ? `https://wa.me/${clean.replace("+", "")}`
        : `whatsapp://send?phone=${clean.replace("+", "")}`;
  } else if (kind === "maps") {
    const q = encodeURIComponent(target);
    url =
      Platform.OS === "ios"
        ? `http://maps.apple.com/?daddr=${q}`
        : `https://www.google.com/maps/dir/?api=1&destination=${q}`;
  }
  try {
    const ok = await Linking.canOpenURL(url);
    if (ok) await Linking.openURL(url);
    else if (kind === "whatsapp")
      await Linking.openURL(`https://wa.me/${target.replace(/[^\d]/g, "")}`);
    else Alert.alert("Impossible d'ouvrir", url);
  } catch {
    Alert.alert("Erreur", "Impossible d'ouvrir cette action");
  }
};

function fmtDate(iso?: string) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return (
      d.toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }) +
      " à " +
      d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    );
  } catch {
    return iso;
  }
}

const STATUS_META: Record<
  string,
  { label: string; icon: any; color: string }
> = {
  AGENT_ASSIGNED: { label: "À démarrer", icon: "hourglass", color: "#F59E0B" },
  PROCESSING: { label: "En cours", icon: "sync", color: "#3B82F6" },
  READY_FOR_PICKUP: { label: "Prêt pour retrait", icon: "cube", color: "#FFA500" },
  VIP_DELIVERY: { label: "Livraison VIP", icon: "rocket", color: "#7C3AED" },
  COMPLETED: { label: "Terminé", icon: "checkmark-done-circle", color: "#10B981" },
  CANCELED: { label: "Annulé", icon: "close-circle", color: "#EF4444" },
};

export default function PaybidTransferDetail() {
  const { t } = useTranslation();
  const colors = useThemedPaybidColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tx, setTx] = useState<any>(null);
  const [tab, setTab] = useState<"updates" | "info">("updates");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    try {
      const r = await api.get(`/transfers/${id}`);
      setTx(r.data);
    } catch {}
  };
  useEffect(() => {
    load();
  }, [id]);

  const start = async () => {
    setBusy(true);
    try {
      await api.post(`/agent/transfers/${id}/start`, {});
      await load();
    } catch (e: any) {
      Alert.alert("Erreur", apiError(e));
    } finally {
      setBusy(false);
    }
  };
  const complete = async () => {
    setBusy(true);
    setErr(null);
    try {
      const { data } = await api.post(`/agent/transfers/${id}/complete`, {
        code,
      });
      Alert.alert(
        "Transfert terminé",
        `Vous avez gagné +${data.earned_eur.toFixed(2)} EUR`
      );
      router.back();
    } catch (e: any) {
      setErr(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  const timeline = useMemo(() => {
    if (!tx) return [];
    return [
      { label: "Transfert créé", date: tx.created_at, done: true },
      { label: "Agent assigné (vous)", date: tx.agent_assigned_at, done: !!tx.agent_id },
      {
        label: "Livraison démarrée",
        date: tx.started_at,
        done: ["PROCESSING", "READY_FOR_PICKUP", "VIP_DELIVERY", "COMPLETED"].includes(tx.status),
      },
      {
        label: "Remise effectuée",
        date: tx.completed_at,
        done: tx.status === "COMPLETED",
      },
    ];
  }, [tx]);

  if (!tx) return null;
  const canStart = ["AGENT_ASSIGNED"].includes(tx.status);
  const canComplete = ["PROCESSING", "READY_FOR_PICKUP", "VIP_DELIVERY"].includes(tx.status);
  const status = STATUS_META[tx.status] || { label: tx.status, icon: "ellipse", color: colors.neutrals.textSecondary };
  const bgGradient = canStart
    ? paybidColors.gradients.hero
    : tx.status === "COMPLETED"
    ? (["#10B981", "#059669", "#059669"] as [string, string, string])
    : paybidColors.gradients.hero;

  return (
    <View style={{ flex: 1, backgroundColor: colors.neutrals.background }}>
      {/* ===== Hero ===== */}
      <LinearGradient colors={bgGradient} style={styles.hero}>
        <SafeAreaView edges={["top"]}>
          <View style={styles.heroTop}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.iconBtn}
              testID="paybid-detail-back"
            >
              <Ionicons name="chevron-back" size={22} color="white" />
            </TouchableOpacity>
            <TText variant="title" weight="extraBold" color="white">
              Détail mission
            </TText>
            <View style={styles.iconBtnGhost} />
          </View>
          <View style={styles.statusIconWrap}>
            <View
              style={[
                styles.statusIcon,
                { backgroundColor: "rgba(255,255,255,0.16)" },
              ]}
            >
              <Ionicons name={status.icon} size={36} color="white" />
            </View>
          </View>
          <View style={{ alignItems: "center", marginTop: spacing.md }}>
            <TText
              variant="label"
              color="rgba(255,255,255,0.78)"
              style={{ letterSpacing: 1 }}
            >
              MONTANT À REMETTRE
            </TText>
            <TText
              variant="display"
              weight="extraBold"
              color="white"
              style={{ marginTop: 4 }}
            >
              {Number(tx.receive_amount).toFixed(0)}{" "}
              <TText
                variant="title"
                weight="bold"
                color="rgba(255,255,255,0.85)"
              >
                {tx.destination_currency}
              </TText>
            </TText>
            <View style={styles.statusPill}>
              <Ionicons name={status.icon} size={12} color="white" />
              <TText
                variant="label"
                weight="bold"
                color="white"
                style={{ marginLeft: 4 }}
              >
                {status.label}
              </TText>
            </View>
          </View>
          <View style={{ alignItems: "center", marginTop: 8 }}>
            <TText variant="caption" color="rgba(255,255,255,0.85)">
              {tx.beneficiary?.full_name || "—"} · {tx.destination_country} ·{" "}
              {(tx.delivery_mode || "").toUpperCase()}
              {tx.vip_delivery ? " · VIP" : ""}
            </TText>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* ===== Carte blanche scrollable ===== */}
      <ScrollView
        style={[
          styles.card,
          { backgroundColor: colors.neutrals.background },
        ]}
        contentContainerStyle={styles.cardInner}
        showsVerticalScrollIndicator={false}
      >
        {/* ===== Quick contact buttons ===== */}
        {tx.beneficiary?.phone ? (
          <View style={styles.contactRow}>
            <ContactBtn
              icon="call"
              label="Appeler"
              color={paybidColors.primary.base}
              onPress={() => openExternal("phone", tx.beneficiary.phone)}
            />
            <ContactBtn
              icon="logo-whatsapp"
              label="WhatsApp"
              color="#25D366"
              onPress={() => openExternal("whatsapp", tx.beneficiary.phone)}
            />
            <ContactBtn
              icon="chatbubbles"
              label="Chat"
              color="#022a6b"
              onPress={() => router.push(`/chat/${tx.id}` as any)}
            />
            {(tx.beneficiary?.city || tx.beneficiary?.address) ? (
              <ContactBtn
                icon="navigate"
                label="Itinéraire"
                color="#F59E0B"
                onPress={() =>
                  openExternal(
                    "maps",
                    `${tx.beneficiary.address || ""} ${tx.beneficiary.city || ""} ${tx.destination_country || ""}`.trim()
                  )
                }
              />
            ) : null}
          </View>
        ) : null}

        {/* ===== Tabs ===== */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            testID="tab-updates"
            onPress={() => setTab("updates")}
            style={[
              styles.tab,
              tab === "updates" && {
                borderBottomColor: paybidColors.primary.base,
              },
            ]}
          >
            <TText
              weight="extraBold"
              color={
                tab === "updates"
                  ? paybidColors.primary.base
                  : colors.neutrals.textSecondary
              }
            >
              Mises à jour
            </TText>
          </TouchableOpacity>
          <TouchableOpacity
            testID="tab-info"
            onPress={() => setTab("info")}
            style={[
              styles.tab,
              tab === "info" && {
                borderBottomColor: paybidColors.primary.base,
              },
            ]}
          >
            <TText
              weight="extraBold"
              color={
                tab === "info"
                  ? paybidColors.primary.base
                  : colors.neutrals.textSecondary
              }
            >
              Informations
            </TText>
          </TouchableOpacity>
        </View>

        {/* ===== Tab content ===== */}
        {tab === "updates" ? (
          <View
            style={[
              styles.box,
              {
                backgroundColor: colors.neutrals.surface,
                borderColor: colors.neutrals.border,
              },
            ]}
          >
            {timeline.map((ev, i) => (
              <View key={i} style={styles.tlRow}>
                <View
                  style={[
                    styles.tlDot,
                    {
                      backgroundColor: ev.done
                        ? paybidColors.status.success
                        : colors.neutrals.border,
                    },
                  ]}
                >
                  {ev.done ? (
                    <Ionicons name="checkmark" size={14} color="white" />
                  ) : null}
                </View>
                {i < timeline.length - 1 ? (
                  <View
                    style={[
                      styles.tlLine,
                      {
                        backgroundColor: ev.done
                          ? paybidColors.status.success
                          : colors.neutrals.border,
                      },
                    ]}
                  />
                ) : null}
                <View style={{ flex: 1, marginLeft: 12, paddingBottom: 14 }}>
                  <TText
                    variant="body"
                    weight={ev.done ? "extraBold" : "semiBold"}
                    color={
                      ev.done
                        ? colors.neutrals.textPrimary
                        : colors.neutrals.textTertiary
                    }
                  >
                    {ev.label}
                  </TText>
                  <TText variant="caption" color={colors.neutrals.textTertiary}>
                    {ev.done ? fmtDate(ev.date) : "En attente"}
                  </TText>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View
            style={[
              styles.box,
              {
                backgroundColor: colors.neutrals.surface,
                borderColor: colors.neutrals.border,
              },
            ]}
          >
            <Row
              label="Bénéficiaire"
              value={tx.beneficiary?.full_name || "—"}
              bold
            />
            <Row
              label="Téléphone"
              value={tx.beneficiary?.phone || "—"}
            />
            {tx.beneficiary?.city || tx.beneficiary?.address ? (
              <Row
                label="Ville / Adresse"
                value={[tx.beneficiary.address, tx.beneficiary.city]
                  .filter(Boolean)
                  .join(", ")}
              />
            ) : null}
            <Row
              label="Pays / Devise"
              value={`${tx.destination_country} · ${tx.destination_currency}`}
            />
            <Row label="Mode" value={(tx.delivery_mode || "").toUpperCase()} />
            <Row
              label="Montant à remettre"
              value={`${Number(tx.receive_amount).toFixed(0)} ${tx.destination_currency}`}
              bold
            />
            <Row
              label="Votre commission"
              value={`+${Number(tx.agent_commission || (tx.fee_total || 0) * 0.6 || 0).toFixed(2)} EUR`}
              tint={paybidColors.primary.base}
            />
            <Row
              label="Code retrait"
              value={tx.withdrawal_code || "—"}
              mono
            />
            {tx.beneficiary?.bank_account ? (
              <Row
                label="Compte bancaire"
                value={tx.beneficiary.bank_account}
                mono
              />
            ) : null}
            {tx.beneficiary?.momo_number ? (
              <Row
                label="Mobile Money"
                value={`${tx.beneficiary.momo_operator} ${tx.beneficiary.momo_number}`}
                mono
              />
            ) : null}
            <Row label="Référence" value={tx.id} mono />
            <Row label="Créé le" value={fmtDate(tx.created_at)} />
          </View>
        )}

        {/* ===== CTAs ===== */}
        {canStart ? (
          <Button
            testID="paybid-detail-start"
            title="Démarrer la livraison"
            icon="play"
            onPress={start}
            loading={busy}
            style={{
              backgroundColor: paybidColors.primary.base,
              marginTop: spacing.lg,
            }}
          />
        ) : null}
        {canComplete ? (
          <View
            style={[
              styles.box,
              {
                backgroundColor: colors.neutrals.surface,
                borderColor: colors.neutrals.border,
                marginTop: spacing.md,
              },
            ]}
          >
            <TText weight="extraBold" style={{ marginBottom: 8 }}>
              Confirmer la remise
            </TText>
            <TText
              variant="caption"
              color={colors.neutrals.textSecondary}
              style={{ marginBottom: 12 }}
            >
              Le bénéficiaire vous communique le code à 10 chiffres reçu par
              l&apos;expéditeur.
            </TText>
            <Input
              label="Code à 10 chiffres"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={10}
              icon="keypad-outline"
            />
            {err ? (
              <TText
                color={paybidColors.status.error}
                style={{ marginTop: 6 }}
              >
                {err}
              </TText>
            ) : null}
            <Button
              testID="paybid-detail-complete"
              title="Valider et encaisser"
              icon="checkmark"
              onPress={complete}
              loading={busy}
              disabled={code.length < 6}
              style={{
                backgroundColor: paybidColors.status.success,
                marginTop: 10,
              }}
            />
          </View>
        ) : null}

        <View style={{ height: spacing.xxxl }} />
      </ScrollView>
    </View>
  );
}

function ContactBtn({ icon, label, color, onPress }: any) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.contactBtn, { backgroundColor: color }]}
    >
      <Ionicons name={icon} size={20} color="white" />
      <TText
        variant="label"
        weight="bold"
        color="white"
        style={{ marginTop: 4 }}
      >
        {label}
      </TText>
    </TouchableOpacity>
  );
}

function Row({ label, value, bold, tint, mono }: any) {
  return (
    <View style={styles.row}>
      <TText variant="caption" color={paybidColors.neutrals.textSecondary}>
        {label}
      </TText>
      <TText
        weight={bold ? "extraBold" : "semiBold"}
        color={tint || (bold ? paybidColors.primary.base : paybidColors.neutrals.textPrimary)}
        style={mono ? { fontVariant: ["tabular-nums"] } : undefined}
      >
        {value}
      </TText>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl + 16,
  },
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
  iconBtnGhost: { width: 36, height: 36 },
  statusIconWrap: { alignItems: "center", marginTop: spacing.lg },
  statusIcon: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignItems: "center",
    justifyContent: "center",
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radii.full,
    backgroundColor: "rgba(255,255,255,0.18)",
    marginTop: 10,
  },
  card: {
    flex: 1,
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    marginTop: -spacing.lg,
  },
  cardInner: { padding: spacing.lg },
  contactRow: { flexDirection: "row", gap: 6, marginBottom: spacing.md },
  contactBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radii.lg,
    alignItems: "center",
  },
  tabRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: paybidColors.neutrals.border,
    marginBottom: spacing.md,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
  },
  box: {
    padding: spacing.lg,
    borderRadius: radii.xl,
    borderWidth: 1,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  tlRow: { flexDirection: "row", position: "relative" },
  tlDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  tlLine: {
    position: "absolute",
    left: 10,
    top: 22,
    bottom: 0,
    width: 2,
  },
});
