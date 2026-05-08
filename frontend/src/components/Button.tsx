import React from "react";
import { TouchableOpacity, ActivityIndicator, View, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, shadows, spacing, fontSize } from "../theme";
import { TText } from "./TText";

type Variant = "primary" | "secondary" | "biometric" | "ghost" | "danger" | "outline";

type Props = {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  testID?: string;
  fullWidth?: boolean;
};

/**
 * Button — palette fintech cohérente.
 * - primary  → CTA principal (bleu impérial, texte blanc)
 * - secondary→ CTA sur fond sombre (blanc, texte bleu impérial)
 * - biometric→ variante biométrie (bleu accent, texte blanc)
 * - danger   → rouge
 * - outline  → bordure bleue, fond blanc, texte bleu
 * - ghost    → transparent, texte secondaire
 */
export function Button({ title, onPress, variant = "primary", icon, loading, disabled, style, textStyle, testID, fullWidth = true }: Props) {
  const bg =
    variant === "primary"
      ? colors.primary.base
      : variant === "secondary"
      ? colors.accent.base
      : variant === "biometric"
      ? colors.accent.biometric
      : variant === "danger"
      ? colors.status.error
      : variant === "outline"
      ? colors.neutrals.white
      : "transparent";
  const fg =
    variant === "secondary"
      ? colors.primary.base
      : variant === "outline"
      ? colors.primary.base
      : variant === "ghost"
      ? colors.neutrals.textSecondary
      : colors.neutrals.white;
  const borderColor = variant === "outline" ? colors.primary.base : "transparent";
  const finalFg = (textStyle as any)?.color || fg;
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
