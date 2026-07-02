import React, { useState, useEffect } from "react";
import { View, StyleSheet, Modal, TouchableOpacity } from "react-native";
import { TText } from "./TText";
import { Button } from "./Button";
import { OTPInput } from "./OTPInput";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radii } from "../theme";

type Props = {
  visible: boolean;
  type: "email" | "phone";
  value: string;
  onVerify: (code: string) => void;
  onResendCode: () => void;
  error?: string | null;
  loading?: boolean;
};

export function VerificationModal({
  visible,
  type,
  value,
  onVerify,
  onResendCode,
  error,
  loading,
}: Props) {
  const [code, setCode] = useState("");
  const [resendLeft, setResendLeft] = useState(0);

  const isEmail = type === "email";
  const label = isEmail ? "email" : "téléphone";
  const icon = isEmail ? "mail-outline" : "call-outline";

  useEffect(() => {
    if (!visible) {
      setCode("");
      setResendLeft(0);
    }
  }, [visible]);

  useEffect(() => {
    if (resendLeft <= 0) return;
    const timer = setInterval(() => {
      setResendLeft((v) => (v <= 1 ? 0 : v - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendLeft]);

  const handleResend = () => {
    onResendCode();
    setCode("");
    setResendLeft(60);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Ionicons name={isEmail ? "mail" : "call"} size={28} color={colors.primary.base} />
            <TText variant="subtitle" weight="extraBold" style={{ marginLeft: 12, flex: 1 }}>
              Vérifier votre {label}
            </TText>
          </View>

          <TText variant="body" color={colors.neutrals.textSecondary} style={{ marginBottom: spacing.md }}>
            Un code de vérification a été envoyé à :
          </TText>

          <View style={styles.valueBox}>
            <Ionicons name={icon} size={18} color={colors.neutrals.textSecondary} />
            <TText weight="semiBold" style={{ marginLeft: 8, flex: 1 }} numberOfLines={1}>
              {value}
            </TText>
          </View>

          <View style={{ marginTop: spacing.lg }}>
            <TText variant="caption" weight="semiBold" color={colors.neutrals.textSecondary} style={{ marginBottom: 8 }}>
              Saisissez le code à 6 chiffres
            </TText>
            <OTPInput value={code} onChange={setCode} autoFocus testIDPrefix={`verify-${type}`} />
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color={colors.status.error} />
              <TText variant="caption" color={colors.status.error} style={{ marginLeft: 6, flex: 1 }}>
                {error}
              </TText>
            </View>
          ) : null}

          <Button
            title={loading ? "Vérification..." : "Valider"}
            icon="checkmark"
            onPress={() => onVerify(code)}
            disabled={code.length < 6 || loading}
            style={{ marginTop: spacing.lg }}
          />

          <View style={styles.resendRow}>
            {resendLeft > 0 ? (
              <TText variant="caption" color={colors.neutrals.textSecondary}>
                Renvoi possible dans <TText weight="bold">{resendLeft}s</TText>
              </TText>
            ) : (
              <TouchableOpacity onPress={handleResend} disabled={loading}>
                <TText variant="caption" weight="bold" color={colors.primary.base}>
                  ↻ Renvoyer le code
                </TText>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  sheet: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: colors.neutrals.surface,
    borderRadius: radii.xxl,
    padding: spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  valueBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutrals.background,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.neutrals.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEE2E2",
    borderRadius: radii.lg,
    padding: spacing.sm,
    marginTop: spacing.md,
  },
  resendRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: spacing.md,
  },
});
