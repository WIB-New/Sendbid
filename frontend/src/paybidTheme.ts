/**
 * PAYBID Theme — Agent companion app.
 * Brand color: #994A26 (deep burnt sienna — per client brand guidelines).
 * Palette derived: shades tuned around HSL(19°, 60%, 37%).
 */
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
