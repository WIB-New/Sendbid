/**
 * SENDBID Theme — Navy Trust + Emerald Action.
 * Brand: Navy #022a6b (trust, banking) + Emerald #04d46f (CTA, success).
 * Typography: Playfair Display (titles, serif) + Montserrat (body, sans).
 */
export const colors = {
  primary: { base: "#022a6b", dark: "#011645", light: "#052080" },
  accent: { base: "#04d46f", dark: "#04ba28", light: "#5FE89F", biometric: "#04d46f" },
  // Gold tones for premium/loyalty states (kept tight with navy mood)
  gold: { base: "#D4AF37", dark: "#9A7C1F", light: "#F1D86A", soft: "#FAF1D2" },
  status: { success: "#04d46f", pending: "#F59E0B", error: "#EF4444", info: "#052080" },
  neutrals: {
    white: "#FFFFFF",
    background: "#F4F7FD",
    surface: "#FFFFFF",
    border: "#DEE5F2",
    borderStrong: "#BAC4DA",
    textPrimary: "#0A0E2E",
    textSecondary: "#4A5478",
    textTertiary: "#8B95B5",
  },
  gradients: {
    flooMoney: ["#022a6b", "#052080"] as [string, string],
    primary: ["#011645", "#022a6b"] as [string, string],
    success: ["#04ba28", "#04d46f"] as [string, string],
    premiumDark: ["#011645", "#022a6b"] as [string, string],
    splash: ["#011645", "#022a6b", "#052080"] as [string, string, string],
    imperial: ["#011645", "#022a6b", "#011645"] as [string, string, string],
    gold: ["#9A7C1F", "#D4AF37", "#F1D86A"] as [string, string, string],
  },
  overlays: {
    successSoft: "#DCFCE7",
    pendingSoft: "#FEF3C7",
    errorSoft: "#FEE2E2",
    infoSoft: "#DBEAFE",
    primarySoft: "#E2E8F5",
    accentSoft: "#DCFCE7",
    goldSoft: "#FAF1D2",
  },
};

export const spacing = { xs: 4, sm: 6, md: 10, lg: 14, xl: 20, xxl: 28, xxxl: 40 };
export const radii = { sm: 4, md: 8, lg: 12, xl: 16, xxl: 22, full: 9999 };

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

export const fontSize = { xs: 11, sm: 13, base: 15, lg: 17, xl: 19, xxl: 22, xxxl: 27, display: 32 };

export const shadows = {
  sm: { shadowColor: "#000A42", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2, elevation: 2 },
  md: { shadowColor: "#000A42", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 4 },
  lg: { shadowColor: "#000A42", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.16, shadowRadius: 20, elevation: 10 },
};
