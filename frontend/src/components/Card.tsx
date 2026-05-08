import React from "react";
import { View, StyleSheet } from "react-native";
import { colors, radii, spacing, shadows } from "../theme";

type Props = {
  children: React.ReactNode;
  style?: any;
  padded?: boolean;
};

export function Card({ children, style, padded = true }: Props) {
  return (
    <View style={[styles.card, padded ? { padding: spacing.lg } : null, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.neutrals.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.neutrals.border,
    ...shadows.sm,
  },
});
