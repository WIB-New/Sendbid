import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, shadows } from "../theme";
import { TText } from "./TText";

type Bid = {
  id: string;
  agent_name: string;
  agent_avatar?: string | null;
  agent_rating: number;
  agent_city: string;
  agent_distance_km: number;
  bid_fee_percent: number;
  eta_minutes: number;
};

export function AgentBidCard({ bid, onAccept, isBest }: { bid: Bid; onAccept: () => void; isBest?: boolean }) {
  return (
    <View style={[styles.card, isBest && { borderColor: colors.accent.base, borderWidth: 1.5 }, shadows.sm]}>
      <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={22} color={colors.neutrals.textSecondary} />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TText variant="body" weight="bold" numberOfLines={1}>
              {bid.agent_name}
            </TText>
            {isBest && (
              <View style={styles.bestBadge}>
                <TText variant="label" weight="bold" color="white">
                  MEILLEUR
                </TText>
              </View>
            )}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
            <Ionicons name="star" size={12} color={colors.status.pending} />
            <TText variant="caption" color={colors.neutrals.textSecondary} style={{ marginLeft: 4 }}>
              {bid.agent_rating.toFixed(1)} • {bid.agent_city} • {bid.agent_distance_km}km • ~{bid.eta_minutes}min
            </TText>
          </View>
        </View>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <TText variant="title" weight="extraBold" color={colors.primary.base}>
          {bid.bid_fee_percent.toFixed(2)}%
        </TText>
        <TouchableOpacity
          testID={`accept-bid-${bid.id}`}
          activeOpacity={0.85}
          onPress={onAccept}
          style={styles.acceptBtn}
        >
          <TText variant="caption" weight="bold" color="white">
            Accepter
          </TText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutrals.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.neutrals.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: colors.neutrals.background,
    alignItems: "center",
    justifyContent: "center",
  },
  bestBadge: {
    backgroundColor: colors.accent.base,
    borderRadius: radii.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  acceptBtn: {
    backgroundColor: colors.accent.base,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.full,
    marginTop: 6,
  },
});
