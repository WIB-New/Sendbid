import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TText } from "./TText";
import { colors, radii, spacing } from "../theme";

type Props = {
  pin: string;
  onChange: (pin: string) => void;
  length?: number;
  testIDPrefix?: string;
};

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"];

export function PINPad({ pin, onChange, length = 6, testIDPrefix = "pinpad" }: Props) {
  const press = (k: string) => {
    if (k === "back") onChange(pin.slice(0, -1));
    else if (k && pin.length < length) onChange(pin + k);
  };
  return (
    <View>
      <View style={styles.dotsRow}>
        {Array.from({ length }).map((_, i) => (
          <View
            key={i}
            testID={`${testIDPrefix}-dot-${i}`}
            style={[styles.dot, { backgroundColor: i < pin.length ? colors.primary.base : colors.neutrals.border }]}
          />
        ))}
      </View>
      <View style={styles.grid}>
        {KEYS.map((k, idx) => (
          <TouchableOpacity
            key={idx}
            disabled={!k}
            testID={`${testIDPrefix}-key-${k || "empty"}`}
            activeOpacity={0.6}
            onPress={() => press(k)}
            style={[styles.key, !k && { opacity: 0 }]}
          >
            {k === "back" ? (
              <Ionicons name="backspace-outline" size={28} color="#0F172A" />
            ) : (
              // v13 — Spec utilisateur : chiffres LISIBLES, contrastés.
              // On force la couleur en noir foncé pour éviter l'héritage d'un thème
              // sombre/sourd qui rendait les touches presque invisibles.
              <TText weight="extraBold" color="#0F172A" style={{ fontSize: 28 }}>
                {k}
              </TText>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dotsRow: { flexDirection: "row", justifyContent: "center", gap: 14, marginBottom: spacing.xl },
  dot: { width: 16, height: 16, borderRadius: radii.full },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center" },
  key: {
    width: "33.33%",
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    // léger fond gris très clair pour mieux distinguer les touches
    backgroundColor: "transparent",
  },
});
