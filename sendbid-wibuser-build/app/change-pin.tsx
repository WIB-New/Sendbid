import React, { useState } from "react";
import { t, useLocale } from "../src/i18n";
import { Platform } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "../src/components/Screen";
import { TText } from "../src/components/TText";
import { Input } from "../src/components/Input";
import { Button } from "../src/components/Button";
import { api, apiError } from "../src/api";
import { colors, spacing } from "../src/theme";
import { useThemedColors } from "../src/themeContext";
export default function ChangePin() {
  useLocale((st) => st.locale);
  const colors = useThemedColors();
  const router = useRouter();
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const submit = async () => {
    setErr(null); setOk(null);
    if (newPin.length !== 6 || !/^\d{6}$/.test(newPin)) { setErr("Le nouveau PIN doit faire 6 chiffres."); return; }
    if (newPin !== confirmPin) { setErr("Les deux nouveaux PIN ne correspondent pas."); return; }
    if (/^(\d)\1{5}$/.test(newPin) || "0123456789".includes(newPin) || "9876543210".includes(newPin)) {
      setErr("PIN trop faible (séquentiel ou répétitif). Choisissez un code plus sécurisé."); return;
    }
    setLoading(true);
    try {
      await api.post("/auth/change-pin", { current_pin: currentPin, new_pin: newPin });
      setOk("Code PIN mis à jour.");
      if (Platform.OS === "web") setTimeout(() => router.back(), 900);
    } catch (e: any) { setErr(apiError(e)); }
    finally { setLoading(false); }
  };

  return (
    <Screen title="Changer le code PIN" back hero>
      <TText variant="caption" color={colors.neutrals.textSecondary} style={{ marginBottom: spacing.md }}>
        Pour votre sécurité, saisissez votre PIN actuel avant d&apos;en définir un nouveau.
      </TText>
      <Input label="PIN actuel (6 chiffres)" value={currentPin} onChangeText={setCurrentPin} keyboardType="number-pad" maxLength={6} secureTextEntry icon="keypad-outline" />
      <Input label={t("auth2.newPin")} value={newPin} onChangeText={setNewPin} keyboardType="number-pad" maxLength={6} secureTextEntry icon="keypad-outline" />
      <Input label="Confirmer le nouveau PIN" value={confirmPin} onChangeText={setConfirmPin} keyboardType="number-pad" maxLength={6} secureTextEntry icon="keypad-outline" />
      {err ? <TText variant="caption" color={colors.status.error} style={{ marginTop: 6 }}>{err}</TText> : null}
      {ok ? <TText variant="caption" color={colors.status.success} weight="bold" align="center" style={{ marginTop: 6 }}>{ok}</TText> : null}
      <Button title="Mettre à jour" icon="checkmark" loading={loading} onPress={submit} style={{ marginTop: spacing.lg }} />
    </Screen>
  );
}
