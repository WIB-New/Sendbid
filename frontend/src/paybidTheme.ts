/**
 * PAYBID Theme — Agent companion app.
 * Brand color: #54280f (deep coffee brown — per client brand guidelines).
 * Palette derived: monochromatic shades around the brand color.
 */
export const paybidColors = {
  primary: { base: "#FFA500", dark: "#F59E0B", light: "#FFC04D" },
  accent: { base: "#022a6b", dark: "#022a6b", light: "#3A4D8F" }, // SENDBID blue tie-in
  status: { success: "#FFA500", pending: "#F59E0B", error: "#EF4444", info: "#3B82F6" },
  neutrals: {
    white: "#FFFFFF",
    background: "#F8F2EC",
    surface: "#FFFFFF",
    border: "#E8D9CC",
    borderStrong: "#C9AE96",
    textPrimary: "#1F1208",
    textSecondary: "#6B5640",
    textTertiary: "#A89177",
  },
  gradients: {
    // Couleur unie #54280f partout (option b retenue par l'utilisateur)
    main: ["#54280f", "#54280f", "#54280f"] as [string, string, string],
    primary: ["#54280f", "#54280f"] as [string, string],
    earnings: ["#54280f", "#54280f"] as [string, string],
    success: ["#F59E0B", "#FFA500"] as [string, string],
    splash: ["#54280f", "#54280f", "#54280f"] as [string, string, string],
    hero: ["#54280f", "#54280f", "#54280f"] as [string, string, string],
  },
  overlays: {
    primarySoft: "#EFE0D2",
    accentSoft: "#E8EBF6",
    successSoft: "#E6F8F0",
    pendingSoft: "#FEF3C7",
    errorSoft: "#FEE2E2",
    infoSoft: "#DBEAFE",
  },
};
