/**
 * Mapping indicatif téléphonique → code pays ISO-2.
 * Couvre les principaux corridors SENDBID (Afrique, Europe, Amérique, Asie, MENA).
 *
 * Utilisation :
 *   import { dialToCountry, countryToDial } from "../utils/dialCodes";
 *   const cc = dialToCountry("+221"); // "SN"
 *   const dial = countryToDial("CM"); // "+237"
 */

export const DIAL_TO_COUNTRY: Record<string, string> = {
  // === Afrique ===
  "+212": "MA", "+213": "DZ", "+216": "TN", "+218": "LY", "+220": "GM",
  "+221": "SN", "+222": "MR", "+223": "ML", "+224": "GN", "+225": "CI",
  "+226": "BF", "+227": "NE", "+228": "TG", "+229": "BJ", "+230": "MU",
  "+231": "LR", "+232": "SL", "+233": "GH", "+234": "NG", "+235": "TD",
  "+236": "CF", "+237": "CM", "+238": "CV", "+239": "ST", "+240": "GQ",
  "+241": "GA", "+242": "CG", "+243": "CD", "+244": "AO", "+245": "GW",
  "+248": "SC", "+249": "SD", "+250": "RW", "+251": "ET", "+252": "SO",
  "+253": "DJ", "+254": "KE", "+255": "TZ", "+256": "UG", "+257": "BI",
  "+258": "MZ", "+260": "ZM", "+261": "MG", "+262": "RE", "+263": "ZW",
  "+264": "NA", "+265": "MW", "+266": "LS", "+267": "BW", "+268": "SZ",
  "+27": "ZA", "+20": "EG",

  // === Europe ===
  "+33": "FR", "+34": "ES", "+39": "IT", "+44": "GB", "+49": "DE",
  "+31": "NL", "+32": "BE", "+351": "PT", "+41": "CH", "+43": "AT",
  "+45": "DK", "+46": "SE", "+47": "NO", "+48": "PL", "+30": "GR",
  "+353": "IE", "+358": "FI", "+352": "LU", "+356": "MT", "+357": "CY",
  "+420": "CZ", "+421": "SK", "+36": "HU", "+40": "RO", "+359": "BG",
  "+385": "HR", "+386": "SI", "+372": "EE", "+371": "LV", "+370": "LT",
  "+354": "IS",

  // === Amérique du Nord ===
  "+1": "US", "+52": "MX",

  // === Amérique du Sud ===
  "+54": "AR", "+55": "BR", "+56": "CL", "+57": "CO", "+58": "VE",
  "+51": "PE", "+593": "EC", "+595": "PY", "+598": "UY", "+591": "BO",

  // === Asie ===
  "+86": "CN", "+91": "IN", "+81": "JP", "+82": "KR", "+62": "ID",
  "+63": "PH", "+66": "TH", "+84": "VN", "+60": "MY", "+65": "SG",
  "+92": "PK", "+880": "BD", "+94": "LK", "+95": "MM", "+98": "IR",
  "+90": "TR",

  // === MENA ===
  "+966": "SA", "+971": "AE", "+972": "IL", "+961": "LB", "+962": "JO",
  "+963": "SY", "+964": "IQ", "+965": "KW", "+968": "OM", "+970": "PS",
  "+973": "BH", "+974": "QA", "+967": "YE",

  // === Océanie ===
  "+61": "AU", "+64": "NZ",
};

// Reverse map: ISO-2 → "+xxx" (auto-générée)
export const COUNTRY_TO_DIAL: Record<string, string> = Object.entries(DIAL_TO_COUNTRY).reduce(
  (acc, [d, cc]) => {
    // Prend la 1ère occurrence rencontrée (NA pour les pays partageant un préfixe, ex +1)
    if (!acc[cc]) acc[cc] = d;
    return acc;
  },
  {} as Record<string, string>,
);

// Liste triée des indicatifs (du + long au + court) pour matching greedy
const DIALS_BY_LENGTH = Object.keys(DIAL_TO_COUNTRY).sort((a, b) => b.length - a.length);

/**
 * Devine le code pays ISO-2 à partir d'un indicatif (ex: "+237" → "CM").
 * Renvoie `null` si non reconnu. Tolère les espaces.
 */
export function dialToCountry(dial: string): string | null {
  if (!dial) return null;
  const cleaned = "+" + String(dial).replace(/[^0-9]/g, "");
  if (cleaned.length < 2) return null;
  // Match greedy : on essaie d'abord les indicatifs longs (ex +212) puis courts (+1)
  for (const d of DIALS_BY_LENGTH) {
    if (cleaned.startsWith(d)) return DIAL_TO_COUNTRY[d];
  }
  return null;
}

export function countryToDial(country_code: string): string {
  return COUNTRY_TO_DIAL[String(country_code).toUpperCase()] || "";
}

/** Drapeau emoji depuis un code ISO-2 (ex "CM" → "🇨🇲"). */
export function flagEmoji(code: string): string {
  if (!code || code.length !== 2) return "";
  const base = 0x1f1e6;
  return String.fromCodePoint(...code.toUpperCase().split("").map((c) => base + c.charCodeAt(0) - 65));
}
