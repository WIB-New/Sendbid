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
import { useTranslation } from "../../src/i18n";
export default function ChangePassword() {
  const { t } = useTranslation();
  useLocale((st) => st.locale);
  const colors = useThemedColors();
  const router = useRouter();
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const submit = async () => {
    setErr(null); setOk(null);
    if (next.length < 8) { setErr("Au moins 8 caractères."); return; }
    if (next !== confirm) { setErr("Les deux nouveaux mots de passe ne correspondent pas."); return; }
    setLoading(true);
    try {
      await api.post("/auth/change-password", { current_password: cur, new_password: next });
      setOk("Mot de passe mis à jour. Reconnectez-vous sur vos autres appareils.");
      if (Platform.OS === "web") setTimeout(() => router.back(), 1200);
    } catch (e: any) { setErr(apiError(e)); }
    finally { setLoading(false); }
  };

  return (
    <Screen title="Changer le mot de passe" back hero>
      <TText variant="caption" color={colors.neutrals.textSecondary} style={{ marginBottom: spacing.md }}>
        Votre mot de passe doit contenir au moins 8 caractères, idéalement un mélange de majuscules, minuscules, chiffres et symboles.
      </TText>
      <Input label={t("auth2.currentPassword")} value={cur} onChangeText={setCur} secureTextEntry passwordToggle icon="lock-closed-outline" />
      <Input label={t("auth2.newPassword")} value={next} onChangeText={setNext} secureTextEntry passwordToggle icon="lock-closed-outline" />
      <Input label="Confirmer le nouveau mot de passe" value={confirm} onChangeText={setConfirm} secureTextEntry passwordToggle icon="lock-closed-outline" />
      {err ? <TText variant="caption" color={colors.status.error} style={{ marginTop: 6 }}>{err}</TText> : null}
      {ok ? <TText variant="caption" color={colors.status.success} weight="bold" align="center" style={{ marginTop: 6 }}>{ok}</TText> : null}
      <Button title="Mettre à jour" icon="checkmark" loading={loading} onPress={submit} style={{ marginTop: spacing.lg }} />
    </Screen>
  );
}
