/** Mapping pays (nom français) → devise locale */
export const COUNTRY_CURRENCY: Record<string, string> = {
  "France": "EUR",
  "Belgique": "EUR",
  "Allemagne": "EUR",
  "Espagne": "EUR",
  "Italie": "EUR",
  "Cameroun": "XAF",
  "Gabon": "XAF",
  "Congo (Brazzaville)": "XAF",
  "Tchad": "XAF",
  "Sénégal": "XOF",
  "Côte d'Ivoire": "XOF",
  "Mali": "XOF",
  "Burkina Faso": "XOF",
  "Togo": "XOF",
  "Bénin": "XOF",
  "Niger": "XOF",
  "Congo (RDC)": "CDF",
  "Guinée": "GNF",
  "Madagascar": "MGA",
  "Maroc": "MAD",
  "Tunisie": "TND",
  "Algérie": "DZD",
  "Royaume-Uni": "GBP",
  "États-Unis": "USD",
  "Canada": "CAD",
  "Suisse": "CHF",
};

/** Mapping code ISO 3166-1 alpha-2 → devise locale */
export const COUNTRY_TO_ISO: Record<string, string> = {
  "France": "FR", "Cameroun": "CM", "Sénégal": "SN", "Côte d'Ivoire": "CI", "Mali": "ML",
  "Gabon": "GA", "Congo (RDC)": "CD", "Congo (Brazzaville)": "CG", "Guinée": "GN",
  "Burkina Faso": "BF", "Togo": "TG", "Bénin": "BJ", "Niger": "NE", "Tchad": "TD",
  "Madagascar": "MG", "Belgique": "BE", "Suisse": "CH", "Canada": "CA", "États-Unis": "US",
  "Royaume-Uni": "GB", "Allemagne": "DE", "Espagne": "ES", "Italie": "IT", "Maroc": "MA",
  "Tunisie": "TN", "Algérie": "DZ",
};

export const ISO_CURRENCY: Record<string, string> = {
  "FR": "EUR", "BE": "EUR", "DE": "EUR", "ES": "EUR", "IT": "EUR",
  "CM": "XAF", "GA": "XAF", "CG": "XAF", "TD": "XAF",
  "SN": "XOF", "CI": "XOF", "ML": "XOF", "BF": "XOF", "TG": "XOF", "BJ": "XOF", "NE": "XOF",
  "CD": "CDF", "GN": "GNF", "MG": "MGA", "MA": "MAD", "TN": "TND", "DZ": "DZD",
  "GB": "GBP", "US": "USD", "CA": "CAD", "CH": "CHF",
};

/**
 * Retourne la devise locale du pays.
 * Accepte le nom français du pays ou le code ISO alpha-2.
 * Si le pays n'est pas trouvé, retourne la devise du wallet (fallback).
 */
export function getLocalCurrency(country?: string | null, walletCurrency?: string): string {
  if (!country) return walletCurrency || "EUR";
  const normalized = country.trim();
  if (COUNTRY_CURRENCY[normalized]) return COUNTRY_CURRENCY[normalized];
  if (ISO_CURRENCY[normalized.toUpperCase()]) return ISO_CURRENCY[normalized.toUpperCase()];
  return walletCurrency || "EUR";
}

/** Mapping code ISO alpha-2 → nom pays (pour les mappings basés sur nom) */
export const ISO_TO_COUNTRY_NAME: Record<string, string> = {
  "FR": "France", "BE": "Belgique", "DE": "Allemagne", "ES": "Espagne", "IT": "Italie",
  "CM": "Cameroun", "GA": "Gabon", "CG": "Congo (Brazzaville)", "TD": "Tchad",
  "SN": "Sénégal", "CI": "Côte d'Ivoire", "ML": "Mali", "BF": "Burkina Faso",
  "TG": "Togo", "BJ": "Bénin", "NE": "Niger", "CD": "Congo (RDC)", "GN": "Guinée",
  "MG": "Madagascar", "MA": "Maroc", "TN": "Tunisie", "DZ": "Algérie",
  "GB": "Royaume-Uni", "US": "États-Unis", "CA": "Canada", "CH": "Suisse",
};

