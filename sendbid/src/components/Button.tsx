import React from "react";
import { TouchableOpacity, ActivityIndicator, View, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radii, shadows, spacing, fontSize } from "../theme";
import { useThemeTokens } from "../themeContext";
import { TText } from "./TText";

type Variant = "primary" | "secondary" | "biometric" | "ghost" | "danger" | "outline";

type Props = {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle | ViewStyle[];
  textStyle?: TextStyle;
  textColor?: string;
  testID?: string;
  fullWidth?: boolean;
};

/**
 * Button — palette fintech cohérente, theme-aware.
 * - primary  → CTA principal (bleu impérial, texte blanc)
 * - secondary→ CTA sur fond sombre (accent vert, texte sombre)
 * - biometric→ variante biométrie (vert accent)
 * - danger   → rouge
 * - outline  → bordure bleue, fond surface, texte bleu
 * - ghost    → transparent, texte secondaire
 */
export function Button({ title, onPress, variant = "primary", icon, loading, disabled, style, textStyle, textColor, testID, fullWidth = true }: Props) {
  const { tokens } = useThemeTokens();
  const bg =
    variant === "primary"
      ? tokens.primary.base
      : variant === "secondary"
      ? tokens.accent.base
      : variant === "biometric"
      ? tokens.accent.biometric
      : variant === "danger"
      ? tokens.status.error
      : variant === "outline"
      ? tokens.neutrals.surface
      : "transparent";
  const fg =
    variant === "secondary"
      ? tokens.primary.base
      : variant === "outline"
      ? tokens.primary.base
      : variant === "ghost"
      ? tokens.neutrals.textSecondary
      : tokens.neutrals.white;
  const borderColor = variant === "outline" ? tokens.primary.base : "transparent";
  const finalFg = textColor || (textStyle as any)?.color || fg;
  return (
    <TouchableOpacity
      testID={testID}
      activeOpacity={0.85}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.btn,
        fullWidth && { width: "100%" },
        { backgroundColor: bg, borderColor, borderWidth: variant === "outline" ? 1.5 : 0, opacity: disabled ? 0.5 : 1 },
        variant === "biometric" ? shadows.lg : variant === "primary" || variant === "secondary" || variant === "danger" ? shadows.md : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={finalFg} />
      ) : (
        <View style={styles.row}>
          {icon ? <Ionicons name={icon} size={20} color={finalFg} style={{ marginRight: 8 }} /> : null}
          <TText weight="bold" color={finalFg} style={[{ fontSize: fontSize.base }, textStyle]}>
            {title}
          </TText>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 56,
    borderRadius: radii.xl,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
});
