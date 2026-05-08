import React, { useState } from "react";
import { View, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "../../src/components/Screen";
import { TText } from "../../src/components/TText";
import { Input } from "../../src/components/Input";
import { Button } from "../../src/components/Button";
import { api, apiError } from "../../src/api";
import { useAuth } from "../../src/store";
import { colors, spacing } from "../../src/theme";

export default function SignUp() {
  const router = useRouter();
  const setSession = useAuth((s) => s.setSession);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const strength = (() => {
    let s = 0;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  })();

  const submit = async () => {
    setErr(null);
    if (password.length < 8) {
      setErr("Mot de passe : 8 caractères minimum");
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post("/auth/register", { full_name: fullName, email, phone, password });
      // B1: auto-login dès l'inscription pour permettre la création du PIN sans OTP.
      if (data.token && data.user) {
        await setSession(data.token, data.user);
      }
      router.push({
        pathname: "/(auth)/create-pin",
        params: { user_id: data.user_id, skip_otp: "1" },
      });
    } catch (e: any) {
      setErr(apiError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen title="Créer un compte" back>
      <TText variant="title" weight="extraBold" style={{ marginTop: spacing.md }}>
        Rejoignez SENDBID
      </TText>
      <TText variant="body" color={colors.neutrals.textSecondary} style={{ marginBottom: spacing.xl }}>
        Créez votre compte en 30 secondes. La vérification KYC pourra être faite plus tard depuis votre profil.
      </TText>

      <Input testID="signup-fullname" label="Nom complet" value={fullName} onChangeText={setFullName} icon="person-outline" />
      <Input testID="signup-email" label="Email" value={email} onChangeText={setEmail} icon="mail-outline" keyboardType="email-address" autoCapitalize="none" />
      <Input testID="signup-phone" label="Téléphone (avec indicatif)" value={phone} onChangeText={setPhone} icon="call-outline" keyboardType="phone-pad" placeholder="+33..." />
      <Input testID="signup-password" label="Mot de passe" value={password} onChangeText={setPassword} icon="lock-closed-outline" passwordToggle secureTextEntry />

      <View style={{ flexDirection: "row", gap: 4, marginBottom: spacing.md }}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              backgroundColor:
                i < strength ? (strength <= 2 ? colors.status.pending : strength === 3 ? colors.status.info : colors.status.success) : colors.neutrals.border,
            }}
          />
        ))}
      </View>
      <TText variant="caption" color={colors.neutrals.textTertiary} style={{ marginBottom: spacing.lg }}>
        8+ caractères, majuscule, chiffre & symbole recommandés.
      </TText>

      {err ? <TText variant="caption" color={colors.status.error} style={{ marginBottom: spacing.sm }}>{err}</TText> : null}

      <Button testID="signup-submit" title="Créer mon compte" onPress={submit} loading={loading} />

      <View style={{ flexDirection: "row", justifyContent: "center", marginTop: spacing.lg }}>
        <TText variant="caption" color={colors.neutrals.textSecondary}>
          Déjà un compte ?{" "}
        </TText>
        <TouchableOpacity onPress={() => router.replace("/(auth)/login")}>
          <TText variant="caption" weight="bold" color={colors.primary.base}>
            Se connecter
          </TText>
        </TouchableOpacity>
      </View>
    </Screen>
  );
}
