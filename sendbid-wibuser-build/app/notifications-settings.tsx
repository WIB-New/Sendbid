import React, { useEffect, useState } from "react";
import { t, useLocale } from "../src/i18n";
import { View, StyleSheet, Switch, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Screen } from "../src/components/Screen";
import { TText } from "../src/components/TText";
import { api } from "../src/api";
import { colors, spacing, radii } from "../src/theme";
import { useThemedColors } from "../src/themeContext";
// Réglage des notifications — toggles inline (push, email, sms)
// "Marketing & promotions" SUPPRIMÉ selon spécification
type Pref = { key: string; label: string; description: string; icon: any; tint: string };
const PREFS: Pref[] = [
  { key: "push",  label: "Notifications push",  description: "Alertes en temps réel sur votre appareil", icon: "notifications-outline", tint: "#022a6b" },
  { key: "email", label: "Notifications email", description: "Reçus par transfert, alertes sécurité",     icon: "mail-outline",         tint: "#10B981" },
  { key: "sms",   label: "Notifications SMS",   description: "Codes OTP, confirmations critiques",       icon: "chatbox-ellipses-outline", tint: "#F59E0B" },
];

export default function NotificationsSettings() {
  useLocale((st) => st.locale);
  const colors = useThemedColors();
  const [vals, setVals] = useState<Record<string, boolean>>({ push: true, email: true, sms: true });
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem("notifications_prefs");
        if (stored) setVals(JSON.parse(stored));
      } catch {}
    })();
  }, []);

  const toggle = async (key: string, next: boolean) => {
    setBusy(key);
    const newVals = { ...vals, [key]: next };
    setVals(newVals);
    try {
      await AsyncStorage.setItem("notifications_prefs", JSON.stringify(newVals));
      // Best-effort sync backend (silent fail si endpoint absent)
      await api.put("/auth/me", { notifications_prefs: newVals }).catch(() => {});
    } finally { setBusy(null); }
  };

  return (
    <Screen title="Réglage des notifications" back hero>
      <View style={styles.card}>
        {PREFS.map((p, i) => (
          <View key={p.key} style={[styles.row, i < PREFS.length - 1 && styles.rowBorder]}>
            <View style={[styles.icon, { backgroundColor: p.tint + "1A" }]}>
              <Ionicons name={p.icon} size={20} color={p.tint} />
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <TText variant="body" weight="semiBold">{p.label}</TText>
              <TText variant="label" color={colors.neutrals.textSecondary} style={{ marginTop: 2 }}>{p.description}</TText>
            </View>
            <Switch
              testID={`notif-${p.key}`}
              value={vals[p.key]}
              onValueChange={(v) => toggle(p.key, v)}
              disabled={busy === p.key}
              trackColor={{ false: colors.neutrals.border, true: "#10B98155" }}
              thumbColor={vals[p.key] ? "#10B981" : "#f4f3f4"}
            />
          </View>
        ))}
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
