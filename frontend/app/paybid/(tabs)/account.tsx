/**
 * /paybid/(tabs)/account.tsx — "Activités" (renommée — item 4 du lot du 12/06/2026)
 *
 * Modifications du 12/06/2026 :
 *   - item 1  : liens vers /paybid/movements, /paybid/cash-recharge, /paybid/loan-request,
 *               /paybid/agency/cashin, /paybid/agency/cashout, /paybid/agency-ops réparés
 *               (les pages ont été créées).
 *   - item 2  : format monétaire 1.500,50 + devise via formatMoney().
 *               Taille du montant réduite (32 → 24).
 *   - item 3  : 3 boutons (Retirer / Recharger / Mon encours) — police + icônes
 *               + padding réduits.
 *   - item 4  : Mouvements cliquables avec modale détail.
 *   - item 5  : Renommage "Mon agence" → "Mon guichet", "Opérations en agence"
 *               → "Opérations en Caisse". Bloc super-agent (Mon agence + Mes caisses).
 */
import React, { useCallback, useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { TText } from "../../../src/components/TText";
import { Button } from "../../../src/components/Button";
import { api } from "../../../src/api";
import { useAuth } from "../../../src/store";
import { paybidColors } from "../../../src/paybidTheme";
import { spacing, radii } from "../../../src/theme";
import { formatMoney, maskMoney } from "../../../src/utils/money";

export default function PaybidAccount() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const [refreshing, setRefreshing] = useState(false);
  const [showBalance, setShowBalance] = useState(true);
  const [floatData, setFloatData] = useState<any>({ balance: 0, currency: "XOF", agency_name: "—" });
  const [movements, setMovements] = useState<any[]>([]);
  const [operations, setOperations] = useState<any[]>([]);
  const [detail, setDetail] = useState<any | null>(null);
  // Item 5 — Vue super-agent : liste des caisses + total
  const [cashboxes, setCashboxes] = useState<any[]>([]);
  const [cashboxesTotal, setCashboxesTotal] = useState<number>(0);

  const isSuperAgent = (user as any)?.role === "super_agent"
    || (user as any)?.agent_type === "super_agent"
    || (user as any)?.role === "agency_manager";

  // Item 5 — Le CTA principal s'appelle "Mon guichet" pour tout le monde,
  // SAUF pour le super-agent qui voit "Mon agence" (vue consolidée).
  const mainCtaTitle = isSuperAgent ? "Mon agence" : "Mon guichet";

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const promises: Promise<any>[] = [
        api.get("/agent/float").catch(() => ({ data: { items: [] } })),
        api.get("/agent/float/movements?limit=5").catch(() => ({ data: { items: [] } })),
        api.get("/agent/transfers?limit=5").catch(() => ({ data: [] })),
      ];
      if (isSuperAgent) {
        promises.push(api.get("/agent/agency/cashboxes").catch(() => ({ data: { cashboxes: [], total_balance: 0 } })));
      }
      const [floatR, movR, opR, cashboxR] = await Promise.all(promises);
      const items = floatR.data?.items || [];
      const main = items[0] || { balance: 0, currency: "XOF" };
      setFloatData({
        balance: main.balance || 0,
        currency: main.currency || "XOF",
        agency_name: (user as any)?.agency_name || (isSuperAgent ? "Mon agence" : "Mon guichet"),
      });
      setMovements(movR.data?.items || []);
      setOperations(opR.data?.items || opR.data || []);
      if (cashboxR) {
        setCashboxes(cashboxR.data?.cashboxes || []);
        setCashboxesTotal(cashboxR.data?.total_balance || 0);
      }
    } catch {}
    finally { setRefreshing(false); }
  }, [user, isSuperAgent]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onLoanRequest = () => {
    Alert.alert(
      "Demander un encours",
      "Une facilité de caisse vous sera proposée si vous êtes éligible (ancienneté, score, historique). Continuer ?",
      [
        { text: "Annuler", style: "cancel" },
        { text: "Vérifier mon éligibilité", onPress: () => router.push("/paybid/loan-request" as any) },
      ]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: paybidColors.neutrals.background }} edges={["top", "left", "right"]}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />} contentContainerStyle={{ padding: spacing.lg }}>
        <TText variant="title" weight="extraBold" style={{ marginBottom: spacing.md }}>Activités</TText>

        {/* CTA principal — fond MARRON UNI (item 1 cosmétique) + nom selon rôle (item 5) */}
        <View style={[styles.cashCard, { backgroundColor: "#54280f" }]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <TText variant="caption" weight="extraBold" color="white">{mainCtaTitle}</TText>
            <TText variant="caption" color="rgba(255,255,255,0.78)">ID: {(user as any)?.profile_id || ((user as any)?.id?.slice(0, 8)) || "—"}</TText>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 14 }}>
            <TText variant="caption" weight="bold" color="rgba(255,255,255,0.78)" style={{ letterSpacing: 1 }}>
              {isSuperAgent ? "TOTAL ESPÈCES (toutes caisses)" : "ESPÈCES EN CAISSE"}
            </TText>
            <TouchableOpacity onPress={() => setShowBalance((v) => !v)} style={{ marginLeft: 8 }}>
              <Ionicons name={showBalance ? "eye" : "eye-off"} size={14} color="rgba(255,255,255,0.78)" />
            </TouchableOpacity>
          </View>
          {/* Item 2 — montant réduit de 36 → 24, format européen 1.500,50 + devise */}
          <TText weight="extraBold" color="white" style={{ fontSize: 24, marginTop: 4 }} numberOfLines={1} adjustsFontSizeToFit>
            {showBalance
              ? formatMoney(isSuperAgent ? cashboxesTotal : floatData.balance, floatData.currency)
              : maskMoney(floatData.currency)}
          </TText>
        </View>

        {/* Item 5 — Vue super-agent : bloc "Mes caisses" sous le total */}
        {isSuperAgent ? (
          <View style={{ marginTop: spacing.sm, marginBottom: spacing.sm }}>
            <TText variant="body" weight="extraBold" style={{ marginBottom: 8 }}>Mes caisses</TText>
            {cashboxes.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="cube-outline" size={36} color={paybidColors.neutrals.textTertiary} />
                <TText variant="caption" color={paybidColors.neutrals.textSecondary} style={{ marginTop: 6 }}>
                  Aucune caisse rattachée
                </TText>
              </View>
            ) : (
              cashboxes.map((cb: any, idx: number) => (
                <TouchableOpacity
                  key={cb.id}
                  testID={`paybid-cashbox-${idx}`}
                  onPress={() => router.push(`/paybid/cashbox/${cb.id}` as any)}
                  style={styles.cashboxRow}
                  activeOpacity={0.7}
                >
                  <View style={[styles.cashboxIcon, { backgroundColor: cb.available ? "rgba(16,185,129,0.15)" : "rgba(156,163,175,0.15)" }]}>
                    <Ionicons name="cube" size={20} color={cb.available ? "#10B981" : "#9CA3AF"} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <TText weight="extraBold" style={{ fontSize: 13 }}>{cb.label || `Caisse ${String(idx + 1).padStart(2, "0")}`}</TText>
                    <TText variant="caption" color={paybidColors.neutrals.textSecondary}>
                      {cb.full_name || "—"} · {cb.city || "—"}
                    </TText>
                  </View>
                  <TText weight="extraBold" style={{ fontSize: 13 }}>{formatMoney(cb.balance || 0, cb.currency || floatData.currency)}</TText>
                  <Ionicons name="chevron-forward" size={16} color={paybidColors.neutrals.textTertiary} style={{ marginLeft: 4 }} />
                </TouchableOpacity>
              ))
            )}
          </View>
        ) : null}

        {/* Item 3 — 3 boutons compacts (police 11, icônes 18, padding réduit) */}
        <View style={styles.row3}>
          <ColorBtn icon="cash-outline" color="#10B981" label="Retirer mes gains" onPress={() => router.push("/paybid/(tabs)/earnings" as any)} />
          <ColorBtn icon="add-circle" color="#022a6b" label="Recharger ma caisse" onPress={() => router.push("/paybid/cash-recharge" as any)} />
          <ColorBtn icon="card-outline" color="#F59E0B" label="Mon encours" onPress={onLoanRequest} />
        </View>

        {/* Mes mouvements (item 4 — cliquables) */}
        <SectionHeader label="Mes mouvements" onSeeAll={() => router.push("/paybid/movements" as any)} />
        {movements.length === 0 ? <EmptyRow text="Aucun mouvement récent" /> : movements.slice(0, 5).map((m: any) => {
          const sign = Number(m.amount_signed || m.amount || 0);
          return (
            <TouchableOpacity key={m.id || Math.random()} onPress={() => setDetail(m)} style={styles.histRow} activeOpacity={0.7}>
              <View style={[styles.histIcon, { backgroundColor: sign >= 0 ? "#ECFDF5" : "#FEF2F2" }]}>
                <Ionicons name={sign >= 0 ? "arrow-down" : "arrow-up"} size={16} color={sign >= 0 ? "#10B981" : "#EF4444"} />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <TText weight="semiBold" style={{ textTransform: "capitalize", fontSize: 13 }}>
                  {(m.type || m.movement_type || "—").replace(/_/g, " ")}
                </TText>
                <TText variant="caption" color={paybidColors.neutrals.textSecondary}>
                  {m.created_at ? new Date(m.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : ""}
                </TText>
              </View>
              <TText weight="extraBold" color={sign >= 0 ? "#10B981" : "#EF4444"} style={{ fontSize: 12 }}>
                {sign >= 0 ? "+" : ""}{formatMoney(Math.abs(sign), m.currency || floatData.currency)}
              </TText>
              <Ionicons name="chevron-forward" size={14} color={paybidColors.neutrals.textTertiary} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          );
        })}

        {/* Conteneur opérations agence — RENOMMÉ (item 5) */}
        <TText variant="body" weight="extraBold" style={{ marginTop: spacing.xl, marginBottom: 8 }}>Opérations en Caisse</TText>
        <View style={styles.agencyContainer}>
          <AgencyBtn icon="arrow-down-circle" color="#10B981" label="Encaisser" hint="Recharger un compte client" onPress={() => router.push("/paybid/agency/cashin" as any)} />
          <AgencyBtn icon="arrow-up-circle" color="#EF4444" label="Décaisser" hint="Payer retrait ou transfert" onPress={() => router.push("/paybid/agency/cashout" as any)} />
          <AgencyBtn icon="business" color="#F59E0B" label="Verser au siège" hint="Reverser le float" onPress={() => router.push("/paybid/float" as any)} />
          <AgencyBtn icon="document-text" color="#022a6b" label="Déclarer espèces" hint="Nouvelle entrée caisse" onPress={() => router.push("/paybid/cash" as any)} />
        </View>

        {/* Mes opérations (transferts) */}
        <SectionHeader label="Mes opérations" onSeeAll={() => router.push("/paybid/(tabs)/transfers" as any)} />
        {operations.length === 0 ? <EmptyRow text="Aucune opération récente" /> : operations.slice(0, 5).map((op: any) => (
          <TouchableOpacity key={op.id || op._id || Math.random()} onPress={() => router.push(`/paybid/transfer/${op.id}` as any)} style={styles.histRow} activeOpacity={0.7}>
            <View style={[styles.histIcon, { backgroundColor: "#EFE0D2" }]}>
              <Ionicons name="paper-plane" size={16} color={paybidColors.primary.base} />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <TText weight="semiBold" style={{ fontSize: 13 }}>{op.beneficiary?.full_name || "Bénéficiaire"}</TText>
              <TText variant="caption" color={paybidColors.neutrals.textSecondary}>
                {op.status || "—"} · {op.created_at ? new Date(op.created_at).toLocaleDateString("fr-FR") : ""}
              </TText>
            </View>
            <TText weight="extraBold" color={paybidColors.primary.base} style={{ fontSize: 12 }}>
              +{formatMoney(op.agent_commission || 0, "EUR")}
            </TText>
            <Ionicons name="chevron-forward" size={14} color={paybidColors.neutrals.textTertiary} style={{ marginLeft: 4 }} />
          </TouchableOpacity>
        ))}

        {/* Opérations consolidées de l'agence (super-agent only) */}
        {isSuperAgent ? (
          <>
            <SectionHeader label="Opérations consolidées" onSeeAll={() => router.push("/paybid/agency-ops" as any)} />
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={32} color={paybidColors.neutrals.textTertiary} />
              <TText variant="caption" color={paybidColors.neutrals.textSecondary} style={{ marginTop: 6 }}>
                Vue consolidée de toute l&apos;agence
              </TText>
            </View>
          </>
        ) : null}
      </ScrollView>

      {/* Modale détail mouvement (item 4) */}
      {detail ? (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <TText weight="extraBold">Détail du mouvement</TText>
              <TouchableOpacity onPress={() => setDetail(null)}>
                <Ionicons name="close" size={22} color={paybidColors.neutrals.textPrimary} />
              </TouchableOpacity>
            </View>
            <View style={[styles.detailIcon, { alignSelf: "center", marginBottom: 12, backgroundColor: Number(detail.amount_signed ?? 0) >= 0 ? "#ECFDF5" : "#FEF2F2" }]}>
              <Ionicons name={Number(detail.amount_signed ?? 0) >= 0 ? "arrow-down" : "arrow-up"} size={28} color={Number(detail.amount_signed ?? 0) >= 0 ? "#10B981" : "#EF4444"} />
            </View>
            <TText weight="extraBold" align="center" style={{ fontSize: 24 }} color={Number(detail.amount_signed ?? 0) >= 0 ? "#10B981" : "#EF4444"}>
              {Number(detail.amount_signed ?? 0) >= 0 ? "+" : ""}{formatMoney(Math.abs(Number(detail.amount_signed ?? detail.amount ?? 0)), detail.currency || floatData.currency)}
            </TText>
            <View style={{ marginTop: 14 }}>
              <DL label="Type" value={(detail.type || detail.movement_type || "—").replace(/_/g, " ")} />
              <DL label="Date" value={detail.created_at ? new Date(detail.created_at).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" }) : "—"} />
              <DL label="Devise" value={detail.currency || "—"} />
              {detail.reference ? <DL label="Référence" value={detail.reference} mono /> : null}
              {detail.note ? <DL label="Note" value={detail.note} /> : null}
              <DL label="ID" value={detail.id || "—"} mono />
            </View>
            <Button title="Fermer" onPress={() => setDetail(null)} style={{ marginTop: 14, backgroundColor: paybidColors.primary.base }} />
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function ColorBtn({ icon, color, label, onPress }: any) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.colorBtn, { backgroundColor: color }]} activeOpacity={0.85}>
      <Ionicons name={icon} size={18} color="white" />
      <TText variant="label" weight="extraBold" color="white" align="center" style={{ marginTop: 4, fontSize: 10 }} numberOfLines={2}>
        {label}
      </TText>
    </TouchableOpacity>
  );
}

