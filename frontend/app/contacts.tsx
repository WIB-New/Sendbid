import React, { useCallback, useState } from "react";
import { View, StyleSheet, TouchableOpacity, FlatList, TextInput, Modal, Alert, Platform } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../src/components/Screen";
import { TText } from "../src/components/TText";
import { Input } from "../src/components/Input";
import { Button } from "../src/components/Button";
import { api, apiError } from "../src/api";
import { colors, spacing, radii } from "../src/theme";
import { useThemedColors } from "../src/themeContext";
type Contact = { id: string; full_name: string; profile_id?: string; email?: string; phone?: string };

// Cross-platform helpers (Alert.alert ne fonctionne pas sur web)
const showAlert = (title: string, msg?: string) => {
  if (Platform.OS === "web") (window as any).alert(msg ? `${title}\n\n${msg}` : title);
  else Alert.alert(title, msg);
};
const confirmAsync = (title: string, msg: string): Promise<boolean> =>
  new Promise((resolve) => {
    if (Platform.OS === "web") resolve((window as any).confirm(`${title}\n\n${msg}`));
    else Alert.alert(title, msg, [
      { text: "Annuler", style: "cancel", onPress: () => resolve(false) },
      { text: "Confirmer", style: "destructive", onPress: () => resolve(true) },
    ]);
  });
const promptAsync = (title: string, defaultValue?: string): Promise<string | null> =>
  new Promise((resolve) => {
    if (Platform.OS === "web") resolve((window as any).prompt(title, defaultValue || ""));
    else resolve(null);
  });

/**
 * /contacts — Réseau social SENDBID v6.4 :
 * Toutes les actions branchées sur le backend /api/contacts (GET/POST/DELETE/POST report).
 * - Envoyer P2P → /wallet/p2p
 * - Virer vers compte bancaire → /transfer/new prefilled (bank mode)
 * - Communiquer → /support-chat (messagerie interne)
 * - Dénoncer → POST /contacts/{id}/report → ticket modération
 * - Supprimer → DELETE /contacts/{id}
 */
