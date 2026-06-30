import React, { useEffect, useState } from "react";
import { t, useLocale } from "../../src/i18n";
import { View, BackHandler, Platform } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Screen } from "../../src/components/Screen";
import { TText } from "../../src/components/TText";
import { PINPad } from "../../src/components/PINPad";
import { Button } from "../../src/components/Button";
import { api, apiError } from "../../src/api";
import { useAuth } from "../../src/store";
import { colors, spacing } from "../../src/theme";
import { useThemedColors } from "../../src/themeContext";
import { useTranslation } from "../../../src/i18n";
export default function CreatePin() {
  const { t } = useTranslation();
  useLocale((st) => st.locale);
  const colors = useThemedColors();
  const router = useRouter();
  const refreshMe = useAuth((s) => s.refreshMe);
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [step, setStep] = useState<"create" | "confirm">("create");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // === Spec v7 : OBLIGATOIRE — empêche toute sortie tant que le PIN n'est pas créé ===
  // 1. Hardware back Android : bloqué
  // 2. Web (browser back) : bloqué via popstate
  useFocusEffect(
    React.useCallback(() => {
      const onAndroidBack = () => true; // intercepte (n'autorise pas le retour)
      const sub = BackHandler.addEventListener("hardwareBackPress", onAndroidBack);
      let popListener: any;
      if (Platform.OS === "web" && typeof window !== "undefined") {
        // Push un état "factice" pour intercepter le back
        try { window.history.pushState({ blockBack: true }, ""); } catch {}
        popListener = () => {
          try { window.history.pushState({ blockBack: true }, ""); } catch {}
        };
        window.addEventListener("popstate", popListener);
      }
      return () => {
        sub.remove();
        if (popListener && typeof window !== "undefined") {
          window.removeEventListener("popstate", popListener);
        }
      };
    }, []),
  );

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
      setErr("Les PIN ne correspondent pas. Veuillez réessayer.");
      setConfirm("");
      // Garde l'utilisateur sur cette étape — pas de retour arrière permis
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      await api.post("/auth/create-pin", { pin });
      await refreshMe();
      // PIN créé avec succès → l'utilisateur peut entrer dans l'app
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
      <TText variant="body" color={colors.neutrals.textSecondary} align="center" style={{ marginBottom: spacing.sm }}>
        Code à 6 chiffres requis pour toute opération financière.
      </TText>
      <TText variant="caption" color={colors.status.warning} align="center" style={{ marginBottom: spacing.xl }}>
        ⚠️ Étape obligatoire — vous ne pourrez pas continuer sans créer votre PIN.
      </TText>

      <View style={{ marginVertical: spacing.lg }}>
        <PINPad pin={step === "create" ? pin : confirm} onChange={onChange} />
      </View>

      {err ? <TText variant="caption" color={colors.status.error} align="center" style={{ marginVertical: spacing.sm }}>{err}</TText> : null}

      {step === "confirm" && confirm.length === 6 ? (
        <Button testID="pin-submit" title="Activer mon PIN" onPress={submit} loading={loading} />
      ) : null}

      {step === "confirm" ? (
        <View style={{ alignItems: "center", marginTop: spacing.md }}>
          <TText variant="caption" color={colors.neutrals.textSecondary}>
            PIN incorrect ?{" "}
            <TText variant="caption" weight="bold" color={colors.primary.base} onPress={() => { setConfirm(""); setPin(""); setStep("create"); setErr(null); }}>
              Recommencer
            </TText>
          </TText>
        </View>
      ) : null}
    </Screen>
  );
}
