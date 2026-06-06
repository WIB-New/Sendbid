/**
 * /paybid/(tabs)/account.tsx — "Mon compte"
 *
 * Conforme à la demande utilisateur (item 6) :
 *   - Titre + CTA Caisse (agence, profil ID, espèces en caisse + œil mask/show)
 *   - 3 boutons : Retirer mes gains / Recharger ma caisse / Mon encours
 *   - Section "Mes mouvements" (5 derniers + Voir tout)
 *   - Conteneur 4 boutons agence : Encaisser / Décaisser / Verser au siège / Déclarer espèces
 *   - Section "Mes opérations" (5 dernières + Voir tout)
 *   - (Super-agent only) Opérations de l'agence
 */
import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import { TText } from "../../../src/components/TText";
import { api } from "../../../src/api";
import { useAuth } from "../../../src/store";
import { paybidColors } from "../../../src/paybidTheme";
import { spacing, radii } from "../../../src/theme";

export default function PaybidAccount() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const [refreshing, setRefreshing] = useState(false);
  const [showBalance, setShowBalance] = useState(true);
  const [floatData, setFloatData] = useState<any>({ balance: 0, currency: "XOF", agency_name: "—" });
  const [movements, setMovements] = useState<any[]>([]);
  const [operations, setOperations] = useState<any[]>([]);

  const isSuperAgent = (user as any)?.role === "super_agent" || (user as any)?.role === "agency_manager";

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [floatR, movR, opR] = await Promise.all([
        api.get("/agent/float"),
        api.get("/agent/float/movements?limit=5"),
        api.get("/agent/transfers?limit=5").catch(() => ({ data: { items: [] } })),
      ]);
      const items = floatR.data?.items || [];
      const main = items[0] || { balance: 0, currency: "XOF" };
      setFloatData({
        balance: main.balance || 0,
        currency: main.currency || "XOF",
        agency_name: (user as any)?.agency_name || "Mon agence",
      });
      setMovements(movR.data?.items || []);
      setOperations(opR.data?.items || opR.data || []);
    } catch {}
    finally { setRefreshing(false); }
  }, [user]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onLoanRequest = () => {
    Alert.alert(
      "Demander un encours",
      "Une facilité de caisse vous sera proposée si vous êtes éligible (ancienneté, score, historique, performances). Continuer ?",
      [
        { text: "Annuler", style: "cancel" },
        { text: "Vérifier mon éligibilité", onPress: () => router.push("/paybid/loan-request" as any) },
      ]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: paybidColors.neutrals.background }} edges={["top", "left", "right"]}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />} contentContainerStyle={{ padding: spacing.lg }}>
        <TText variant="title" weight="extraBold" style={{ marginBottom: spacing.md }}>Mon compte</TText>

        {/* CTA Caisse */}
        <LinearGradient colors={paybidColors.gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cashCard}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <TText variant="caption" weight="extraBold" color="white">{floatData.agency_name}</TText>
            <TText variant="caption" color="rgba(255,255,255,0.78)">ID: {(user as any)?.profile_id || (user as any)?.id?.slice(0, 8) || "—"}</TText>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 16 }}>
            <TText variant="caption" weight="bold" color="rgba(255,255,255,0.78)" style={{ letterSpacing: 1 }}>ESPÈCES EN CAISSE</TText>
            <TouchableOpacity onPress={() => setShowBalance((v) => !v)} style={{ marginLeft: 8 }}>
              <Ionicons name={showBalance ? "eye" : "eye-off"} size={16} color="rgba(255,255,255,0.78)" />
            </TouchableOpacity>
          </View>
          <TText weight="extraBold" color="white" style={{ fontSize: 36, marginTop: 4 }}>
            {showBalance ? `${Number(floatData.balance).toFixed(2)} ${floatData.currency}` : "•••••• " + floatData.currency}
          </TText>
        </LinearGradient>

        {/* 3 boutons colorés */}
        <View style={styles.row3}>
          <ColorBtn icon="cash-outline" color="#10B981" label="Retirer mes gains" onPress={() => router.push("/paybid/earnings" as any)} />
          <ColorBtn icon="add-circle" color="#022a6b" label="Recharger ma caisse" onPress={() => router.push("/paybid/cash-recharge" as any)} />
          <ColorBtn icon="card-outline" color="#F59E0B" label="Mon encours" onPress={onLoanRequest} />
        </View>

        {/* Mes mouvements */}
        <SectionHeader label="Mes mouvements" onSeeAll={() => router.push("/paybid/movements" as any)} />
        {movements.length === 0 ? <EmptyRow text="Aucun mouvement récent" /> : movements.slice(0, 5).map((m: any) => (
          <View key={m.id || Math.random()} style={styles.histRow}>
            <View style={[styles.histIcon, { backgroundColor: (m.amount_signed || 0) >= 0 ? "#ECFDF5" : "#FEF2F2" }]}>
              <Ionicons name={(m.amount_signed || 0) >= 0 ? "arrow-down" : "arrow-up"} size={16} color={(m.amount_signed || 0) >= 0 ? "#10B981" : "#EF4444"} />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <TText weight="semiBold" style={{ textTransform: "capitalize" }}>{(m.type || m.movement_type || "—").replace(/_/g, " ")}</TText>
              <TText variant="caption" color={paybidColors.neutrals.textSecondary}>{m.created_at ? new Date(m.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : ""}</TText>
            </View>
            <TText weight="extraBold" color={(m.amount_signed || 0) >= 0 ? "#10B981" : "#EF4444"}>
              {(m.amount_signed || 0) >= 0 ? "+" : ""}{Number(m.amount_signed || 0).toFixed(2)} {m.currency || floatData.currency}
            </TText>
          </View>
        ))}

        {/* Conteneur opérations agence */}
        <TText variant="body" weight="extraBold" style={{ marginTop: spacing.xl, marginBottom: 8 }}>Opérations en agence</TText>
        <View style={styles.agencyContainer}>
          <AgencyBtn icon="arrow-down-circle" color="#10B981" label="Encaisser" hint="Recharger un compte client" onPress={() => router.push("/paybid/agency/cashin" as any)} />
          <AgencyBtn icon="arrow-up-circle" color="#EF4444" label="Décaisser" hint="Payer retrait ou transfert" onPress={() => router.push("/paybid/agency/cashout" as any)} />
          <AgencyBtn icon="business" color="#F59E0B" label="Verser au siège" hint="Reverser le float" onPress={() => router.push("/paybid/float" as any)} />
          <AgencyBtn icon="document-text" color="#022a6b" label="Déclarer espèces" hint="Nouvelle entrée caisse" onPress={() => router.push("/paybid/cash" as any)} />
        </View>

        {/* Mes opérations */}
        <SectionHeader label="Mes opérations" onSeeAll={() => router.push("/paybid/(tabs)/transfers" as any)} />
        {operations.length === 0 ? <EmptyRow text="Aucune opération récente" /> : operations.slice(0, 5).map((op: any) => (
          <TouchableOpacity key={op.id || op._id || Math.random()} onPress={() => router.push(`/paybid/transfer/${op.id}` as any)} style={styles.histRow}>
            <View style={[styles.histIcon, { backgroundColor: "#EFE0D2" }]}>
              <Ionicons name="paper-plane" size={16} color={paybidColors.primary.base} />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <TText weight="semiBold">{op.beneficiary?.full_name || "Bénéficiaire"}</TText>
              <TText variant="caption" color={paybidColors.neutrals.textSecondary}>{op.status || "—"} · {op.created_at ? new Date(op.created_at).toLocaleDateString("fr-FR") : ""}</TText>
            </View>
            <TText weight="extraBold" color={paybidColors.primary.base}>+{Number(op.agent_commission || 0).toFixed(2)} EUR</TText>
          </TouchableOpacity>
        ))}

        {/* Opérations de l'agence (super-agent only) */}
        {isSuperAgent ? (
          <>
            <SectionHeader label="Opérations de l'agence" onSeeAll={() => router.push("/paybid/agency-ops" as any)} />
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={36} color={paybidColors.neutrals.textTertiary} />
              <TText variant="caption" color={paybidColors.neutrals.textSecondary} style={{ marginTop: 6 }}>Vue consolidée bientôt disponible</TText>
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function ColorBtn({ icon, color, label, onPress }: any) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.colorBtn, { backgroundColor: color }]} activeOpacity={0.85}>
      <Ionicons name={icon} size={22} color="white" />
      <TText variant="caption" weight="extraBold" color="white" align="center" style={{ marginTop: 6 }} numberOfLines={2}>{label}</TText>
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

const styles = StyleSheet.create({
  cashCard: { padding: spacing.lg, borderRadius: radii.xxl, marginBottom: spacing.md },
  row3: { flexDirection: "row", gap: 8, marginBottom: spacing.sm },
  colorBtn: { flex: 1, paddingVertical: 14, borderRadius: radii.xl, alignItems: "center", justifyContent: "center" },
  histRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 12, backgroundColor: paybidColors.neutrals.surface, borderRadius: radii.lg, marginBottom: 6, borderWidth: 1, borderColor: paybidColors.neutrals.border },
  histIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  agencyContainer: { backgroundColor: paybidColors.neutrals.surface, padding: 12, borderRadius: radii.xl, borderWidth: 1, borderColor: paybidColors.neutrals.border },
  agencyBtn: { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: paybidColors.neutrals.border },
  agencyIcon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", padding: 20 },
});
