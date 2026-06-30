import React, { useState } from "react";
import { View, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "../../src/components/Screen";
import { TText } from "../../src/components/TText";
import { PINPad } from "../../src/components/PINPad";
import { Button } from "../../src/components/Button";
import { api, apiError } from "../../src/api";
import { useAuth } from "../../src/store";
import { colors, spacing } from "../../src/theme";
import { useTranslation } from "../../src/i18n";

export default function VerifyPin() {
  const { t } = useTranslation();
  const router = useRouter();
  const refreshMe = useAuth((s) => s.refreshMe);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onChange = (val: string) => {
    setPin(val);
    setErr(null);
    if (val.length === 6) {
      // Auto-submit après 6 chiffres
      setTimeout(() => submit(val), 200);
    }
  };

  const submit = async (code = pin) => {
    if (code.length !== 6) return;
    setLoading(true);
    setErr(null);
    try {
      await api.post("/auth/verify-pin", { pin: code });
      // Rafraîchir les données utilisateur
      try { await refreshMe(); } catch {}
      // Rediriger vers l'accueil
      router.replace("/(tabs)");
    } catch (e: any) {
      setErr(apiError(e) || "PIN incorrect");
      setPin("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen title="Sécurité" back={false}>
      <TText variant="title" weight="extraBold" align="center" style={{ marginTop: spacing.lg }}>
        Saisissez votre PIN
      </TText>
      <TText variant="body" color={colors.neutrals.textSecondary} align="center" style={{ marginBottom: spacing.xl }}>
        Code à 6 chiffres pour accéder à votre compte.
      </TText>

      <View style={{ marginVertical: spacing.lg }}>
        <PINPad pin={pin} onChange={onChange} />
      </View>

      {err ? <TText variant="caption" color={colors.status.error} align="center" style={{ marginVertical: spacing.sm }}>{err}</TText> : null}

      <TouchableOpacity onPress={() => router.replace("/welcome")} style={{ alignSelf: "center", marginTop: spacing.md }}>
        <TText variant="body" color={colors.primary.base}>
          Changer de compte
        </TText>
      </TouchableOpacity>
    </Screen>
  );
}
