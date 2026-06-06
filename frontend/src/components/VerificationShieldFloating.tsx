/**
 * Icône bouclier flottante globale (affichée sur toutes les pages).
 * - Visible tant que email OU phone non vérifié.
 * - Clignote pour attirer l'attention (animation opacity + scale).
 * - Petite (32px), positionnée bottom-right au-dessus de la tab bar.
 * - Clic → ré-ouvre la popup de vérification.
 */
import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, TouchableOpacity, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../store";
import { useVerifPopup } from "../uiState";
import { radii } from "../theme";

export default function VerificationShieldFloating() {
  const user = useAuth((s) => s.user);
  const show = useVerifPopup((s) => s.show);
  const popupOpen = useVerifPopup((s) => s.open);
  const splashOpen = useVerifPopup((s) => s.splashOpen);

  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Clignotement doux par boucle infinie
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.55, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const visible = !!user && (!user.email_verified || !user.phone_verified) && !popupOpen && !splashOpen;
  if (!visible) return null;

  return (
    <Animated.View style={[styles.wrap, { opacity: pulse, transform: [{ scale: pulse.interpolate({ inputRange: [0.55, 1], outputRange: [0.95, 1] }) }] }]}>
      <TouchableOpacity
        testID="floating-verify-shield"
        onPress={show}
        style={styles.btn}
        activeOpacity={0.85}
        accessibilityLabel="Vérifier votre compte"
      >
        <Ionicons name="shield-half" size={16} color="white" />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    right: 14,
    bottom: Platform.OS === "ios" ? 82 : 76,
    zIndex: 9999,
  },
  btn: {
    width: 32, height: 32, borderRadius: radii.full,
    backgroundColor: "#F59E0B",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 3 },
    elevation: 5,
    borderWidth: 1.5, borderColor: "white",
  },
});
