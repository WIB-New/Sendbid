import React, { useEffect, useState, useCallback } from "react";
import { View, StyleSheet, TouchableOpacity, Alert, Modal, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../../src/components/Screen";
import { TText } from "../../src/components/TText";
import { Input } from "../../src/components/Input";
import { Button } from "../../src/components/Button";
import { api, apiError } from "../../src/api";
import { useTranslation } from "../../src/i18n";
import { colors, spacing, radii } from "../../src/theme";
import { useAuth } from "../../src/store";
import { getBanks, getMomoOps } from "../../src/currency";

type AccountType = "bank" | "momo" | "paypal";

type Account = {
  id: string;
  type: AccountType;
  label?: string;
  identifier: string;
  operator?: string;
  bank_name?: string;
  status?: string;
  country?: string;
  created_at?: string;
};

const ICONS: Record<AccountType, keyof typeof Ionicons.glyphMap> = {
  bank: "business-outline",
  momo: "phone-portrait-outline",
  paypal: "logo-paypal",
};

const LABELS: Record<AccountType, { title: string; identifierLabel: string; placeholder: string; identifierIcon: keyof typeof Ionicons.glyphMap }> = {
  bank: { title: "Compte bancaire", identifierLabel: "IBAN / Numéro de compte", placeholder: "FR14 2004 1010 0505 0001 3M02 606", identifierIcon: "business-outline" },
  momo: { title: "Portefeuille mobile", identifierLabel: "Numéro de téléphone", placeholder: "6XX XX XX XX", identifierIcon: "phone-portrait-outline" },
  paypal: { title: "PayPal", identifierLabel: "Email PayPal", placeholder: "email@example.com", identifierIcon: "mail-outline" },
};

const STATUS_LABELS: Record<string, { text: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  pending: { text: "En vérification", color: "#B45309", icon: "time-outline" },
  active: { text: "Vérifié", color: "#047857", icon: "checkmark-circle" },
  verified: { text: "Vérifié", color: "#047857", icon: "checkmark-circle" },
  rejected: { text: "Refusé", color: colors.status.error, icon: "close-circle" },
};

function formatIban(value: string): string {
  const raw = value.replace(/\s/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return raw.replace(/(.{4})/g, "$1 ").trim();
}

function normalizePhone(value: string, country?: string): string {
  let raw = value.replace(/\s/g, "").replace(/\D/g, "");
  if (country === "CM" && !raw.startsWith("237") && raw.length === 9) raw = "237" + raw;
  if (country === "SN" && !raw.startsWith("221") && raw.length === 9) raw = "221" + raw;
  if (country === "CI" && !raw.startsWith("225") && raw.length === 10) raw = "225" + raw;
  return raw;
}

export default function LinkedAccountsScreen() {
  const { t } = useTranslation();
  const user = useAuth((s) => s.user);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [addType, setAddType] = useState<AccountType | null>(null);
  const [editing, setEditing] = useState<Account | null>(null);
  const [form, setForm] = useState({ label: "", identifier: "", operator: "", bank_name: "" });
  const [customBank, setCustomBank] = useState(false);
  const [customOp, setCustomOp] = useState(false);
  const [showBankList, setShowBankList] = useState(false);
  const [showOpList, setShowOpList] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/wallet/linked-accounts");
      setAccounts(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setAccounts([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => { setForm({ label: "", identifier: "", operator: "", bank_name: "" }); setCustomBank(false); setCustomOp(false); setShowBankList(false); setShowOpList(false); };

  const openAdd = (type: AccountType) => {
    setEditing(null);
    resetForm();
    setAddType(type);
    setErr(null);
  };

  const openEdit = (acc: Account) => {
    setEditing(acc);
    setForm({
      label: acc.label || "",
      identifier: acc.identifier || "",
      operator: acc.operator || "",
      bank_name: acc.bank_name || "",
    });
    const banks = getBanks(user?.country);
    setCustomBank(acc.type === "bank" && acc.bank_name ? !banks.includes(acc.bank_name) : false);
    setCustomOp(acc.type === "momo" && acc.operator ? !getMomoOps(user?.country).includes(acc.operator) : false);
    setAddType(acc.type);
    setErr(null);
  };

  const validate = (type: AccountType): string | null => {
    const id = form.identifier.trim();
    if (!id) return "L'identifiant est requis";
    if (type === "bank") {
      const raw = id.replace(/\s/g, "");
      if (raw.length < 14) return "L'IBAN semble trop court (min. 14 caractères)";
      if (!/^[A-Z]{2}\d{2}/.test(raw)) return "L'IBAN doit commencer par un code pays (ex: FR14)";
    }
    if (type === "momo") {
      const raw = normalizePhone(id, user?.country || undefined);
      if (raw.length < 8) return "Le numéro de téléphone semble incomplet";
      const op = form.operator?.trim();
      if (!op) return "Sélectionnez un portefeuille mobile";
      if (user?.country === "CM" && !raw.startsWith("237")) return "Le numéro camerounais doit commencer par 237";
      if (user?.country === "SN" && !raw.startsWith("221")) return "Le numéro sénégalais doit commencer par 221";
      if (user?.country === "CI" && !raw.startsWith("225")) return "Le numéro ivoirien doit commencer par 225";
    }
    if (type === "paypal") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(id)) return "L'adresse email PayPal n'est pas valide";
    }
    return null;
  };

  const saveAccount = async () => {
    setErr(null);
    const validation = validate(addType!);
    if (validation) { setErr(validation); return; }
    setLoading(true);
    try {
      const payload: any = {
        identifier: addType === "bank" ? formatIban(form.identifier) : form.identifier.trim(),
        label: form.label.trim() || undefined,
        country: user?.country,
      };
      if (addType === "bank") payload.bank_name = form.bank_name.trim();
      if (addType === "momo") payload.operator = form.operator.trim();
      if (editing) {
        await api.put(`/wallet/linked-accounts/${editing.id}`, payload);
      } else {
        await api.post("/wallet/linked-accounts", { ...payload, type: addType });
      }
      resetForm();
      setEditing(null);
      setAddType(null);
      await load();
    } catch (e: any) {
      setErr(apiError(e));
    } finally {
      setLoading(false);
    }
  };

  const deleteAccount = (id: string) => {
    Alert.alert("Supprimer", "Retirer ce compte de vos moyens de paiement ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer", style: "destructive", onPress: async () => {
          try { await api.delete(`/wallet/linked-accounts/${id}`); await load(); } catch {}
        }
      }
    ]);
  };

  const verifyAccount = async (id: string) => {
    try {
      await api.post(`/wallet/linked-accounts/${id}/verify`);
      await load();
    } catch (e: any) {
      Alert.alert("Vérification", apiError(e));
    }
  };

  const grouped = {
    bank: accounts.filter((a) => a.type === "bank" && a.status !== "deleted"),
    momo: accounts.filter((a) => a.type === "momo" && a.status !== "deleted"),
    paypal: accounts.filter((a) => a.type === "paypal" && a.status !== "deleted"),
  };

  const momoOps = getMomoOps(user?.country || undefined);
  const bankOptions = getBanks(user?.country || undefined);

  return (
    <Screen title="Comptes liés" back>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}>
        {(["bank", "momo", "paypal"] as AccountType[]).map((type) => (
          <View key={type} style={{ marginBottom: spacing.xl }}>
            <View style={styles.sectionHeader}>
              <Ionicons name={ICONS[type]} size={18} color={colors.primary.base} />
              <TText variant="body" weight="bold" style={{ marginLeft: 8, flex: 1 }}>{LABELS[type].title}</TText>
              <TouchableOpacity onPress={() => openAdd(type)} style={styles.addBtn}>
                <Ionicons name="add" size={20} color="white" />
              </TouchableOpacity>
            </View>
            {grouped[type].length === 0 ? (
              <TText variant="caption" color={colors.neutrals.textSecondary}>Aucun compte {LABELS[type].title.toLowerCase()} lié.</TText>
            ) : (
              grouped[type].map((acc) => {
                const status = STATUS_LABELS[acc.status || "pending"] || STATUS_LABELS.pending;
                return (
                  <View key={acc.id} style={styles.row}>
                    <TouchableOpacity onPress={() => openEdit(acc)} style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
                      <View style={styles.iconCircle}>
                        <Ionicons name={ICONS[type]} size={18} color={colors.primary.base} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <TText variant="caption" weight="extraBold" style={{ flex: 1 }}>
                            {acc.label || acc.bank_name || acc.operator || acc.identifier}
                          </TText>
                          <Ionicons name={status.icon} size={14} color={status.color} />
                          <TText variant="label" color={status.color}>{status.text}</TText>
                        </View>
                        {type === "bank" && acc.bank_name ? (
                          <TText variant="label" color={colors.neutrals.textSecondary}>{acc.bank_name}</TText>
                        ) : null}
                        {type === "momo" && acc.operator ? (
                          <TText variant="label" color={colors.neutrals.textSecondary}>{acc.operator}</TText>
                        ) : null}
                        <TText variant="label" color={colors.neutrals.textSecondary}>{acc.identifier}</TText>
                      </View>
                    </TouchableOpacity>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      {acc.status === "pending" ? (
                        <TouchableOpacity onPress={() => verifyAccount(acc.id)} style={{ padding: 6, marginRight: 4 }}>
                          <Ionicons name="checkmark-circle-outline" size={22} color={colors.primary.base} />
                        </TouchableOpacity>
                      ) : null}
                      <TouchableOpacity onPress={() => deleteAccount(acc.id)} style={{ padding: 6 }}>
                        <Ionicons name="trash-outline" size={20} color={colors.status.error} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        ))}

        <View style={{ backgroundColor: "#FEF3C7", borderRadius: radii.lg, padding: spacing.md, marginTop: spacing.md }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
            <Ionicons name="information-circle-outline" size={18} color="#B45309" />
            <TText variant="label" color="#B45309" style={{ marginLeft: 8, flex: 1, lineHeight: 18 }}>
              Les nouveaux comptes sont placés en vérification. Appuyez sur l'icône ✓ pour lancer la vérification automatique, ou modifiez le compte si vous avez fait une erreur.
            </TText>
          </View>
        </View>
      </ScrollView>

      <Modal visible={!!addType} transparent animationType="slide" onRequestClose={() => { setAddType(null); setEditing(null); }}>
        <View style={styles.modalOverlay}>
          <View style={styles.sheet}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.md }}>
              <TText variant="subtitle" weight="bold" style={{ flex: 1 }}>
                {editing ? "Modifier" : "Ajouter"} {addType ? LABELS[addType].title : ""}
              </TText>
              <TouchableOpacity onPress={() => { setAddType(null); setEditing(null); }}>
                <Ionicons name="close" size={24} color={colors.neutrals.textPrimary} />
              </TouchableOpacity>
            </View>
            {addType === "bank" ? (
              <>
                <TouchableOpacity onPress={() => setShowBankList(true)} style={styles.selectBox}>
                  <View style={{ flex: 1 }}>
                    <TText variant="label" color={colors.neutrals.textSecondary}>Banque</TText>
                    <TText variant="caption" weight={form.bank_name ? "bold" : "regular"} color={form.bank_name ? colors.neutrals.textPrimary : colors.neutrals.textSecondary}>
                      {form.bank_name || "Sélectionnez une banque"}
                    </TText>
                  </View>
                  <Ionicons name="chevron-down" size={18} color={colors.neutrals.textSecondary} />
                </TouchableOpacity>
                {customBank ? (
                  <Input label="Nom de la banque (manuel)" value={form.bank_name} onChangeText={(v) => setForm({ ...form, bank_name: v })} icon="business-outline" placeholder="Ex: Ma banque locale" />
                ) : null}
                <Input label={LABELS.bank.identifierLabel} value={form.identifier} onChangeText={(v) => setForm({ ...form, identifier: formatIban(v) })} icon={LABELS.bank.identifierIcon} placeholder={LABELS.bank.placeholder} autoCapitalize="characters" />
              </>
            ) : null}
            {addType === "momo" ? (
              <>
                <TouchableOpacity onPress={() => setShowOpList(true)} style={styles.selectBox}>
                  <View style={{ flex: 1 }}>
                    <TText variant="label" color={colors.neutrals.textSecondary}>Portefeuille mobile</TText>
                    <TText variant="caption" weight={form.operator ? "bold" : "regular"} color={form.operator ? colors.neutrals.textPrimary : colors.neutrals.textSecondary}>
                      {form.operator || "Sélectionnez un portefeuille mobile"}
                    </TText>
                  </View>
                  <Ionicons name="chevron-down" size={18} color={colors.neutrals.textSecondary} />
                </TouchableOpacity>
                {customOp ? (
                  <Input label="Portefeuille mobile (manuel)" value={form.operator} onChangeText={(v) => setForm({ ...form, operator: v })} icon="phone-portrait-outline" placeholder="Ex: Mon opérateur" />
                ) : null}
                <Input label={LABELS.momo.identifierLabel} value={form.identifier} onChangeText={(v) => setForm({ ...form, identifier: normalizePhone(v, user?.country || undefined) })} icon={LABELS.momo.identifierIcon} placeholder={LABELS.momo.placeholder} keyboardType="phone-pad" />
              </>
            ) : null}
            {addType === "paypal" ? (
              <Input label={LABELS.paypal.identifierLabel} value={form.identifier} onChangeText={(v) => setForm({ ...form, identifier: v.trim() })} icon={LABELS.paypal.identifierIcon} placeholder={LABELS.paypal.placeholder} keyboardType="email-address" autoCapitalize="none" />
            ) : null}
            <Input label="Libellé (optionnel)" value={form.label} onChangeText={(v) => setForm({ ...form, label: v })} icon="pricetag-outline" placeholder="Mon compte perso" />
            {err ? <TText variant="caption" color={colors.status.error} style={{ marginTop: 8 }}>{err}</TText> : null}
            <Button title={editing ? "Enregistrer les modifications" : "Enregistrer"} loading={loading} onPress={saveAccount} style={{ marginTop: spacing.md }} />
          </View>
        </View>
      </Modal>

      {/* Modal liste des banques */}
      <Modal visible={showBankList} transparent animationType="slide" onRequestClose={() => setShowBankList(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.sheet}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.md }}>
              <TText variant="subtitle" weight="bold" style={{ flex: 1 }}>Choisir une banque</TText>
              <TouchableOpacity onPress={() => setShowBankList(false)}>
                <Ionicons name="close" size={24} color={colors.neutrals.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 350 }}>
              {bankOptions.map((b) => (
                <TouchableOpacity key={b} onPress={() => { setForm({ ...form, bank_name: b }); setCustomBank(false); setShowBankList(false); }} style={styles.listItem}>
                  <TText variant="caption" color={form.bank_name === b ? colors.primary.base : colors.neutrals.textPrimary}>{b}</TText>
                  {form.bank_name === b ? <Ionicons name="checkmark" size={18} color={colors.primary.base} /> : null}
                </TouchableOpacity>
              ))}
              <TouchableOpacity onPress={() => { setForm({ ...form, bank_name: "" }); setCustomBank(true); setShowBankList(false); }} style={styles.listItem}>
                <TText variant="caption" weight="bold" color={colors.primary.base}>+ Autre (saisie manuelle)</TText>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal liste des portefeuilles mobiles */}
      <Modal visible={showOpList} transparent animationType="slide" onRequestClose={() => setShowOpList(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.sheet}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.md }}>
              <TText variant="subtitle" weight="bold" style={{ flex: 1 }}>Choisir un portefeuille mobile</TText>
              <TouchableOpacity onPress={() => setShowOpList(false)}>
                <Ionicons name="close" size={24} color={colors.neutrals.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 350 }}>
              {momoOps.map((op) => (
                <TouchableOpacity key={op} onPress={() => { setForm({ ...form, operator: op }); setCustomOp(false); setShowOpList(false); }} style={styles.listItem}>
                  <TText variant="caption" color={form.operator === op ? colors.primary.base : colors.neutrals.textPrimary}>{op}</TText>
                  {form.operator === op ? <Ionicons name="checkmark" size={18} color={colors.primary.base} /> : null}
                </TouchableOpacity>
              ))}
              <TouchableOpacity onPress={() => { setForm({ ...form, operator: "" }); setCustomOp(true); setShowOpList(false); }} style={styles.listItem}>
                <TText variant="caption" weight="bold" color={colors.primary.base}>+ Autre (saisie manuelle)</TText>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionHeader: { flexDirection: "row", alignItems: "center", marginBottom: spacing.md },
  selectBox: { flexDirection: "row", alignItems: "center", backgroundColor: colors.neutrals.surface, borderRadius: radii.lg, borderWidth: 1.5, borderColor: colors.neutrals.border, padding: 14, marginBottom: 10 },
  listItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.neutrals.border },
  addBtn: { width: 28, height: 28, borderRadius: radii.full, backgroundColor: colors.primary.base, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", backgroundColor: colors.neutrals.surface, borderRadius: radii.xl, padding: 14, marginBottom: 8 },
  iconCircle: { width: 36, height: 36, borderRadius: radii.full, backgroundColor: colors.overlays.primarySoft, alignItems: "center", justifyContent: "center" },
  opChip: { borderWidth: 1, borderColor: colors.neutrals.border, borderRadius: radii.full, paddingHorizontal: 12, paddingVertical: 8 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.neutrals.background, borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl, padding: spacing.xl, paddingBottom: spacing.xxxl },
});
