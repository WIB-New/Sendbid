import React from "react";
import Svg, { Path, Defs, LinearGradient, Stop, G, Rect } from "react-native-svg";
import { View, StyleSheet } from "react-native";
import { TText } from "./TText";
import { colors, spacing } from "../theme";

type Props = {
  size?: number;
  showText?: boolean;
  variant?: "light" | "dark";
  withBackground?: boolean;
};

/**
 * SENDBID Logo v2 — Diamant avec dégradé bleu → cyan → teal → vert.
 * Inspiré du logo officiel v03 fourni par l'utilisateur.
 * Palette exacte : #2D7DFF (bleu royal) → #22C4E8 (cyan) → #2FDFB0 (teal) → #5CE1A6 (vert menthe)
 */
export function SendBidLogo({ size = 56, showText = false, variant = "dark", withBackground = true }: Props) {
  const textColor = variant === "light" ? "#FFFFFF" : colors.neutrals.textPrimary;
  return (
    <View style={styles.row}>
      <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
        <Defs>
          {/* Fond tuile iOS : gradient diagonal bleu → cyan → teal → vert */}
          <LinearGradient id="sbBg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#2D7DFF" />
            <Stop offset="0.35" stopColor="#22C4E8" />
            <Stop offset="0.75" stopColor="#2FDFB0" />
            <Stop offset="1" stopColor="#5CE1A6" />
          </LinearGradient>
          {/* Top crown : cyan clair brillant */}
          <LinearGradient id="sbTop" x1="20" y1="22" x2="44" y2="38" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#E0F7FF" stopOpacity="0.95" />
            <Stop offset="1" stopColor="#5ED4FF" stopOpacity="0.85" />
          </LinearGradient>
          {/* Left facet : bleu royal profond */}
          <LinearGradient id="sbLeft" x1="20" y1="28" x2="32" y2="55" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#1D5AD6" />
            <Stop offset="1" stopColor="#0F3FA8" />
          </LinearGradient>
          {/* Right facet : cyan moyen */}
          <LinearGradient id="sbRight" x1="32" y1="28" x2="48" y2="55" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#4AB8E8" />
            <Stop offset="1" stopColor="#2A8DD1" />
          </LinearGradient>
          {/* Center pointe : bleu très clair */}
          <LinearGradient id="sbCenter" x1="28" y1="28" x2="36" y2="55" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#BFE9FA" />
            <Stop offset="1" stopColor="#6FC7F5" />
          </LinearGradient>
        </Defs>
        {/* Fond arrondi tuile iOS-style */}
        {withBackground ? (
          <Rect x="0" y="0" width="64" height="64" rx="14" ry="14" fill="url(#sbBg)" />
        ) : null}
        <G>
          {/* Top crown (trapèze haut) */}
          <Path d="M18 28 L32 18 L46 28 L38 28 L32 22 L26 28 Z" fill="url(#sbTop)" />
          {/* Table top (bande horizontale) */}
          <Path d="M18 28 L46 28 L38 28 L26 28 Z" fill="#0F3FA8" fillOpacity="0.2" />
          {/* Left pavilion */}
          <Path d="M18 28 L32 50 L26 28 Z" fill="url(#sbLeft)" />
          {/* Right pavilion */}
          <Path d="M46 28 L32 50 L38 28 Z" fill="url(#sbRight)" />
          {/* Center pavilion (pointe bas) */}
          <Path d="M26 28 L32 50 L38 28 Z" fill="url(#sbCenter)" />
          {/* Highlight reflections */}
          <Path d="M26 28 L32 22 L38 28 Z" fill="#FFFFFF" fillOpacity="0.5" />
          <Path d="M18 28 L26 28 L22 26 L20 27 Z" fill="#FFFFFF" fillOpacity="0.25" />
        </G>
      </Svg>
      {showText ? (
        <View style={{ marginLeft: spacing.sm }}>
          <TText variant="title" weight="extraBold" color={textColor} style={{ letterSpacing: 1 }}>
            SENDBID
          </TText>
          <TText variant="caption" color={variant === "light" ? "rgba(255,255,255,0.8)" : colors.neutrals.textSecondary}>
            Transférez. Simplement.
          </TText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
});
