import React, { useEffect, useState } from "react";
import { View, StyleSheet, TouchableOpacity, Switch, Platform, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as LocalAuthentication from "expo-local-authentication";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Screen } from "../src/components/Screen";
import { TText } from "../src/components/TText";
import { colors, spacing, radii } from "../src/theme";
import { useTranslation } from "../src/i18n";

// Sécurité — activation directe de la biométrie + accès rapide aux changements PIN/MDP/Sessions
export default function SecurityScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [bioEnabled, setBioEnabled] = useState(false);
  const [bioSupported, setBioSupported] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const has = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        setBioSupported(has && enrolled);
        const saved = await AsyncStorage.getItem("biometric_enabled");
        setBioEnabled(saved === "true");
      } catch { setBioSupported(Platform.OS === "web" ? false : false); }
    })();
  }, []);

  const toggleBio = async (next: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      if (next) {
        // Demander l'authentification biométrique pour activer
        const r = await LocalAuthentication.authenticateAsync({ promptMessage: "Activer la connexion biométrique" });
        if (!r.success) { setBusy(false); return; }
      }
      await AsyncStorage.setItem("biometric_enabled", next ? "true" : "false");
      setBioEnabled(next);
    } catch (e: any) {
      if (Platform.OS === "web") (window as any).alert("Biométrie indisponible sur navigateur web.");
      else Alert.alert("Erreur", "Activation biométrique impossible.");
    } finally { setBusy(false); }
  };

  return (
    <Screen title="Sécurité" back hero>
      <View style={styles.card}>
        {/* Connexion biométrique — toggle inline */}
        <View style={[styles.row, styles.rowBorder]}>
          <View style={[styles.icon, { backgroundColor: "#8B5CF61A" }]}>
            <Ionicons name="finger-print" size={22} color="#8B5CF6" />
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <TText variant="body" weight="semiBold">Connexion biométrique</TText>
            <TText variant="label" color={colors.neutrals.textSecondary} style={{ marginTop: 2 }}>
              {bioSupported ? "Face ID / Empreinte digitale" : "Indisponible sur cet appareil"}
            </TText>
          </View>
          <Switch
            testID="security-bio-toggle"
            value={bioEnabled}
            onValueChange={toggleBio}
            disabled={!bioSupported || busy}
            trackColor={{ false: colors.neutrals.border, true: "#10B98155" }}
            thumbColor={bioEnabled ? "#10B981" : "#f4f3f4"}
          />
        </View>

        {/* Changer le code PIN */}
        <TouchableOpacity testID="security-change-pin" onPress={() => router.push("/change-pin" as any)} style={[styles.row, styles.rowBorder]}>
          <View style={[styles.icon, { backgroundColor: "#F59E0B1A" }]}>
            <Ionicons name="keypad-outline" size={22} color="#F59E0B" />
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <TText variant="body" weight="semiBold">Changer le code PIN</TText>
            <TText variant="label" color={colors.neutrals.textSecondary} style={{ marginTop: 2 }}>PIN à 6 chiffres</TText>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.neutrals.textTertiary} />
        </TouchableOpacity>

        {/* Changer le mot de passe */}
        <TouchableOpacity testID="security-change-password" onPress={() => router.push("/change-password" as any)} style={[styles.row, styles.rowBorder]}>
          <View style={[styles.icon, { backgroundColor: "#EF44441A" }]}>
            <Ionicons name="lock-closed-outline" size={22} color="#EF4444" />
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <TText variant="body" weight="semiBold">Changer le mot de passe</TText>
            <TText variant="label" color={colors.neutrals.textSecondary} style={{ marginTop: 2 }}>Mot de passe de connexion</TText>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.neutrals.textTertiary} />
        </TouchableOpacity>

        {/* Sessions actives */}
        <TouchableOpacity testID="security-sessions" onPress={() => router.push("/sessions" as any)} style={styles.row}>
          <View style={[styles.icon, { backgroundColor: "#3B82F61A" }]}>
            <Ionicons name="phone-portrait-outline" size={22} color="#3B82F6" />
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <TText variant="body" weight="semiBold">Sessions actives</TText>
            <TText variant="label" color={colors.neutrals.textSecondary} style={{ marginTop: 2 }}>Appareils connectés à votre compte</TText>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.neutrals.textTertiary} />
        </TouchableOpacity>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "white", borderRadius: radii.xxl, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingVertical: 16 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  icon: { width: 40, height: 40, borderRadius: radii.full, alignItems: "center", justifyContent: "center" },
});