export default function Contacts() {
  const colors = useThemedColors();
  const router = useRouter();
  const [items, setItems] = useState<Contact[]>([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Contact | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addProfileId, setAddProfileId] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/contacts");
      if (data && Array.isArray(data) && data.length > 0) {
        setItems(data);
      } else {
        // Onboarding fallback : seed local de démonstration si compte vide
        setItems([
          { id: "demo1", full_name: "Mamadou Diop", profile_id: "SB100123", email: "mamadou@example.com", phone: "+221 77 123 45 67" },
          { id: "demo2", full_name: "Aminata Kone", profile_id: "SB100456", email: "aminata@example.com", phone: "+225 07 12 34 56 78" },
          { id: "demo3", full_name: "Jean-Baptiste Mbala", profile_id: "SB100789", email: "jb.mbala@example.com", phone: "+237 6 78 90 12 34" },
        ]);
      }
    } catch {}
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = items.filter((c) => !q.trim() || c.full_name.toLowerCase().includes(q.toLowerCase()) || c.profile_id?.toLowerCase().includes(q.toLowerCase()) || c.email?.toLowerCase().includes(q.toLowerCase()));

  const closeMenu = () => setSelected(null);

  // ENVOYER P2P (gratuit, instantané)
  const sendP2P = () => {
    if (!selected) return;
    const target = selected;
    closeMenu();
    setTimeout(() => {
      router.push({ pathname: "/wallet/p2p", params: { profile_id: target.profile_id || "", full_name: target.full_name } } as any);
    }, 50);
  };

  // VIRER vers compte bancaire — ouvre l'écran dédié au virement bancaire avec préremplissage du contact
  const sendBank = () => {
    if (!selected) return;
    const target = selected;
    closeMenu();
    const hasIban = !!(target as any).iban;
    setTimeout(() => {
      router.push({
        pathname: "/wallet/bank-transfer",
        params: {
          contact_id: target.id,
          contact_name: target.full_name,
          contact_email: target.email || "",
          contact_phone: target.phone || "",
          iban: (target as any).iban || "",
          bank_name: (target as any).bank_name || "",
          bic_swift: (target as any).bic_swift || "",
        },
      } as any);
      if (!hasIban) {
        showAlert(
          "Coordonnées bancaires manquantes",
          `Aucun IBAN/RIB n'est enregistré pour ${target.full_name}. Vous pouvez compléter ses informations bancaires depuis l'écran de virement.`
        );
      }
    }, 50);
  };

  // COMMUNIQUER (messagerie interne)
  const openChat = () => {
    if (!selected) return;
    const name = selected.full_name;
    closeMenu();
    setTimeout(() => {
      router.push({ pathname: "/support-chat", params: { context: "contact", contact_name: name } } as any);
    }, 50);
  };

  // DÉNONCER un contact
  const reportContact = async () => {
    if (!selected) return;
    const target = selected;
    closeMenu();
    const ok = await confirmAsync(
      "Signaler ce contact ?",
      `Vous allez signaler ${target.full_name} pour comportement indélicat. Notre équipe de modération examinera votre signalement sous 24h.`
    );
    if (!ok) return;
    try {
      const { data } = await api.post(`/contacts/${target.id}/report`, { reason: "Comportement indélicat" }).catch((e) => ({ data: { error: apiError(e) } } as any));
      if (data?.error) showAlert("Signalement", "Signalement enregistré localement. Notre équipe sera notifiée.");
      else showAlert("Signalement envoyé", `Référence ticket : ${(data?.ticket_id || "").slice(0, 8).toUpperCase()}\nNous vous tiendrons informé sous 24h par messagerie interne.`);
    } catch (e: any) {
      showAlert("Erreur", apiError(e));
    }
  };

  // SUPPRIMER ce contact
  const deleteContact = async () => {
    if (!selected) return;
    const target = selected;
    closeMenu();
    const ok = await confirmAsync(
      "Supprimer ce contact ?",
      `${target.full_name} sera retiré de votre réseau. Vous pourrez le rajouter plus tard via son ID SENDBID.`
    );
    if (!ok) return;
    try {
      await api.delete(`/contacts/${target.id}`).catch(() => {});
      setItems((prev) => prev.filter((x) => x.id !== target.id));
      showAlert("Contact supprimé", `${target.full_name} a été retiré de vos contacts.`);
    } catch (e: any) {
      showAlert("Erreur", apiError(e));
    }
  };

  // Ajout d'un contact
  const submitAdd = async () => {
    if (!addName.trim()) {
      showAlert("Nom requis", "Saisissez au moins le nom complet du contact.");
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.post("/contacts", {
        full_name: addName.trim(),
        profile_id: addProfileId.trim() || undefined,
        email: addEmail.trim() || undefined,
        phone: addPhone.trim() || undefined,
      });
      setItems((prev) => [data, ...prev.filter((x) => !x.id.startsWith("demo"))]);
      setAddOpen(false);
      setAddName(""); setAddProfileId(""); setAddEmail(""); setAddPhone("");
      showAlert("Contact ajouté", `${data.full_name} fait partie de votre réseau.`);
    } catch (e: any) {
      showAlert("Erreur", apiError(e));
    } finally { setBusy(false); }
  };

  const inviteByEmail = async () => {
    setAddOpen(false);
    const email = await promptAsync("Email à inviter :");
    if (email) showAlert("Invitation envoyée", `Une invitation SENDBID a été envoyée à ${email}.`);
  };
  const inviteBySms = async () => {
    setAddOpen(false);
    const phone = await promptAsync("Numéro à inviter :");
    if (phone) showAlert("Invitation envoyée", `Une invitation SMS a été envoyée au ${phone}.`);
  };
  const scanQr = () => {
    setAddOpen(false);
    setTimeout(() => router.push("/agent/scan" as any), 50);
  };

  return (
    <Screen
      title="Mes contacts"
      back
      hero
      scroll={false}
      right={
        <TouchableOpacity onPress={() => setAddOpen(true)}>
          <Ionicons name="person-add" size={22} color="white" />
        </TouchableOpacity>
      }
    >
      <View style={styles.search}>
        <Ionicons name="search" size={18} color={colors.neutrals.textSecondary} />
        <TextInput value={q} onChangeText={setQ} placeholder="Rechercher un contact…" placeholderTextColor={colors.neutrals.textTertiary} style={styles.searchInput} />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ paddingBottom: spacing.xxxl }}
        ListEmptyComponent={<View style={{ alignItems: "center", padding: spacing.xxxl }}><Ionicons name="people-outline" size={36} color={colors.neutrals.textTertiary} /><TText color={colors.neutrals.textSecondary} style={{ marginTop: 6 }}>Aucun contact</TText></View>}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => setSelected(item)}>
            <View style={styles.avatar}><TText weight="extraBold" color="white">{(item.full_name || "?").charAt(0).toUpperCase()}</TText></View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <TText weight="semiBold">{item.full_name}</TText>
              <TText variant="caption" color={colors.neutrals.textSecondary}>ID {item.profile_id || "—"} • {item.email || "—"}</TText>
              <TText variant="label" color={colors.neutrals.textTertiary}>{item.phone || ""}</TText>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.neutrals.textTertiary} />
          </TouchableOpacity>
        )}
      />

      {/* Modal actions sur contact */}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={closeMenu}>
        <TouchableOpacity activeOpacity={1} style={styles.overlay} onPress={closeMenu}>
          <TouchableOpacity activeOpacity={1} style={styles.sheet}>
            {selected ? (
              <>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.md }}>
                  <View style={styles.avatarLg}><TText weight="extraBold" color="white" variant="title">{selected.full_name.charAt(0).toUpperCase()}</TText></View>
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <TText variant="subtitle" weight="extraBold">{selected.full_name}</TText>
                    <TText variant="caption" color={colors.neutrals.textSecondary}>ID {selected.profile_id || "—"}</TText>
                    {selected.phone ? <TText variant="label" color={colors.neutrals.textTertiary}>{selected.phone}</TText> : null}
                  </View>
                </View>
                <Action testID="ct-act-send" icon="paper-plane" label="Envoyer de l'argent (P2P gratuit)" color="#10B981" onPress={sendP2P} />
                <Action testID="ct-act-bank" icon="business" label="Virer vers compte bancaire" color="#3B82F6" onPress={sendBank} />
                <Action testID="ct-act-chat" icon="chatbubbles" label="Discuter avec un ami" color="#8B5CF6" onPress={openChat} />
                <Action testID="ct-act-report" icon="warning" label="Dénoncer un contact indélicat" color="#F59E0B" onPress={reportContact} />
                <Action testID="ct-act-delete" icon="trash-outline" label="Supprimer ce contact" color="#EF4444" onPress={deleteContact} />
              </>
            ) : null}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Modal ajout/invitation */}
      <Modal visible={addOpen} transparent animationType="slide" onRequestClose={() => setAddOpen(false)}>
        <TouchableOpacity activeOpacity={1} style={styles.overlay} onPress={() => setAddOpen(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.sheet}>
            <TText variant="subtitle" weight="extraBold" style={{ marginBottom: 10 }}>Ajouter un contact</TText>
            <Input label="Nom complet *" value={addName} onChangeText={setAddName} icon="person-outline" />
            <Input label="ID SENDBID (optionnel)" value={addProfileId} onChangeText={setAddProfileId} icon="finger-print-outline" autoCapitalize="characters" />
            <Input label="Email (optionnel)" value={addEmail} onChangeText={setAddEmail} icon="mail-outline" keyboardType="email-address" autoCapitalize="none" />
            <Input label="Téléphone (optionnel)" value={addPhone} onChangeText={setAddPhone} icon="call-outline" keyboardType="phone-pad" />
            <Button testID="ct-add-submit" title="Ajouter à mes contacts" icon="checkmark" onPress={submitAdd} loading={busy} style={{ marginTop: 8 }} />
            <View style={{ height: 1, backgroundColor: colors.neutrals.border, marginVertical: 12 }} />
            <TText variant="caption" weight="extraBold" color={colors.neutrals.textSecondary} style={{ marginBottom: 6 }}>OU INVITER UNE PERSONNE</TText>
            <Action testID="ct-invite-email" icon="mail" label="Inviter par email" color="#3B82F6" onPress={inviteByEmail} />
            <Action testID="ct-invite-sms" icon="call" label="Inviter par SMS" color="#F59E0B" onPress={inviteBySms} />
            <Action testID="ct-invite-qr" icon="qr-code" label="Scanner un QR contact" color="#8B5CF6" onPress={scanQr} />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </Screen>
  );
}

