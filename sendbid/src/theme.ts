/**
 * SENDBID Theme — Mode Clair.
 * Brand: Bleu marine #1A2B4C + blanc pur + vert menthe pour accents.
 * Typography: Playfair Display (titles, serif) + Montserrat (body, sans).
 */
export const colors = {
  primary: { base: "#1A2B4C", dark: "#0F1A2E", light: "#2E4A7A" },
  accent: { base: "#FFFFFF", dark: "#F9FAFB", light: "#E6ECF8", biometric: "#2E4A7A" },
  mint: { base: "#00E676", dark: "#00C853", light: "#69F0AE" },
  // Gold tones for premium/loyalty states
  gold: { base: "#D4AF37", dark: "#9A7C1F", light: "#F1D86A", soft: "#FAF1D2" },
  status: { success: "#10B981", pending: "#F59E0B", error: "#EF4444", info: "#2E4A7A" },
  neutrals: {
    white: "#FFFFFF",
    background: "#FFFFFF",
    surface: "#FFFFFF",
    border: "#E5E7EB",
    borderStrong: "#D1D5DB",
    textPrimary: "#1A2B4C",
    textSecondary: "#6B7280",
    textTertiary: "#9CA3AF",
  },
  gradients: {
    flooMoney: ["#1A2B4C", "#2E4A7A"] as [string, string],
    primary: ["#0F1A2E", "#1A2B4C"] as [string, string],
    success: ["#059669", "#10B981"] as [string, string],
    premiumDark: ["#0F1A2E", "#1A2B4C"] as [string, string],
    splash: ["#FFFFFF", "#FFFFFF", "#FFFFFF"] as [string, string, string],
    imperial: ["#0F1A2E", "#1A2B4C", "#0F1A2E"] as [string, string, string],
    gold: ["#9A7C1F", "#D4AF37", "#F1D86A"] as [string, string, string],
  },
  overlays: {
    successSoft: "#E6F8F0",
    pendingSoft: "#FEF3C7",
    errorSoft: "#FEE2E2",
    infoSoft: "#DBEAFE",
    primarySoft: "#E6ECF8",
    accentSoft: "#F9FAFB",
    goldSoft: "#FAF1D2",
  },
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const radii = { sm: 4, md: 8, lg: 12, xl: 16, xxl: 24, full: 9999 };

/**
 * Typography:
 * - body / regular / medium / semiBold / bold use Montserrat (clean sans-serif)
 * - title / display use Playfair Display for an imperial / editorial feel
 * - extraBold reuses Montserrat black for strong CTAs
 */
export const fontFamily = {
  regular: "Montserrat_400Regular",
  medium: "Montserrat_500Medium",
  semiBold: "Montserrat_600SemiBold",
  bold: "Montserrat_700Bold",
  extraBold: "Montserrat_800ExtraBold",
  // Serif used for editorial headlines and large numbers
  serifRegular: "PlayfairDisplay_400Regular",
  serifSemiBold: "PlayfairDisplay_600SemiBold",
  serifBold: "PlayfairDisplay_700Bold",
  serifExtraBold: "PlayfairDisplay_800ExtraBold",
  serifBlack: "PlayfairDisplay_900Black",
  // Open Sans — clean body font for forms and auth pages
  openSansRegular: "OpenSans_400Regular",
  openSansMedium: "OpenSans_500Medium",
  openSansSemiBold: "OpenSans_600SemiBold",
  openSansBold: "OpenSans_700Bold",
  openSansExtraBold: "OpenSans_800ExtraBold",
};

export const fontSize = { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, xxl: 24, xxxl: 30, display: 36 };

export const shadows = {
  sm: { shadowColor: "#000A42", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2, elevation: 2 },
  md: { shadowColor: "#000A42", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 4 },
  lg: { shadowColor: "#000A42", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.16, shadowRadius: 20, elevation: 10 },
};