/** Opérateurs Mobile Money disponibles par pays */
export const COUNTRY_MOMO_OPS: Record<string, string[]> = {
  "Cameroun":           ["MTN MoMo", "Orange Money"],
  "Gabon":              ["Airtel Money", "Moov Money"],
  "Congo (Brazzaville)":["MTN MoMo", "Airtel Money"],
  "Tchad":              ["Airtel Money", "Moov Money"],
  "Sénégal":            ["Wave", "Orange Money", "Free Money"],
  "Côte d'Ivoire":      ["Wave", "Orange Money", "MTN MoMo", "Moov Money"],
  "Mali":               ["Orange Money", "Moov Money"],
  "Burkina Faso":       ["Orange Money", "Moov Money"],
  "Togo":               ["Moov Money", "Tmoney"],
  "Bénin":              ["Moov Money", "MTN MoMo"],
  "Niger":              ["Airtel Money", "Moov Money"],
  "Congo (RDC)":        ["Airtel Money", "Orange Money", "M-Pesa"],
  "Guinée":             ["Orange Money", "MTN MoMo"],
  "Madagascar":         ["Mvola", "Orange Money", "Airtel Money"],
  "Maroc":              ["Orange Money", "Maroc Telecom Money"],
  "Tunisie":            ["Orange Money", "Ooredoo Money"],
  "Algérie":            ["Algérie Poste (CCP)"],
  "France":             ["Lydia", "PayLib"],
  "Belgique":           ["Payconiq"],
  "Royaume-Uni":        ["Monzo", "Revolut"],
  "États-Unis":         ["Venmo", "Zelle", "Cash App"],
  "Canada":             ["Interac e-Transfer"],
  "Suisse":             ["TWINT"],
  "Allemagne":          ["N26", "Klarna"],
  "Espagne":            ["Bizum"],
  "Italie":             ["Satispay"],
};

/** Méthodes de retrait disponibles par pays */
export const COUNTRY_PAYMENT_METHODS: Record<string, ("cash" | "bank" | "momo" | "paypal")[]> = {
  "France":             ["cash", "bank", "momo", "paypal"],
  "Belgique":           ["cash", "bank", "momo", "paypal"],
  "Allemagne":          ["cash", "bank", "momo", "paypal"],
  "Espagne":            ["cash", "bank", "momo", "paypal"],
  "Italie":             ["cash", "bank", "momo", "paypal"],
  "Suisse":             ["cash", "bank", "momo", "paypal"],
  "Royaume-Uni":        ["cash", "bank", "momo", "paypal"],
  "États-Unis":         ["cash", "bank", "momo", "paypal"],
  "Canada":             ["cash", "bank", "momo", "paypal"],
  "Cameroun":           ["cash", "momo", "bank", "paypal"],
  "Gabon":              ["cash", "momo", "bank", "paypal"],
  "Congo (Brazzaville)":["cash", "momo", "bank", "paypal"],
  "Tchad":              ["cash", "momo", "bank", "paypal"],
  "Sénégal":            ["cash", "momo", "bank", "paypal"],
  "Côte d'Ivoire":      ["cash", "momo", "bank", "paypal"],
  "Mali":               ["cash", "momo", "bank", "paypal"],
  "Burkina Faso":       ["cash", "momo", "bank", "paypal"],
  "Togo":               ["cash", "momo", "bank", "paypal"],
  "Bénin":              ["cash", "momo", "bank", "paypal"],
  "Niger":              ["cash", "momo", "bank", "paypal"],
  "Congo (RDC)":        ["cash", "momo", "bank", "paypal"],
  "Guinée":             ["cash", "momo", "bank", "paypal"],
  "Madagascar":         ["cash", "momo", "bank", "paypal"],
  "Maroc":              ["cash", "bank", "momo", "paypal"],
  "Tunisie":            ["cash", "bank", "momo", "paypal"],
  "Algérie":            ["cash", "bank", "momo", "paypal"],
};

function resolveCountryName(country?: string | null): string | undefined {
  if (!country) return undefined;
  const normalized = country.trim();
  if (COUNTRY_CURRENCY[normalized]) return normalized;
  return ISO_TO_COUNTRY_NAME[normalized.toUpperCase()];
}

