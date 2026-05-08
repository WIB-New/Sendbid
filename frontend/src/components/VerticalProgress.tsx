import React from "react";
import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TText } from "./TText";
import { colors, spacing, radii } from "../theme";

export type ProgressStep = {
  key: string;
  label: string;
  description?: string;
  state: "completed" | "active" | "pending" | "failed";
  timestamp?: string;
};

type Props = {
  steps: ProgressStep[];
};

/**
 * Vertical progress bar used to track a transfer journey
 * (DRAFT → BIDDING → AGENT_ASSIGNED → PROCESSING → COMPLETED).
 * Shows iconified circles connected by colored vertical bars.
 */
export function VerticalProgress({ steps }: Props) {
  return (
    <View>
      {steps.map((s, idx) => {
        const isLast = idx === steps.length - 1;
        const dotColor =
          s.state === "completed"
            ? colors.status.success
            : s.state === "active"
            ? colors.primary.base
            : s.state === "failed"
            ? colors.status.error
            : colors.neutrals.border;
        const lineColor =
          s.state === "completed"
            ? colors.status.success
            : s.state === "active"
            ? colors.primary.base
            : colors.neutrals.border;
        const icon =
          s.state === "completed"
            ? "checkmark"
            : s.state === "failed"
            ? "close"
            : s.state === "active"
            ? "ellipse"
            : "ellipse-outline";
        return (
          <View key={s.key} style={styles.row}>
            {/* Left rail */}
            <View style={styles.rail}>
              <View style={[styles.dot, { backgroundColor: dotColor, borderColor: dotColor }]}>
                <Ionicons
                  name={icon as any}
                  size={s.state === "active" ? 10 : 14}
                  color={s.state === "pending" ? colors.neutrals.textTertiary : "white"}
                />
              </View>
              {!isLast ? <View style={[styles.line, { backgroundColor: lineColor }]} /> : null}
            </View>
            {/* Right content */}
            <View style={styles.body}>
              <TText weight={s.state === "active" ? "extraBold" : "semiBold"} color={s.state === "pending" ? colors.neutrals.textTertiary : colors.neutrals.textPrimary}>
                {s.label}
              </TText>
              {s.description ? (
                <TText variant="caption" color={colors.neutrals.textSecondary} style={{ marginTop: 2 }}>
                  {s.description}
                </TText>
              ) : null}
              {s.timestamp ? (
                <TText variant="label" color={colors.neutrals.textTertiary} style={{ marginTop: 2 }}>
                  {s.timestamp}
                </TText>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "stretch", minHeight: 64 },
  rail: { width: 28, alignItems: "center" },
  dot: {
    width: 24,
    height: 24,
    borderRadius: radii.full,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  line: { width: 2, flex: 1, marginTop: 2 },
  body: { flex: 1, marginLeft: spacing.md, paddingBottom: spacing.lg },
});
