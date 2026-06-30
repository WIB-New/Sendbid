import React, { useState } from "react";
import { t, useLocale } from "../../src/i18n";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "../../src/components/Screen";
import { TText } from "../../src/components/TText";
import { Input } from "../../src/components/Input";
import { Button } from "../../src/components/Button";
import { api, apiError } from "../../src/api";
import { colors, spacing } from "../../src/theme";
import { useThemedColors } from "../../src/themeContext";
import { useTranslation } from "../../../src/i18n";
export default function ForgotPassword() {
  const { t } = useTranslation();
  useLocale((st) => st.locale);
  const colors = useThemedColors();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    setErr(null);
    try {
      const { data } = await api.post("/auth/forgot-password", { email });
      setSent(true);
      setToken(data.dev_reset_token || null);
    } catch (e: any) {
      setErr(apiError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen title={t("auth2.forgotTitle")} back>
      <TText variant="title" weight="extraBold" style={{ marginTop: spacing.md }}>
        Réinitialisation
      </TText>
      <TText variant="body" color={colors.neutrals.textSecondary} style={{ marginBottom: spacing.xl }}>
        Nous vous enverrons un lien valide 10 minutes.
      </TText>

      <Input testID="forgot-email" label="Email" value={email} onChangeText={setEmail} icon="mail-outline" keyboardType="email-address" autoCapitalize="none" />

      {err ? <TText variant="caption" color={colors.status.error} style={{ marginBottom: spacing.sm }}>{err}</TText> : null}

      {sent ? (
        <View style={{ backgroundColor: colors.overlays.successSoft, padding: spacing.md, borderRadius: 12, marginBottom: spacing.lg }}>
          <TText variant="caption" weight="bold" color={colors.status.success}>
            Lien envoyé ✓
          </TText>
          <TText variant="caption" color={colors.neutrals.textSecondary}>
            Consultez votre boîte mail. Lien valide 10 minutes.
          </TText>
          {token ? (
            <Button
              testID="forgot-use-token"
              title="Utiliser le lien (DEV)"
              variant="outline"
              style={{ marginTop: spacing.md }}
              onPress={() => router.replace({ pathname: "/(auth)/reset-password", params: { token } })}
            />
          ) : null}
        </View>
      ) : (
        <Button testID="forgot-submit" title="Envoyer le lien" onPress={submit} loading={loading} disabled={!email} />
      )}
    </Screen>
  );
}
