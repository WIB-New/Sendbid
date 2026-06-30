import React from "react";
import { View, StyleSheet } from "react-native";
import { radii, spacing, shadows } from "../theme";
import { useThemeTokens } from "../themeContext";

type Props = {
  children: React.ReactNode;
  style?: any;
  padded?: boolean;
};

export function Card({ children, style, padded = true }: Props) {
  const { tokens } = useThemeTokens();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: tokens.neutrals.surface, borderColor: tokens.neutrals.border },
        padded ? { padding: spacing.lg } : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
    borderWidth: 1,
    ...shadows.sm,
  },
});