function AgencyBtn({ icon, color, label, hint, onPress }: any) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.agencyBtn} activeOpacity={0.7}>
      <View style={[styles.agencyIcon, { backgroundColor: color + "1A" }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <TText weight="extraBold" style={{ fontSize: 13 }}>{label}</TText>
        <TText variant="caption" color={paybidColors.neutrals.textSecondary} style={{ fontSize: 11 }}>{hint}</TText>
      </View>
      <Ionicons name="chevron-forward" size={18} color={paybidColors.neutrals.textTertiary} />
    </TouchableOpacity>
  );
}

function SectionHeader({ label, onSeeAll }: any) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.xl, marginBottom: 8 }}>
      <TText variant="body" weight="extraBold">{label}</TText>
      <TouchableOpacity onPress={onSeeAll}><TText variant="caption" weight="bold" color={paybidColors.primary.base}>Voir tout</TText></TouchableOpacity>
    </View>
  );
}

function EmptyRow({ text }: any) {
  return <View style={styles.empty}><TText variant="caption" color={paybidColors.neutrals.textTertiary}>{text}</TText></View>;
}

function DL({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: paybidColors.neutrals.border }}>
      <TText variant="caption" color={paybidColors.neutrals.textSecondary}>{label}</TText>
      <TText weight="semiBold" style={[{ flexShrink: 1, textAlign: "right", marginLeft: 8 }, mono ? { fontVariant: ["tabular-nums"] } : null]} numberOfLines={2}>{value}</TText>
    </View>
  );
}

