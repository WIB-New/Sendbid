/**
 * Dark theme tokens — SENDBID Navy Trust + Emerald, version sombre premium.
 * Activé via /app/frontend/app/preferences.tsx (Thème: Sombre).
 *
 * IMPORTANT — Migration progressive :
 * Le dark mode global nécessite l'usage de `useThemeTokens()` (voir src/themeContext.tsx) dans chaque écran.
 * Une refonte complète des 100+ écrans dépasse le scope d'une seule session ; les composants principaux
 * (Screen, Button, Input, TText, FlooMoneyCard, Home, Wallet, Profile) reçoivent les tokens progressivement.
 */
export const darkColors = {
  primary: { base: "#3D52D5", dark: "#022a6b", light: "#5C70E9" },
  accent: { base: "#04d46f", dark: "#04ba28", light: "#5FE89F", biometric: "#04d46f" },
  gold: { base: "#D4AF37", dark: "#9A7C1F", light: "#F1D86A", soft: "#332C0F" },
  status: { success: "#04d46f", pending: "#F59E0B", error: "#F87171", info: "#5C70E9" },
  neutrals: {
    white: "#FFFFFF",
    background: "#0A0E2E",
    surface: "#15193D",
    border: "#2A3056",
    borderStrong: "#3A4070",
    textPrimary: "#F4F7FD",
    textSecondary: "#BAC4DA",
    textTertiary: "#8B95B5",
  },
  gradients: {
    flooMoney: ["#022a6b", "#052080"] as [string, string],
    primary: ["#022a6b", "#3D52D5"] as [string, string],
    success: ["#04ba28", "#04d46f"] as [string, string],
    premiumDark: ["#011645", "#022a6b"] as [string, string],
    splash: ["#011645", "#022a6b", "#3D52D5"] as [string, string, string],
    imperial: ["#011645", "#022a6b", "#3D52D5"] as [string, string, string],
    gold: ["#9A7C1F", "#D4AF37", "#F1D86A"] as [string, string, string],
  },
  overlays: {
    successSoft: "#0B3D24",
    pendingSoft: "#3D2F0A",
    errorSoft: "#3D1414",
    infoSoft: "#0F1B47",
    primarySoft: "#1A234F",
    accentSoft: "#0B3D24",
    goldSoft: "#332C0F",
  },
};
