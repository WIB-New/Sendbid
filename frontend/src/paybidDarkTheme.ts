/**
 * PAYBID Dark Theme — variant sombre de paybidColors.
 *
 * Bascul\u00e9 automatiquement par useThemedPaybidColors() en fonction du mode global SENDBID.
 */
export const paybidDarkColors = {
  primary: { base: "#FFB733", dark: "#CC7A00", light: "#FFCC66" },
  accent: { base: "#3A4D8F", dark: "#022a6b", light: "#5B6FB8" },
  status: { success: "#04d46f", pending: "#F59E0B", error: "#F87171", info: "#3B82F6" },
  neutrals: {
    white: "#FFFFFF",
    background: "#0F0905",
    surface: "#1C140E",
    border: "#3B2A1C",
    borderStrong: "#5A3F2B",
    textPrimary: "#F8F2EC",
    textSecondary: "#C9AE96",
    textTertiary: "#8B7460",
  },
  gradients: {
    main: ["#3A1A08", "#54280f", "#6E380F"] as [string, string, string],
    earnings: ["#3A1A08", "#54280f"] as [string, string],
    success: ["#04ba28", "#04d46f"] as [string, string],
    splash: ["#1A0805", "#3A1A08", "#54280f"] as [string, string, string],
    hero: ["#1A0805", "#3A1A08", "#54280f"] as [string, string, string],
  },
  overlays: {
    primarySoft: "#3B2A1C",
    accentSoft: "#1A2548",
    successSoft: "#0B3D24",
    pendingSoft: "#3D2F0A",
    errorSoft: "#3D1414",
    infoSoft: "#0F1B47",
  },
};
