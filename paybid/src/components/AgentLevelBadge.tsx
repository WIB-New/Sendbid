/**
 * AgentLevelBadge — Calcule et affiche le niveau de l'agent.
 *
 * Logique :
 *   Bronze   : 0-49 transferts OU rating < 4.0
 *   Silver   : 50-199 transferts ET rating >= 4.2
 *   Gold     : 200-999 transferts ET rating >= 4.5
 *   Platinum : >= 1000 transferts ET rating >= 4.7
 */
import React from "react";
import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TText } from "./TText";

type LevelKey = "bronze" | "silver" | "gold" | "platinum";

const LEVELS: Record<LevelKey, { label: string; color: string; bg: string; icon: any }> = {
  bronze:   { label: "Bronze",   color: "#92400E", bg: "#FEF3C7", icon: "medal-outline" },
  silver:   { label: "Silver",   color: "#475569", bg: "#E2E8F0", icon: "medal-outline" },
  gold:     { label: "Gold",     color: "#92400E", bg: "#FDE68A", icon: "trophy-outline" },
  platinum: { label: "Platinum", color: "#1E1B4B", bg: "#C7D2FE", icon: "star" },
};

export function computeAgentLevel(rating: number = 0, transfersCount: number = 0): LevelKey {
  if (transfersCount >= 1000 && rating >= 4.7) return "platinum";
  if (transfersCount >= 200 && rating >= 4.5) return "gold";
  if (transfersCount >= 50 && rating >= 4.2) return "silver";
  return "bronze";
}

export function AgentLevelBadge({ rating = 0, transfersCount = 0, compact = false }: { rating?: number; transfersCount?: number; compact?: boolean }) {
  const lvl = computeAgentLevel(rating, transfersCount);
  const cfg = LEVELS[lvl];
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }, compact && { paddingHorizontal: 8, paddingVertical: 3 }]}>
      <Ionicons name={cfg.icon} size={compact ? 12 : 14} color={cfg.color} />
      <TText
        weight="extraBold"
        color={cfg.color}
        style={{ marginLeft: 4, fontSize: compact ? 10 : 12, letterSpacing: 0.5 }}
      >
        {cfg.label.toUpperCase()}
      </TText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
});
