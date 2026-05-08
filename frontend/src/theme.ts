/**
 * SENDBID Theme — Imperial Edition.
 * Brand: Imperial blue #00147E + white accent + gold highlights for premium states.
 * Typography: Playfair Display (titles, serif) + Montserrat (body, sans).
 */
export const colors = {
  primary: { base: "#00147E", dark: "#000A42", light: "#3D52D5" },
  accent: { base: "#FFFFFF", dark: "#F5F7FF", light: "#E8ECFF", biometric: "#3D52D5" },
  // Gold tones for premium/loyalty states (kept tight with imperial mood)
  gold: { base: "#D4AF37", dark: "#9A7C1F", light: "#F1D86A", soft: "#FAF1D2" },
  status: { success: "#10B981", pending: "#F59E0B", error: "#EF4444", info: "#3D52D5" },
  neutrals: {
    white: "#FFFFFF",
    background: "#F5F7FF",
    surface: "#FFFFFF",
    border: "#E0E5F5",
    borderStrong: "#C2CADD",
    textPrimary: "#0A0E2E",
    textSecondary: "#4A5478",
    textTertiary: "#8B95B5",
  },
  gradients: {
    flooMoney: ["#00147E", "#3D52D5"] as [string, string],
    primary: ["#000A42", "#00147E"] as [string, string],
    success: ["#059669", "#10B981"] as [string, string],
    premiumDark: ["#000A42", "#1A1F4E"] as [string, string],
    splash: ["#000A42", "#00147E", "#3D52D5"] as [string, string, string],
    imperial: ["#000A42", "#00147E", "#000A42"] as [string, string, string],
    gold: ["#9A7C1F", "#D4AF37", "#F1D86A"] as [string, string, string],
  },
  overlays: {
    successSoft: "#E6F8F0",
    pendingSoft: "#FEF3C7",
    errorSoft: "#FEE2E2",
    infoSoft: "#DBEAFE",
    primarySoft: "#E0E5F5",
    accentSoft: "#F5F7FF",
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
};

export const fontSize = { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, xxl: 24, xxxl: 30, display: 36 };

export const shadows = {
  sm: { shadowColor: "#000A42", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2, elevation: 2 },
  md: { shadowColor: "#000A42", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 4 },
  lg: { shadowColor: "#000A42", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.16, shadowRadius: 20, elevation: 10 },
};
