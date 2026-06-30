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
import { LinearGradient } from "expo-linear-gradient";
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
          {/* === Header avec gradient bleu === */}
          <LinearGradient colors={["#022a6b", "#3B82F6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerGradient}>
            <View style={styles.headerInner}>
              <View style={styles.headerIconCircle}>
                <Ionicons name="shield-checkmark" size={22} color="white" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <TText variant="subtitle" weight="extraBold" color="white">Vérification de votre compte</TText>
                <TText variant="label" color="rgba(255,255,255,0.85)" style={{ marginTop: 2 }}>
                  Sécurisez votre accès en quelques secondes
                </TText>
              </View>
              <TouchableOpacity testID="vp-close" onPress={() => handleClose(bothDone)} style={styles.closeBtn} accessibilityLabel="Fermer la fenêtre">
                <Ionicons name="close" size={20} color="white" />
              </TouchableOpacity>
            </View>
          </LinearGradient>

          <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }} keyboardShouldPersistTaps="handled">
            {/* ========================= SECTION EMAIL ========================= */}
            {emailVerified ? (
              // Carte condensée verte si email déjà vérifié
              <View style={styles.verifiedCard}>
                <View style={styles.verifiedIcon}>
                  <Ionicons name="checkmark-circle" size={22} color="white" />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <TText variant="caption" weight="extraBold" color="#065F46">Email vérifié</TText>
                  <TText variant="label" color="#047857" numberOfLines={1}>{user?.email || "—"}</TText>
                </View>
                <Ionicons name="mail" size={18} color="#10B981" />
              </View>
            ) : (
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionDot, { backgroundColor: "#3B82F6" }]}>
                    <Ionicons name="mail" size={16} color="white" />
                  </View>
                  <TText variant="caption" weight="extraBold" color="#022a6b" style={{ marginLeft: 8, letterSpacing: 0.4 }}>
                    ÉTAPE 1 — EMAIL
                  </TText>
                </View>

                {/* Email + bouton Vérifier */}
                <TText variant="caption" weight="semiBold" color={themed.neutrals.textSecondary} style={styles.label}>Adresse email d'inscription</TText>
                <View style={styles.row}>
                  <View style={[styles.fieldReadonly, { flex: 1, borderColor: themed.neutrals.border }]}>
                    <Ionicons name="mail-outline" size={16} color={themed.neutrals.textSecondary} />
                    <TText weight="semiBold" style={{ marginLeft: 8, flex: 1 }} numberOfLines={1}>{user?.email || "—"}</TText>
                  </View>
                  <TouchableOpacity testID="vp-send-email" disabled={emailLoadingSend} onPress={sendEmailCode} style={[styles.actionBtnBlue, emailLoadingSend && { opacity: 0.5 }]}>
                    <TText variant="caption" weight="extraBold" color="white">{emailLoadingSend ? "..." : "Envoyer code"}</TText>
                  </TouchableOpacity>
                </View>

                {/* Code OTP email */}
                <TText variant="caption" weight="semiBold" color={themed.neutrals.textSecondary} style={styles.label}>Code reçu par email</TText>
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
                    />
                  </View>
                  <TouchableOpacity testID="vp-validate-email" disabled={emailLoadingVerify || emailOtp.length < 4} onPress={verifyEmailCode} style={[styles.actionBtnBlue, (emailLoadingVerify || emailOtp.length < 4) && { opacity: 0.4 }]}>
                    <TText variant="caption" weight="extraBold" color="white">Valider</TText>
                  </TouchableOpacity>
                </View>
                <View style={styles.timerRow}>
                  {emailLeft > 0 ? (
                    <TText variant="label" color={themed.neutrals.textSecondary}>
                      Renvoi possible dans <TText weight="extraBold">{emailLeft}s</TText>
                    </TText>
                  ) : (
                    <TouchableOpacity testID="vp-resend-email" disabled={emailLoadingSend} onPress={sendEmailCode}>
                      <TText variant="label" weight="extraBold" color="#3B82F6">↻ Renvoyer le code</TText>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Message confirmation/erreur email */}
                {emailMsg.type ? (
                  <View style={[styles.msgBox, emailMsg.type === "ok" ? styles.msgOk : styles.msgErr]}>
                    <Ionicons name={emailMsg.type === "ok" ? "checkmark-circle" : "alert-circle"} size={16} color={emailMsg.type === "ok" ? "#065F46" : "#991B1B"} />
                    <TText variant="label" color={emailMsg.type === "ok" ? "#065F46" : "#991B1B"} style={{ marginLeft: 6, flex: 1 }}>
                      {emailMsg.text}
                    </TText>
                  </View>
                ) : null}
              </View>
            )}

            {/* ========================= SECTION PHONE ========================= */}
            {phoneVerified ? (
              // Carte condensée verte si téléphone déjà vérifié
              <View style={[styles.verifiedCard, { marginTop: 10 }]}>
                <View style={styles.verifiedIcon}>
                  <Ionicons name="checkmark-circle" size={22} color="white" />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <TText variant="caption" weight="extraBold" color="#065F46">Numéro de téléphone vérifié</TText>
                  <TText variant="label" color="#047857" numberOfLines={1}>{user?.phone || "—"}</TText>
                </View>
                <Ionicons name="call" size={18} color="#10B981" />
              </View>
            ) : (
              <View style={[styles.sectionCard, { marginTop: 10, backgroundColor: "#FFF7ED", borderColor: "#FED7AA" }]}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionDot, { backgroundColor: "#F59E0B" }]}>
                    <Ionicons name="call" size={16} color="white" />
                  </View>
                  <TText variant="caption" weight="extraBold" color="#92400E" style={{ marginLeft: 8, letterSpacing: 0.4 }}>
                    ÉTAPE 2 — TÉLÉPHONE
                  </TText>
                </View>

                <TText variant="caption" weight="semiBold" color={themed.neutrals.textSecondary} style={styles.label}>Numéro de téléphone d'inscription</TText>
                <View style={styles.row}>
                  <View style={[styles.fieldReadonly, { flex: 1, borderColor: themed.neutrals.border }]}>
                    <Ionicons name="call-outline" size={16} color={themed.neutrals.textSecondary} />
                    <TText weight="semiBold" style={{ marginLeft: 8, flex: 1 }} numberOfLines={1}>{user?.phone || "—"}</TText>
                  </View>
                  <TouchableOpacity testID="vp-send-phone" disabled={phoneLoadingSend} onPress={sendPhoneCode} style={[styles.actionBtnOrange, phoneLoadingSend && { opacity: 0.5 }]}>
                    <TText variant="caption" weight="extraBold" color="white">{phoneLoadingSend ? "..." : "Envoyer code"}</TText>
                  </TouchableOpacity>
                </View>

                <TText variant="caption" weight="semiBold" color={themed.neutrals.textSecondary} style={styles.label}>Code reçu par SMS</TText>
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
                    />
                  </View>
                  <TouchableOpacity testID="vp-validate-phone" disabled={phoneLoadingVerify || phoneOtp.length < 4} onPress={verifyPhoneCode} style={[styles.actionBtnOrange, (phoneLoadingVerify || phoneOtp.length < 4) && { opacity: 0.4 }]}>
                    <TText variant="caption" weight="extraBold" color="white">Valider</TText>
                  </TouchableOpacity>
                </View>
                <View style={styles.timerRow}>
                  {phoneLeft > 0 ? (
                    <TText variant="label" color={themed.neutrals.textSecondary}>
                      Renvoi possible dans <TText weight="extraBold">{phoneLeft}s</TText>
                    </TText>
                  ) : (
                    <TouchableOpacity testID="vp-resend-phone" disabled={phoneLoadingSend} onPress={sendPhoneCode}>
                      <TText variant="label" weight="extraBold" color="#F59E0B">↻ Renvoyer le code</TText>
                    </TouchableOpacity>
                  )}
                </View>

                {phoneMsg.type ? (
                  <View style={[styles.msgBox, phoneMsg.type === "ok" ? styles.msgOk : styles.msgErr]}>
                    <Ionicons name={phoneMsg.type === "ok" ? "checkmark-circle" : "alert-circle"} size={16} color={phoneMsg.type === "ok" ? "#065F46" : "#991B1B"} />
                    <TText variant="label" color={phoneMsg.type === "ok" ? "#065F46" : "#991B1B"} style={{ marginLeft: 6, flex: 1 }}>
                      {phoneMsg.text}
                    </TText>
                  </View>
                ) : null}
              </View>
            )}

            {/* ========================= FÉLICITATIONS ========================= */}
            {bothDone ? (
              <LinearGradient colors={["#10B981", "#059669"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.successBox}>
                <View style={styles.trophyCircle}>
                  <Ionicons name="trophy" size={32} color="#FBBF24" />
                </View>
                <TText variant="title" weight="extraBold" color="white" align="center" style={{ marginTop: 10 }}>
                  Félicitations !
                </TText>
                <TText variant="caption" color="rgba(255,255,255,0.95)" align="center" style={{ marginTop: 6, lineHeight: 18 }}>
                  Votre email et votre numéro de téléphone sont désormais vérifiés. Votre compte est pleinement sécurisé et toutes les fonctionnalités sont débloquées.
                </TText>
                <View style={{ width: "100%", marginTop: 14 }}>
                  <Button testID="vp-finish" title="Fermer cette fenêtre" onPress={() => handleClose(true)} icon="checkmark-done" style={{ backgroundColor: "white" }} textStyle={{ color: "#059669" } as any} />
                </View>
              </LinearGradient>
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
    overflow: "hidden",
  },
  // Header gradient bleu
  headerGradient: { paddingHorizontal: spacing.lg, paddingVertical: 14 },
  headerInner: { flexDirection: "row", alignItems: "center" },
  headerIconCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
  },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
  },

  // Carte section (email = bleu, phone = orange via override)
  sectionCard: {
    backgroundColor: "#EFF6FF",
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    padding: spacing.md,
  },
  sectionHeader: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  sectionDot: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
  },

  // Carte condensée verte pour canal déjà vérifié
  verifiedCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#ECFDF5",
    borderRadius: radii.xl,
    borderWidth: 1, borderColor: "#10B981",
    padding: spacing.md,
  },
  verifiedIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#10B981",
    alignItems: "center", justifyContent: "center",
  },

  label: { letterSpacing: 0.3, marginTop: 8, marginBottom: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  fieldReadonly: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 12, height: 44,
    backgroundColor: "white",
    borderRadius: radii.lg, borderWidth: 1,
  },
  // Boutons d'action colorés (bleu pour email, orange pour phone)
  actionBtnBlue: {
    backgroundColor: "#3B82F6",
    paddingHorizontal: 12, height: 44,
    borderRadius: radii.lg,
    alignItems: "center", justifyContent: "center",
    minWidth: 100,
  },
  actionBtnOrange: {
    backgroundColor: "#F59E0B",
    paddingHorizontal: 12, height: 44,
    borderRadius: radii.lg,
    alignItems: "center", justifyContent: "center",
    minWidth: 100,
  },
  timerRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 4, marginBottom: 4 },
  msgBox: {
    flexDirection: "row", alignItems: "flex-start",
    padding: 10, borderRadius: radii.lg, marginTop: 6, borderWidth: 1,
  },
  msgOk: { backgroundColor: "#D1FAE5", borderColor: "#10B981" },
  msgErr: { backgroundColor: "#FEE2E2", borderColor: "#EF4444" },
  divider: { height: 1, backgroundColor: colors.neutrals.border, marginVertical: spacing.md },

  // Box de félicitations avec gradient vert
  successBox: {
    borderRadius: radii.xxl,
    padding: spacing.lg,
    alignItems: "center", justifyContent: "center",
    marginTop: spacing.md,
  },
  trophyCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
  },

  // Overlay confirmation d'interruption (inchangé)
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
