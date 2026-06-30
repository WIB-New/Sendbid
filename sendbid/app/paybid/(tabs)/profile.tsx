import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, TextInput, Modal, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { TText } from "../../../src/components/TText";
import { Button } from "../../../src/components/Button";
import { api, apiError } from "../../../src/api";
import { useAuth } from "../../../src/store";
import { paybidColors } from "../../../src/paybidTheme";
import { spacing, radii } from "../../../src/theme";
import { useTranslation } from "../../../src/i18n";

export default function PaybidProfile() {
  const { t } = useTranslation();
  const router = useRouter();
  const logoutStore = useAuth((s) => s.logout);
  const [me, setMe] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [editOpen, setEditOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [editFields, setEditFields] = useState<any>({});
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.get("/agent/me");
      setMe(r.data);
    } catch (e: any) {
      setError(apiError(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const logout = async () => {
    Alert.alert("Se déconnecter", "Voulez-vous vraiment quitter PAYBID ?", [
      { text: "Annuler" },
      { text: "Se déconnecter", style: "destructive", onPress: async () => {
        await logoutStore();
        router.replace("/paybid/login" as any);
      }},
    ]);
  };

  const openEdit = () => {
    const { agent, user } = me || {};
    setEditFields({
      full_name: agent?.full_name || "",
      phone: user?.phone || "",
      city: agent?.city || "",
      address: agent?.address || "",
    });
    setEditOpen(true);
  };

  const saveProfile = async () => {
    setBusy(true);
    try {
      await api.patch("/agent/profile", editFields);
      Alert.alert("Profil mis à jour");
      setEditOpen(false);
      load();
    } catch (e: any) { Alert.alert("Erreur", apiError(e)); }
    finally { setBusy(false); }
  };

  const changePassword = async () => {
    if (!newPwd || newPwd.length < 6) { Alert.alert("Erreur", "Minimum 6 caractères"); return; }
    setBusy(true);
    try {
      await api.post("/agent/change-password", { old_password: oldPwd, new_password: newPwd });
      Alert.alert("Mot de passe modifié");
      setPwdOpen(false); setOldPwd(""); setNewPwd("");
    } catch (e: any) { Alert.alert("Erreur", apiError(e)); }
    finally { setBusy(false); }
  };

  const toggleAvailability = async (val: boolean) => {
    try {
      await api.post("/agent/availability", { available: val });
      load();
    } catch {}
  };

  if (loading) return (
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: paybidColors.neutrals.background }}>
      <View style={styles.center}><ActivityIndicator size="large" color={paybidColors.primary.base} /></View>
    </SafeAreaView>
  );

  if (error || !me) return (
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: paybidColors.neutrals.background }}>
      <View style={styles.center}>
        <Ionicons name="cloud-offline-outline" size={48} color={paybidColors.status.error} />
        <TText style={{ marginTop: 16, marginBottom: 24 }} color={paybidColors.neutrals.textSecondary}>{error || "Impossible de charger votre profil"}</TText>
        <Button title="Réessayer" onPress={() => load()} style={{ backgroundColor: paybidColors.primary.base }} />
      </View>
    </SafeAreaView>
  );

  const { user, agent, wallet } = me;
  const initials = (agent.full_name || "A").split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: paybidColors.neutrals.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}>
        {/* Header card */}
        <View style={styles.head}>
          <View style={styles.avatarCircle}>
            <TText style={{ fontSize: 28, fontWeight: "800", color: "white" }}>{initials}</TText>
          </View>
          <TText variant="title" weight="extraBold" style={{ marginTop: spacing.sm }}>{agent.full_name}</TText>
          <TText variant="caption" color={paybidColors.neutrals.textSecondary}>{user.email}</TText>
          <TText variant="label" color={paybidColors.neutrals.textTertiary}>{agent.city} · ID: {user.profile_id}</TText>
          <View style={styles.statsRow}>
            <StatBadge icon="star" label="Note" value={`${(agent.rating || 0).toFixed(1)}`} color="#F59E0B" />
            <StatBadge icon="checkmark-done" label="Missions" value={`${agent.transfers_count || agent.total_transfers || 0}`} color="#10B981" />
            <StatBadge icon="shield-checkmark" label="KYC" value={`Tier ${agent.kyc_tier || 1}`} color="#2563EB" />
          </View>
        </View>

        {/* Compte */}
        <Section title="Mon compte">
          <Row icon="wallet-outline" label="Solde wallet" value={`${Number(wallet?.balance || 0).toFixed(2)} ${wallet?.currency || "EUR"}`} />
          <Row icon="call-outline" label="Téléphone" value={user.phone || "Non renseigné"} warn={!user.phone} />
          <Row icon="mail-outline" label="Email" value={user.email || "—"} />
          <Row icon="location-outline" label="Ville" value={agent.city || "Non renseignée"} warn={!agent.city} />
          <Row icon="home-outline" label="Adresse" value={agent.address || "Non renseignée"} warn={!agent.address} />
          <Row icon="bicycle-outline" label="Modes de remise" value={(agent.delivery_modes || []).length > 0 ? (agent.delivery_modes || []).join(", ").toUpperCase() : "Non configurés"} warn={!(agent.delivery_modes || []).length} />
          <Row icon="globe-outline" label="Pays" value={agent.country || "—"} />
          <View style={styles.rowSwitch}>
            <Ionicons name="radio-outline" size={18} color={agent.available ? "#10B981" : paybidColors.neutrals.textTertiary} />
            <TText weight="semiBold" style={{ flex: 1, marginLeft: 10 }}>Disponibilité</TText>
            <Switch value={agent.available !== false} onValueChange={toggleAvailability} thumbColor="white" trackColor={{ true: "#10B981", false: "#D1D5DB" }} />
          </View>
        </Section>

        {/* Alerte compléter profil */}
        {(!agent.address || !(agent.delivery_modes || []).length) ? (
          <TouchableOpacity style={styles.completeAlert} onPress={openEdit} activeOpacity={0.7}>
            <Ionicons name="alert-circle" size={20} color="#F59E0B" />
            <TText variant="caption" weight="bold" style={{ marginLeft: 8, flex: 1, color: "#92400E" }}>
              Complétez votre profil pour recevoir plus de missions
            </TText>
            <Ionicons name="chevron-forward" size={16} color="#F59E0B" />
          </TouchableOpacity>
        ) : null}

        {/* Actions profil */}
        <Section title="Modifier">
          <MenuRow icon="create-outline" label="Modifier mes informations" onPress={openEdit} />
          <MenuRow icon="camera-outline" label="Changer ma photo de profil" onPress={() => Alert.alert("Photo", "Fonctionnalité disponible dans la prochaine version.")} />
        </Section>

        {/* Sécurité */}
        <Section title="Sécurité">
          <MenuRow icon="lock-closed-outline" label="Changer mon mot de passe" onPress={() => setPwdOpen(true)} />
          <MenuRow icon="finger-print-outline" label="Authentification biométrique" onPress={() => Alert.alert("Biométrie", "Activation disponible prochainement.")} />
          <MenuRow icon="key-outline" label="Code PIN de retrait" onPress={() => Alert.alert("PIN", "Gestion du code PIN disponible prochainement.")} />
        </Section>

        {/* Finance */}
        <Section title="Finance">
          <MenuRow icon="trending-up-outline" label="Mes gains" onPress={() => router.push("/paybid/(tabs)/earnings" as any)} />
          <MenuRow icon="arrow-up-circle-outline" label="Retirer mes gains" onPress={() => router.push("/paybid/cashout" as any)} />
          <MenuRow icon="card-outline" label="Gérer ma caisse (float)" onPress={() => router.push("/paybid/float" as any)} />
        </Section>

        {/* Support */}
        <Section title="Aide & Support">
          <MenuRow icon="chatbubbles-outline" label="Contacter le support" onPress={() => Alert.alert("Support", "Écrivez-nous à support@sendbid.com ou via le chat.")} />
          <MenuRow icon="document-text-outline" label="Conditions d'utilisation" onPress={() => Alert.alert("CGU", "Disponibles sur sendbid.com/cgu")} />
          <MenuRow icon="information-circle-outline" label="À propos de PAYBID" onPress={() => Alert.alert("PAYBID", "Version 5.0 · Réseau d'agents de paiement SENDBID.")} />
        </Section>

        {/* Déconnexion */}
        <TouchableOpacity style={styles.logoutBtn} onPress={logout} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={20} color={paybidColors.status.error} />
          <TText weight="bold" style={{ marginLeft: 10, color: paybidColors.status.error }}>Se déconnecter</TText>
        </TouchableOpacity>
      </ScrollView>

      {/* Modal — Modifier infos */}
      <Modal visible={editOpen} transparent animationType="slide" onRequestClose={() => setEditOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <TText weight="extraBold" style={{ fontSize: 18 }}>Modifier mes infos</TText>
              <TouchableOpacity onPress={() => setEditOpen(false)}><Ionicons name="close-circle" size={28} color={paybidColors.neutrals.textTertiary} /></TouchableOpacity>
            </View>
            <Field label="Nom complet" value={editFields.full_name} onChange={(v: string) => setEditFields({ ...editFields, full_name: v })} />
            <Field label="Téléphone" value={editFields.phone} onChange={(v: string) => setEditFields({ ...editFields, phone: v })} keyboardType="phone-pad" />
            <Field label="Ville" value={editFields.city} onChange={(v: string) => setEditFields({ ...editFields, city: v })} />
            <Field label="Adresse" value={editFields.address} onChange={(v: string) => setEditFields({ ...editFields, address: v })} />
            <Button title="Enregistrer" icon="checkmark" onPress={saveProfile} loading={busy} style={{ backgroundColor: paybidColors.primary.base, marginTop: spacing.md }} />
          </View>
        </View>
      </Modal>

      {/* Modal — Changer mot de passe */}
      <Modal visible={pwdOpen} transparent animationType="slide" onRequestClose={() => setPwdOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <TText weight="extraBold" style={{ fontSize: 18 }}>Changer le mot de passe</TText>
              <TouchableOpacity onPress={() => setPwdOpen(false)}><Ionicons name="close-circle" size={28} color={paybidColors.neutrals.textTertiary} /></TouchableOpacity>
            </View>
            <Field label="Ancien mot de passe" value={oldPwd} onChange={setOldPwd} secure />
            <Field label="Nouveau mot de passe" value={newPwd} onChange={setNewPwd} secure />
            <TText variant="label" color={paybidColors.neutrals.textTertiary} style={{ marginTop: 4 }}>Minimum 6 caractères</TText>
            <Button title="Modifier" icon="lock-closed" onPress={changePassword} loading={busy} style={{ backgroundColor: paybidColors.primary.base, marginTop: spacing.md }} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function StatBadge({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <View style={[styles.stat, { backgroundColor: color + "12" }]}>
      <Ionicons name={icon as any} size={16} color={color} />
      <TText weight="extraBold" style={{ marginTop: 2, color }}>{value}</TText>
      <TText variant="label" color={paybidColors.neutrals.textSecondary}>{label}</TText>
    </View>
  );
}
function Section({ title, children }: any) {
  return (
    <View style={{ marginTop: spacing.xl }}>
      <TText variant="caption" weight="bold" color={paybidColors.neutrals.textSecondary} style={{ marginBottom: 6 }}>{title.toUpperCase()}</TText>
      <View style={styles.box}>{children}</View>
    </View>
  );
}
function Row({ icon, label, value, warn }: any) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={18} color={paybidColors.primary.base} />
      <TText weight="semiBold" style={{ flex: 1, marginLeft: 10 }}>{label}</TText>
      <TText color={warn ? "#F59E0B" : paybidColors.neutrals.textSecondary} style={{ maxWidth: "50%" as any, textAlign: "right", fontStyle: warn ? "italic" : "normal" }}>{value}</TText>
    </View>
  );
}
function MenuRow({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.menuRow} onPress={onPress} activeOpacity={0.6}>
      <Ionicons name={icon as any} size={18} color={paybidColors.primary.base} />
      <TText weight="semiBold" style={{ flex: 1, marginLeft: 10 }}>{label}</TText>
      <Ionicons name="chevron-forward" size={16} color={paybidColors.neutrals.textTertiary} />
    </TouchableOpacity>
  );
}
function Field({ label, value, onChange, keyboardType, secure }: any) {
  return (
    <View style={{ marginBottom: 12 }}>
      <TText variant="caption" weight="bold" style={{ marginBottom: 4 }}>{label}</TText>
      <TextInput
        value={value} onChangeText={onChange}
        keyboardType={keyboardType} secureTextEntry={secure}
        style={styles.input}
        placeholderTextColor={paybidColors.neutrals.textTertiary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.xl },
  head: { alignItems: "center", padding: spacing.xl, backgroundColor: paybidColors.neutrals.surface, borderRadius: radii.xxl, borderWidth: 1, borderColor: paybidColors.neutrals.border },
  avatarCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: paybidColors.primary.base, alignItems: "center", justifyContent: "center" },
  statsRow: { flexDirection: "row", gap: 10, marginTop: spacing.md, alignSelf: "stretch" },
  stat: { flex: 1, padding: spacing.md, borderRadius: radii.lg, alignItems: "center" },
  box: { backgroundColor: paybidColors.neutrals.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: paybidColors.neutrals.border, padding: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: spacing.sm, borderBottomWidth: 1, borderBottomColor: paybidColors.neutrals.border },
  rowSwitch: { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: spacing.sm },
  menuRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: spacing.sm, borderBottomWidth: 1, borderBottomColor: paybidColors.neutrals.border },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: spacing.xl, padding: 14, backgroundColor: "rgba(239,68,68,0.08)", borderRadius: radii.lg, borderWidth: 1, borderColor: "rgba(239,68,68,0.2)" },
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  modalContent: { backgroundColor: "white", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.xl, paddingBottom: 40 },
  input: { backgroundColor: paybidColors.neutrals.background, borderRadius: radii.lg, borderWidth: 1, borderColor: paybidColors.neutrals.border, padding: 12, fontSize: 15, color: paybidColors.neutrals.textPrimary },
  completeAlert: { flexDirection: "row", alignItems: "center", marginTop: spacing.md, padding: 12, backgroundColor: "#FEF3C7", borderRadius: radii.lg, borderWidth: 1, borderColor: "#FDE68A" },
});
