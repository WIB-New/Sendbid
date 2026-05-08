import React, { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "../../src/components/Screen";
import { TText } from "../../src/components/TText";
import { PINPad } from "../../src/components/PINPad";
import { Button } from "../../src/components/Button";
import { api, apiError } from "../../src/api";
import { useAuth } from "../../src/store";
import { colors, spacing } from "../../src/theme";

export default function CreatePin() {
  const router = useRouter();
  const refreshMe = useAuth((s) => s.refreshMe);
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [step, setStep] = useState<"create" | "confirm">("create");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onChange = (val: string) => {
    if (step === "create") {
      setPin(val);
      if (val.length === 6) setTimeout(() => setStep("confirm"), 200);
    } else {
      setConfirm(val);
    }
  };

  const submit = async () => {
    if (pin !== confirm) {
      setErr("Les PIN ne correspondent pas");
      setConfirm("");
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      await api.post("/auth/create-pin", { pin });
      await refreshMe();
      router.replace("/(tabs)");
    } catch (e: any) {
      setErr(apiError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen title="Créer un PIN" back={false}>
      <TText variant="title" weight="extraBold" align="center" style={{ marginTop: spacing.lg }}>
        {step === "create" ? "Créez votre PIN" : "Confirmez votre PIN"}
      </TText>
      <TText variant="body" color={colors.neutrals.textSecondary} align="center" style={{ marginBottom: spacing.xl }}>
        Code à 6 chiffres requis pour toute opération financière.
      </TText>

      <View style={{ marginVertical: spacing.lg }}>
        <PINPad pin={step === "create" ? pin : confirm} onChange={onChange} />
      </View>

      {err ? <TText variant="caption" color={colors.status.error} align="center" style={{ marginVertical: spacing.sm }}>{err}</TText> : null}

      {step === "confirm" && confirm.length === 6 ? (
        <Button testID="pin-submit" title="Activer mon PIN" onPress={submit} loading={loading} />
      ) : null}
    </Screen>
  );
}
