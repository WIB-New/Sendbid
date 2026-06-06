/**
 * VerificationPopup — popup post-1ère-connexion pour vérifier email + téléphone.
 * Spec v7 : 7 sections (email field + verify btn, code OTP email + 60s + resend,
 * confirm/error email, phone field + verify btn, code OTP SMS + 60s + resend,
 * confirm/error phone, message félicitations + bouton Fermer).
 *
 * - Reste monté tant que la procédure n'est pas achevée (ou interrompue via X).
 * - Bouton X = demande de confirmation avant fermeture.
 */
import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, TouchableOpacity, Modal, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TText } from "./TText";
import { Input } from "./Input";
import { Button } from "./Button";
import { api, apiError } from "../api";
import { useAuth } from "../store";
import { colors, spacing, radii } from "../theme";
import { useThemedColors } from "../themeContext";

type Props = { visible: boolean; onClose: (completed: boolean) => void };

const RESEND_COOLDOWN = 60; // secondes

export default function VerificationPopup({ visible, onClose }: Props) {
  const themed = useThemedColors();
  const user = useAuth((s) => s.user);
  const refreshMe = useAuth((s) => s.refreshMe);

  // ===== Sécurité d'usage =====
  // Pour éviter un blocage si user undefined / déjà tout vérifié, on garde un guard.
  const emailVerified = !!user?.email_verified;
  const phoneVerified = !!user?.phone_verified;

  const [emailOtp, setEmailOtp] = useState("");
  const [phoneOtp, setPhoneOtp] = useState("");
  const [emailMsg, setEmailMsg] = useState<{ type: "ok" | "err" | null; text: string }>({ type: null, text: "" });
  const [phoneMsg, setPhoneMsg] = useState<{ type: "ok" | "err" | null; text: string }>({ type: null, text: "" });

  const [emailLoadingSend, setEmailLoadingSend] = useState(false);
  const [emailLoadingVerify, setEmailLoadingVerify] = useState(false);
  const [phoneLoadingSend, setPhoneLoadingSend] = useState(false);
  const [phoneLoadingVerify, setPhoneLoadingVerify] = useState(false);

  // Compteurs 60s par canal (0 = pas en cours OU expiré → permet renvoi)
  const [emailLeft, setEmailLeft] = useState(0);
  const [phoneLeft, setPhoneLeft] = useState(0);
  const emailIntervalRef = useRef<any>(null);
  const phoneIntervalRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (emailIntervalRef.current) clearInterval(emailIntervalRef.current);
      if (phoneIntervalRef.current) clearInterval(phoneIntervalRef.current);
    };
  }, []);

  const startCountdown = (which: "email" | "phone") => {
    if (which === "email") {
      setEmailLeft(RESEND_COOLDOWN);
      if (emailIntervalRef.current) clearInterval(emailIntervalRef.current);
      emailIntervalRef.current = setInterval(() => {
        setEmailLeft((v) => (v <= 1 ? (clearInterval(emailIntervalRef.current), 0) : v - 1));
      }, 1000);
    } else {
      setPhoneLeft(RESEND_COOLDOWN);
      if (phoneIntervalRef.current) clearInterval(phoneIntervalRef.current);
      phoneIntervalRef.current = setInterval(() => {
        setPhoneLeft((v) => (v <= 1 ? (clearInterval(phoneIntervalRef.current), 0) : v - 1));
      }, 1000);
    }
  };

  // === EMAIL ===
  const sendEmailCode = async () => {
    setEmailLoadingSend(true);
    setEmailMsg({ type: null, text: "" });
    try {
      const { data } = await api.post("/auth/resend-email-otp");
      startCountdown("email");
      const devCode = (data as any)?.dev_email_otp;
      setEmailMsg({
        type: "ok",
        text: devCode
          ? `Code envoyé à ${user?.email}. (DEV : ${devCode})`
          : `Code envoyé à ${user?.email}. Vérifiez votre boîte de réception.`,
      });
    } catch (e: any) {
      setEmailMsg({ type: "err", text: apiError(e) });
    } finally {
      setEmailLoadingSend(false);
    }
  };

  const verifyEmailCode = async () => {
    if (!emailOtp || emailOtp.length < 4) {
      setEmailMsg({ type: "err", text: "Saisissez le code reçu par email." });
      return;
    }
    setEmailLoadingVerify(true);
    setEmailMsg({ type: null, text: "" });
    try {
      await api.post("/auth/verify-email-otp", { code: emailOtp });
      await refreshMe();
      setEmailMsg({ type: "ok", text: "✓ Email vérifié avec succès." });
      if (emailIntervalRef.current) clearInterval(emailIntervalRef.current);
      setEmailLeft(0);
    } catch (e: any) {
      setEmailMsg({ type: "err", text: apiError(e) });
    } finally {
      setEmailLoadingVerify(false);
    }
  };

  // === PHONE ===
  const sendPhoneCode = async () => {
    setPhoneLoadingSend(true);
    setPhoneMsg({ type: null, text: "" });
    try {
      const { data } = await api.post("/auth/resend-phone-otp");
      startCountdown("phone");
      const devCode = (data as any)?.dev_phone_otp;
      setPhoneMsg({
        type: "ok",
        text: devCode
          ? `SMS envoyé au ${user?.phone}. (DEV : ${devCode})`
          : `SMS envoyé au ${user?.phone}.`,
      });
    } catch (e: any) {
      setPhoneMsg({ type: "err", text: apiError(e) });
    } finally {
      setPhoneLoadingSend(false);
    }
  };

  const verifyPhoneCode = async () => {
    if (!phoneOtp || phoneOtp.length < 4) {
      setPhoneMsg({ type: "err", text: "Saisissez le code reçu par SMS." });
      return;
    }
    setPhoneLoadingVerify(true);
    setPhoneMsg({ type: null, text: "" });
    try {
      await api.post("/auth/verify-phone-otp", { code: phoneOtp });
      await refreshMe();
      setPhoneMsg({ type: "ok", text: "✓ Numéro de téléphone vérifié avec succès." });
      if (phoneIntervalRef.current) clearInterval(phoneIntervalRef.current);
      setPhoneLeft(0);
    } catch (e: any) {
      setPhoneMsg({ type: "err", text: apiError(e) });
    } finally {
      setPhoneLoadingVerify(false);
    }
  };

  const bothDone = emailVerified && phoneVerified;

  // === Confirmation d'interruption (modal interne, multi-plateforme) ===
  // Remplace window.confirm/Alert.alert qui ne fonctionnent pas dans un Modal RN Web.
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleClose = (completed: boolean) => {
    if (!completed) {
      // Demande de confirmation via modal interne (fiable sur Web ET Native)
      setConfirmOpen(true);
    } else {
      onClose(true);
    }
  };

  const confirmInterrupt = () => {
    setConfirmOpen(false);
    onClose(false);
  };
  const cancelInterrupt = () => setConfirmOpen(false);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => handleClose(bothDone)}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: themed.neutrals.surface }]}>
          {/* Header sticky */}
          <View style={styles.header}>
            <TText variant="subtitle" weight="extraBold" style={{ flex: 1 }}>
              Vérification de votre compte
            </TText>
            <TouchableOpacity testID="vp-close" onPress={() => handleClose(bothDone)} style={styles.closeBtn} accessibilityLabel="Fermer la fenêtre">
              <Ionicons name="close" size={22} color={themed.neutrals.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }} keyboardShouldPersistTaps="handled">
            <TText variant="caption" color={themed.neutrals.textSecondary} style={{ marginBottom: spacing.md }}>
              Vérifiez votre email et votre numéro de téléphone pour sécuriser votre compte et débloquer toutes les fonctionnalités.
            </TText>

            {/* === Ligne 1 : email + bouton === */}
            <TText variant="caption" weight="extraBold" color={themed.neutrals.textSecondary} style={styles.label}>1. Email d'inscription</TText>
            <View style={styles.row}>
              <View style={[styles.fieldReadonly, { flex: 1, borderColor: emailVerified ? themed.status.success : themed.neutrals.border }]}>
                <Ionicons name="mail-outline" size={16} color={themed.neutrals.textSecondary} />
                <TText weight="semiBold" style={{ marginLeft: 8, flex: 1 }} numberOfLines={1}>{user?.email || "—"}</TText>
                {emailVerified ? <Ionicons name="checkmark-circle" size={18} color={themed.status.success} /> : null}
              </View>
              <TouchableOpacity
                testID="vp-send-email"
                disabled={emailVerified || emailLoadingSend}
                onPress={sendEmailCode}
                style={[styles.actionBtn, (emailVerified || emailLoadingSend) && { opacity: 0.5 }]}
              >
                <TText variant="caption" weight="extraBold" color="white">
                  {emailVerified ? "Vérifié" : emailLoadingSend ? "..." : "Vérifier"}
                </TText>
              </TouchableOpacity>
            </View>

            {/* === Ligne 2 : code OTP email + compteur 60s + renvoi === */}
            <TText variant="caption" weight="extraBold" color={themed.neutrals.textSecondary} style={styles.label}>2. Code reçu par email</TText>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Input
                  testID="vp-otp-email"
                  value={emailOtp}
                  onChangeText={(v) => setEmailOtp(v.replace(/[^0-9]/g, "").slice(0, 6))}
                  keyboardType="number-pad"
                  placeholder="6 chiffres"
                  icon="key-outline"
                  style={{ marginBottom: 0 } as any}
                  editable={!emailVerified}
                />
              </View>
              <TouchableOpacity
                testID="vp-validate-email"
                disabled={emailVerified || emailLoadingVerify || emailOtp.length < 4}
                onPress={verifyEmailCode}
                style={[styles.actionBtn, (emailVerified || emailLoadingVerify || emailOtp.length < 4) && { opacity: 0.5 }]}
              >
                <TText variant="caption" weight="extraBold" color="white">OK</TText>
              </TouchableOpacity>
            </View>
            <View style={styles.timerRow}>
              {emailLeft > 0 ? (
                <TText variant="label" color={themed.neutrals.textSecondary}>
                  Renvoi possible dans <TText weight="extraBold">{emailLeft}s</TText>
                </TText>
              ) : (
                <TouchableOpacity testID="vp-resend-email" disabled={emailVerified || emailLoadingSend} onPress={sendEmailCode}>
                  <TText variant="label" weight="extraBold" color={emailVerified ? themed.neutrals.textTertiary : themed.primary.base}>
                    {emailVerified ? "—" : "↻ Renvoyer le code"}
                  </TText>
                </TouchableOpacity>
              )}
            </View>

            {/* === Ligne 3 : message confirmation/erreur email === */}
            {emailMsg.type ? (
              <View style={[styles.msgBox, emailMsg.type === "ok" ? styles.msgOk : styles.msgErr]}>
                <Ionicons name={emailMsg.type === "ok" ? "checkmark-circle" : "alert-circle"} size={16} color={emailMsg.type === "ok" ? "#065F46" : "#991B1B"} />
                <TText variant="label" color={emailMsg.type === "ok" ? "#065F46" : "#991B1B"} style={{ marginLeft: 6, flex: 1 }}>
                  {emailMsg.text}
                </TText>
              </View>
            ) : null}

            <View style={styles.divider} />

            {/* === Ligne 4 : phone + bouton === */}
            <TText variant="caption" weight="extraBold" color={themed.neutrals.textSecondary} style={styles.label}>4. Numéro de téléphone d'inscription</TText>
            <View style={styles.row}>
              <View style={[styles.fieldReadonly, { flex: 1, borderColor: phoneVerified ? themed.status.success : themed.neutrals.border }]}>
                <Ionicons name="call-outline" size={16} color={themed.neutrals.textSecondary} />
                <TText weight="semiBold" style={{ marginLeft: 8, flex: 1 }} numberOfLines={1}>{user?.phone || "—"}</TText>
                {phoneVerified ? <Ionicons name="checkmark-circle" size={18} color={themed.status.success} /> : null}
              </View>
              <TouchableOpacity
                testID="vp-send-phone"
                disabled={phoneVerified || phoneLoadingSend}
                onPress={sendPhoneCode}
                style={[styles.actionBtn, (phoneVerified || phoneLoadingSend) && { opacity: 0.5 }]}
              >
                <TText variant="caption" weight="extraBold" color="white">
                  {phoneVerified ? "Vérifié" : phoneLoadingSend ? "..." : "Vérifier"}
                </TText>
              </TouchableOpacity>
            </View>

            {/* === Ligne 5 : code OTP SMS + compteur 60s === */}
            <TText variant="caption" weight="extraBold" color={themed.neutrals.textSecondary} style={styles.label}>5. Code reçu par SMS</TText>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Input
                  testID="vp-otp-phone"
                  value={phoneOtp}
                  onChangeText={(v) => setPhoneOtp(v.replace(/[^0-9]/g, "").slice(0, 6))}
                  keyboardType="number-pad"
                  placeholder="6 chiffres"
                  icon="key-outline"
                  style={{ marginBottom: 0 } as any}
                  editable={!phoneVerified}
                />
              </View>
              <TouchableOpacity
                testID="vp-validate-phone"
                disabled={phoneVerified || phoneLoadingVerify || phoneOtp.length < 4}
                onPress={verifyPhoneCode}
                style={[styles.actionBtn, (phoneVerified || phoneLoadingVerify || phoneOtp.length < 4) && { opacity: 0.5 }]}
              >
                <TText variant="caption" weight="extraBold" color="white">OK</TText>
              </TouchableOpacity>
            </View>
            <View style={styles.timerRow}>
              {phoneLeft > 0 ? (
                <TText variant="label" color={themed.neutrals.textSecondary}>
                  Renvoi possible dans <TText weight="extraBold">{phoneLeft}s</TText>
                </TText>
              ) : (
                <TouchableOpacity testID="vp-resend-phone" disabled={phoneVerified || phoneLoadingSend} onPress={sendPhoneCode}>
                  <TText variant="label" weight="extraBold" color={phoneVerified ? themed.neutrals.textTertiary : themed.primary.base}>
                    {phoneVerified ? "—" : "↻ Renvoyer le code"}
                  </TText>
                </TouchableOpacity>
              )}
            </View>

            {/* === Ligne 6 : message confirmation/erreur phone === */}
            {phoneMsg.type ? (
              <View style={[styles.msgBox, phoneMsg.type === "ok" ? styles.msgOk : styles.msgErr]}>
                <Ionicons name={phoneMsg.type === "ok" ? "checkmark-circle" : "alert-circle"} size={16} color={phoneMsg.type === "ok" ? "#065F46" : "#991B1B"} />
                <TText variant="label" color={phoneMsg.type === "ok" ? "#065F46" : "#991B1B"} style={{ marginLeft: 6, flex: 1 }}>
                  {phoneMsg.text}
                </TText>
              </View>
            ) : null}

            {/* === Ligne 7 : félicitations + Fermer === */}
            {bothDone ? (
              <View style={styles.successBox}>
                <Ionicons name="trophy" size={28} color="#065F46" style={{ marginBottom: 8 }} />
                <TText weight="extraBold" color="#065F46" align="center" style={{ marginBottom: 6 }}>
                  Félicitations !
                </TText>
                <TText variant="caption" color="#065F46" align="center" style={{ marginBottom: 12 }}>
                  Votre email et votre numéro de téléphone sont désormais vérifiés. Votre compte est pleinement sécurisé.
                </TText>
                <Button testID="vp-finish" title="Fermer cette fenêtre" onPress={() => handleClose(true)} icon="checkmark-done" />
              </View>
            ) : null}
          </ScrollView>

          {/* === Confirmation interne d'interruption — overlay au-dessus du contenu === */}
          {confirmOpen ? (
            <View style={styles.confirmOverlay}>
              <View style={[styles.confirmBox, { backgroundColor: themed.neutrals.surface }]}>
                <View style={[styles.confirmIcon, { backgroundColor: "#FEF3C7" }]}>
                  <Ionicons name="alert-circle" size={26} color="#92400E" />
                </View>
                <TText variant="subtitle" weight="extraBold" align="center" style={{ marginTop: 8 }}>
                  Interrompre la vérification ?
                </TText>
                <TText variant="caption" color={themed.neutrals.textSecondary} align="center" style={{ marginTop: 6, lineHeight: 18 }}>
                  Vérifier votre email et votre numéro de téléphone est important pour sécuriser votre compte et débloquer toutes les fonctionnalités. Vous pourrez reprendre cette procédure plus tard via la bannière de rappel.
                </TText>
                <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
                  <TouchableOpacity testID="vp-cancel-interrupt" onPress={cancelInterrupt} style={[styles.confirmBtn, { backgroundColor: themed.primary.base, flex: 1.4 }]}>
                    <TText variant="caption" weight="extraBold" color="white" align="center">Continuer la vérification</TText>
                  </TouchableOpacity>
                  <TouchableOpacity testID="vp-confirm-interrupt" onPress={confirmInterrupt} style={[styles.confirmBtnGhost, { borderColor: themed.neutrals.border, flex: 1 }]}>
                    <TText variant="caption" weight="extraBold" color={themed.status.error} align="center">Interrompre</TText>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", alignItems: "center", padding: 12 },
  sheet: {
    width: "100%",
    maxWidth: 480,
    maxHeight: "92%",
    borderRadius: radii.xxl,
    paddingHorizontal: spacing.lg, paddingTop: 16, paddingBottom: 16,
  },
  header: {
    flexDirection: "row", alignItems: "center",
    paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: colors.neutrals.border,
    marginBottom: 12,
  },
  closeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.neutrals.background },
  label: { letterSpacing: 0.4, marginTop: 8, marginBottom: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  fieldReadonly: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 12, height: 44,
    backgroundColor: colors.neutrals.background,
    borderRadius: radii.lg, borderWidth: 1,
  },
  actionBtn: {
    backgroundColor: colors.primary.base,
    paddingHorizontal: 12, height: 44,
    borderRadius: radii.lg,
    alignItems: "center", justifyContent: "center",
    minWidth: 80,
  },
  timerRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 4, marginBottom: 4 },
  msgBox: {
    flexDirection: "row", alignItems: "flex-start",
    padding: 10, borderRadius: radii.lg, marginTop: 6, borderWidth: 1,
  },
  msgOk: { backgroundColor: "#D1FAE5", borderColor: "#10B981" },
  msgErr: { backgroundColor: "#FEE2E2", borderColor: "#EF4444" },
  divider: { height: 1, backgroundColor: colors.neutrals.border, marginVertical: spacing.md },
  successBox: {
    backgroundColor: "#D1FAE5",
    borderRadius: radii.xl, borderWidth: 1, borderColor: "#10B981",
    padding: spacing.lg,
    alignItems: "center", justifyContent: "center",
    marginTop: spacing.md,
  },
  // Overlay de confirmation d'interruption (au-dessus du contenu)
  confirmOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center", alignItems: "center",
    padding: spacing.lg, zIndex: 50,
    borderRadius: radii.xxl,
  },
  confirmBox: {
    width: "100%", maxWidth: 380,
    borderRadius: radii.xxl,
    padding: spacing.lg,
    alignItems: "center",
    shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  confirmIcon: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  confirmBtn: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: radii.full, alignItems: "center", justifyContent: "center" },
  confirmBtnGhost: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: radii.full, alignItems: "center", justifyContent: "center", borderWidth: 1.5, backgroundColor: "transparent" },
});
