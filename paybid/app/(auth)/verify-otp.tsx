import React, { useEffect, useState } from "react";
import { View, TouchableOpacity } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Screen } from "../../src/components/Screen";
import { TText } from "../../src/components/TText";
import { OTPInput } from "../../src/components/OTPInput";
import { Button } from "../../src/components/Button";
import { api, apiError } from "../../src/api";
import { useAuth } from "../../src/store";
import { colors, spacing } from "../../src/theme";
import { useTranslation } from "../../src/i18n";

export default function VerifyOtp() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ user_id: string; dev_email_otp?: string; dev_phone_otp?: string }>();
  const router = useRouter();
  const setSession = useAuth((s) => s.setSession);
  const [emailCode, setEmailCode] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [seconds, setSeconds] = useState(180);
  const [devOtps, setDevOtps] = useState({ email: params.dev_email_otp as string, phone: params.dev_phone_otp as string });

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [seconds]);

  const submit = async () => {
    setErr(null);
    setLoading(true);
    try {
      const { data } = await api.post("/auth/verify-otp", { user_id: params.user_id, email_code: emailCode, phone_code: phoneCode });
      await setSession(data.access_token, data.user);
      router.replace("/(auth)/create-pin");
    } catch (e: any) {
      setErr(apiError(e));
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    try {
      const { data } = await api.post("/auth/resend-otp", { user_id: params.user_id });
      setDevOtps({ email: data.dev_email_otp, phone: data.dev_phone_otp });
      setSeconds(180);
    } catch (e: any) {
      setErr(apiError(e));
    }
  };

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <Screen title="Vérification" back>
      <TText variant="title" weight="extraBold" style={{ marginTop: spacing.md }}>
        Vérifiez vos identifiants
      </TText>
      <TText variant="body" color={colors.neutrals.textSecondary}>
        Entrez les codes à 6 chiffres reçus par email et SMS.
      </TText>

      <View
        style={{
          backgroundColor: seconds < 30 ? colors.overlays.errorSoft : colors.overlays.primarySoft,
          padding: spacing.md, borderRadius: 12, marginVertical: spacing.lg, alignItems: "center",
        }}
      >
        <TText weight="bold" color={seconds < 30 ? colors.status.error : colors.primary.base} variant="title">
          {mm}:{ss}
        </TText>
        <TText variant="caption" color={colors.neutrals.textSecondary}>
          Temps restant
        </TText>
      </View>

      {(devOtps.email || devOtps.phone) ? (
        <View style={{ backgroundColor: colors.overlays.pendingSoft, padding: spacing.md, borderRadius: 12, marginBottom: spacing.lg }}>
          <TText variant="caption" weight="bold" color={colors.status.pending}>DEV — codes mockés :</TText>
          <TText variant="caption" color={colors.neutrals.textSecondary}>📧 Email : {devOtps.email}</TText>
          <TText variant="caption" color={colors.neutrals.textSecondary}>📱 SMS : {devOtps.phone}</TText>
        </View>
      ) : null}

      <TText variant="caption" weight="semiBold" color={colors.neutrals.textSecondary}>
        Code email
      </TText>
      <View style={{ marginVertical: spacing.sm }}>
        <OTPInput value={emailCode} onChange={setEmailCode} testIDPrefix="otp-email" autoFocus />
      </View>
      <TText variant="caption" weight="semiBold" color={colors.neutrals.textSecondary} style={{ marginTop: spacing.md }}>
        Code SMS
      </TText>
      <View style={{ marginVertical: spacing.sm }}>
        <OTPInput value={phoneCode} onChange={setPhoneCode} testIDPrefix="otp-phone" />
      </View>

      {err ? <TText variant="caption" color={colors.status.error} style={{ marginBottom: spacing.sm }}>{err}</TText> : null}

      <Button testID="verify-submit" title="Vérifier" onPress={submit} loading={loading} disabled={emailCode.length < 6 || phoneCode.length < 6} />

      <TouchableOpacity testID="verify-resend" onPress={resend} disabled={seconds > 0} style={{ alignSelf: "center", marginTop: spacing.lg }}>
        <TText variant="caption" weight="semiBold" color={seconds > 0 ? colors.neutrals.textTertiary : colors.primary.base}>
          {seconds > 0 ? `Renvoyer dans ${mm}:${ss}` : "Renvoyer les codes"}
        </TText>
      </TouchableOpacity>
    </Screen>
  );
}
