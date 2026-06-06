/**
 * FirstLoginVerificationGuard — orchestre la procédure de vérification
 * email + téléphone post 1ère connexion.
 *
 * Spec v7 :
 * - Déclenche la popup VerificationPopup 30 sec après l'arrivée du user dans (tabs)
 *   SI : user.first_login_at est récent ET la popup n'a jamais été montrée
 *   ET au moins email_verified OU phone_verified est false.
 * - Si l'utilisateur interrompt sans finir → bannière de rappel persistante en
 *   bas de l'écran (lien pour ré-ouvrir la popup à tout moment).
 */
import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, TouchableOpacity, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TText } from "./TText";
import VerificationPopup from "./VerificationPopup";
import { api } from "../api";
import { useAuth } from "../store";
import { colors, spacing, radii } from "../theme";
import { useThemedColors } from "../themeContext";

const FIRST_LOGIN_TRIGGER_MS = 30 * 1000; // 30 sec après 1ère connexion

export default function FirstLoginVerificationGuard() {
  const themed = useThemedColors();
  const user = useAuth((s) => s.user);
  const [open, setOpen] = useState(false);
  const [reminderHidden, setReminderHidden] = useState(false);
  const timerRef = useRef<any>(null);

  const needsVerification = !!user && (!user.email_verified || !user.phone_verified);
  const popupAlreadyShown = !!(user as any)?.verification_popup_shown_at;

  // === Trigger 30s après 1ère connexion ===
  useEffect(() => {
    if (!user) return;
    if (!needsVerification) return;
    if (popupAlreadyShown) return; // ne se déclenche qu'une seule fois automatique

    // Délai 30 sec
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setOpen(true);
    }, FIRST_LOGIN_TRIGGER_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [user?.id, needsVerification, popupAlreadyShown]);

  const handleClose = async (completed: boolean) => {
    setOpen(false);
    // Marquer côté backend pour ne plus auto-déclencher
    try {
      await api.post("/auth/mark-verification-popup-shown");
    } catch {}
    if (!completed) {
      // L'utilisateur a interrompu — on affiche la bannière de rappel
      setReminderHidden(false);
    }
  };

  // === Bannière de rappel ===
  // Visible SI :
  //  - user a besoin de vérifier (au moins un canal non vérifié)
  //  - popup a déjà été montrée une fois (popupAlreadyShown)
  //  - reminder pas masqué manuellement pour cette session
  const showReminder = !!user && needsVerification && popupAlreadyShown && !open && !reminderHidden;

  return (
    <>
      <VerificationPopup visible={open} onClose={handleClose} />
      {showReminder ? (
        <View
          testID="vp-reminder-banner"
          style={[styles.banner, { backgroundColor: themed.status.warning + "1A", borderColor: themed.status.warning }]}
          pointerEvents="box-none"
        >
          <View style={{ flexDirection: "row", alignItems: "center", padding: 10 }}>
            <Ionicons name="shield-checkmark-outline" size={20} color={themed.status.warning} />
            <View style={{ flex: 1, marginHorizontal: 10 }}>
              <TText variant="caption" weight="extraBold" color={themed.neutrals.textPrimary}>
                Sécurisez votre compte
              </TText>
              <TText variant="label" color={themed.neutrals.textSecondary}>
                Vérifiez votre email et votre téléphone pour débloquer toutes les fonctionnalités.
              </TText>
            </View>
            <TouchableOpacity testID="vp-reminder-open" onPress={() => setOpen(true)} style={[styles.cta, { backgroundColor: themed.primary.base }]}>
              <TText variant="label" weight="extraBold" color="white">Vérifier</TText>
            </TouchableOpacity>
            <TouchableOpacity testID="vp-reminder-dismiss" onPress={() => setReminderHidden(true)} style={{ marginLeft: 6, padding: 4 }}>
              <Ionicons name="close" size={18} color={themed.neutrals.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    bottom: Platform.OS === "ios" ? 86 : 70, // au-dessus de la tab bar
    borderRadius: radii.lg,
    borderWidth: 1,
    // Shadow léger pour décoller du fond
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 3,
    backgroundColor: colors.neutrals.surface,
    zIndex: 1000,
  },
  cta: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radii.full },
});
