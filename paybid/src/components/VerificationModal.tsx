import React, { useState } from "react";
import {
  View,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TText } from "./TText";
import { Input } from "./Input";
import { Button } from "./Button";
import { colors, spacing, radii } from "../theme";

type Props = {
  visible: boolean;
  type: "email" | "phone";
  value?: string | null;
  onVerify: (code: string) => void;
  onResendCode: () => void;
  error?: string | null;
  loading?: boolean;
};

export function VerificationModal({ visible, type, value, onVerify, onResendCode, error, loading }: Props) {
  const [code, setCode] = useState("");

  const isEmail = type === "email";
  const icon = isEmail ? "mail-outline" : "phone-portrait-outline";
  const label = isEmail ? "Email" : "Téléphone";
  const instruction = isEmail
    ? `Un code de vérification a été envoyé à ${value ?? "votre email"}.`
    : `Un code de vérification a été envoyé au ${value ?? "votre numéro"}.`;

  const handleSubmit = () => {
    if (code.trim().length >= 4) onVerify(code.trim());
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => {}}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.iconWrap}>
            <Ionicons name={icon} size={32} color={colors.primary.base} />
          </View>
          <TText variant="subtitle" weight="extraBold" align="center" style={{ marginBottom: 8 }}>
            Vérifier votre {label}
          </TText>
          <TText variant="caption" color={colors.neutrals.textSecondary} align="center" style={{ marginBottom: spacing.lg }}>
            {instruction}
          </TText>

          <Input
            label={`Code de vérification ${label}`}
            value={code}
            onChangeText={setCode}
            icon="key-outline"
            keyboardType="number-pad"
            autoCapitalize="none"
          />

          {error ? (
            <TText variant="caption" color={colors.status.error} style={{ marginBottom: 8 }}>
              {error}
            </TText>
          ) : null}

          <Button
            title="Vérifier"
            onPress={handleSubmit}
            loading={loading}
            disabled={code.trim().length < 4}
            icon="checkmark-circle-outline"
            style={{ marginTop: 4 }}
          />

          <TouchableOpacity onPress={onResendCode} style={styles.resendRow} activeOpacity={0.7}>
            <Ionicons name="refresh-outline" size={14} color={colors.primary.base} style={{ marginRight: 4 }} />
            <TText variant="caption" color={colors.primary.base} weight="semiBold">
              Renvoyer le code
            </TText>
          </TouchableOpacity>
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
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.xl,
    paddingBottom: 48,
  },
  iconWrap: {
    alignSelf: "center",
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.overlays.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  resendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.lg,
  },
});
