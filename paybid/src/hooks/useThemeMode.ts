/**
 * useThemeMode — Hook pour gérer le mode clair/sombre.
 * Utilise le store Zustand useAuth pour persister le thème choisi.
 * Fournit les couleurs adaptées au mode actif.
 */
import { useColorScheme } from "react-native";
import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ThemeMode = "light" | "dark" | "system";

const STORAGE_KEY = "sb_theme_mode";

interface ThemeStore {
  mode: ThemeMode;
  setMode: (m: ThemeMode) => Promise<void>;
  hydrated: boolean;
  hydrate: () => Promise<void>;
}

export const useThemeStore = create<ThemeStore>((set) => ({
  mode: "light",
  hydrated: false,
  setMode: async (m) => {
    try { await AsyncStorage.setItem(STORAGE_KEY, m); } catch {}
    set({ mode: m });
  },
  hydrate: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored && ["light", "dark", "system"].includes(stored)) {
        set({ mode: stored as ThemeMode, hydrated: true });
        return;
      }
    } catch {}
    set({ hydrated: true });
  },
}));

export const lightColors = {
  background: "#FFFFFF",
  surface: "#FFFFFF",
  banner: "#1A2B4C",
  textPrimary: "#1A2B4C",
  textSecondary: "#6B7280",
  textOnBanner: "#FFFFFF",
  textOnBannerSub: "rgba(255,255,255,0.7)",
  label: "#374151",
  placeholder: "#9CA3AF",
  border: "#E5E7EB",
  borderFocus: "#1A2B4C",
  button: "#1A2B4C",
  buttonText: "#FFFFFF",
  checkboxActive: "#00E676",
  checkboxInactive: "#D1D5DB",
  error: "#EF4444",
  link: "#1A2B4C",
  linkSecondary: "#6B7280",
  cardShadow: "#000",
  backBtnBg: "rgba(255,255,255,0.15)",
  inputBg: "#FFFFFF",
  statusBar: "light" as const,
};

export const darkColors = {
  background: "#0F1A2E",
  surface: "#1A2B4C",
  banner: "#0A1220",
  textPrimary: "#F9FAFB",
  textSecondary: "#9CA3AF",
  textOnBanner: "#FFFFFF",
  textOnBannerSub: "rgba(255,255,255,0.6)",
  label: "#D1D5DB",
  placeholder: "#6B7280",
  border: "#374151",
  borderFocus: "#60A5FA",
  button: "#2563EB",
  buttonText: "#FFFFFF",
  checkboxActive: "#00E676",
  checkboxInactive: "#4B5563",
  error: "#F87171",
  link: "#60A5FA",
  linkSecondary: "#9CA3AF",
  cardShadow: "#000",
  backBtnBg: "rgba(255,255,255,0.1)",
  inputBg: "#1E3A5F",
  statusBar: "light" as const,
};

export function useThemeColors() {
  const mode = useThemeStore((s) => s.mode);
  const systemScheme = useColorScheme();

  const resolved = mode === "system" ? (systemScheme || "light") : mode;
  const isDark = resolved === "dark";

  return {
    colors: isDark ? darkColors : lightColors,
    isDark,
    mode,
  };
}
