/**
 * Theme Context — dark/light global switch SENDBID/PAYBID.
 *
 * Stratégie : **local-first**.
 * - L'utilisateur peut changer le thème sans être connecté (AsyncStorage clé `sb_theme_mode`).
 * - Si l'utilisateur est connecté, la pref est aussi synchronisée côté backend (`PUT /auth/me { theme }`).
 * - Mode `system` : suit `Appearance.getColorScheme()` en temps réel.
 *
 * Usage côté écran :
 *   const { tokens, isDark, mode, setMode } = useThemeTokens();
 *   <View style={{ backgroundColor: tokens.neutrals.surface }} />
 *
 * Sélecteur : /app/preferences.tsx
 */
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Appearance } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors as lightColors } from "./theme";
import { darkColors } from "./darkTheme";
import { paybidColors } from "./paybidTheme";
import { paybidDarkColors } from "./paybidDarkTheme";
import { useAuth } from "./store";
import { api } from "./api";

export type ThemeMode = "light" | "dark" | "system";

type Ctx = {
  mode: ThemeMode;
  setMode: (m: ThemeMode) => Promise<void>;
  tokens: typeof lightColors;
  isDark: boolean;
};

const STORAGE_KEY = "sb_theme_mode";
const ThemeCtx = createContext<Ctx>({ mode: "system", setMode: async () => {}, tokens: lightColors, isDark: false });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const user = useAuth((s) => s.user);
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [systemScheme, setSystemScheme] = useState<string>(Appearance.getColorScheme() || "light");
  const [hydrated, setHydrated] = useState(false);

  // Hydratation au démarrage : priorité AsyncStorage, fallback user.theme, fallback "system"
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored && ["light", "dark", "system"].includes(stored)) {
          setModeState(stored as ThemeMode);
        } else if (user && (user as any)?.theme) {
          setModeState((user as any).theme as ThemeMode);
        }
      } catch {}
      setHydrated(true);
    })();
  }, []);

  // Si l'utilisateur se connecte et a une préférence serveur ≠ stockée → re-sync local
  useEffect(() => {
    if (hydrated && user && (user as any)?.theme) {
      const srv = (user as any).theme as ThemeMode;
      AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
        if (!stored) setModeState(srv);
      }).catch(() => {});
    }
  }, [user, hydrated]);

  // Réagit aux changements OS
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => setSystemScheme(colorScheme || "light"));
    return () => sub.remove();
  }, []);

  const isDark = mode === "dark" || (mode === "system" && systemScheme === "dark");
  const tokens = (isDark ? darkColors : lightColors) as typeof lightColors;

  const setMode = async (m: ThemeMode) => {
    setModeState(m);
    try { await AsyncStorage.setItem(STORAGE_KEY, m); } catch {}
    // Sync backend (silent, best-effort)
    if (user) {
      try { await api.put("/auth/me", { theme: m }); } catch {}
    }
  };

  const value = useMemo<Ctx>(() => ({ mode, setMode, tokens, isDark }), [mode, setMode, tokens, isDark]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useThemeTokens() {
  return useContext(ThemeCtx);
}

/**
 * Drop-in replacement pour `import { colors } from "./theme"`.
 *
 * Migration ultra-rapide d'un écran vers le dark mode :
 *   AVANT :  import { colors } from "../../src/theme";
 *   APRÈS :  const colors = useThemedColors();   // dans le composant
 *
 * Retourne directement les tokens (mêmes clés que `theme.colors`).
 */
export function useThemedColors() {
  return useContext(ThemeCtx).tokens;
}

/**
 * PayBID equivalent: returns paybidColors (light) or paybidDarkColors (dark)
 * depending on the global theme mode.
 *
 * Usage in PayBID screens:
 *   const paybidColors = useThemedPaybidColors();
 */
export function useThemedPaybidColors() {
  const { isDark } = useContext(ThemeCtx);
  return (isDark ? paybidDarkColors : paybidColors) as typeof paybidColors;
}
