/**
 * Icône bouclier flottante globale (affichée sur toutes les pages).
 * v3 — Repositionné en HAUT à droite (près de la cloche), animation
 *       multi-couches (pulse + glow + sparkle rotatif) pour ne pas
 *       passer inaperçu. Toujours présent tant que email OU phone non vérifié.
 *
 *  - Position FIXE en haut-droit, sous la status bar (useSafeAreaInsets)
 *  - Effet clignotant (opacity 1 ↔ 0.4) + scintillement (scale 1 ↔ 1.18)
 *  - Halo coloré pulsant à l'arrière-plan
 *  - Petite étoile de scintillement qui tourne en orbite
 *  - Reste cliquable → ré-ouvre la popup de vérification
 */
import React, { useEffect, useRef } from "react";
import {
  Animated,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Easing,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../store";
import { useVerifPopup } from "../uiState";
import { radii } from "../theme";

export default function VerificationShieldFloating() {
  const user = useAuth((s) => s.user);
  const show = useVerifPopup((s) => s.show);
  const popupOpen = useVerifPopup((s) => s.open);
  const splashOpen = useVerifPopup((s) => s.splashOpen);
  const insets = useSafeAreaInsets();

  // Trois animations parallèles
  const pulse = useRef(new Animated.Value(1)).current;     // opacity du bouclier
  const glow = useRef(new Animated.Value(0)).current;      // halo (cercle exterieur)
  const sparkle = useRef(new Animated.Value(0)).current;   // rotation continue (0 → 1 → 0)

  useEffect(() => {
    // 1) Pulse — opacity + scale (rythme rapide)
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.35,
          duration: 550,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 550,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    // 2) Glow — halo expanding/contracting plus lent
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 1100,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0,
          duration: 1100,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    // 3) Sparkle — étoile qui tourne en orbite + opacity sinusoïdale
    const sparkleLoop = Animated.loop(
      Animated.timing(sparkle, {
        toValue: 1,
        duration: 2400,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    pulseLoop.start();
    glowLoop.start();
    sparkleLoop.start();
    return () => {
      pulseLoop.stop();
      glowLoop.stop();
      sparkleLoop.stop();
    };
  }, [pulse, glow, sparkle]);

  const visible =
    !!user &&
    (!user.email_verified || !user.phone_verified) &&
    !popupOpen &&
    !splashOpen;
  if (!visible) return null;

  // Position : haut-droite, juste sous la status bar (mais au-dessus des headers).
  // Décalé de la cloche habituelle (~14px) pour rester visible sans la chevaucher.
  const topPos =
    (insets.top || (Platform.OS === "ios" ? 44 : 24)) + 8;

  const sparkleAngle = sparkle.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });
  const sparkleOpacity = sparkle.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [0.2, 1, 0.6, 1, 0.2],
  });

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { top: topPos }]}
    >
      {/* Halo pulsant (cercle extérieur) — purement décoratif */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glow,
          {
            opacity: glow.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.6],
            }),
            transform: [
              {
                scale: glow.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.7, 1.8],
                }),
              },
            ],
          },
        ]}
      />
      {/* Sparkle orbital */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.sparkleOrbit,
          {
            opacity: sparkleOpacity,
            transform: [{ rotate: sparkleAngle }],
          },
        ]}
      >
        <View style={styles.sparkleDot}>
          <Ionicons name="sparkles" size={10} color="#FCD34D" />
        </View>
      </Animated.View>

      {/* Bouclier cliquable */}
      <Animated.View
        style={{
          opacity: pulse,
          transform: [
            {
              scale: pulse.interpolate({
                inputRange: [0.35, 1],
                outputRange: [1.18, 1],
              }),
            },
          ],
        }}
      >
        <TouchableOpacity
          testID="floating-verify-shield"
          onPress={show}
          style={styles.btn}
          activeOpacity={0.85}
          accessibilityLabel="Vérifier votre compte"
        >
          <Ionicons name="shield-half" size={18} color="white" />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const SIZE = 38;
const SHIELD_COLOR = "#B91C1C"; // Lot 5 — rouge sombre demandé par l'utilisateur (au lieu du #F59E0B orange)

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    right: 64, // décalé à gauche de l'emplacement de la cloche (qui est à ~14)
    zIndex: 99999,
    width: SIZE,
    height: SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  glow: {
    position: "absolute",
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: SHIELD_COLOR,
    shadowColor: SHIELD_COLOR,
    shadowOpacity: 0.85,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  sparkleOrbit: {
    position: "absolute",
    width: SIZE + 14,
    height: SIZE + 14,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  sparkleDot: {
    width: 12,
    height: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -2,
  },
  btn: {
    width: SIZE,
    height: SIZE,
    borderRadius: radii.full,
    backgroundColor: SHIELD_COLOR,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: SHIELD_COLOR,
    shadowOpacity: 0.6,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 8,
    borderWidth: 2,
    borderColor: "white",
  },
});
