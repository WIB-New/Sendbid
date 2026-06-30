/**
 * Formatage monétaire global SENDBID/PAYBID — 12/06/2026 (item 2).
 *
 * Format européen UNIQUE pour TOUTE l'app :
 *   - Séparateur de milliers : « . »  (point)
 *   - Séparateur décimal     : « , »  (virgule)
 *   - 2 décimales fixes
 *   - Devise positionnée après le montant, séparée par un espace insécable
 *
 * Exemples :
 *   formatMoney(1500.5)            → "1.500,50 EUR"
 *   formatMoney(1500.5, "XOF")     → "1.500,50 XOF"
 *   formatMoney(0)                  → "0,00 EUR"
 *   formatMoney(1234567.89, "EUR")  → "1.234.567,89 EUR"
 *   formatMoney(2.5, "EUR", { withCurrency: false }) → "2,50"
 */
export type MoneyOpts = {
  withCurrency?: boolean;   // par défaut true
  decimals?: number;        // par défaut 2
  symbol?: boolean;         // si true, remplace "EUR" par "€", "USD" par "$"
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: "€",
  USD: "$",
  GBP: "£",
  XOF: "FCFA",
  XAF: "FCFA",
  CAD: "C$",
  CHF: "CHF",
  MAD: "DH",
};

export function formatMoney(amount: number | string | null | undefined, currency: string = "EUR", opts: MoneyOpts = {}): string {
  const withCurrency = opts.withCurrency !== false;
  const decimals = opts.decimals ?? 2;
  const useSymbol = opts.symbol === true;

  const n = Number(amount);
  if (!Number.isFinite(n)) {
    return withCurrency ? `0,00 ${useSymbol ? (CURRENCY_SYMBOLS[currency] || currency) : currency}` : "0,00";
  }

  // Format avec Intl en fr-FR — produit "1 500,50" (espace insécable)
  // Puis on convertit les espaces en points pour matcher la spec utilisateur "1.500,50"
  const raw = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: true,
  }).format(n);
  // Remplace TOUS les types d'espaces de groupement (espace normal, insécable U+00A0, fine U+202F) par "."
  const normalized = raw.replace(/[\s\u00A0\u202F]/g, ".");

  if (!withCurrency) return normalized;
  const cur = useSymbol ? (CURRENCY_SYMBOLS[currency] || currency) : currency;
  return `${normalized} ${cur}`;
}

/**
 * Masquage du montant (mode "œil fermé") : conserve la devise.
 */
export function maskMoney(currency: string = "EUR"): string {
  return `•••••• ${currency}`;
}