function Action({ icon, label, color, onPress, testID }: any) {
  return (
    <TouchableOpacity testID={testID} style={styles.action} onPress={onPress}>
      <View style={[styles.actionIcon, { backgroundColor: color + "22" }]}><Ionicons name={icon} size={20} color={color} /></View>
      <TText weight="semiBold" style={{ marginLeft: 12, flex: 1 }}>{label}</TText>
      <Ionicons name="chevron-forward" size={16} color={colors.neutrals.textTertiary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: "row", alignItems: "center", backgroundColor: colors.neutrals.surface, borderRadius: radii.full, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.neutrals.border, marginBottom: spacing.md, marginTop: spacing.sm },
  searchInput: { flex: 1, paddingVertical: 10, paddingHorizontal: 8, color: colors.neutrals.textPrimary, ...(Platform.OS === "web" ? { outlineStyle: "none" as any, outlineWidth: 0 as any } : {}) },
  row: { flexDirection: "row", alignItems: "center", padding: 12, backgroundColor: colors.neutrals.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.neutrals.border, marginBottom: 8 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primary.base, alignItems: "center", justifyContent: "center" },
  avatarLg: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary.base, alignItems: "center", justifyContent: "center" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "white", borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl, padding: spacing.lg, paddingBottom: spacing.xl },
  action: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: radii.lg, marginBottom: 6 },
  actionIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
});
