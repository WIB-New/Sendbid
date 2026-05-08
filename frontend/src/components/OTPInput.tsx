import React, { useEffect, useRef, useState } from "react";
import { View, TextInput, StyleSheet, Platform } from "react-native";
import { colors, radii, spacing, fontFamily, fontSize } from "../theme";

type Props = {
  length?: number;
  value: string;
  onChange: (val: string) => void;
  testIDPrefix?: string;
  autoFocus?: boolean;
};

export function OTPInput({ length = 6, value, onChange, testIDPrefix = "otp", autoFocus }: Props) {
  const refs = useRef<Array<TextInput | null>>([]);
  const [chars, setChars] = useState<string[]>(Array.from({ length }, (_, i) => value[i] || ""));

  useEffect(() => {
    setChars(Array.from({ length }, (_, i) => value[i] || ""));
  }, [value, length]);

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  const setAt = (i: number, ch: string) => {
    const c = ch.replace(/\D/g, "").slice(-1);
    const next = [...chars];
    next[i] = c;
    setChars(next);
    onChange(next.join(""));
    if (c && i < length - 1) refs.current[i + 1]?.focus();
  };

  const onKey = (i: number, key: string) => {
    if (key === "Backspace" && !chars[i] && i > 0) {
      refs.current[i - 1]?.focus();
    }
  };

  return (
    <View style={styles.row}>
      {Array.from({ length }).map((_, i) => (
        <TextInput
          key={i}
          ref={(r) => {
            refs.current[i] = r;
          }}
          testID={`${testIDPrefix}-cell-${i}`}
          value={chars[i]}
          onChangeText={(t) => setAt(i, t)}
          onKeyPress={({ nativeEvent }) => onKey(i, nativeEvent.key)}
          keyboardType={Platform.OS === "web" ? "default" : "number-pad"}
          maxLength={1}
          style={[
            styles.cell,
            { borderColor: chars[i] ? colors.primary.base : colors.neutrals.border },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", width: "100%" },
  cell: {
    width: 48,
    height: 56,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    backgroundColor: colors.neutrals.surface,
    textAlign: "center",
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    color: colors.neutrals.textPrimary,
  },
});
