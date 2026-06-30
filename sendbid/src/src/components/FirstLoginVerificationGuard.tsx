/**
 * FirstLoginVerificationGuard v8
 * - 30s après 1ère connexion → splash "Vérification de sécurité" (3,5s)
 * - puis chaîne automatiquement vers VerificationPopup
 * - L'icône bouclier dans le header (cf. (tabs)/index.tsx) ré-ouvre la popup à tout moment.
 * - La bannière persistante de rappel a été retirée (remplacée par l'icône header).
 */
import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { TText } from "./TText";
import VerificationPopup from "./VerificationPopup";
import { api } from "../api";
import { useAuth } from "../store";
import { useVerifPopup } from "../uiState";
import { colors, spacing, radii } from "../theme";

const FIRST_LOGIN_TRIGGER_MS = 30 * 1000;
const SPLASH_DURATION_MS = 3500;

export default function FirstLoginVerificationGuard() {
  const user = useAuth((s) => s.user);
  const popupOpen = useVerifPopup((s) => s.open);
  const splashOpen = useVerifPopup((s) => s.splashOpen);
  const showPopup = useVerifPopup((s) => s.show);
  const hidePopup = useVerifPopup((s) => s.hide);
  const showSplash = useVerifPopup((s) => s.showSplash);
  const hideSplash = useVerifPopup((s) => s.hideSplash);

  const timerRef = useRef<any>(null);
  const splashTimerRef = useRef<any>(null);
  const [triggered, setTriggered] = useState(false);

  const needsVerification = !!user && (!user.email_verified || !user.phone_verified);
  const popupAlreadyShown = !!(user as any)?.verification_popup_shown_at;

  useEffect(() => {
    if (!user || !needsVerification || popupAlreadyShown || triggered) return;
    timerRef.current = setTimeout(() => {
      setTriggered(true);
      showSplash();
      splashTimerRef.current = setTimeout(() => {
        hideSplash();
        showPopup();
      }, SPLASH_DURATION_MS);
    }, FIRST_LOGIN_TRIGGER_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (splashTimerRef.current) clearTimeout(splashTimerRef.current);
    };
  }, [user?.id, needsVerification, popupAlreadyShown, triggered]);

  const handlePopupClose = async () => {
    hidePopup();
    try {
      await api.post("/auth/mark-verification-popup-shown");
      // v10 — Spec item 2 : forcer la mise à jour locale de `verification_popup_shown_at`
      // afin que la popup NE RÉAPPARAISSE JAMAIS pendant cette session
      // (sans dépendre d'un re-login). Seule l'icône bouclier reste comme rappel.
      const { refreshMe } = useAuth.getState();
      await refreshMe();
    } catch {}
  };

  return (
    <>
      {/* === Splash "Vérification de sécurité" === */}
      <Modal visible={splashOpen} transparent animationType="fade" onRequestClose={hideSplash}>
        <View style={styles.splashBackdrop}>
          <LinearGradient colors={["#022a6b", "#052080", "#011645"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.splashSheet}>
            <View style={styles.splashIconWrap}>
              <Ionicons name="shield-checkmark" size={48} color="white" />
            </View>
            <TText variant="title" weight="extraBold" color="white" align="center" style={{ marginTop: 12 }}>
              Vérification de sécurité
            </TText>
            <TText variant="caption" color="rgba(255,255,255,0.92)" align="center" style={{ marginTop: 8, lineHeight: 19 }}>
              Pour protéger votre compte SENDBID, nous allons vérifier votre adresse e-mail ainsi que votre numéro de téléphone. Cette étape est obligatoire et ne prendra que quelques instants.
            </TText>
            <View style={styles.splashSteps}>
              {[
                { icon: "mail", label: "1. E-mail" },
                { icon: "call", label: "2. Téléphone" },
                { icon: "checkmark-done", label: "3. Confirmé" },
              ].map((s, i) => (
                <View key={s.label} style={{ flex: 1, alignItems: "center" }}>
                  <View style={styles.splashStepIcon}>
                    <Ionicons name={s.icon as any} size={18} color="white" />
                  </View>
                  <TText variant="label" weight="extraBold" color="white" style={{ marginTop: 4, fontSize: 10 }}>{s.label}</TText>
                  {i < 2 ? <View style={styles.splashStepBar} pointerEvents="none" /> : null}
                </View>
              ))}
            </View>
            <TText variant="caption" weight="bold" color="rgba(255,255,255,0.85)" align="center" style={{ marginTop: 14 }}>
              La procédure démarre dans quelques instants…
            </TText>
          </LinearGradient>
        </View>
      </Modal>

      {/* === Popup principal de vérification === */}
      <VerificationPopup visible={popupOpen} onClose={handlePopupClose} />
    </>
  );
}

const styles = StyleSheet.create({
  splashBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "center", alignItems: "center", padding: 18 },
  splashSheet: {
    width: "100%", maxWidth: 420,
    borderRadius: radii.xxl,
    padding: spacing.xl,
    alignItems: "center",
    shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  splashIconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center", justifyContent: "center",
  },
  splashSteps: { flexDirection: "row", marginTop: 18, width: "100%" },
  splashStepIcon: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center", justifyContent: "center",
  },
  splashStepBar: {
    position: "absolute", top: 17, right: -30, width: 60, height: 2,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
});
