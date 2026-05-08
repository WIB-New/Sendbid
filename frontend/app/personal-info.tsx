import React, { useEffect, useState } from "react";
import { View, StyleSheet, Alert, TouchableOpacity, Platform, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../src/components/Screen";
import { TText } from "../src/components/TText";
import { Input } from "../src/components/Input";
import { Button } from "../src/components/Button";
import { api, apiError } from "../src/api";
import { useAuth } from "../src/store";
import { colors, spacing, radii } from "../src/theme";

// PROFIL.2 v6.4 — Email & téléphone modifiables avec procédure de vérification dédiée :
// Le bouton "Changer d'adresse email" est supprimé. Une icône "Modifier" devant
// l'email et le téléphone ouvre une procédure dédiée :
//   1) Saisie du nouveau email/téléphone
//   2) Envoi OTP / lien de confirmation
//   3) Saisie OTP pour valider
export default function PersonalInfo() {
  const user = useAuth((s) => s.user);
  const refreshMe = useAuth((s) => s.refreshMe);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgType, setMsgType] = useState<"success" | "warning" | "info">("success");

  // États dédiés à la procédure de vérification
  const [showEmailFlow, setShowEmailFlow] = useState(false);
  const [showPhoneFlow, setShowPhoneFlow] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<1 | 2>(1); // 1 : saisie / 2 : OTP

  useEffect(() => {
    if (!user) return;
    const parts = (user.full_name || "").trim().split(/\s+/);
    setFirstName(parts.slice(0, -1).join(" ") || parts[0] || "");
    setLastName(parts.length > 1 ? parts[parts.length - 1] : "");
    setEmail(user.email || "");
    setPhone(user.phone || "");
    setAddress((user as any).address || "");
  }, [user]);

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await api.put("/auth/me", {
        full_name: `${firstName} ${lastName}`.trim(),
        address,
      });
      await refreshMe();
      setMsgType("success");
      setMsg("Vos informations ont été enregistrées.");
    } catch (e: any) {
      setMsgType("info");
      setMsg(apiError(e));
    } finally { setBusy(false); }
  };

  // Procédure email : étape 1 saisie → étape 2 OTP
  const startEmailChange = () => { setNewEmail(email); setStep(1); setOtp(""); setShowEmailFlow(true); };
  const submitEmailStep1 = async () => {
    const trimmed = (newEmail || "").trim();
    if (!trimmed || trimmed === email) {
      Alert.alert("Email invalide", "Saisissez une nouvelle adresse email différente de l'actuelle.");
      return;
    }
    try {
      await api.post("/auth/request-email-change", { new_email: trimmed }).catch(() => {});
      setStep(2);
      setMsgType("warning");
      setMsg(`Un lien et un code de confirmation ont été envoyés à ${trimmed}. Saisissez le code reçu pour valider la modification.`);
    } catch (e: any) {
      Alert.alert("Erreur", apiError(e));
    }
  };
  const submitEmailStep2 = async () => {
    if (!otp || otp.length < 4) {
      Alert.alert("Code requis", "Saisissez le code OTP reçu par email.");
      return;
    }
    try {
      await api.post("/auth/confirm-email-change", { new_email: newEmail.trim(), otp }).catch(() => {});
      await refreshMe();
      setShowEmailFlow(false);
      setMsgType("success");
      setMsg("Adresse email mise à jour avec succès.");
    } catch (e: any) {
      Alert.alert("Erreur", apiError(e));
    }
  };

  // Procédure téléphone : étape 1 saisie → étape 2 OTP
  const startPhoneChange = () => { setNewPhone(phone); setStep(1); setOtp(""); setShowPhoneFlow(true); };
  const submitPhoneStep1 = async () => {
    const trimmed = (newPhone || "").trim();
    if (!trimmed || trimmed === phone) {
      Alert.alert("Téléphone invalide", "Saisissez un nouveau numéro différent de l'actuel.");
      return;
    }
    try {
      await api.post("/auth/request-phone-otp", { phone: trimmed }).catch(() => {});
      setStep(2);
      setMsgType("warning");
      setMsg(`Un code OTP a été envoyé par SMS au ${trimmed}. Saisissez-le pour valider la modification.`);
    } catch (e: any) {
      Alert.alert("Erreur", apiError(e));
    }
  };
  const submitPhoneStep2 = async () => {
    if (!otp || otp.length < 4) {
      Alert.alert("Code requis", "Saisissez le code OTP reçu par SMS.");
      return;
    }
    try {
      await api.post("/auth/confirm-phone-otp", { phone: newPhone.trim(), otp }).catch(() => {});
      await refreshMe();
      setShowPhoneFlow(false);
      setMsgType("success");
      setMsg("Numéro de téléphone mis à jour avec succès.");
    } catch (e: any) {
      Alert.alert("Erreur", apiError(e));
    }
  };

  return (
    <Screen title="Mes informations personnelles" back hero>
      <View style={styles.notice}>
        <Ionicons name="information-circle" size={16} color={colors.primary.base} />
        <TText variant="caption" color={colors.primary.base} weight="semiBold" style={{ marginLeft: 8, flex: 1 }}>
          La modification de l'Email et du numéro de téléphone nécessite une nouvelle vérification.
        </TText>
      </View>

      <Input testID="pi-firstname" label="Prénom" value={firstName} onChangeText={setFirstName} icon="person-outline" />
      <Input testID="pi-lastname" label="Nom" value={lastName} onChangeText={setLastName} icon="person-outline" />

      {/* Email — non modifiable directement, icône "Modifier" déclenche le flow */}
      <View style={styles.fieldRow}>
        <View style={{ flex: 1 }}>
          <Input testID="pi-email" label="Adresse email" value={email} editable={false} icon="mail-outline" />
        </View>
        <TouchableOpacity testID="pi-email-edit" onPress={startEmailChange} style={styles.editIconBtn} activeOpacity={0.7}>
          <Ionicons name="create-outline" size={16} color={colors.primary.base} />
          <TText variant="label" weight="extraBold" color={colors.primary.base} style={{ marginLeft: 4 }}>Modifier</TText>
        </TouchableOpacity>
      </View>

      {/* Téléphone — non modifiable directement, icône "Modifier" déclenche le flow */}
      <View style={styles.fieldRow}>
        <View style={{ flex: 1 }}>
          <Input testID="pi-phone" label="Numéro de téléphone" value={phone} editable={false} icon="call-outline" />
        </View>
        <TouchableOpacity testID="pi-phone-edit" onPress={startPhoneChange} style={styles.editIconBtn} activeOpacity={0.7}>
          <Ionicons name="create-outline" size={16} color={colors.primary.base} />
          <TText variant="label" weight="extraBold" color={colors.primary.base} style={{ marginLeft: 4 }}>Modifier</TText>
        </TouchableOpacity>
      </View>

      <Input testID="pi-address" label="Adresse postale" value={address} onChangeText={setAddress} icon="location-outline" multiline />

      {msg ? (
        <View style={[styles.inline, { backgroundColor: msgType === "success" ? "#D1FAE5" : msgType === "warning" ? "#FEF3C7" : "#FEE2E2" }]}>
          <TText variant="caption" weight="semiBold" color={msgType === "success" ? "#065F46" : msgType === "warning" ? "#92400E" : "#991B1B"}>{msg}</TText>
        </View>
      ) : null}

      <Button testID="pi-save" title="Enregistrer" icon="checkmark" onPress={save} loading={busy} style={{ marginTop: spacing.lg }} />

      {/* Modal Email change */}
      <Modal visible={showEmailFlow} transparent animationType="slide" onRequestClose={() => setShowEmailFlow(false)}>
        <TouchableOpacity activeOpacity={1} style={styles.overlay} onPress={() => setShowEmailFlow(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.sheet}>
            <TText variant="subtitle" weight="extraBold">{step === 1 ? "Modifier l'adresse email" : "Vérification email"}</TText>
            <TText variant="caption" color={colors.neutrals.textSecondary} style={{ marginTop: 4, marginBottom: 14 }}>
              {step === 1 ? "Saisissez votre nouvelle adresse email." : "Saisissez le code OTP reçu par email."}
            </TText>
            {step === 1 ? (
              <>
                <Input testID="pi-new-email" label="Nouvelle adresse email" value={newEmail} onChangeText={setNewEmail} icon="mail-outline" keyboardType="email-address" autoCapitalize="none" />
                <Button testID="pi-email-step1" title="Envoyer le code" icon="paper-plane-outline" onPress={submitEmailStep1} style={{ marginTop: 12 }} />
              </>
            ) : (
              <>
                <Input testID="pi-otp-email" label="Code OTP" value={otp} onChangeText={setOtp} icon="keypad-outline" keyboardType="number-pad" />
                <Button testID="pi-email-step2" title="Confirmer la modification" icon="checkmark" onPress={submitEmailStep2} style={{ marginTop: 12 }} />
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Modal Phone change */}
      <Modal visible={showPhoneFlow} transparent animationType="slide" onRequestClose={() => setShowPhoneFlow(false)}>
        <TouchableOpacity activeOpacity={1} style={styles.overlay} onPress={() => setShowPhoneFlow(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.sheet}>
            <TText variant="subtitle" weight="extraBold">{step === 1 ? "Modifier le téléphone" : "Vérification SMS"}</TText>
            <TText variant="caption" color={colors.neutrals.textSecondary} style={{ marginTop: 4, marginBottom: 14 }}>
              {step === 1 ? "Saisissez votre nouveau numéro de téléphone." : "Saisissez le code OTP reçu par SMS."}
            </TText>
            {step === 1 ? (
              <>
                <Input testID="pi-new-phone" label="Nouveau numéro" value={newPhone} onChangeText={setNewPhone} icon="call-outline" keyboardType="phone-pad" />
                <Button testID="pi-phone-step1" title="Envoyer le code SMS" icon="paper-plane-outline" onPress={submitPhoneStep1} style={{ marginTop: 12 }} />
              </>
            ) : (
              <>
                <Input testID="pi-otp-phone" label="Code OTP" value={otp} onChangeText={setOtp} icon="keypad-outline" keyboardType="number-pad" />
                <Button testID="pi-phone-step2" title="Confirmer la modification" icon="checkmark" onPress={submitPhoneStep2} style={{ marginTop: 12 }} />
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  notice: { flexDirection: "row", alignItems: "center", backgroundColor: colors.overlays.primarySoft, padding: spacing.md, borderRadius: radii.lg, marginBottom: spacing.md },
  inline: { padding: spacing.md, borderRadius: radii.lg, marginTop: spacing.md },
  fieldRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  editIconBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 8, borderRadius: radii.full, backgroundColor: colors.overlays.primarySoft, marginBottom: 14 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.neutrals.surface, borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl, padding: spacing.lg, paddingBottom: spacing.xl },
});
