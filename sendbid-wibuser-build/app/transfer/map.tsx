import React, { useEffect, useState } from "react";
import { t, useLocale } from "../../src/i18n";
import { View, StyleSheet, TouchableOpacity, ActivityIndicator, Linking, Platform } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import { Screen } from "../../src/components/Screen";
import { TText } from "../../src/components/TText";
import { Button } from "../../src/components/Button";
import { api } from "../../src/api";
import { colors, spacing, radii } from "../../src/theme";
import { useThemedColors } from "../../src/themeContext";
const MODES: { key: string; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "drive", label: "Voiture", icon: "car-outline" },
  { key: "walk", label: "À pied", icon: "walk-outline" },
  { key: "transit", label: "Transports", icon: "bus-outline" },
  { key: "bike", label: "Vélo", icon: "bicycle-outline" },
];

type RouteData = {
  ok: boolean;
  stub?: boolean;
  stub_reason?: string;
  mode: string;
  distance_text?: string;
  duration_text?: string;
  embed_url?: string;
  static_url?: string;
  start_location?: { lat: number; lng: number };
  end_location?: { lat: number; lng: number };
  agent?: { full_name?: string; city?: string; lat?: number; lng?: number };
};

export default function MapScreen() {
  useLocale((st) => st.locale);
  const colors = useThemedColors();
  const { transfer_id } = useLocalSearchParams<{ transfer_id: string }>();
  const [t, setT] = useState<any>(null);
  const [mode, setMode] = useState("drive");
  const [route, setRoute] = useState<RouteData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!transfer_id) return;
    api.get(`/transfers/${transfer_id}`).then((r) => setT(r.data)).catch(() => {});
  }, [transfer_id]);

  useEffect(() => {
    if (!transfer_id) return;
    setLoading(true);
    api
      .get(`/maps/transfer/${transfer_id}/route`, { params: { mode } })
      .then((r) => setRoute(r.data))
      .catch(() => setRoute(null))
      .finally(() => setLoading(false));
  }, [transfer_id, mode]);

  const openExternalNav = async () => {
    if (!route?.end_location) return;
    const { lat, lng } = route.end_location;
    const url = Platform.select({
      ios: `maps:0,0?q=${lat},${lng}`,
      android: `geo:0,0?q=${lat},${lng}(Agent)`,
      default: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
    });
    if (url) await Linking.openURL(url);
  };

  return (
    <Screen title="Itinéraire vers l'agence" back hero>
      <View style={styles.mapBox}>
        {loading ? (
          <View style={styles.fallback}>
            <ActivityIndicator color={colors.primary.base} />
            <TText variant="caption" color={colors.neutrals.textSecondary} style={{ marginTop: 8 }}>
              Calcul de l&apos;itinéraire…
            </TText>
          </View>
        ) : route?.embed_url && !route?.stub ? (
          <WebView
            originWhitelist={["*"]}
            source={{ uri: route.embed_url }}
            style={styles.webview}
            javaScriptEnabled
            domStorageEnabled
            allowsInlineMediaPlayback
          />
        ) : (
          <View style={styles.fallback}>
            <Ionicons name="map" size={64} color={colors.primary.base} />
            <TText variant="caption" color={colors.neutrals.textSecondary} align="center" style={{ marginTop: 8 }}>
              {route?.stub_reason === "no_agent_assigned"
                ? "En attente d'attribution d'un agent…"
                : route?.stub_reason === "non_vip_transfer"
                ? "Carte indisponible — ce transfert est en mode classique. Le bénéficiaire se rend en agence avec son code de retrait."
                : "Aperçu indisponible — itinéraire estimé localement"}
            </TText>
          </View>
        )}
      </View>

      {route?.distance_text || route?.duration_text ? (
        <View style={styles.metricsRow}>
          <View style={styles.metric}>
            <Ionicons name="navigate-outline" size={18} color={colors.primary.base} />
            <TText variant="body" weight="semiBold" style={{ marginLeft: 8 }}>
              {route?.distance_text ?? "—"}
            </TText>
          </View>
          <View style={styles.metricSep} />
          <View style={styles.metric}>
            <Ionicons name="time-outline" size={18} color={colors.primary.base} />
            <TText variant="body" weight="semiBold" style={{ marginLeft: 8 }}>
              {route?.duration_text ?? "—"}
            </TText>
          </View>
        </View>
      ) : null}

      {(t?.agent_snapshot || route?.agent) ? (
        <View style={styles.agentBox}>
          <View style={styles.row}>
            <Ionicons name="storefront-outline" size={18} color={colors.primary.base} />
            <TText variant="body" weight="semiBold" style={{ marginLeft: 8 }}>
              Agence {(t?.agent_snapshot?.full_name) || route?.agent?.full_name}
            </TText>
          </View>
          <TText variant="caption" color={colors.neutrals.textSecondary} style={{ marginTop: 4 }}>
            {(t?.agent_snapshot?.city) || route?.agent?.city} • Ouverte 8h-20h
          </TText>
        </View>
      ) : null}

      <TText variant="caption" weight="semiBold" color={colors.neutrals.textSecondary} style={{ marginTop: spacing.lg, marginBottom: 8 }}>
        Mode de transport
      </TText>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {MODES.map((m) => (
          <TouchableOpacity
            key={m.key}
            testID={`mode-${m.key}`}
            style={[styles.modeChip, mode === m.key && { backgroundColor: colors.primary.base, borderColor: colors.primary.base }]}
            onPress={() => setMode(m.key)}
          >
            <Ionicons name={m.icon} size={20} color={mode === m.key ? "white" : colors.primary.base} />
            <TText variant="caption" weight="bold" color={mode === m.key ? "white" : colors.neutrals.textPrimary} style={{ marginLeft: 6 }}>
              {m.label}
            </TText>
          </TouchableOpacity>
        ))}
      </View>

      <Button
        title="Ouvrir dans Plans"
        icon="navigate"
        style={{ marginTop: spacing.lg }}
        onPress={openExternalNav}
        disabled={!route?.end_location}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  mapBox: {
    backgroundColor: colors.overlays.primarySoft,
    height: 300,
    borderRadius: radii.xl,
    overflow: "hidden",
  },
  webview: { flex: 1, backgroundColor: "transparent" },
  fallback: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  metricsRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutrals.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.neutrals.border,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  metric: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  metricSep: { width: 1, height: 24, backgroundColor: colors.neutrals.border },
  agentBox: {
    backgroundColor: colors.neutrals.surface,
    padding: spacing.lg,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.neutrals.border,
    marginTop: spacing.md,
  },
  row: { flexDirection: "row", alignItems: "center" },
  modeChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.neutrals.surface,
    borderWidth: 1.5,
    borderColor: colors.neutrals.border,
    borderRadius: radii.full,
  },
});
