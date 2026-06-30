/**
 * PAYBID Theme — Agent companion app.
 * Brand color: #994A26 (deep burnt sienna — per client brand guidelines).
 * Palette derived: shades tuned around HSL(19°, 60%, 37%).
 */

// Font family Inter pour PayBID
export const paybidFontFamily = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semiBold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  extraBold: "Inter_800ExtraBold",
};

export const paybidFontSize = {
  xs: 10,
  sm: 12,
  base: 14,
  md: 16,
  lg: 18,
  xl: 20,
  "2xl": 24,
  "3xl": 30,
  display: 36,
};

export const paybidColors = {
  primary: { base: "#994A26", dark: "#66301A", light: "#C17043" },
  accent: { base: "#1B2A5B", dark: "#0F1B40", light: "#3A4D8F" }, // SENDBID blue tie-in
  status: { success: "#10B981", pending: "#F59E0B", error: "#EF4444", info: "#3B82F6" },
  neutrals: {
    white: "#FFFFFF",
    background: "#FBF4EE",
    surface: "#FFFFFF",
    border: "#EED9C7",
    borderStrong: "#D2AE94",
    textPrimary: "#1F1208",
    textSecondary: "#6B5640",
    textTertiary: "#A89177",
  },
  gradients: {
    main: ["#994A26", "#C17043", "#66301A"] as [string, string, string],
    earnings: ["#66301A", "#994A26"] as [string, string],
    success: ["#059669", "#10B981"] as [string, string],
    splash: ["#3F1D0F", "#66301A", "#994A26"] as [string, string, string],
    hero: ["#3F1D0F", "#66301A", "#994A26"] as [string, string, string],
    imperial: ["#3F1D0F", "#66301A", "#994A26"] as [string, string, string],
  },
  overlays: {
    primarySoft: "#F6E1D2",
    accentSoft: "#E8EBF6",
    successSoft: "#E6F8F0",
    pendingSoft: "#FEF3C7",
    errorSoft: "#FEE2E2",
    infoSoft: "#DBEAFE",
  },
};
