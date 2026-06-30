import React, { useState } from "react";
import {
  View,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TText } from "./TText";
import { paybidColors, paybidFontFamily as fontFamily } from "../paybidTheme";
import { spacing, radii } from "../theme";
import { api, apiError } from "../api";

const PIN_LENGTH = 6;
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"];

type Props = {
  visible: boolean;
  onSuccess: () => void;
  onCancel: () => void;
};

export function PinBiometryModal({ visible, onSuccess, onCancel }: Props) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onKeyPress = async (key: string) => {
    if (loading) return;
    setErr(null);
    if (key === "back") { setPin((p) => p.slice(0, -1)); return; }
    if (!key || pin.length >= PIN_LENGTH) return;
    const next = pin + key;
    setPin(next);
    if (next.length === PIN_LENGTH) {
      setLoading(true);
      try {
        await api.post("/auth/verify-pin", { pin: next });
        setPin("");
        onSuccess();
      } catch (e: any) {
        setErr(apiError(e) || "Code PIN incorrect");
        setPin("");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleCancel = () => {
    setPin("");
    setErr(null);
    onCancel();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleCancel}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <TText weight="extraBold" color={paybidColors.primary.dark} style={{ fontSize: 18 }}>
              Confirmer avec PIN
            </TText>
            <TouchableOpacity onPress={handleCancel} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close-circle-outline" size={26} color={paybidColors.neutrals.textTertiary} />
            </TouchableOpacity>
          </View>

          <TText variant="caption" color={paybidColors.neutrals.textSecondary} align="center" style={{ marginBottom: spacing.xl }}>
            Saisissez votre code PIN à 6 chiffres pour confirmer l'opération.
          </TText>

          {/* Dots */}
          <View style={styles.dotsRow}>
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i < pin.length
                    ? { backgroundColor: paybidColors.primary.base, borderWidth: 0 }
                    : { backgroundColor: "transparent", borderWidth: 2, borderColor: paybidColors.neutrals.border },
                ]}
              />
            ))}
          </View>

          {err ? (
            <TText variant="caption" color={paybidColors.status.error} align="center" style={{ marginBottom: 8 }}>
              {err}
            </TText>
          ) : <View style={{ height: 22 }} />}

          {/* Keypad */}
          <View style={styles.keypad}>
            {KEYS.map((k, idx) => (
              <TouchableOpacity
                key={idx}
                disabled={!k || loading}
                activeOpacity={0.6}
                onPress={() => onKeyPress(k)}
                style={[styles.key, !k && { opacity: 0 }]}
              >
                {k === "back" ? (
                  <Ionicons name="backspace-outline" size={26} color={paybidColors.primary.dark} />
                ) : (
                  <TText weight="medium" color={paybidColors.primary.dark} style={{ fontSize: 26 }}>{k}</TText>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: paybidColors.neutrals.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing.xl,
    paddingBottom: 48,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 14,
    marginBottom: spacing.md,
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  keypad: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginTop: spacing.md,
  },
  key: {
    width: "33.33%",
    height: 68,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.lg,
  },
});