const styles = StyleSheet.create({
  cashCard: { padding: spacing.lg, borderRadius: radii.xxl, marginBottom: spacing.md },
  // item 3 — boutons compacts
  row3: { flexDirection: "row", gap: 6, marginBottom: spacing.sm, marginTop: spacing.sm },
  colorBtn: { flex: 1, paddingVertical: 10, paddingHorizontal: 4, borderRadius: radii.lg, alignItems: "center", justifyContent: "center" },
  histRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, paddingHorizontal: 10, backgroundColor: paybidColors.neutrals.surface, borderRadius: radii.lg, marginBottom: 6, borderWidth: 1, borderColor: paybidColors.neutrals.border },
  histIcon: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  agencyContainer: { backgroundColor: paybidColors.neutrals.surface, padding: 12, borderRadius: radii.xl, borderWidth: 1, borderColor: paybidColors.neutrals.border },
  agencyBtn: { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: paybidColors.neutrals.border },
  agencyIcon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", padding: 20 },
  // item 5 — cashbox row
  cashboxRow: { flexDirection: "row", alignItems: "center", padding: 12, backgroundColor: paybidColors.neutrals.surface, borderRadius: radii.lg, marginBottom: 6, borderWidth: 1, borderColor: paybidColors.neutrals.border },
  cashboxIcon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  // modale détail
  detailIcon: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  modalOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: spacing.lg, zIndex: 99 },
  modalCard: { width: "100%", maxWidth: 420, backgroundColor: paybidColors.neutrals.surface, borderRadius: radii.xxl, padding: spacing.lg, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 10 },
});
