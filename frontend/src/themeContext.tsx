/**
 * Theme Context — dark/light global switch.
 *
 * Usage côté écran :
 *   const { tokens } = useThemeTokens();
 *   <View style={{ backgroundColor: tokens.neutrals.surface }}>…
 *
 * Le sélecteur de thème (clair/sombre/système) se trouve dans /app/preferences.tsx.
 * La préférence est persistée côté backend via `PUT /auth/me { theme: 'light'|'dark'|'system' }`.
 */
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Appearance } from "react-native";
import { colors as lightColors } from "./theme";
import { darkColors } from "./darkTheme";
import { useAuth } from "./store";

type ThemeMode = "light" | "dark" | "system";

type Ctx = { mode: ThemeMode; setMode: (m: ThemeMode) => void; tokens: typeof lightColors; isDark: boolean };

const ThemeCtx = createContext<Ctx>({ mode: "system", setMode: () => {}, tokens: lightColors, isDark: false });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const user = useAuth((s) => s.user);
  const [mode, setMode] = useState<ThemeMode>(((user as any)?.theme as ThemeMode) || "system");
  const [systemScheme, setSystemScheme] = useState<string>(Appearance.getColorScheme() || "light");

  useEffect(() => {
    if (user && (user as any)?.theme) setMode((user as any).theme as ThemeMode);
  }, [user]);

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => setSystemScheme(colorScheme || "light"));
    return () => sub.remove();
  }, []);

  const isDark = mode === "dark" || (mode === "system" && systemScheme === "dark");
  const tokens = (isDark ? darkColors : lightColors) as typeof lightColors;

  const value = useMemo(() => ({ mode, setMode, tokens, isDark }), [mode, tokens, isDark]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useThemeTokens() {
  return useContext(ThemeCtx);
}