/** Retourne les opérateurs MoMo disponibles pour un pays (accepte nom ou ISO) */
export function getMomoOps(country?: string | null): string[] {
  const name = resolveCountryName(country);
  if (name && COUNTRY_MOMO_OPS[name]) return COUNTRY_MOMO_OPS[name];
  return ["Wave", "Orange Money", "MTN MoMo", "Moov Money", "Airtel Money"];
}

/** Retourne les méthodes de retrait disponibles pour un pays (accepte nom ou ISO) */
export function getPaymentMethods(country?: string | null): ("cash" | "bank" | "momo" | "paypal")[] {
  const name = resolveCountryName(country);
  if (name && COUNTRY_PAYMENT_METHODS[name]) return COUNTRY_PAYMENT_METHODS[name];
  return ["cash", "bank", "momo", "paypal"];
}

/** Banques locales par pays */
export const COUNTRY_BANKS: Record<string, string[]> = {
  "Cameroun": [
    "Afriland First Bank",
    "BICEC (Banque Internationale du Cameroun pour l'Épargne et le Crédit)",
    "SGC (Société Générale Cameroun)",
    "SCB Cameroun (Société Commerciale de Banque)",
    "CCA Bank (Crédit Communautaire d'Afrique)",
    "UBA Cameroun (United Bank for Africa)",
    "Ecobank Cameroun",
    "BGFI Bank Cameroun",
    "CBC Bank (Commercial Bank of Cameroon)",
    "Citibank Cameroun",
    "NFC Bank (National Financial Credit Bank)",
    "Atlantic Bank Cameroun",
    "BDEAC",
  ],
  "Sénégal": [
    "CBAO Groupe Attijariwafa",
    "SGBS (Société Générale de Banques au Sénégal)",
    "Ecobank Sénégal",
    "BIS (Banque Islamique du Sénégal)",
    "UBA Sénégal",
    "Orabank Sénégal",
    "BHS (Banque de l'Habitat du Sénégal)",
    "BICIS (BNP Paribas)",
  ],
  "Côte d'Ivoire": [
    "SGCI (Société Générale Côte d'Ivoire)",
    "Ecobank Côte d'Ivoire",
    "BICICI (BNP Paribas)",
    "Orabank Côte d'Ivoire",
    "UBA Côte d'Ivoire",
    "BIAO-CI",
    "Versus Bank",
    "NSIA Banque",
  ],
  "Gabon": [
    "BGFI Bank Gabon",
    "Orabank Gabon",
    "UBA Gabon",
    "Ecobank Gabon",
    "BICI Gabon",
  ],
  "Congo (Brazzaville)": [
    "BGFI Bank Congo",
    "LCB Bank",
    "Ecobank Congo",
    "Crédit du Congo",
  ],
  "Congo (RDC)": [
    "Rawbank",
    "Equity BCDC",
    "UBA RDC",
    "Ecobank RDC",
    "TMB (Trust Merchant Bank)",
  ],
  "Maroc": [
    "Attijariwafa Bank",
    "Banque Populaire",
    "BMCE Bank (Bank of Africa)",
    "CIH Bank",
    "Crédit Agricole du Maroc",
    "Société Générale Maroc",
    "BMCI (BNP Paribas Maroc)",
    "Al Barid Bank",
  ],
  "Tunisie": [
    "Banque Nationale Agricole (BNA)",
    "BIAT",
    "Attijari Bank Tunisie",
    "STB (Société Tunisienne de Banque)",
    "BH Bank",
    "Amen Bank",
    "UIB (Union Internationale de Banques)",
  ],
  "Algérie": [
    "BNA (Banque Nationale d'Algérie)",
    "CPA (Crédit Populaire d'Algérie)",
    "BEA (Banque Extérieure d'Algérie)",
    "BADR (Banque de l'Agriculture)",
    "BDL (Banque de Développement Local)",
    "Société Générale Algérie",
    "BNP Paribas El Djazaïr",
  ],
  "France": [
    "BNP Paribas", "Société Générale", "Crédit Agricole", "LCL",
    "Caisse d'Épargne", "Banque Populaire", "Crédit Mutuel",
    "CIC", "La Banque Postale", "Boursorama", "Revolut", "N26",
  ],
  "Belgique": [
    "BNP Paribas Fortis", "ING Belgique", "KBC", "Belfius", "Crelan",
  ],
  "Royaume-Uni": [
    "Barclays", "HSBC UK", "Lloyds Bank", "NatWest", "Santander UK",
    "Monzo", "Starling Bank", "Revolut",
  ],
  "États-Unis": [
    "Chase (JPMorgan)", "Bank of America", "Wells Fargo", "Citibank",
    "U.S. Bank", "Capital One", "TD Bank",
  ],
  "Canada": [
    "RBC (Royal Bank of Canada)", "TD Canada Trust", "Scotiabank",
    "BMO (Banque de Montréal)", "CIBC", "Desjardins",
  ],
  "Allemagne": [
    "Deutsche Bank", "Commerzbank", "Sparkasse", "Volksbanken Raiffeisenbanken",
    "ING Allemagne", "Deutsche Kreditbank (DKB)", "N26", "Comdirect",
  ],
  "Espagne": [
    "Banco Santander", "BBVA", "CaixaBank", "Sabadell", "Bankinter",
    "Kutxabank", "Abanca", "Openbank",
  ],
  "Italie": [
    "UniCredit", "Intesa Sanpaolo", "Banca Monte dei Paschi di Siena",
    "Banco BPM", "UBI Banca", "Poste Italiane", "Deutsche Bank Italia",
  ],
  "Suisse": [
    "UBS", "Credit Suisse", "PostFinance", "Raiffeisen", "Zürcher Kantonalbank",
  ],
  "Chine": [
    "ICBC (Industrial and Commercial Bank of China)",
    "CCB (China Construction Bank)",
    "ABC (Agricultural Bank of China)",
    "Bank of China",
    "Postal Savings Bank of China",
    "China Merchants Bank",
    "WeChat Pay (Tencent)",
    "Alipay (Ant Group)",
  ],
  "Inde": [
    "State Bank of India (SBI)",
    "HDFC Bank",
    "ICICI Bank",
    "Axis Bank",
    "Kotak Mahindra Bank",
    "Bank of Baroda",
    "Punjab National Bank",
    "Union Bank of India",
  ],
  "Japon": [
    "Japan Post Bank",
    "MUFG Bank (Mitsubishi UFJ)",
    "SMBC (Sumitomo Mitsui)",
    "Mizuho Bank",
    "Resona Bank",
  ],
  "Brésil": [
    "Banco do Brasil",
    "Caixa Econômica Federal",
    "Bradesco",
    "Itaú Unibanco",
    "Santander Brasil",
    "Nubank",
  ],
  "Mexique": [
    "BBVA México",
    "Citibanamex",
    "Santander México",
    "Banorte",
    "HSBC México",
  ],
  "Émirats arabes unis": [
    "First Abu Dhabi Bank (FAB)",
    "Emirates NBD",
    "Abu Dhabi Commercial Bank (ADCB)",
    "Dubai Islamic Bank",
    "Mashreq Bank",
  ],
  "Arabie saoudite": [
    "Al Rajhi Bank",
    "National Commercial Bank (Alinma)",
    "Saudi National Bank (SNB)",
    "Riyad Bank",
    "Bank AlJazira",
  ],
  "Afrique du Sud": [
    "Standard Bank",
    "Absa Bank",
    "FirstRand (FNB)",
    "Nedbank",
    "Capitec Bank",
  ],
  "Nigeria": [
    "Zenith Bank",
    "Access Bank",
    "GTBank (Guaranty Trust Bank)",
    "UBA Nigeria",
    "First Bank of Nigeria",
    "Fidelity Bank",
    "Stanbic IBTC Bank",
  ],
  "Ghana": [
    "GCB Bank",
    "Ecobank Ghana",
    "Stanbic Bank Ghana",
    "Absa Ghana",
    "Fidelity Bank Ghana",
  ],
  "Kenya": [
    "Equity Bank Kenya",
    "KCB (Kenya Commercial Bank)",
    "Cooperative Bank",
    "Absa Kenya",
    "NCBA Bank",
  ],
  "Éthiopie": [
    "Commercial Bank of Ethiopia",
    "Awash Bank",
    "Dashen Bank",
    "Bank of Abyssinia",
  ],
};

/** Retourne la liste des banques pour un pays (accepte nom ou ISO) */
export function getBanks(country?: string | null): string[] {
  const name = resolveCountryName(country);
  if (name && COUNTRY_BANKS[name]) return COUNTRY_BANKS[name];
  return [];
}
