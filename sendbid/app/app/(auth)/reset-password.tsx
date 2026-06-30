import React, { useState } from "react";
import { t, useLocale } from "../../src/i18n";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Screen } from "../../src/components/Screen";
import { TText } from "../../src/components/TText";
import { Input } from "../../src/components/Input";
import { Button } from "../../src/components/Button";
import { api, apiError } from "../../src/api";
import { colors, spacing } from "../../src/theme";
import { useThemedColors } from "../../src/themeContext";
import { useTranslation } from "../../../src/i18n";
export default function ResetPassword() {
  const { t } = useTranslation();
  useLocale((st) => st.locale);
  const colors = useThemedColors();
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setErr(null);
    if (pwd.length < 8) {
      setErr("8 caractères minimum");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, new_password: pwd });
      router.replace("/(auth)/login");
    } catch (e: any) {
      setErr(apiError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen title={t("auth2.newPassword")} back>
      <TText variant="title" weight="extraBold" style={{ marginTop: spacing.md, marginBottom: spacing.lg }}>
        Choisissez un nouveau mot de passe
      </TText>
      <Input testID="reset-pwd" label={t("auth2.newPassword")} value={pwd} onChangeText={setPwd} secureTextEntry passwordToggle icon="lock-closed-outline" />
      {err ? <TText variant="caption" color={colors.status.error}>{err}</TText> : null}
      <Button testID="reset-submit" title="Mettre à jour" onPress={submit} loading={loading} />
    </Screen>
  );
}
