/**
 * PinGate — Composant universel de vérification d'identité par PIN + biométrie
 *
 * Usage :
 *   <PinGate
 *     visible={open}
 *     title="Confirmer l'opération"
 *     subtitle="Entrez votre code PIN pour valider"
 *     onSuccess={() => { ... }}
 *     onCancel={() => setOpen(false)}
 *     allowBiometric  // optionnel — propose Face ID / empreinte si activé
 *   />
 *
 * - Tente d'abord la biométrie si `allowBiometric` + utilisateur l'a activée localement
 * - Sinon (ou en fallback), demande un PIN à 6 chiffres → POST /auth/verify-pin
 * - Verrouille en cas d'échecs répétés (côté backend : 5 essais → lock 15min)
 */
import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { TText } from "./TText";
import { Button } from "./Button";
import { PINPad } from "./PINPad";
import { api, apiError } from "../api";
import { colors, spacing, radii } from "../theme";

const BIO_TOKEN_KEY = "sb_biometric_token";
const isWeb = Platform.OS === "web";
const secureGet = async (k: string) =>
  isWeb ? AsyncStorage.getItem(k) : SecureStore.getItemAsync(k);

type Props = {
  visible: boolean;
  title?: string;
  subtitle?: string;
  onSuccess: () => void;
  onCancel: () => void;
  allowBiometric?: boolean;
  /**
   * Si fourni, le PIN saisi sera renvoyé au parent via onSuccess(pin) au lieu d'être vérifié par /auth/verify-pin.
   * Utile pour les endpoints (transfer/confirm, wallet/p2p…) qui acceptent déjà le PIN dans le payload.
   */
  returnPinToCaller?: (pin: string) => void;
};

export function PinGate({
  visible,
  title = "Confirmer votre identité",
  subtitle = "Entrez votre code PIN à 6 chiffres",
  onSuccess,
  onCancel,
  allowBiometric = true,
  returnPinToCaller,
}: Props) {
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [bioAvailable, setBioAvailable] = useState(false);

  // Init biométrie quand la modale s'ouvre
  useEffect(() => {
    if (!visible) return;
    setPin("");
    setErr(null);
    (async () => {
      if (!allowBiometric || Platform.OS === "web") {
        setBioAvailable(false);
        return;
      }
      try {
        const hw = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        const tokenSaved = await secureGet(BIO_TOKEN_KEY);
        setBioAvailable(!!(hw && enrolled && tokenSaved));
      } catch {
        setBioAvailable(false);
      }
    })();
  }, [visible, allowBiometric]);

  const tryBiometric = async () => {
    if (loading) return;
    try {
      setLoading(true);
      setErr(null);
      const r = await LocalAuthentication.authenticateAsync({
        promptMessage: title,
        fallbackLabel: "Utiliser le PIN",
        cancelLabel: "Annuler",
      });
      if (r.success) {
        // Biométrie OK → on considère l'utilisateur authentifié localement
        if (returnPinToCaller) {
          // On ne connaît pas le PIN ; le caller doit avoir une voie sans PIN (sinon désactiver allowBiometric)
          // Pour les flows qui exigent un PIN serveur, ce cas est un no-op : on bascule sur la saisie PIN.
          setBioAvailable(false);
          setErr(null);
        } else {
          onSuccess();
        }
      }
    } catch {
      // L'utilisateur peut annuler → on reste sur l'écran PIN
      setErr(null);
    } finally {
      setLoading(false);
    }
  };

  // Auto-déclenchement biométrique à l'ouverture (UX fluide)
  useEffect(() => {
    if (visible && bioAvailable && !returnPinToCaller) {
      // Délai léger pour laisser le modal s'animer
      const t = setTimeout(tryBiometric, 250);
      return () => clearTimeout(t);
    }
  }, [visible, bioAvailable, returnPinToCaller]);

  const submitPin = async () => {
    if (pin.length !== 6) return;
    setLoading(true);
    setErr(null);
    try {
      if (returnPinToCaller) {
        // Le caller veut le PIN en clair pour le passer à son propre endpoint
        returnPinToCaller(pin);
        setPin("");
        return;
      }
      await api.post("/auth/verify-pin", { pin });
      onSuccess();
      setPin("");
    } catch (e: any) {
      setErr(apiError(e) || "Code PIN incorrect");
      setPin("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <View style={styles.bg}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={styles.lockIcon}>
              <Ionicons name="shield-checkmark" size={26} color="#022a6b" />
            </View>
            {/* v12 — Spec utilisateur : lisibilité maximale du titre et du sous-titre.
                On force ici les couleurs en noir/gris foncé explicites pour ne pas dépendre
                du thème (clair ou sombre) ni d'un éventuel override hérité d'un parent. */}
            <TText variant="title" weight="extraBold" align="center" color="#0F172A" style={{ marginTop: spacing.md, fontSize: 20 }}>
              {title}
            </TText>
            <TText variant="body" weight="semiBold" color="#374151" align="center" style={{ marginTop: 6, paddingHorizontal: 8 }}>
              {subtitle}
            </TText>
          </View>

          <View style={{ marginTop: spacing.lg }}>
            <PINPad pin={pin} onChange={setPin} testIDPrefix="pingate" />
          </View>

          {err ? (
            <TText variant="caption" color={colors.status.error} align="center" style={{ marginTop: spacing.sm }}>
              {err}
            </TText>
          ) : null}

          {bioAvailable && !returnPinToCaller ? (
            <TouchableOpacity
              testID="pingate-biometric"
              onPress={tryBiometric}
              style={styles.bioRow}
              activeOpacity={0.7}
            >
              <Ionicons name="finger-print" size={20} color="#022a6b" />
              <TText variant="caption" weight="extraBold" color="#022a6b" style={{ marginLeft: 8 }}>
                Utiliser la biométrie
              </TText>
            </TouchableOpacity>
          ) : null}

          <Button
            testID="pingate-submit"
            title={loading ? "Vérification…" : "Valider"}
            onPress={submitPin}
            loading={loading}
            disabled={pin.length !== 6 || loading}
            style={{ marginTop: spacing.lg, backgroundColor: "#022a6b" }}
          />

          <TouchableOpacity
            testID="pingate-cancel"
            onPress={onCancel}
            style={styles.cancelRow}
            disabled={loading}
          >
            <TText variant="caption" weight="semiBold" color={colors.neutrals.textSecondary}>
              Annuler
            </TText>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "white",
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: radii.full,
    alignSelf: "center",
    marginBottom: spacing.md,
  },
  header: { alignItems: "center" },
  lockIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#022a6b1A",
    alignItems: "center",
    justifyContent: "center",
  },
  bioRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    marginTop: spacing.sm,
  },
  cancelRow: { alignItems: "center", paddingVertical: 14, marginTop: 4 },
});
