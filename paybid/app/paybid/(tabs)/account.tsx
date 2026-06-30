/**
 * /paybid/(tabs)/account.tsx — Tableau de bord financier agent
 * UI/UX professionnel premium — 4 KPI cards, alertes, modal encours, historique
 */
import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert, Modal, TextInput, ActivityIndicator, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { TText } from "../../../src/components/TText";
import { Button } from "../../../src/components/Button";
import { api, apiError } from "../../../src/api";
import { useAuth } from "../../../src/store";
import { paybidColors } from "../../../src/paybidTheme";
import { spacing, radii, shadows } from "../../../src/theme";
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
  // Indicateurs financiers
  const [kpi, setKpi] = useState({ gains: 0, capital: 0, a_verser: 0, encours: 0, currency: "XOF" });
  // Modal encours
  const [encoursModal, setEncoursModal] = useState(false);
  const [encoursList, setEncoursList] = useState<any[]>([]);
  const [encoursLoading, setEncoursLoading] = useState(false);
  const [newEncours, setNewEncours] = useState({ montant: "", motif: "", echeance: "" });
  const [encoursTab, setEncoursTab] = useState<"list"|"new">("list");

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
        api.get("/agent/dashboard").catch(() => ({ data: {} })),
      ];
      if (isSuperAgent) {
        promises.push(api.get("/agent/agency/cashboxes").catch(() => ({ data: { cashboxes: [], total_balance: 0 } })));
      }
      const [floatR, movR, opR, dashR, cashboxR] = await Promise.all(promises);
      const items = floatR.data?.items || [];
      const main = items[0] || { balance: 0, currency: "XOF" };
      setFloatData({
        balance: main.balance || 0,
        currency: main.currency || "XOF",
        agency_name: (user as any)?.agency_name || (isSuperAgent ? "Mon agence" : "Mon guichet"),
      });
      setMovements(movR.data?.items || []);
      setOperations(opR.data?.items || opR.data || []);
      // KPIs financiers depuis le dashboard
      const d = dashR.data?.stats || dashR.data || {};
      setKpi({
        gains: d.total_earnings_eur || d.month_earnings_eur || 0,
        capital: d.capital || d.float_balance || main.balance || 0,
        a_verser: d.a_verser_siege || d.pending_transfer_amount || 0,
        encours: d.encours_total || d.loan_balance || 0,
        currency: main.currency || "XOF",
      });
      if (cashboxR) {
        setCashboxes(cashboxR.data?.cashboxes || []);
        setCashboxesTotal(cashboxR.data?.total_balance || 0);
      }
    } catch {}
    finally { setRefreshing(false); }
  }, [user, isSuperAgent]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openEncoursModal = async () => {
    setEncoursModal(true);
    setEncoursLoading(true);
    try {
      const { data } = await api.get("/agent/encours").catch(() => ({ data: [] }));
      setEncoursList(Array.isArray(data) ? data : data.items || []);
    } finally { setEncoursLoading(false); }
  };

  const submitEncours = async () => {
    const val = parseFloat(newEncours.montant);
    if (!val || isNaN(val) || val <= 0) { Alert.alert("Montant invalide"); return; }
    if (!newEncours.motif.trim()) { Alert.alert("Motif requis"); return; }
    try {
      await api.post("/agent/encours", { amount: val, motif: newEncours.motif, echeance: newEncours.echeance });
      setNewEncours({ montant: "", motif: "", echeance: "" });
      setEncoursTab("list");
      openEncoursModal();
    } catch (e: any) { Alert.alert("Erreur", apiError(e)); }
  };

  const solderEncours = async (id: string, partial?: number) => {
    try {
      await api.post(`/agent/encours/${id}/solder`, partial ? { amount: partial } : {});
      openEncoursModal();
    } catch (e: any) { Alert.alert("Erreur", apiError(e)); }
  };

  // Alerte À Verser Siège
  const verserAlert = kpi.a_verser > 100000 ? "critical" : kpi.a_verser > 50000 ? "warning" : "ok";
  const verserColor = verserAlert === "critical" ? "#EF4444" : verserAlert === "warning" ? "#F59E0B" : "#10B981";

  return (
    <SafeAreaView style={styles.root} edges={["top","left","right"]}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={paybidColors.primary.base} />}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.pageHeader}>
          <View>
            <TText variant="title" weight="extraBold">Activités</TText>
            <TText variant="caption" color={paybidColors.neutrals.textSecondary}>Tableau de bord financier</TText>
          </View>
          <TouchableOpacity style={styles.historyBtn} onPress={() => router.push("/paybid/movements" as any)}>
            <Ionicons name="time-outline" size={18} color={paybidColors.primary.base} />
          </TouchableOpacity>
        </View>

        {/* ── Alerte À Verser Siège ── */}
        {verserAlert === "critical" && (
          <TouchableOpacity onPress={() => router.push("/paybid/float" as any)} style={[styles.alertBanner, { backgroundColor: "#FEE2E2", borderColor: "#EF4444" }]}>
            <View style={styles.alertIcon}><Ionicons name="warning" size={16} color="#EF4444" /></View>
            <TText variant="caption" weight="bold" color="#B91C1C" style={{ flex: 1, marginLeft: 10 }}>
              Versement siège CRITIQUE — risque de blocage. Régularisez immédiatement.
            </TText>
            <Ionicons name="chevron-forward" size={14} color="#EF4444" />
          </TouchableOpacity>
        )}
        {verserAlert === "warning" && (
          <TouchableOpacity onPress={() => router.push("/paybid/float" as any)} style={[styles.alertBanner, { backgroundColor: "#FEF3C7", borderColor: "#F59E0B" }]}>
            <View style={[styles.alertIcon, { backgroundColor: "#FDE68A" }]}><Ionicons name="alert-circle" size={16} color="#D97706" /></View>
            <TText variant="caption" weight="bold" color="#92400E" style={{ flex: 1, marginLeft: 10 }}>
              Montant à verser au siège élevé — pensez à régulariser.
            </TText>
            <Ionicons name="chevron-forward" size={14} color="#D97706" />
          </TouchableOpacity>
        )}

        {/* ── Carte solde principal ── */}
        <LinearGradient colors={["#3F1D0F", "#994A26"]} start={{x:0,y:0}} end={{x:1,y:1}} style={[styles.heroCard, shadows.lg]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <View>
              <TText variant="label" color="rgba(255,255,255,0.7)" style={{ letterSpacing: 1 }}>
                {isSuperAgent ? "TOTAL CAISSES" : "ESPÈCES EN CAISSE"}
              </TText>
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6, gap: 10 }}>
                <TText weight="extraBold" color="white" style={{ fontSize: 28 }} numberOfLines={1} adjustsFontSizeToFit>
                  {showBalance
                    ? formatMoney(isSuperAgent ? cashboxesTotal : floatData.balance, floatData.currency)
                    : "•••••• " + floatData.currency}
                </TText>
                <TouchableOpacity onPress={() => setShowBalance(v => !v)} hitSlop={10}>
                  <Ionicons name={showBalance ? "eye" : "eye-off"} size={18} color="rgba(255,255,255,0.8)" />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.heroAgencyBadge}>
              <Ionicons name="business" size={14} color="rgba(255,255,255,0.8)" />
              <TText variant="label" weight="bold" color="rgba(255,255,255,0.9)" style={{ marginLeft: 4 }}>
                {mainCtaTitle}
              </TText>
            </View>
          </View>
          <TText variant="label" color="rgba(255,255,255,0.55)" style={{ marginTop: 4 }}>
            ID : {(user as any)?.profile_id || ((user as any)?.id?.slice(0,8)) || "—"}
          </TText>
        </LinearGradient>

        {/* ── 2 boutons rapides ── */}
        <View style={styles.actionRow}>
          <QuickBtn icon="arrow-up-circle-outline" label="Retirer" color="#10B981" bg="#D1FAE5"
            onPress={() => router.push("/paybid/cashout" as any)} />
          <QuickBtn icon="add-circle-outline" label="Recharger" color="#3B82F6" bg="#DBEAFE"
            onPress={() => router.push("/paybid/cash-recharge" as any)} />
          <QuickBtn icon="qr-code-outline" label="Scanner QR" color="#6366F1" bg="#EEF2FF"
            onPress={() => router.push("/paybid/scan" as any)} />
        </View>

        {/* ── 4 KPI cards ── */}
        <View style={styles.kpiGrid}>
          <KpiCard icon="trending-up" label="GAINS" value={formatMoney(kpi.gains, "EUR")} color="#10B981" bg="#D1FAE5" />
          <KpiCard icon="wallet-outline" label="CAPITAL" value={formatMoney(kpi.capital, kpi.currency)} color="#3B82F6" bg="#DBEAFE" />
          <KpiCard icon="arrow-up-circle-outline" label="À VERSER SIÈGE" value={formatMoney(kpi.a_verser, kpi.currency)} color={verserColor} bg={verserAlert==="critical"?"#FEE2E2":verserAlert==="warning"?"#FEF3C7":"#D1FAE5"}
            onPress={() => router.push("/paybid/float" as any)} badge={verserAlert !== "ok" ? verserColor : undefined} hint="Tap → Gestion float" />
          <KpiCard icon="card-outline" label="ENCOURS" value={formatMoney(kpi.encours, "EUR")} color="#F59E0B" bg="#FEF3C7"
            onPress={openEncoursModal} />
        </View>

        {/* ── Caisses super-agent ── */}
        {isSuperAgent && cashboxes.length > 0 && (
          <View style={{ marginBottom: spacing.md }}>
            <SectionHeader label="Mes caisses" onSeeAll={() => {}} />
            {cashboxes.map((cb: any, idx: number) => (
              <TouchableOpacity key={cb.id} onPress={() => router.push(`/paybid/cashbox/${cb.id}` as any)} style={styles.listRow} activeOpacity={0.7}>
                <View style={[styles.rowIconBox, { backgroundColor: cb.available ? "#D1FAE5" : "#F3F4F6" }]}>
                  <Ionicons name="cube" size={16} color={cb.available ? "#10B981" : "#9CA3AF"} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <TText weight="semiBold">{cb.label || `Caisse ${String(idx+1).padStart(2,"0")}`}</TText>
                  <TText variant="caption" color={paybidColors.neutrals.textSecondary}>{cb.city || "—"}</TText>
                </View>
                <TText weight="bold">{formatMoney(cb.balance||0, cb.currency||floatData.currency)}</TText>
                <Ionicons name="chevron-forward" size={14} color={paybidColors.neutrals.textTertiary} style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── Opérations en caisse ── */}
        <SectionHeader label="Opérations en caisse" />
        <View style={styles.opsGrid}>
          <OpsBtn icon="arrow-down-circle" color="#10B981" label="Encaisser" onPress={() => router.push("/paybid/agency/cashin" as any)} />
          <OpsBtn icon="arrow-up-circle" color="#EF4444" label="Décaisser" onPress={() => router.push("/paybid/agency/cashout" as any)} />
          <OpsBtn icon="paper-plane" color="#3B82F6" label="Transferts" onPress={() => router.push("/paybid/(tabs)/transfers" as any)} />
          <OpsBtn icon="document-text" color="#6366F1" label="Déclarer" onPress={() => router.push("/paybid/cash" as any)} />
        </View>

        {/* ── Mouvements récents ── */}
        <SectionHeader label="Mouvements récents" onSeeAll={() => router.push("/paybid/movements" as any)} />
        {movements.length === 0
          ? <EmptyState icon="swap-vertical-outline" text="Aucun mouvement récent" />
          : movements.slice(0,5).map((m: any) => {
              const sign = Number(m.amount_signed || m.amount || 0);
              return (
                <TouchableOpacity key={m.id || Math.random()} onPress={() => setDetail(m)} style={styles.listRow} activeOpacity={0.7}>
                  <View style={[styles.rowIconBox, { backgroundColor: sign>=0?"#D1FAE5":"#FEE2E2" }]}>
                    <Ionicons name={sign>=0?"arrow-down":"arrow-up"} size={16} color={sign>=0?"#10B981":"#EF4444"} />
                  </View>
                  <View style={{ flex:1, marginLeft:12 }}>
                    <TText weight="semiBold" style={{ textTransform:"capitalize" }} numberOfLines={1}>
                      {(m.type||m.movement_type||"—").replace(/_/g," ")}
                    </TText>
                    <TText variant="caption" color={paybidColors.neutrals.textSecondary}>
                      {m.created_at ? new Date(m.created_at).toLocaleString("fr-FR",{dateStyle:"short",timeStyle:"short"}) : ""}
                    </TText>
                  </View>
                  <TText weight="bold" color={sign>=0?"#10B981":"#EF4444"}>
                    {sign>=0?"+":""}{formatMoney(Math.abs(sign), m.currency||floatData.currency)}
                  </TText>
                  <Ionicons name="chevron-forward" size={14} color={paybidColors.neutrals.textTertiary} style={{ marginLeft:6 }} />
                </TouchableOpacity>
              );
            })
        }

        {/* ── Missions récentes ── */}
        <SectionHeader label="Dernières missions" onSeeAll={() => router.push("/paybid/(tabs)/transfers" as any)} />
        {operations.length === 0
          ? <EmptyState icon="paper-plane-outline" text="Aucune mission récente" />
          : operations.slice(0,5).map((op: any) => (
            <TouchableOpacity key={op.id||Math.random()} onPress={() => router.push(`/paybid/transfer/${op.id}` as any)} style={styles.listRow} activeOpacity={0.7}>
              <View style={[styles.rowIconBox, { backgroundColor: paybidColors.overlays.primarySoft }]}>
                <Ionicons name="paper-plane" size={16} color={paybidColors.primary.base} />
              </View>
              <View style={{ flex:1, marginLeft:12 }}>
                <TText weight="semiBold" numberOfLines={1}>{op.beneficiary?.full_name || "Bénéficiaire"}</TText>
                <TText variant="caption" color={paybidColors.neutrals.textSecondary}>
                  {op.status||"—"} · {op.created_at ? new Date(op.created_at).toLocaleDateString("fr-FR") : ""}
                </TText>
              </View>
              <TText weight="bold" color={paybidColors.primary.base}>
                +{formatMoney(op.agent_commission||0,"EUR")}
              </TText>
              <Ionicons name="chevron-forward" size={14} color={paybidColors.neutrals.textTertiary} style={{ marginLeft:6 }} />
            </TouchableOpacity>
          ))
        }
      </ScrollView>

      {/* ── Modal détail mouvement ── */}
      <Modal visible={!!detail} transparent animationType="fade" onRequestClose={() => setDetail(null)}>
        <View style={styles.modalBg}>
          <View style={styles.detailSheet}>
            <View style={{ flexDirection:"row", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <TText variant="subtitle" weight="bold">Détail</TText>
              <TouchableOpacity onPress={() => setDetail(null)} style={styles.closeBtn}>
                <Ionicons name="close" size={18} color={paybidColors.neutrals.textPrimary} />
              </TouchableOpacity>
            </View>
            {detail && <>
              <View style={[styles.detailAmtBox, { backgroundColor: Number(detail.amount_signed??0)>=0?"#D1FAE5":"#FEE2E2" }]}>
                <Ionicons name={Number(detail.amount_signed??0)>=0?"arrow-down":"arrow-up"} size={24} color={Number(detail.amount_signed??0)>=0?"#10B981":"#EF4444"} />
                <TText weight="extraBold" style={{ fontSize:22, marginLeft:8 }} color={Number(detail.amount_signed??0)>=0?"#10B981":"#EF4444"}>
                  {Number(detail.amount_signed??0)>=0?"+":""}{formatMoney(Math.abs(Number(detail.amount_signed??detail.amount??0)), detail.currency||floatData.currency)}
                </TText>
              </View>
              <DL label="Type" value={(detail.type||detail.movement_type||"—").replace(/_/g," ")} />
              <DL label="Date" value={detail.created_at ? new Date(detail.created_at).toLocaleString("fr-FR",{dateStyle:"long",timeStyle:"short"}) : "—"} />
              <DL label="Devise" value={detail.currency||"—"} />
              {detail.reference && <DL label="Référence" value={detail.reference} mono />}
              {detail.note && <DL label="Note" value={detail.note} />}
              <DL label="ID" value={detail.id||"—"} mono />
            </>}
            <Button title="Fermer" onPress={() => setDetail(null)} style={{ marginTop:16, backgroundColor:paybidColors.primary.base }} />
          </View>
        </View>
      </Modal>

      {/* ── Modal Encours ── */}
      <Modal visible={encoursModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEncoursModal(false)}>
        <SafeAreaView style={{ flex:1, backgroundColor:paybidColors.neutrals.background }}>
          <View style={styles.sheetHeader}>
            <TouchableOpacity onPress={() => setEncoursModal(false)} style={styles.closeBtn}>
              <Ionicons name="close" size={18} color={paybidColors.neutrals.textPrimary} />
            </TouchableOpacity>
            <TText variant="subtitle" weight="bold">Gestion des encours</TText>
            <View style={{ width:32 }} />
          </View>
          <View style={{ flexDirection:"row", padding:spacing.md, gap:8 }}>
            {(["list","new"] as const).map(tab => (
              <TouchableOpacity key={tab} onPress={() => setEncoursTab(tab)}
                style={[styles.segBtn, encoursTab===tab && { backgroundColor:paybidColors.primary.base, borderColor:paybidColors.primary.base }]}>
                <TText weight="bold" color={encoursTab===tab?"white":paybidColors.neutrals.textSecondary}>
                  {tab==="list"?"Mes encours":"Nouvel encours"}
                </TText>
              </TouchableOpacity>
            ))}
          </View>
          <ScrollView contentContainerStyle={{ padding:spacing.lg }}>
            {encoursTab==="list" ? (
              encoursLoading ? <ActivityIndicator color={paybidColors.primary.base} style={{ marginTop:40 }} /> :
              encoursList.length===0 ? (
                <EmptyState icon="checkmark-circle-outline" text="Aucun encours actif" />
              ) : encoursList.map((enc:any) => (
                <View key={enc.id} style={styles.encoursCard}>
                  <View style={{ flex:1 }}>
                    <TText weight="bold">{enc.motif||"Encours"}</TText>
                    <TText variant="caption" color={paybidColors.neutrals.textSecondary}>
                      Échéance : {enc.echeance ? new Date(enc.echeance).toLocaleDateString("fr-FR") : "—"}
                    </TText>
                    <View style={[styles.statusPill, { backgroundColor: enc.statut==="en_cours"?"#FEF3C7":"#D1FAE5" }]}>
                      <TText variant="label" weight="bold" color={enc.statut==="en_cours"?"#D97706":"#059669"}>
                        {enc.statut==="en_cours"?"En cours":"Soldé"}
                      </TText>
                    </View>
                  </View>
                  <View style={{ alignItems:"flex-end" }}>
                    <TText weight="extraBold" color="#EF4444">{formatMoney(enc.amount||0,"EUR")}</TText>
                    {enc.statut==="en_cours" && (
                      <TouchableOpacity onPress={() => solderEncours(enc.id)} style={styles.solderBtn}>
                        <TText variant="label" weight="bold" color="white">Solder</TText>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))
            ) : (
              <View style={{ gap:16 }}>
                <InputField label="Montant (EUR)" placeholder="Ex: 500" keyboardType="decimal-pad"
                  value={newEncours.montant} onChangeText={v => setNewEncours(p=>({...p,montant:v}))} />
                <InputField label="Motif" placeholder="Ex: Achat de liquidités"
                  value={newEncours.motif} onChangeText={v => setNewEncours(p=>({...p,motif:v}))} />
                <InputField label="Date d'échéance (JJ/MM/AAAA)" placeholder="Ex: 31/12/2025"
                  value={newEncours.echeance} onChangeText={v => setNewEncours(p=>({...p,echeance:v}))} />
                <Button title="Créer l'encours" onPress={submitEncours} style={{ backgroundColor:paybidColors.primary.base }} />
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function QuickBtn({ icon, label, color, bg, onPress }: any) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.quickBtn} activeOpacity={0.75}>
      <View style={[styles.quickIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <TText variant="label" weight="semiBold" align="center" style={{ marginTop: 6, fontSize: 11 }} numberOfLines={2}>{label}</TText>
    </TouchableOpacity>
  );
}

function KpiCard({ icon, label, value, color, bg, onPress, badge, hint }: any) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={onPress ? 0.75 : 1} style={styles.kpiCard}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View style={[styles.kpiIconBox, { backgroundColor: bg }]}>
          <Ionicons name={icon} size={16} color={color} />
        </View>
        {badge && <View style={[styles.kpiBadge, { backgroundColor: badge, position: "relative", top: 0, right: 0 }]} />}
        {onPress && <Ionicons name="chevron-forward" size={12} color={paybidColors.neutrals.textTertiary} />}
      </View>
      <TText variant="label" color={paybidColors.neutrals.textSecondary} style={{ marginTop: 8, fontSize: 10, letterSpacing: 0.5 }}>{label}</TText>
      <TText weight="extraBold" color={color} style={{ fontSize: 13, marginTop: 2 }} numberOfLines={1} adjustsFontSizeToFit>{value}</TText>
      {hint && <TText variant="label" color={paybidColors.neutrals.textTertiary} style={{ fontSize: 9, marginTop: 2 }}>{hint}</TText>}
    </TouchableOpacity>
  );
}

function OpsBtn({ icon, color, label, onPress }: any) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.opsBtn} activeOpacity={0.75}>
      <View style={[styles.opsIcon, { backgroundColor: color + "18" }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <TText variant="label" weight="semiBold" align="center" style={{ marginTop: 5, fontSize: 11 }} numberOfLines={2}>{label}</TText>
    </TouchableOpacity>
  );
}

function SectionHeader({ label, onSeeAll }: any) {
  return (
    <View style={styles.sectionHeader}>
      <TText variant="body" weight="extraBold">{label}</TText>
      {onSeeAll && (
        <TouchableOpacity onPress={onSeeAll} style={styles.seeAllBtn}>
          <TText variant="label" weight="bold" color={paybidColors.primary.base}>Voir tout</TText>
          <Ionicons name="chevron-forward" size={12} color={paybidColors.primary.base} style={{ marginLeft: 2 }} />
        </TouchableOpacity>
      )}
    </View>
  );
}

function EmptyState({ icon, text }: any) {
  return (
    <View style={styles.emptyBox}>
      <Ionicons name={icon} size={32} color={paybidColors.neutrals.textTertiary} />
      <TText variant="caption" color={paybidColors.neutrals.textSecondary} style={{ marginTop: 8 }}>{text}</TText>
    </View>
  );
}

function InputField({ label, ...props }: any) {
  return (
    <View>
      <TText variant="caption" weight="semiBold" color={paybidColors.neutrals.textSecondary} style={{ marginBottom: 6 }}>{label}</TText>
      <TextInput style={styles.inputField} placeholderTextColor={paybidColors.neutrals.textTertiary} {...props} />
    </View>
  );
}

function DL({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.dlRow}>
      <TText variant="caption" color={paybidColors.neutrals.textSecondary}>{label}</TText>
      <TText weight="semiBold" style={[styles.dlValue, mono ? { fontVariant: ["tabular-nums"] } : null]} numberOfLines={2}>{value}</TText>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: paybidColors.neutrals.background },
  scroll: { padding: spacing.lg, paddingBottom: 40 },

  // Header
  pageHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  historyBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: paybidColors.neutrals.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: paybidColors.neutrals.border },

  // Alert banner
  alertBanner: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: radii.xl, borderWidth: 1, marginBottom: spacing.sm },
  alertIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#FEE2E2", alignItems: "center", justifyContent: "center" },

  // Hero card (solde)
  heroCard: { borderRadius: radii.xxl, padding: spacing.lg, marginBottom: spacing.md },
  heroAgencyBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.15)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },

  // 3 boutons rapides
  actionRow: { flexDirection: "row", gap: 8, marginBottom: spacing.lg },
  quickBtn: { flex: 1, alignItems: "center", paddingVertical: 12, backgroundColor: paybidColors.neutrals.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: paybidColors.neutrals.border },
  quickIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },

  // 4 KPI cards
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: spacing.lg },
  kpiCard: { width: "47.5%", backgroundColor: paybidColors.neutrals.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: paybidColors.neutrals.border, padding: 14 },
  kpiIconBox: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  kpiBadge: { width: 8, height: 8, borderRadius: 4 },

  // Ops grid (4 boutons caisse)
  opsGrid: { flexDirection: "row", gap: 8, marginBottom: spacing.md },
  opsBtn: { flex: 1, alignItems: "center", paddingVertical: 14, backgroundColor: paybidColors.neutrals.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: paybidColors.neutrals.border },
  opsIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },

  // Listes
  listRow: { flexDirection: "row", alignItems: "center", padding: 12, backgroundColor: paybidColors.neutrals.surface, borderRadius: radii.xl, marginBottom: 8, borderWidth: 1, borderColor: paybidColors.neutrals.border },
  rowIconBox: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },

  // Section header
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.xl, marginBottom: 10 },
  seeAllBtn: { flexDirection: "row", alignItems: "center" },

  // Empty
  emptyBox: { alignItems: "center", padding: 28, backgroundColor: paybidColors.neutrals.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: paybidColors.neutrals.border, marginBottom: 8 },

  // Modales
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", alignItems: "center", padding: spacing.lg },
  detailSheet: { width: "100%", maxWidth: 420, backgroundColor: paybidColors.neutrals.surface, borderRadius: radii.xxl, padding: spacing.lg },
  detailAmtBox: { flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 16, borderRadius: radii.xl, marginBottom: 16 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: paybidColors.neutrals.border, alignItems: "center", justifyContent: "center" },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: paybidColors.neutrals.border },

  // Encours
  segBtn: { flex: 1, paddingVertical: 9, borderRadius: radii.lg, alignItems: "center", backgroundColor: paybidColors.neutrals.surface, borderWidth: 1, borderColor: paybidColors.neutrals.border },
  encoursCard: { flexDirection: "row", backgroundColor: paybidColors.neutrals.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: paybidColors.neutrals.border, padding: 14, marginBottom: 10 },
  statusPill: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, marginTop: 6 },
  solderBtn: { marginTop: 8, backgroundColor: "#EF4444", paddingVertical: 6, paddingHorizontal: 14, borderRadius: radii.lg },
  inputField: { backgroundColor: paybidColors.neutrals.background, borderRadius: radii.lg, borderWidth: 1, borderColor: paybidColors.neutrals.border, paddingHorizontal: 14, paddingVertical: 13, color: paybidColors.neutrals.textPrimary, fontSize: 15 },

  // DL row
  dlRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: paybidColors.neutrals.border },
  dlValue: { flexShrink: 1, textAlign: "right", marginLeft: 12 },
});
