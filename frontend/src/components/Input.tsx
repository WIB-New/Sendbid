import React, { forwardRef, useState } from "react";
import { TextInput, View, StyleSheet, TextInputProps, TouchableOpacity, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, fontFamily, fontSize } from "../theme";
import { TText } from "./TText";

type Props = TextInputProps & {
  label?: string;
  error?: string | null;
  icon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightPress?: () => void;
  passwordToggle?: boolean;
  hint?: string;
  testID?: string;
};

export const Input = forwardRef<TextInput, Props>(function Input(
  { label, error, icon, rightIcon, onRightPress, passwordToggle, hint, secureTextEntry, testID, style, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(!!secureTextEntry);
  return (
    <View style={{ width: "100%", marginBottom: spacing.md }}>
      {label ? (
        <TText variant="caption" weight="semiBold" color={colors.neutrals.textSecondary} style={{ marginBottom: 6 }}>
          {label}
        </TText>
      ) : null}
      <View
        style={[
          styles.box,
          { borderColor: error ? colors.status.error : focused ? colors.primary.base : colors.neutrals.border },
        ]}
      >
        {icon ? <Ionicons name={icon} size={18} color={colors.neutrals.textSecondary} style={{ marginRight: 8 }} /> : null}
        <TextInput
          ref={ref}
          testID={testID}
          placeholderTextColor={colors.neutrals.textTertiary}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          secureTextEntry={passwordToggle ? hidden : secureTextEntry}
          style={[
            {
              flex: 1,
              fontFamily: fontFamily.regular,
              fontSize: fontSize.base,
              color: colors.neutrals.textPrimary,
              paddingVertical: 0,
              // Désactive l'outline noir par défaut du navigateur en RN Web
              ...(Platform.OS === "web" ? { outlineStyle: "none", outlineWidth: 0 } : {}),
            } as any,
            style as any,
          ]}
          {...rest}
        />
        {passwordToggle ? (
          <TouchableOpacity onPress={() => setHidden((p) => !p)} hitSlop={10}>
            <Ionicons name={hidden ? "eye-outline" : "eye-off-outline"} size={20} color={colors.neutrals.textSecondary} />
          </TouchableOpacity>
        ) : rightIcon ? (
          <TouchableOpacity onPress={onRightPress} hitSlop={10}>
            <Ionicons name={rightIcon} size={20} color={colors.neutrals.textSecondary} />
          </TouchableOpacity>
        ) : null}
      </View>
      {error ? (
        <TText variant="caption" color={colors.status.error} style={{ marginTop: 4 }}>
          {error}
        </TText>
      ) : hint ? (
        <TText variant="caption" color={colors.neutrals.textTertiary} style={{ marginTop: 4 }}>
          {hint}
        </TText>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  box: {
    height: 56,
    borderRadius: radii.xl,
    backgroundColor: colors.neutrals.surface,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
  },
});
