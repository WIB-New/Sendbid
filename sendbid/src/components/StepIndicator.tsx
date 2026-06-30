import React from "react";
import { View, StyleSheet } from "react-native";
import { colors, radii, spacing } from "../theme";

export function StepIndicator({ step, total, testID }: { step: number; total: number; testID?: string }) {
  return (
    <View testID={testID} style={styles.row}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.bar,
            { backgroundColor: i < step ? colors.primary.base : colors.neutrals.border, flex: 1, marginHorizontal: 3 },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", width: "100%", marginVertical: spacing.md },
  bar: { height: 4, borderRadius: radii.full },
});
